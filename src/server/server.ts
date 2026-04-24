import cors from "cors";
import crypto from "crypto";
import express from "express";
import fs from "fs";
import path from "path";
import { prisma } from "./prisma";
import { createBackup, getBackupStatus, openBackupDirectory, updateBackupDirectory } from "./backup";
import { completeDriveOAuthFlow, disconnectDrive, getDriveConfig, startDriveOAuthFlow, updateDriveSettings } from "./drive";
import { categorySchema, settingsSchema, transactionFormSchema } from "../lib/schemas";
import { formatMonthYear } from "../lib/format";

type PeriodType = "daily" | "monthly" | "yearly" | "all";
const API_SESSION_COOKIE_NAME = "finans_api_session";
const SAME_MACHINE_ORIGINS = new Set([
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3001",
  "http://localhost:3001",
]);

function getMonthRange(monthInput?: string) {
  const today = new Date();
  const [year, month] = (monthInput ?? `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return { year, month, start, end };
}

function getPeriodRange(
  periodType: PeriodType,
  input: { day?: string; month?: string; year?: string },
) {
  const today = new Date();

  if (periodType === "all") {
    return {
      periodType,
      label: "Tum donemler",
      start: null,
      end: null,
    };
  }

  if (periodType === "daily") {
    const dayValue = input.day ?? today.toISOString().slice(0, 10);
    const [year, month, day] = dayValue.split("-").map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day + 1);

    return {
      periodType,
      label: new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(start),
      start,
      end,
    };
  }

  if (periodType === "yearly") {
    const year = Number(input.year ?? today.getFullYear());
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    return {
      periodType,
      label: `${year}`,
      start,
      end,
    };
  }

  const [year, month] = (input.month ?? `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return {
    periodType: "monthly" as const,
    label: formatMonthYear(year, month),
    start,
    end,
  };
}

function sumAmounts(items: Array<{ amount: number }>) {
  return items.reduce((total, item) => total + item.amount, 0);
}

function getCredentialsDirectory() {
  const appDataDir =
    process.env.APP_DATA_DIR ??
    (() => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl?.startsWith("file:")) {
        throw new Error("Kimlik bilgisi klasoru bulunamadi.");
      }

      return path.dirname(databaseUrl.replace("file:", ""));
    })();

  return path.join(appDataDir, "credentials");
}

function getApiSessionTokenPath() {
  return path.join(getCredentialsDirectory(), "api-session-token");
}

function getOrCreateApiSessionToken() {
  const tokenPath = getApiSessionTokenPath();

  if (process.env.LOCAL_API_SESSION_TOKEN) {
    return process.env.LOCAL_API_SESSION_TOKEN;
  }

  if (fs.existsSync(tokenPath)) {
    process.env.LOCAL_API_SESSION_TOKEN = fs.readFileSync(tokenPath, "utf-8").trim();
    return process.env.LOCAL_API_SESSION_TOKEN;
  }

  const token = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
  process.env.LOCAL_API_SESSION_TOKEN = token;
  return token;
}

function readCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

async function buildPeriodReport(
  periodType: PeriodType,
  input: { day?: string; month?: string; year?: string; categoryId?: string },
) {
  const range = getPeriodRange(periodType, input);

  const transactions = await prisma.transaction.findMany({
    where: {
      ...(range.start && range.end ? { date: { gte: range.start, lt: range.end } } : {}),
      ...(input.categoryId && input.categoryId !== "all" ? { categoryId: input.categoryId } : {}),
    },
    include: { category: true },
    orderBy: { date: "asc" },
  });

  const income = transactions.filter((item) => item.type === "income");
  const expense = transactions.filter((item) => item.type === "expense");

  const byCategoryMap = new Map<string, { income: number; expense: number }>();
  const trendMap = new Map<string, { income: number; expense: number }>();

  for (const item of transactions) {
    const categoryData = byCategoryMap.get(item.category.name) ?? { income: 0, expense: 0 };
    const date = new Date(item.date);

    let trendKey = "";
    if (periodType === "daily") {
      trendKey = `${`${date.getHours()}`.padStart(2, "0")}:00`;
    } else if (periodType === "yearly") {
      trendKey = new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(date);
    } else if (periodType === "all") {
      trendKey = `${date.getFullYear()}`;
    } else {
      trendKey = String(date.getDate()).padStart(2, "0");
    }

    const trendData = trendMap.get(trendKey) ?? { income: 0, expense: 0 };

    if (item.type === "income") {
      categoryData.income += item.amount;
      trendData.income += item.amount;
    } else {
      categoryData.expense += item.amount;
      trendData.expense += item.amount;
    }

    byCategoryMap.set(item.category.name, categoryData);
    trendMap.set(trendKey, trendData);
  }

  return {
    periodType,
    periodLabel: range.label,
    totals: {
      income: sumAmounts(income),
      expense: sumAmounts(expense),
      net: sumAmounts(income) - sumAmounts(expense),
    },
    byCategory: [...byCategoryMap.entries()].map(([category, values]) => ({
      category,
      income: values.income,
      expense: values.expense,
      net: values.income - values.expense,
    })),
    dailyTrend: [...trendMap.entries()].map(([label, values]) => ({
      label,
      income: values.income,
      expense: values.expense,
    })),
  };
}

