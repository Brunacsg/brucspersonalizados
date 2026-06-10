const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const out = path.join(__dirname, 'assets', 'images');
if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

const defs = [
  { name: 'logo.jpg', w: 400, h: 120, color: '#2d1b4e' },
  { name: 'hero-banner.jpeg', w: 1600, h: 900, color: '#30103a' },
  { name: 'sobre.jpeg', w: 800, h: 540, color: '#3a2a62' },
];

const products = ['squeezes','copos-termicos','canecas','kits-corporativos','cadernos','ecobags','feiras','casamentos','formaturas','promocionais'];
for (const p of products) defs.push({ name: p + '.jpeg', w: 600, h: 400, color: '#4a2f7a' });
for (let i=1;i<=6;i++) defs.push({ name: `projeto-${i}.jpeg`, w: 600, h: 500, color: '#523675' });

async function make(d) {
  const file = path.join(out, d.name);
  const img = sharp({ create: { width: d.w, height: d.h, channels: 3, background: d.color } });
  await img.jpeg({ quality: 85 }).toFile(file);
  console.log('Written', d.name);
}

(async () => {
  for (const d of defs) {
    try { await make(d); } catch (e) { console.error('Err', d.name, e.message); }
  }
  console.log('Placeholders done.');
})();
