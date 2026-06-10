const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const imgRegex = /<img\s+([^>]*?)src="(assets\/images\/([^"]+))"([^>]*)>/gi;
let match;
const replaced = new Set();

function makePicture(origSrc, filename, beforeAttrs, afterAttrs) {
  const ext = path.extname(filename).toLowerCase();
  const base = path.basename(filename, ext);
  const altMatch = (beforeAttrs + afterAttrs).match(/alt="([^"]*)"/i);
  const alt = altMatch ? altMatch[1] : '';
  const mime = (ext === '.png') ? 'image/png' : 'image/jpeg';
  const sizes = '(max-width: 480px) 480px, (max-width: 768px) 768px, 1200px';

  const webpSrcset = `assets/images/${base}-1200.webp 1200w, assets/images/${base}-768.webp 768w, assets/images/${base}-480.webp 480w`;
  const jpgSrcset = `assets/images/${base}-1200${ext} 1200w, assets/images/${base}-768${ext} 768w, assets/images/${base}-480${ext} 480w`;
  const fallback = `assets/images/${base}-1200${ext}`;

  return `
<picture>
  <source type="image/webp" srcset="${webpSrcset}" sizes="${sizes}">
  <source type="${mime}" srcset="${jpgSrcset}" sizes="${sizes}">
  <img src="${fallback}" alt="${alt}" loading="lazy" decoding="async" fetchpriority="low">
</picture>`;
}

const newHtml = html.replace(imgRegex, (full, beforeAttrs, src, filename, afterAttrs) => {
  // avoid replacing if already inside <picture>
  const prefix = html.slice(0, html.indexOf(full));
  const lastOpen = prefix.lastIndexOf('<picture');
  const lastClose = prefix.lastIndexOf('</picture>');
  if (lastOpen > lastClose) return full; // inside picture

  // find base files exist
  const base = path.basename(filename, path.extname(filename));
  const dir = path.join(__dirname, 'assets', 'images');
  const webp = path.join(dir, `${base}-1200.webp`);
  const lg = path.join(dir, `${base}-1200${path.extname(filename)}`);
  if (fs.existsSync(webp) && fs.existsSync(lg)) {
    replaced.add(filename);
    return makePicture(src, filename, beforeAttrs, afterAttrs);
  }
  return full;
});

fs.writeFileSync(indexPath + '.srcset.bak', html, 'utf8');
fs.writeFileSync(indexPath, newHtml, 'utf8');
console.log('Replaced images with picture where variants exist. Files changed:', Array.from(replaced));
