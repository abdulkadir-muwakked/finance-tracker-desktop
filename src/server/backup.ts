import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { prisma } from "./prisma";
import { uploadBackupToDrive } from "./drive";

const BACKUP_RETENTION_COUNT = 5;
const DEFAULT_AUTO_BACKUP_INTERVAL_HOURS = 24 * 7;
const BACKUP_SCHEDULER_POLL_MS = 60 * 60 * 1000;
let backupScheduler: NodeJS.Timeout | null = null;

function getDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error("Veritabani yolu bulunamadi.");
  }

  return databaseUrl.replace("file:", "");
}

function getDefaultBackupDirectory() {
  return path.join(path.dirname(getDatabasePath()), "backups");
}

function formatBackupTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");

  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

function escapeSqlitePath(filePath: string) {
  return filePath.replace(/'/g, "''");
}

async function setAppSetting(key: string, value: string) {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function getConfiguredBackupDirectory() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "backupDirectory" },
  });

  return setting?.value?.trim() || getDefaultBackupDirectory();
}

async function getConfiguredAutoBackupIntervalHours() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "autoBackupIntervalHours" },
  });
  const parsed = Number(setting?.value ?? DEFAULT_AUTO_BACKUP_INTERVAL_HOURS);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_AUTO_BACKUP_INTERVAL_HOURS;
  }

  return Math.round(parsed);
}

async function getBackupFiles() {
  const backupDir = await getConfiguredBackupDirectory();
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs
    .readdirSync(backupDir)
    .filter((file) => file.endsWith(".db"))
    .map((file) => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);

      return {
        name: file,
        path: filePath,
        createdAt: stats.mtime,
      };
    })
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

async function pruneOldBackups() {
  const backups = await getBackupFiles();
  const stale = backups.slice(BACKUP_RETENTION_COUNT);

  for (const file of stale) {
    fs.unlinkSync(file.path);
  }
}

export async function createBackup(mode: "manual" | "auto" = "manual") {
  const databasePath = getDatabasePath();
  const backupDir = await getConfiguredBackupDirectory();

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });

  const backupName = `finance-tracker-backup-${formatBackupTimestamp()}.db`;
  const backupPath = path.join(backupDir, backupName);

  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);
  }

  await prisma.$executeRawUnsafe(`VACUUM INTO '${escapeSqlitePath(backupPath)}'`);

  await pruneOldBackups();

  const now = new Date().toISOString();

  await Promise.all([
    setAppSetting("lastBackupAt", now),
    setAppSetting("lastBackupFile", backupName),
    setAppSetting("lastBackupMode", mode),
  ]);

  await uploadBackupToDrive(backupPath, backupName, BACKUP_RETENTION_COUNT);

  return getBackupStatus();
}

export async function getBackupStatus() {
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: ["lastBackupAt", "lastBackupFile", "lastBackupMode", "backupDirectory"],
      },
    },
  });

  const map = new Map(settings.map((item) => [item.key, item.value]));
  const backupDirectory = map.get("backupDirectory")?.trim() || getDefaultBackupDirectory();
  const backups = await getBackupFiles();
  const autoBackupIntervalHours = await getConfiguredAutoBackupIntervalHours();

  return {
    backupDirectory,
    defaultBackupDirectory: getDefaultBackupDirectory(),
    backupRetentionCount: BACKUP_RETENTION_COUNT,
    autoBackupIntervalDays: Number((autoBackupIntervalHours / 24).toFixed(2)),
    autoBackupIntervalHours,
    backupCount: backups.length,
    lastBackupAt: map.get("lastBackupAt") ?? null,
    lastBackupFile: map.get("lastBackupFile") ?? null,
    lastBackupMode: map.get("lastBackupMode") ?? null,
  };
}

export async function runAutomaticBackupIfDue() {
  const status = await getBackupStatus();

  if (!status.lastBackupAt) {
    await createBackup("auto");
    return;
  }

  const lastBackupDate = new Date(status.lastBackupAt);
  const nextDueAt = new Date(lastBackupDate);
  nextDueAt.setHours(nextDueAt.getHours() + status.autoBackupIntervalHours);

  if (Date.now() >= nextDueAt.getTime()) {
    await createBackup("auto");
  }
}

export async function updateBackupDirectory(directory: string) {
  const normalized = directory.trim() || getDefaultBackupDirectory();

  fs.mkdirSync(normalized, { recursive: true });

  await setAppSetting("backupDirectory", normalized);

  return getBackupStatus();
}

export async function updateAutoBackupIntervalHours(hours: number) {
  const normalized = Math.max(1, Math.round(hours));
  await setAppSetting("autoBackupIntervalHours", String(normalized));
  return getBackupStatus();
}

export function startAutomaticBackupScheduler() {
  if (backupScheduler) {
    return;
  }

  backupScheduler = setInterval(() => {
    runAutomaticBackupIfDue().catch(console.error);
  }, BACKUP_SCHEDULER_POLL_MS);
}

export async function openBackupDirectory() {
  const backupDirectory = await getConfiguredBackupDirectory();
  fs.mkdirSync(backupDirectory, { recursive: true });

  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "explorer"
        : "xdg-open";

  const child = spawn(command, [backupDirectory], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return { success: true };
}
