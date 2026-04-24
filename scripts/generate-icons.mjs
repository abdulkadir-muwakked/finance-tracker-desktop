import fs from "fs";
import path from "path";
import pngToIco from "png-to-ico";

const buildDir = path.resolve("build");
const pngPath = path.join(buildDir, "icon.png");
const icoPath = path.join(buildDir, "icon.ico");

if (!fs.existsSync(pngPath)) {
  throw new Error(`icon.png bulunamadi: ${pngPath}`);
}

const icoBuffer = await pngToIco(pngPath);
fs.writeFileSync(icoPath, icoBuffer);

console.log(`ICO hazir: ${icoPath}`);
