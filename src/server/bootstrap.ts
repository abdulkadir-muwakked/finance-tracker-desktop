import { PrismaClient } from "../../generated/prisma-client";

export async function bootstrapDatabase() {
  const prisma = new PrismaClient();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Category (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      isDefault BOOLEAN NOT NULL DEFAULT false,
      isActive BOOLEAN NOT NULL DEFAULT true,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Currency (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT true,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS AppSetting (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Transaction" (
      id TEXT PRIMARY KEY,
      date DATETIME NOT NULL,
      description TEXT NOT NULL,
      person TEXT NOT NULL,
      amount REAL NOT NULL,
      currencyCode TEXT,
      type TEXT NOT NULL,
      notes TEXT,
      categoryId TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoryId) REFERENCES Category(id),
      FOREIGN KEY (currencyCode) REFERENCES Currency(code)
    )
  `);

  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO Category (id, name, description, isDefault, isActive) VALUES (?, ?, ?, ?, 1)`,
    "cat-mutfak",
    "Mutfak",
    "Mutfak ve sarf giderleri",
    1,
  );
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO Category (id, name, description, isDefault, isActive) VALUES (?, ?, ?, ?, 1)`,
    "cat-teknik",
    "Teknik",
    "Teknik ekipman ve servisler",
    1,
  );
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO Category (id, name, description, isDefault, isActive) VALUES (?, ?, ?, ?, 1)`,
    "cat-maaslar",
    "Maaşlar",
    "Personel maas odemeleri",
    1,
  );
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO Category (id, name, description, isDefault, isActive) VALUES (?, ?, ?, ?, 1)`,
    "cat-diger",
    "Diğer",
    "Diger isletme kalemleri",
    1,
  );

  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO Currency (code, name, symbol, isActive) VALUES (?, ?, ?, 1)`,
    "TRY",
    "Turk Lirasi",
    "₺",
  );
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO Currency (code, name, symbol, isActive) VALUES (?, ?, ?, 1)`,
    "USD",
    "US Dollar",
    "$",
  );
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO Currency (code, name, symbol, isActive) VALUES (?, ?, ?, 1)`,
    "EUR",
    "Euro",
    "€",
  );

  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO AppSetting (key, value) VALUES (?, ?)`,
    "workspaceName",
    "Ofis Finans Takip",
  );
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO AppSetting (key, value) VALUES (?, ?)`,
    "defaultCurrency",
    "TRY",
  );
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO AppSetting (key, value) VALUES (?, ?)`,
    "autoBackupIntervalHours",
    "168",
  );
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO AppSetting (key, value) VALUES (?, ?)`,
    "driveEnabled",
    "false",
  );
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO AppSetting (key, value) VALUES (?, ?)`,
    "driveFolderName",
    "Finans Takip Backups",
  );

  await prisma.$disconnect();
}
