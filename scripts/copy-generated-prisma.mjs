import fs from "fs";
import path from "path";

const sourceDir = path.resolve("generated");
const targetDir = path.resolve("dist-desktop", "generated");

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Generated Prisma client not found: ${sourceDir}`);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Generated Prisma client copied to: ${targetDir}`);
