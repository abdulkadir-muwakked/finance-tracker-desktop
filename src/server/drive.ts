import fs from "fs";
import path from "path";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import { prisma } from "./prisma";

const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"];
const DEFAULT_DRIVE_FOLDER_NAME = "Finans Takip Backups";
const CALLBACK_BASE_URL = process.env.DRIVE_CALLBACK_BASE_URL ?? "http://127.0.0.1:3001";
const CALLBACK_PATH = "/api/drive/oauth/callback";
const SECURE_DRIVE_STORE_FILENAME = "drive-secrets.json";
let pendingAuthState: string | null = null;

type SecureDriveSecrets = {
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  expiryDate?: string;
};

type DriveConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  folderName: string;
  folderId: string | null;
  connectedEmail: string | null;
  refreshToken: string | null;
  accessToken: string | null;
  expiryDate: string | null;
  lastUploadAt: string | null;
  lastUploadFile: string | null;
  lastUploadStatus: string | null;
  lastUploadError: string | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Drive islemi basarisiz oldu.";
}

function isDriveNotFoundError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error ? Number((error as { code?: unknown }).code) : undefined;
  const message = getErrorMessage(error).toLowerCase();

  return code === 404 || message.includes("file not found") || message.includes("not found");
}

function getRedirectUri() {
  return `${CALLBACK_BASE_URL}${CALLBACK_PATH}`;
}

function getSecureStorePath() {
  const appDataDir =
    process.env.APP_DATA_DIR ??
    (() => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl?.startsWith("file:")) {
        throw new Error("Guvenli Drive saklama yolu bulunamadi.");
      }

      return path.dirname(databaseUrl.replace("file:", ""));
    })();

  return path.join(appDataDir, "credentials", SECURE_DRIVE_STORE_FILENAME);
}

function readSecureSecretsFile(): SecureDriveSecrets {
  const storePath = getSecureStorePath();
  if (!fs.existsSync(storePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(storePath, "utf-8")) as SecureDriveSecrets;
  } catch {
    return {};
  }
}

function writeSecureSecretsFile(data: SecureDriveSecrets) {
  const storePath = getSecureStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

async function removeLegacySecretSettings() {
  await prisma.appSetting.deleteMany({
    where: {
      key: {
        in: ["driveClientSecret", "driveRefreshToken", "driveAccessToken", "driveExpiryDate"],
      },
    },
  });
}

async function loadSecureDriveSecretsFromStore(publicMap: Map<string, string>): Promise<SecureDriveSecrets> {
  const fileSecrets = readSecureSecretsFile();
  if (fileSecrets.clientSecret || fileSecrets.refreshToken || fileSecrets.accessToken || fileSecrets.expiryDate) {
    return fileSecrets;
  }

  const legacySecrets: SecureDriveSecrets = {
    clientSecret: publicMap.get("driveClientSecret") ?? undefined,
    refreshToken: publicMap.get("driveRefreshToken") ?? undefined,
    accessToken: publicMap.get("driveAccessToken") ?? undefined,
    expiryDate: publicMap.get("driveExpiryDate") ?? undefined,
  };

  if (legacySecrets.clientSecret || legacySecrets.refreshToken || legacySecrets.accessToken || legacySecrets.expiryDate) {
    writeSecureSecretsFile(legacySecrets);
    await removeLegacySecretSettings();
    return legacySecrets;
  }

  return {};
}

async function getSettingsMap(keys: string[]) {
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: keys,
      },
    },
  });

  return new Map(settings.map((item) => [item.key, item.value]));
}

async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function removeSetting(key: string) {
  await prisma.appSetting.deleteMany({
    where: { key },
  });
}

export async function getDriveConfig(): Promise<DriveConfig> {
  const map = await getSettingsMap([
    "driveEnabled",
    "driveClientId",
    "driveFolderName",
    "driveFolderId",
    "driveConnectedEmail",
    "driveLastUploadAt",
    "driveLastUploadFile",
    "driveLastUploadStatus",
    "driveLastUploadError",
    "driveClientSecret",
    "driveRefreshToken",
    "driveAccessToken",
    "driveExpiryDate",
  ]);
  const secureSecrets = await loadSecureDriveSecretsFromStore(map);

  return {
    enabled: map.get("driveEnabled") === "true",
    clientId: map.get("driveClientId") ?? "",
    clientSecret: secureSecrets.clientSecret ?? "",
    folderName: map.get("driveFolderName")?.trim() || DEFAULT_DRIVE_FOLDER_NAME,
    folderId: map.get("driveFolderId") ?? null,
    connectedEmail: map.get("driveConnectedEmail") ?? null,
    refreshToken: secureSecrets.refreshToken ?? null,
    accessToken: secureSecrets.accessToken ?? null,
    expiryDate: secureSecrets.expiryDate ?? null,
    lastUploadAt: map.get("driveLastUploadAt") ?? null,
    lastUploadFile: map.get("driveLastUploadFile") ?? null,
    lastUploadStatus: map.get("driveLastUploadStatus") ?? null,
    lastUploadError: map.get("driveLastUploadError") ?? null,
  };
}

