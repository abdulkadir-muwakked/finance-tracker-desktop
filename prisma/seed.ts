import { PrismaClient } from "@prisma/client";
import path from "path";
import { bootstrapDatabase } from "../src/server/bootstrap";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(process.cwd(), "prisma", "finance-tracker.db")}`;
}

const prisma = new PrismaClient();

async function main() {
  await bootstrapDatabase();

  const defaultCategories = [
    { name: "Mutfak", isDefault: true, description: "Mutfak ve sarf giderleri" },
    { name: "Teknik", isDefault: true, description: "Teknik ekipman ve servisler" },
    { name: "Maaşlar", isDefault: true, description: "Personel maas odemeleri" },
    { name: "Diğer", isDefault: true, description: "Diger isletme kalemleri" },
  ];

  const currencies = [
    { code: "TRY", name: "Turk Lirasi", symbol: "₺" },
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
  ];

  for (const category of defaultCategories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {
        description: category.description,
        isDefault: true,
        isActive: true,
      },
      create: category,
    });
  }

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {
        name: currency.name,
        symbol: currency.symbol,
        isActive: true,
      },
      create: currency,
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "workspaceName" },
    update: {},
    create: {
      key: "workspaceName",
      value: "Ofis Finans Takip",
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "defaultCurrency" },
    update: {},
    create: {
      key: "defaultCurrency",
      value: "TRY",
    },
  });

  const transactionCount = await prisma.transaction.count();

  if (transactionCount > 0) {
    return;
  }

  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((item) => [item.name, item.id]));

  const sampleTransactions = [
    {
      date: new Date("2026-03-02"),
      description: "Mart kira katkisi",
      person: "Muhasebe",
      amount: 32000,
      currencyCode: "TRY",
      type: "income",
      categoryId: categoryMap.get("Diğer")!,
    },
    {
      date: new Date("2026-03-04"),
      description: "Mutfak erzak alimi",
      person: "Ayse",
      amount: 4650,
      currencyCode: "TRY",
      type: "expense",
      categoryId: categoryMap.get("Mutfak")!,
    },
    {
      date: new Date("2026-03-09"),
      description: "Yazici toner alimi",
      person: "Mert",
      amount: 2850,
      currencyCode: "TRY",
      type: "expense",
      categoryId: categoryMap.get("Teknik")!,
    },
    {
      date: new Date("2026-03-28"),
      description: "Mart maas odemesi",
      person: "Insan Kaynaklari",
      amount: 185000,
      currencyCode: "TRY",
      type: "expense",
      categoryId: categoryMap.get("Maaşlar")!,
    },
    {
      date: new Date("2026-04-03"),
      description: "Nisan tahsilati",
      person: "Muhasebe",
      amount: 35500,
      currencyCode: "TRY",
      type: "income",
      categoryId: categoryMap.get("Diğer")!,
    },
    {
      date: new Date("2026-04-05"),
      description: "Kahve ve ofis mutfagi",
      person: "Selin",
      amount: 3925,
      currencyCode: "TRY",
      type: "expense",
      categoryId: categoryMap.get("Mutfak")!,
    },
    {
      date: new Date("2026-04-11"),
      description: "Laptop sarj adaptorleri",
      person: "Okan",
      amount: 6180,
      currencyCode: "TRY",
      type: "expense",
      categoryId: categoryMap.get("Teknik")!,
    },
    {
      date: new Date("2026-04-26"),
      description: "Nisan maas odemesi",
      person: "Insan Kaynaklari",
      amount: 188500,
      currencyCode: "TRY",
      type: "expense",
      categoryId: categoryMap.get("Maaşlar")!,
    },
  ];

  await prisma.transaction.createMany({
    data: sampleTransactions,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
