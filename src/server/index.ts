import fs from "fs";
import path from "path";
import { runAutomaticBackupIfDue, startAutomaticBackupScheduler } from "./backup";
import { bootstrapDatabase } from "./bootstrap";
import { startServer } from "./server";

async function bootstrap() {
  const appDataDir =
    process.env.APP_DATA_DIR ?? path.join(process.cwd(), "prisma");

  fs.mkdirSync(appDataDir, { recursive: true });

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${path.join(appDataDir, "finance-tracker.db")}`;
  }

  await bootstrapDatabase();
  await runAutomaticBackupIfDue();
  startAutomaticBackupScheduler();

  const port = Number(process.env.PORT ?? "3001");
  await startServer({
    port,
    databasePath: process.env.DATABASE_URL.replace("file:", ""),
  });

  console.log(`API hazir: http://127.0.0.1:${port}`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
