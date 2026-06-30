// Generates a 1024x1024 App Store-compliant icon (RGB, no alpha) from the
// vector sprout mark, on a solid background matching the existing brand icon.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "plantet-app-icon-1024.png");

(async () => {
  // 1) Sample the existing icon's background (top-left pixel) for an exact match.
  const src = path.join(ROOT, "public", "plantet-app-icon.png");
  const { data } = await sharp(src)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [r, g, b] = data;
  const bg = `rgb(${r},${g},${b})`;

  // 2) Build a 1024 icon: solid bg + the white/sage sprout mark scaled up.
  //    Paths are from public/plantet-mark-white.svg (viewBox 0 0 96 96).
  const S = 1024 / 96; // scale factor
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${bg}"/>
  <g transform="scale(${S})">
    <g transform="translate(8 4)">
      <path d="M40 82 C 40 66 40 56 40 46" stroke="#F6F2E9" stroke-width="6" stroke-linecap="round" fill="none"/>
      <g transform="translate(40 58) rotate(38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#A8C19A"/></g>
      <g transform="translate(40 50) rotate(-38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#F6F2E9"/></g>
    </g>
  </g>
</svg>`;

  await sharp(Buffer.from(svg))
    .flatten({ background: bg }) // drop any alpha -> opaque
    .removeAlpha()
    .png()
    .toFile(OUT);

  const meta = await sharp(OUT).metadata();
  console.log(`Wrote ${OUT}`);
  console.log(`  ${meta.width}x${meta.height}, channels=${meta.channels}, hasAlpha=${meta.hasAlpha}, bg=${bg}`);
})();