export async function createApp(options?: { staticDir?: string; databasePath?: string }) {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || SAME_MACHINE_ORIGINS.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("CORS engellendi."));
      },
      credentials: true,
    }),
  );
  app.use(express.json());

  app.post("/api/session", (_request, response) => {
    const token = getOrCreateApiSessionToken();

    response.cookie(API_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/api",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    response.json({ success: true });
  });

  app.use("/api", (request, response, next) => {
    if (request.method === "OPTIONS" || request.path === "/session" || request.path === "/drive/oauth/callback") {
      next();
      return;
    }

    const sessionToken = readCookieValue(request.headers.cookie, API_SESSION_COOKIE_NAME);

    if (!sessionToken || sessionToken !== getOrCreateApiSessionToken()) {
      response.status(401).json({ message: "Yerel API oturumu dogrulanamadi." });
      return;
    }

    next();
  });

  async function buildSettingsResponse(workspaceName: string, defaultCurrency: string) {
    const [backupStatus, driveConfig] = await Promise.all([getBackupStatus(), getDriveConfig()]);

    return {
      workspaceName,
      defaultCurrency,
      databasePath: options?.databasePath ?? "",
      ...backupStatus,
      driveEnabled: driveConfig.enabled,
      driveClientId: driveConfig.clientId,
      driveFolderName: driveConfig.folderName,
      driveClientSecretConfigured: Boolean(driveConfig.clientSecret),
      driveConnectedEmail: driveConfig.connectedEmail,
      driveLastUploadAt: driveConfig.lastUploadAt,
      driveLastUploadFile: driveConfig.lastUploadFile,
      driveLastUploadStatus: driveConfig.lastUploadStatus,
      driveLastUploadError: driveConfig.lastUploadError,
    };
  }

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/currencies", async (_request, response) => {
    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });
    response.json(currencies);
  });

  app.get("/api/categories", async (_request, response) => {
    const categories = await prisma.category.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    response.json(categories);
  });

  app.post("/api/categories", async (request, response) => {
    const result = categorySchema.safeParse(request.body);
    if (!result.success) {
      return response.status(400).json({ message: result.error.issues[0]?.message });
    }

    const existing = await prisma.category.findUnique({
      where: { name: result.data.name.trim() },
    });

    if (existing) {
      return response.status(409).json({ message: "Bu kategori zaten mevcut." });
    }

    const category = await prisma.category.create({
      data: {
        name: result.data.name.trim(),
        description: result.data.description?.trim() || null,
      },
    });

    return response.status(201).json(category);
  });

  app.put("/api/categories/:id", async (request, response) => {
    const id = request.params.id;
    const payload = request.body as { name?: string; description?: string; isActive?: boolean };

    const current = await prisma.category.findUnique({ where: { id } });
    if (!current) {
      return response.status(404).json({ message: "Kategori bulunamadi." });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: payload.name?.trim() || current.name,
        description:
          payload.description !== undefined ? payload.description.trim() || null : current.description,
        isActive: payload.isActive ?? current.isActive,
      },
    });

    return response.json(category);
  });

  app.delete("/api/categories/:id", async (request, response) => {
    const id = request.params.id;
    const transactionCount = await prisma.transaction.count({ where: { categoryId: id } });

    if (transactionCount > 0) {
      const linkedTransactions = await prisma.transaction.findMany({
        where: { categoryId: id },
        select: {
          id: true,
          date: true,
          description: true,
          person: true,
          amount: true,
          type: true,
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 12,
      });

      return response.status(400).json({
        success: false,
        message: "Bu kategoriye bagli islemler var. Once islemleri tasiyin veya silin.",
        transactionCount,
        linkedTransactions,
      });
    }

    await prisma.category.delete({ where: { id } });
    return response.json({ success: true });
  });

  app.get("/api/transactions", async (request, response) => {
    const {
      periodType = "monthly",
      day,
      month,
      year,
      categoryId,
      type,
      query,
    } = request.query as Record<string, string | undefined>;
    const range = getPeriodRange(periodType as PeriodType, { day, month, year });

    const transactions = await prisma.transaction.findMany({
      where: {
        ...(range.start && range.end ? { date: { gte: range.start, lt: range.end } } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(type && type !== "all" ? { type } : {}),
        ...(query
          ? {
              OR: [
                { description: { contains: query } },
                { person: { contains: query } },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return response.json(transactions);
  });

  app.get("/api/transactions/:id", async (request, response) => {
    const transaction = await prisma.transaction.findUnique({
      where: { id: request.params.id },
      include: { category: true },
    });

    if (!transaction) {
      return response.status(404).json({ message: "Kayit bulunamadi." });
    }

    return response.json(transaction);
  });

  app.post("/api/transactions", async (request, response) => {
    const result = transactionFormSchema.safeParse(request.body);
    if (!result.success) {
      return response.status(400).json({ message: result.error.issues[0]?.message });
    }

    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(result.data.date),
        description: result.data.description.trim(),
        person: result.data.person.trim(),
        amount: result.data.amount,
        currencyCode: result.data.currencyCode || null,
        type: result.data.type,
        categoryId: result.data.categoryId,
        notes: result.data.notes || null,
      },
      include: { category: true },
    });

    return response.status(201).json(transaction);
  });

  app.put("/api/transactions/:id", async (request, response) => {
    const result = transactionFormSchema.safeParse(request.body);
    if (!result.success) {
      return response.status(400).json({ message: result.error.issues[0]?.message });
    }

    const transaction = await prisma.transaction.update({
      where: { id: request.params.id },
      data: {
        date: new Date(result.data.date),
        description: result.data.description.trim(),
        person: result.data.person.trim(),
        amount: result.data.amount,
        currencyCode: result.data.currencyCode || null,
        type: result.data.type,
        categoryId: result.data.categoryId,
        notes: result.data.notes || null,
      },
      include: { category: true },
    });

    return response.json(transaction);
  });

  app.delete("/api/transactions/:id", async (request, response) => {
    await prisma.transaction.delete({ where: { id: request.params.id } });
    return response.json({ success: true });
  });

  app.get("/api/dashboard", async (request, response) => {
    const range = getMonthRange(request.query.month as string | undefined);

    const [transactions, allTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          date: { gte: range.start, lt: range.end },
        },
        include: { category: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.transaction.findMany({
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    const income = transactions.filter((item) => item.type === "income");
    const expense = transactions.filter((item) => item.type === "expense");
    const overallIncome = allTransactions.filter((item) => item.type === "income");
    const overallExpense = allTransactions.filter((item) => item.type === "expense");

    const grouped = new Map<string, number>();
    for (const item of expense) {
      grouped.set(item.category.name, (grouped.get(item.category.name) ?? 0) + item.amount);
    }

    return response.json({
      monthLabel: formatMonthYear(range.year, range.month),
      totals: {
        income: sumAmounts(income),
        expense: sumAmounts(expense),
        net: sumAmounts(income) - sumAmounts(expense),
      },
      overallTotals: {
        income: sumAmounts(overallIncome),
        expense: sumAmounts(overallExpense),
        net: sumAmounts(overallIncome) - sumAmounts(overallExpense),
      },
      categoryDistribution: [...grouped.entries()]
        .map(([category, total]) => ({ category, total }))
        .sort((left, right) => right.total - left.total),
      recentTransactions: transactions.slice(0, 8),
    });
  });

  app.get("/api/reports/monthly", async (request, response) => {
    const year = Number(request.query.year);
    const month = Number(request.query.month);
    return response.json(await buildPeriodReport("monthly", { year: String(year), month: `${year}-${`${month}`.padStart(2, "0")}` }));
  });

  app.get("/api/reports/period", async (request, response) => {
    const {
      periodType = "monthly",
      day,
      month,
      year,
      categoryId,
    } = request.query as Record<string, string | undefined>;

    return response.json(
      await buildPeriodReport(periodType as PeriodType, {
        day,
        month,
        year,
        categoryId,
      }),
    );
  });

  app.get("/api/settings", async (_request, response) => {
    const settings = await prisma.appSetting.findMany();
    const map = new Map(settings.map((item) => [item.key, item.value]));

    return response.json(
      await buildSettingsResponse(
        map.get("workspaceName") ?? "Ofis Finans Takip",
        map.get("defaultCurrency") ?? "TRY",
      ),
    );
  });

  app.put("/api/settings", async (request, response) => {
    const result = settingsSchema.safeParse(request.body);
    if (!result.success) {
      return response.status(400).json({ message: result.error.issues[0]?.message });
    }

    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { key: "workspaceName" },
        update: { value: result.data.workspaceName.trim() },
        create: { key: "workspaceName", value: result.data.workspaceName.trim() },
      }),
      prisma.appSetting.upsert({
        where: { key: "defaultCurrency" },
        update: { value: result.data.defaultCurrency },
        create: { key: "defaultCurrency", value: result.data.defaultCurrency },
      }),
      prisma.appSetting.upsert({
        where: { key: "autoBackupIntervalHours" },
        update: { value: String(result.data.autoBackupIntervalHours) },
        create: { key: "autoBackupIntervalHours", value: String(result.data.autoBackupIntervalHours) },
      }),
      prisma.appSetting.upsert({
        where: { key: "driveEnabled" },
        update: { value: String(result.data.driveEnabled) },
        create: { key: "driveEnabled", value: String(result.data.driveEnabled) },
      }),
      prisma.appSetting.upsert({
        where: { key: "driveClientId" },
        update: { value: result.data.driveClientId?.trim() || "" },
        create: { key: "driveClientId", value: result.data.driveClientId?.trim() || "" },
      }),
      prisma.appSetting.upsert({
        where: { key: "driveFolderName" },
        update: { value: result.data.driveFolderName?.trim() || "Finans Takip Backups" },
        create: { key: "driveFolderName", value: result.data.driveFolderName?.trim() || "Finans Takip Backups" },
      }),
    ]);

    if (result.data.backupDirectory !== undefined) {
      await updateBackupDirectory(result.data.backupDirectory);
    }

    await updateDriveSettings({
      enabled: result.data.driveEnabled,
      clientId: result.data.driveClientId ?? "",
      clientSecret: result.data.driveClientSecret ?? "",
      folderName: result.data.driveFolderName ?? "",
    });

    return response.json(await buildSettingsResponse(result.data.workspaceName, result.data.defaultCurrency));
  });

  app.post("/api/drive/connect", async (_request, response) => {
    const result = await startDriveOAuthFlow();
    return response.json({ success: true, authUrl: result.authUrl });
  });

  app.get("/api/drive/oauth/callback", async (request, response) => {
    const code = request.query.code as string | undefined;
    const state = request.query.state as string | undefined;

    if (!code) {
      return response.status(400).send("<html><body><h2>Kod bulunamadi.</h2></body></html>");
    }

    try {
      await completeDriveOAuthFlow(code, state);
      return response.send(`
        <html>
          <body style="font-family: sans-serif; padding: 32px;">
            <h2>Google Drive baglantisi tamamlandi.</h2>
            <p>Bu pencereyi kapatip uygulamaya donebilirsiniz.</p>
          </body>
        </html>
      `);
    } catch (error) {
      return response.status(400).send(`
        <html>
          <body style="font-family: sans-serif; padding: 32px;">
            <h2>Google Drive baglantisi basarisiz oldu.</h2>
            <p>${error instanceof Error ? error.message : "Bilinmeyen hata"}</p>
          </body>
        </html>
      `);
    }
  });

  app.post("/api/drive/disconnect", async (_request, response) => {
    await disconnectDrive();

    const settings = await prisma.appSetting.findMany();
    const map = new Map(settings.map((item) => [item.key, item.value]));

    return response.json(
      await buildSettingsResponse(
        map.get("workspaceName") ?? "Ofis Finans Takip",
        map.get("defaultCurrency") ?? "TRY",
      ),
    );
  });

  app.post("/api/backups/run", async (_request, response) => {
    const backupStatus = await createBackup("manual");
    const settings = await prisma.appSetting.findMany();
    const map = new Map(settings.map((item) => [item.key, item.value]));

    return response.status(201).json({
      workspaceName: map.get("workspaceName") ?? "Ofis Finans Takip",
      defaultCurrency: map.get("defaultCurrency") ?? "TRY",
      databasePath: options?.databasePath ?? "",
      ...backupStatus,
    });
  });

  app.post("/api/backups/open", async (_request, response) => {
    const result = await openBackupDirectory();
    return response.json(result);
  });

  if (options?.staticDir) {
    app.use(express.static(options.staticDir, { extensions: ["html"] }));
    app.get("*", (request, response, next) => {
      if (request.path.startsWith("/api")) {
        return next();
      }

      const normalized = request.path === "/" ? "dashboard" : request.path.replace(/^\/+/, "");
      const filePath = path.join(options.staticDir!, `${normalized}.html`);
      return response.sendFile(filePath, (error) => {
        if (error) {
          response.sendFile(path.join(options.staticDir!, "dashboard.html"));
        }
      });
    });
  }

  return app;
}

export async function startServer(options: {
  port: number;
  staticDir?: string;
  databasePath?: string;
}) {
  const app = await createApp({
    staticDir: options.staticDir,
    databasePath: options.databasePath,
  });

  return new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const server = app.listen(options.port, "127.0.0.1", () => resolve(server));
  });
}
