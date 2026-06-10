const fs = require('fs');
const path = require('path');

const root = process.cwd();
const imagesDir = path.join(root, 'assets', 'images');
const indexPath = path.join(root, 'index.html');

function listImageFiles() {
  return fs.readdirSync(imagesDir).filter(f => !f.startsWith('.'));
}

function findReplacement(missing) {
  const base = path.basename(missing, path.extname(missing));
  const files = listImageFiles();
  // prefer jpg/jpeg, png, webp in that order — prefer JPEG for final site
  const order = ['.jpeg', '.jpg', '.png', '.webp', '.svg'];
  for (const ext of order) {
    const candidate = base + ext;
    if (files.includes(candidate)) return candidate;
  }
  // fallback: any file containing base
  for (const f of files) {
    if (f.includes(base)) return f;
  }
  return null;
}

function main() {
  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found');
    process.exit(1);
  }
  const html = fs.readFileSync(indexPath, 'utf8');
  const imagePattern = /assets\/images\/[A-Za-z0-9_\-\.]+/g;
  const refs = [...new Set(html.match(imagePattern) || [])];

  const files = listImageFiles();
  const missing = [];
  for (const ref of refs) {
    const fname = path.basename(ref);
    if (!files.includes(fname)) missing.push(fname);
  }

  if (missing.length === 0) {
    console.log('All referenced images exist. No changes needed.');
    return;
  }

  let newHtml = html;
  const changes = [];
  for (const miss of missing) {
    const repl = findReplacement(miss);
    if (repl) {
      const from = 'assets/images/' + miss;
      const to = 'assets/images/' + repl;
      const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      newHtml = newHtml.replace(re, to);
      changes.push({miss, repl});
    }
  }

  if (changes.length === 0) {
    console.log('No suitable replacements found for missing images:', missing);
    process.exit(0);
  }

  // backup
  fs.copyFileSync(indexPath, indexPath + '.bak');
  fs.writeFileSync(indexPath, newHtml, 'utf8');
  console.log('Updated index.html with the following replacements:');
  changes.forEach(c => console.log(`${c.miss} -> ${c.repl}`));
}

main();
