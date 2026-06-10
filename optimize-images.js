const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

const imagesDir = path.join(__dirname, 'assets', 'images');

async function optimizeFile(file) {
  const full = path.join(imagesDir, file);
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.png') return;
  const name = path.basename(file, ext);
  try {
    // optimize PNG (overwrite)
    await sharp(full)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(path.join(imagesDir, `${name}.opt.png`));
    // replace original with optimized
    await fs.rename(path.join(imagesDir, `${name}.opt.png`), full);

    // also produce JPEG version for JPG-only workflow
    await sharp(full)
      .jpeg({ quality: 85 })
      .toFile(path.join(imagesDir, `${name}.jpeg`));

    console.log('Optimized and produced JPEG:', file);
  } catch (err) {
    console.error('Error optimizing', file, err.message);
  }
}

async function main() {
  const files = await fs.readdir(imagesDir);
  const pngs = files.filter(f => f.toLowerCase().endsWith('.png'));
  for (const f of pngs) {
    await optimizeFile(f);
  }
  console.log('Optimization complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
