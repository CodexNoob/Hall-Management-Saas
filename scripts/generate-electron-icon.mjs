import fs from "node:fs";
import sharp from "sharp";

const sourceLogo = "public/images/branding/logo.png";
const outputIcon = "electron/assets/icon.ico";

const backgroundSvg = Buffer.from(`
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" rx="56" fill="#071427"/>
  <circle cx="128" cy="128" r="104" fill="#1f4d73" opacity="0.32"/>
</svg>
`);

const logoMask = await sharp(sourceLogo)
  .resize({
    width: 210,
    height: 210,
    fit: "inside"
  })
  .ensureAlpha()
  .extractChannel("alpha")
  .toBuffer();

const logoMetadata = await sharp(logoMask).metadata();
const logo = await sharp({
  create: {
    width: logoMetadata.width ?? 210,
    height: logoMetadata.height ?? 210,
    channels: 4,
    background: "#ffffff"
  }
})
  .joinChannel(logoMask)
  .png()
  .toBuffer();

const png = await sharp(backgroundSvg)
  .composite([
    {
      input: logo,
      gravity: "center"
    }
  ])
  .png()
  .toBuffer();

const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 0;
header[7] = 0;
header[8] = 0;
header[9] = 0;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);

fs.writeFileSync(outputIcon, Buffer.concat([header, png]));

console.log(`Generated ${outputIcon}`);