function createOAuthClient(config: DriveConfig) {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Google Drive istemci bilgileri eksik.");
  }

  return new google.auth.OAuth2(config.clientId, config.clientSecret, getRedirectUri());
}

async function getAuthorizedClients() {
  const config = await getDriveConfig();
  const oauth2Client = createOAuthClient(config);

  if (!config.refreshToken) {
    throw new Error("Google Drive hesabi bagli degil.");
  }

  oauth2Client.setCredentials({
    refresh_token: config.refreshToken,
    access_token: config.accessToken ?? undefined,
    expiry_date: config.expiryDate ? new Date(config.expiryDate).getTime() : undefined,
  });

  return {
    config,
    oauth2Client,
    drive: google.drive({ version: "v3", auth: oauth2Client }),
    oauth2: google.oauth2({ version: "v2", auth: oauth2Client }),
  };
}

async function findExistingFolderByName(drive: drive_v3.Drive, folderName: string) {
  const result = await drive.files.list({
    q: `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 10,
  });

  return result.data.files?.[0]?.id ?? null;
}

async function ensureDriveFolder() {
  const { config, drive } = await getAuthorizedClients();

  if (config.folderId) {
    try {
      const existing = await drive.files.get({
        fileId: config.folderId,
        fields: "id, name",
      });

      if (existing.data.id) {
        return existing.data.id;
      }
    } catch {
      await removeSetting("driveFolderId");
    }
  }

  const existingFolderId = await findExistingFolderByName(drive, config.folderName);
  if (existingFolderId) {
    await setSetting("driveFolderId", existingFolderId);
    return existingFolderId;
  }

  const created = await drive.files.create({
    requestBody: {
      name: config.folderName,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  if (!created.data.id) {
    throw new Error("Google Drive klasoru olusturulamadi.");
  }

  await setSetting("driveFolderId", created.data.id);
  return created.data.id;
}

async function resetStoredDriveFolder() {
  await removeSetting("driveFolderId");
}

async function updateUploadStatus(status: {
  lastUploadAt?: string | null;
  lastUploadFile?: string | null;
  lastUploadStatus?: string | null;
  lastUploadError?: string | null;
}) {
  const entries = Object.entries(status).filter(([, value]) => value !== undefined);
  await Promise.all(
    entries.map(([key, value]) =>
      value === null ? removeSetting(`drive${key.charAt(0).toUpperCase()}${key.slice(1)}`) : setSetting(`drive${key.charAt(0).toUpperCase()}${key.slice(1)}`, String(value)),
    ),
  );
}

async function pruneRemoteBackups(drive: drive_v3.Drive, folderId: string, keepCount: number) {
  const files = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, createdTime)",
    orderBy: "createdTime desc",
    pageSize: 100,
  });

  const stale = (files.data.files ?? []).slice(keepCount);

  await Promise.all(
    stale
      .filter((file) => file.id)
      .map(async (file) => {
        try {
          await drive.files.delete({ fileId: file.id! });
        } catch (error) {
          if (!isDriveNotFoundError(error)) {
            throw error;
          }
        }
      }),
  );
}

async function uploadBackupOnce(localFilePath: string, fileName: string) {
  const { drive } = await getAuthorizedClients();
  const folderId = await ensureDriveFolder();

  await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: "application/octet-stream",
      body: fs.createReadStream(localFilePath),
    },
    fields: "id",
  });

  return { drive, folderId };
}

export async function uploadBackupToDrive(localFilePath: string, fileName: string, keepCount: number) {
  const driveConfig = await getDriveConfig();

  if (!driveConfig.enabled || !driveConfig.refreshToken) {
    return {
      skipped: true,
      reason: "Drive yedekleme kapali veya baglanti yok.",
    };
  }

  try {
    let uploadResult;

    try {
      uploadResult = await uploadBackupOnce(localFilePath, fileName);
    } catch (error) {
      if (!isDriveNotFoundError(error)) {
        throw error;
      }

      await resetStoredDriveFolder();
      uploadResult = await uploadBackupOnce(localFilePath, fileName);
    }

    await pruneRemoteBackups(uploadResult.drive, uploadResult.folderId, keepCount);
    await updateUploadStatus({
      lastUploadAt: new Date().toISOString(),
      lastUploadFile: fileName,
      lastUploadStatus: "success",
      lastUploadError: null,
    });

    return { skipped: false, success: true };
  } catch (error) {
    const message = getErrorMessage(error);
    await updateUploadStatus({
      lastUploadStatus: "error",
      lastUploadError: message,
    });
    return { skipped: false, success: false, error: message };
  }
}

export async function updateDriveSettings(input: {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  folderName: string;
}) {
  if (input.clientSecret.trim()) {
    const currentSecrets = readSecureSecretsFile();
    writeSecureSecretsFile({
      ...currentSecrets,
      clientSecret: input.clientSecret.trim(),
    });
  }

  await Promise.all([
    setSetting("driveEnabled", String(input.enabled)),
    setSetting("driveClientId", input.clientId.trim()),
    setSetting("driveFolderName", input.folderName.trim() || DEFAULT_DRIVE_FOLDER_NAME),
  ]);

  return getDriveConfig();
}

export async function startDriveOAuthFlow() {
  const config = await getDriveConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error("Once Google Client ID ve Google Client Secret alanlarini doldurup ayarlari kaydedin.");
  }

  const oauth2Client = createOAuthClient(config);

  pendingAuthState = Math.random().toString(36).slice(2);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent select_account",
    scope: DRIVE_SCOPE,
    state: pendingAuthState,
  });

  return { authUrl };
}

export async function completeDriveOAuthFlow(code: string, state?: string | null) {
  const config = await getDriveConfig();

  if (pendingAuthState && state !== pendingAuthState) {
    throw new Error("Google Drive yetkilendirme durumu dogrulanamadi.");
  }

  const oauth2Client = createOAuthClient(config);
  const { tokens } = await oauth2Client.getToken(code);
  const currentSecrets = readSecureSecretsFile();

  writeSecureSecretsFile({
    ...currentSecrets,
    clientSecret: config.clientSecret,
    refreshToken: tokens.refresh_token ?? config.refreshToken ?? undefined,
    accessToken: tokens.access_token ?? undefined,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
  });

  oauth2Client.setCredentials(tokens);
  let connectedEmail = config.connectedEmail ?? "";

  try {
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const about = await drive.about.get({
      fields: "user(emailAddress)",
    });
    connectedEmail = about.data.user?.emailAddress ?? connectedEmail;
  } catch {
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const me = await oauth2.userinfo.get({
        auth: oauth2Client,
      });
      connectedEmail = me.data.email ?? connectedEmail;
    } catch {
      connectedEmail = connectedEmail || "Baglandi";
    }
  }

  await Promise.all([
    setSetting("driveConnectedEmail", connectedEmail),
    setSetting("driveLastUploadStatus", "connected"),
    removeSetting("driveLastUploadError"),
  ]);

  pendingAuthState = null;

  return getDriveConfig();
}

export async function disconnectDrive() {
  const config = await getDriveConfig();
  const currentSecrets = readSecureSecretsFile();

  if (config.clientId && config.clientSecret && (config.refreshToken || config.accessToken)) {
    try {
      const oauth2Client = createOAuthClient(config);

      if (config.refreshToken) {
        await oauth2Client.revokeToken(config.refreshToken);
      }

      if (config.accessToken) {
        await oauth2Client.revokeToken(config.accessToken);
      }
    } catch {
      // Revoke can fail if the token is already invalid or expired.
      // Local cleanup should still continue.
    }
  }

  writeSecureSecretsFile({
    ...currentSecrets,
    refreshToken: undefined,
    accessToken: undefined,
    expiryDate: undefined,
  });

  pendingAuthState = null;

  await Promise.all([
    removeSetting("driveConnectedEmail"),
    removeSetting("driveFolderId"),
    removeSetting("driveLastUploadAt"),
    removeSetting("driveLastUploadFile"),
    removeSetting("driveLastUploadStatus"),
    removeSetting("driveLastUploadError"),
  ]);

  return getDriveConfig();
}
