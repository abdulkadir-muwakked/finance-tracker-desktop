import path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

type ParsedRow = {
  date: Date;
  description: string;
  person: string;
  amount: number;
  currencyCode: string;
  type: "income" | "expense";
  categoryName: string;
  notes: string;
};

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filePath = args.find((arg) => !arg.startsWith("--")) ?? "";

if (!filePath) {
  console.error("Kullanim: npm run import:excel -- <dosya-yolu> [--dry-run]");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(process.cwd(), "prisma", "finance-tracker.db")}`;
}

function excelDateToDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    return new Date(utcValue * 1000);
  }

  if (typeof value === "string" && value.trim()) {
    const text = value.trim();

    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
      return new Date(text);
    }

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
      const [day, month, year] = text.split(".").map(Number);
      return new Date(year, month - 1, day);
    }

    const asNumber = Number(text);
    if (!Number.isNaN(asNumber)) {
      return excelDateToDate(asNumber);
    }
  }

  return null;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCurrency(value: unknown) {
  const currency = normalizeText(value).toUpperCase();
  if (!currency || currency === "TL") return "TRY";
  return currency;
}

function pickSheetName(workbook: XLSX.WorkBook) {
  const candidates = workbook.SheetNames.filter((name) =>
    ["GİRİŞ-ÇIKIŞ", "Sayfa1"].includes(name),
  );

  if (!candidates.length) {
    return workbook.SheetNames[0];
  }

  const scored = candidates.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      range: 2,
      defval: "",
      raw: true,
    });

    const meaningfulCount = rows.filter((row) =>
      Object.entries(row).some(
        ([key, value]) =>
          ["TARİH", "İŞLEM TÜRÜ", "AÇIKLAMA", "GİRİŞ", "ÇIKIŞ", "GİRİŞ/ÇIKIŞ", "TUTAR"].includes(key) &&
          normalizeText(value) !== "",
      ),
    ).length;

    return { name, meaningfulCount };
  });

  scored.sort((left, right) => right.meaningfulCount - left.meaningfulCount);
  return scored[0].name;
}

function detectTransactionType(row: Record<string, unknown>) {
  const combinedDirection = normalizeText(row["GİRİŞ/ÇIKIŞ"]);
  if (combinedDirection === "GİRİŞ") return "income" as const;
  if (combinedDirection === "ÇIKIŞ") return "expense" as const;

  const incomeValue = Number(row["GİRİŞ"] ?? 0);
  const expenseValue = Number(row["ÇIKIŞ"] ?? 0);

  if (incomeValue > 0 && expenseValue <= 0) return "income" as const;
  if (expenseValue > 0 && incomeValue <= 0) return "expense" as const;

  return null;
}

function detectAmount(row: Record<string, unknown>, type: "income" | "expense") {
  const directAmount = Number(row["TUTAR"] ?? 0);
  if (directAmount > 0) return directAmount;

  const incomeValue = Number(row["GİRİŞ"] ?? 0);
  const expenseValue = Number(row["ÇIKIŞ"] ?? 0);

  return type === "income" ? incomeValue : expenseValue;
}

function buildCategoryName(transactionType: string) {
  const normalized = normalizeText(transactionType);
  return normalized || "Diğer";
}

function buildDescription(row: Record<string, unknown>) {
  const detail = normalizeText(row["AÇIKLAMA"]);
  const transactionType = normalizeText(row["İŞLEM TÜRÜ"]);

  if (detail && transactionType && detail !== transactionType) {
    return `${transactionType} - ${detail}`;
  }

  return detail || transactionType || "Excel aktarimi";
}

function parseRows(workbook: XLSX.WorkBook) {
  const sheetName = pickSheetName(workbook);
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: 2,
    defval: "",
    raw: true,
  });

  const parsed: ParsedRow[] = [];
  const skipped: Array<{ rowNumber: number; reason: string }> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 4;
    const transactionType = normalizeText(row["İŞLEM TÜRÜ"]);
    const hasMeaningfulData =
      normalizeText(row["TARİH"]) !== "" ||
      transactionType !== "" ||
      normalizeText(row["AÇIKLAMA"]) !== "" ||
      Number(row["TUTAR"] ?? 0) > 0 ||
      Number(row["GİRİŞ"] ?? 0) > 0 ||
      Number(row["ÇIKIŞ"] ?? 0) > 0;

    if (!hasMeaningfulData) {
      return;
    }

    const date = excelDateToDate(row["TARİH"]);
    const type = detectTransactionType(row);

    if (!date || Number.isNaN(date.getTime())) {
      skipped.push({ rowNumber, reason: "Gecersiz tarih" });
      return;
    }

    if (!type) {
      skipped.push({ rowNumber, reason: "Gelir/gider yonu anlasilmadi" });
      return;
    }

    const amount = detectAmount(row, type);
    if (!(amount > 0)) {
      skipped.push({ rowNumber, reason: "Tutar bulunamadi" });
      return;
    }

    const paymentMethod = normalizeText(row["ÖDEME ARACI"]);
    const person = normalizeText(row["MUHATAP İSMİ"]) || "Belirtilmedi";
    const currencyCode = normalizeCurrency(row["PARA BİRİMİ"]);
    const categoryName = buildCategoryName(transactionType);
    const description = buildDescription(row);
    const tlAmount = Number(row["TL KARŞILIĞI"] ?? 0);

    parsed.push({
      date,
      description,
      person,
      amount,
      currencyCode,
      type,
      categoryName,
      notes: [
        "Excel aktarimi",
        paymentMethod ? `Odeme araci: ${paymentMethod}` : "",
        transactionType ? `Islem turu: ${transactionType}` : "",
        tlAmount > 0 ? `TL karsiligi: ${tlAmount}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    });
  });

  return { parsed, skipped, sheetName };
}

