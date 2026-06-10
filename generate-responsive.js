const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

const imagesDir = path.join(__dirname, 'assets', 'images');
const sizes = [480, 768, 1200];

async function processFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) return;
  const name = path.basename(file, ext);
  const input = path.join(imagesDir, file);
  for (const size of sizes) {
    const outName = `${name}-${size}.jpeg`;
    const outPath = path.join(imagesDir, outName);
    await sharp(input)
      .resize({ width: size })
      .jpeg({ quality: 80 })
      .toFile(outPath);
    console.log('Written', outName);
  }
}

async function main() {
  const files = await fs.readdir(imagesDir);
  const targets = files.filter(f => ['.png', '.jpg', '.jpeg'].includes(path.extname(f).toLowerCase()) && !f.includes('-'));
  for (const f of targets) {
    try {
      await processFile(f);
    } catch (e) { console.error('Error', f, e.message); }
  }
  console.log('Responsive variants generated.');
}

main().catch(err => { console.error(err); process.exit(1); });
