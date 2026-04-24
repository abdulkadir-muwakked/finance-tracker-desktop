const { app, BrowserWindow, dialog } = require("electron") as typeof import("electron");
const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");
const { bootstrapDatabase } = require("../src/server/bootstrap") as typeof import("../src/server/bootstrap");
const { runAutomaticBackupIfDue, startAutomaticBackupScheduler } = require("../src/server/backup") as typeof import("../src/server/backup");
const { startServer } = require("../src/server/server") as typeof import("../src/server/server");

let mainWindow: import("electron").BrowserWindow | null = null;

async function ensureDatabase(userDataPath: string) {
  const dbDir = path.join(userDataPath, "data");
  fs.mkdirSync(dbDir, { recursive: true });
  process.env.APP_DATA_DIR = dbDir;
  process.env.DATABASE_URL = `file:${path.join(dbDir, "finance-tracker.db")}`;
  await bootstrapDatabase();
}

async function createMainWindow() {
  const isDev = !app.isPackaged;
  const userDataPath = app.getPath("userData");

  await ensureDatabase(userDataPath);
  await runAutomaticBackupIfDue();

  if (isDev) {
    mainWindow = new BrowserWindow({
      width: 1560,
      height: 980,
      minWidth: 1280,
      minHeight: 820,
      backgroundColor: "#f4f5f0",
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
      },
    });

    await mainWindow.loadURL("http://127.0.0.1:3000/dashboard");
    return;
  }

  const staticDir = path.join(app.getAppPath(), "out");
  startAutomaticBackupScheduler();
  await startServer({
    port: 3001,
    staticDir,
    databasePath: process.env.DATABASE_URL?.replace("file:", ""),
  });

  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: "#f4f5f0",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  await mainWindow.loadURL("http://127.0.0.1:3001/dashboard");
}

app.whenReady().then(() => {
  createMainWindow().catch(async (error) => {
    console.error(error);
    await dialog.showMessageBox({
      type: "error",
      title: "Baslatma Hatasi",
      message: "Uygulama baslatilamadi.",
      detail: String(error),
    });
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow().catch(console.error);
  }
});