function buildTransactionKey(item: {
  date: Date | string;
  description: string;
  person: string;
  amount: number;
  type: "income" | "expense" | string;
}) {
  const date =
    item.date instanceof Date
      ? item.date.toISOString().slice(0, 10)
      : new Date(item.date).toISOString().slice(0, 10);

  return [
    date,
    item.description.trim().toLowerCase(),
    item.person.trim().toLowerCase(),
    item.amount.toFixed(2),
    item.type,
  ].join("|");
}

async function ensureCurrencies(codes: string[]) {
  const defaults: Record<string, { name: string; symbol: string }> = {
    TRY: { name: "Turk Lirasi", symbol: "₺" },
    USD: { name: "US Dollar", symbol: "$" },
    EUR: { name: "Euro", symbol: "€" },
    GBP: { name: "British Pound", symbol: "£" },
  };

  for (const code of codes) {
    const meta = defaults[code] ?? { name: code, symbol: code };
    await prisma.currency.upsert({
      where: { code },
      update: { isActive: true, name: meta.name, symbol: meta.symbol },
      create: { code, isActive: true, name: meta.name, symbol: meta.symbol },
    });
  }
}

async function ensureCategories(names: string[]) {
  const categoryMap = new Map<string, string>();

  for (const name of names) {
    const category = await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
    categoryMap.set(name, category.id);
  }

  return categoryMap;
}

async function main() {
  const workbook = XLSX.readFile(filePath, {
    cellDates: false,
  });

  const { parsed, skipped, sheetName } = parseRows(workbook);

  const existingTransactions = await prisma.transaction.findMany({
    select: {
      date: true,
      description: true,
      person: true,
      amount: true,
      type: true,
    },
  });

  const existingKeys = new Set(existingTransactions.map(buildTransactionKey));
  const uniqueParsed = parsed.filter((item) => !existingKeys.has(buildTransactionKey(item)));

  const categoryNames = [...new Set(uniqueParsed.map((item) => item.categoryName))].sort((a, b) =>
    a.localeCompare(b, "tr"),
  );
  const currencyCodes = [...new Set(uniqueParsed.map((item) => item.currencyCode))].sort();

  console.log(`Kaynak dosya: ${filePath}`);
  console.log(`Kullanilan sayfa: ${sheetName}`);
  console.log(`Okunan satir: ${parsed.length}`);
  console.log(`Atlanan satir: ${skipped.length}`);
  console.log(`Yeni eklenecek satir: ${uniqueParsed.length}`);
  console.log(`Kategori sayisi: ${categoryNames.length}`);
  console.log(`Para birimleri: ${currencyCodes.join(", ")}`);

  if (skipped.length) {
    console.log("\nAtlanan ilk 10 satir:");
    for (const item of skipped.slice(0, 10)) {
      console.log(`- Satir ${item.rowNumber}: ${item.reason}`);
    }
  }

  console.log("\nOrnek ilk 10 kayit:");
  for (const item of uniqueParsed.slice(0, 10)) {
    console.log(
      JSON.stringify(
        {
          date: item.date.toISOString().slice(0, 10),
          type: item.type,
          amount: item.amount,
          currencyCode: item.currencyCode,
          category: item.categoryName,
          person: item.person,
          description: item.description,
        },
        null,
        2,
      ),
    );
  }

  if (dryRun) {
    return;
  }

  await ensureCurrencies(currencyCodes);
  const categoryMap = await ensureCategories(categoryNames);

  await prisma.transaction.createMany({
    data: uniqueParsed.map((item) => ({
      date: item.date,
      description: item.description,
      person: item.person,
      amount: item.amount,
      currencyCode: item.currencyCode,
      type: item.type,
      categoryId: categoryMap.get(item.categoryName)!,
      notes: item.notes,
    })),
  });

  console.log(`\nAktarim tamamlandi. Eklenen kayit sayisi: ${uniqueParsed.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
