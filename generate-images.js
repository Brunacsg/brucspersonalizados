const fs = require('fs');
const path = require('path');
const { Jimp, rgbaToInt, intToRGBA } = require('jimp');
const sharp = require('sharp');

const outputDir = path.join(__dirname, 'assets', 'images');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const colors = {
  purple: rgbaToInt(45, 27, 78, 255),
  lightPurple: rgbaToInt(108, 52, 131, 255),
  white: rgbaToInt(255, 255, 255, 255),
  black: rgbaToInt(0, 0, 0, 255),
  gray: rgbaToInt(230, 230, 230, 255),
  gray2: rgbaToInt(180, 180, 180, 255),
};

async function createGradient(width, height, startColor, endColor) {
  const image = new Jimp({ width, height });
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const r = Math.round((1 - t) * startColor.r + t * endColor.r);
    const g = Math.round((1 - t) * startColor.g + t * endColor.g);
    const b = Math.round((1 - t) * startColor.b + t * endColor.b);
    image.scan(0, y, width, 1, function(x, yy, idx) {
      this.bitmap.data[idx + 0] = r;
      this.bitmap.data[idx + 1] = g;
      this.bitmap.data[idx + 2] = b;
      this.bitmap.data[idx + 3] = 255;
    });
  }
  return image;
}

function drawRoundedRect(image, x, y, w, h, radius, color) {
  const rgba = intToRGBA(color);
  const circle = new Jimp({ width: radius * 2, height: radius * 2, color: 0x00000000 });
  circle.scan(0, 0, radius * 2, radius * 2, function(cx, cy, idx) {
    const dx = cx - radius;
    const dy = cy - radius;
    if (dx * dx + dy * dy <= radius * radius) {
      this.bitmap.data[idx + 0] = rgba.r;
      this.bitmap.data[idx + 1] = rgba.g;
      this.bitmap.data[idx + 2] = rgba.b;
      this.bitmap.data[idx + 3] = rgba.a;
    }
  });

  image.composite(circle, x, y);
  image.composite(circle, x + w - radius * 2, y);
  image.composite(circle, x, y + h - radius * 2);
  image.composite(circle, x + w - radius * 2, y + h - radius * 2);
  image.scan(x + radius, y, w - 2 * radius, h, function(px, py, idx) {
    this.bitmap.data[idx + 0] = rgba.r;
    this.bitmap.data[idx + 1] = rgba.g;
    this.bitmap.data[idx + 2] = rgba.b;
    this.bitmap.data[idx + 3] = rgba.a;
  });
  image.scan(x, y + radius, radius, h - 2 * radius, function(px, py, idx) {
    this.bitmap.data[idx + 0] = rgba.r;
    this.bitmap.data[idx + 1] = rgba.g;
    this.bitmap.data[idx + 2] = rgba.b;
    this.bitmap.data[idx + 3] = rgba.a;
  });
  image.scan(x + w - radius, y + radius, radius, h - 2 * radius, function(px, py, idx) {
    this.bitmap.data[idx + 0] = rgba.r;
    this.bitmap.data[idx + 1] = rgba.g;
    this.bitmap.data[idx + 2] = rgba.b;
    this.bitmap.data[idx + 3] = rgba.a;
  });
}

function drawCircle(image, cx, cy, radius, color, opacity = 1) {
  const rgba = intToRGBA(color);
  image.scan(cx - radius, cy - radius, radius * 2, radius * 2, function(x, y, idx) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= radius * radius) {
      this.bitmap.data[idx + 0] = rgba.r;
      this.bitmap.data[idx + 1] = rgba.g;
      this.bitmap.data[idx + 2] = rgba.b;
      this.bitmap.data[idx + 3] = Math.round(rgba.a * opacity);
    }
  });
}

async function productCard(name, filename) {
  const width = 600;
  const height = 400;
  const base = await createGradient(width, height, {r: 42, g: 20, b: 61}, {r: 108, g: 52, b: 131});
  const overlay = new Jimp({ width, height, color: rgbaToInt(0, 0, 0, 102) });
  base.composite(overlay, 0, 0);
  drawRoundedRect(base, 80, 90, 440, 220, 30, colors.white);
  drawRoundedRect(base, 110, 110, 120, 180, 20, colors.purple);
  drawRoundedRect(base, 370, 130, 120, 140, 20, colors.lightPurple);
  drawCircle(base, 240, 200, 60, colors.lightPurple, 0.35);
  drawCircle(base, 430, 190, 48, colors.purple, 0.35);
  await saveImage(base, filename);
}

async function heroBanner() {
  const width = 1600;
  const height = 900;
  const base = await createGradient(width, height, {r: 45, g: 27, b: 78}, {r: 31, g: 14, b: 50});
  drawRoundedRect(base, 120, 160, 300, 520, 40, colors.white);
  drawRoundedRect(base, 460, 140, 280, 520, 40, colors.white);
  drawRoundedRect(base, 820, 220, 280, 420, 40, colors.white);
  drawRoundedRect(base, 1120, 260, 240, 340, 40, colors.white);
  const circle = new Jimp({ width: 140, height: 140, color: 0xFFFFFFFF });
  const mask = new Jimp({ width: 140, height: 140, color: 0x00000000 });
  await circle.scan(0,0,140,140,(x,y,idx)=>{
    const dx = x-70;
    const dy = y-70;
    if(dx*dx+dy*dy <= 70*70){
      circle.bitmap.data[idx+0]=255;
      circle.bitmap.data[idx+1]=255;
      circle.bitmap.data[idx+2]=255;
      circle.bitmap.data[idx+3]=255;
    } else {
      circle.bitmap.data[idx+3]=0;
    }
  });
  await base.composite(circle, 140, 640, {mode: Jimp.BLEND_SOURCE_OVER, opacitySource:0.12});
  await base.composite(circle, 350, 700, {mode: Jimp.BLEND_SOURCE_OVER, opacitySource:0.08});
  await base.composite(circle, 980, 620, {mode: Jimp.BLEND_SOURCE_OVER, opacitySource:0.1});
  drawRoundedRect(base, 120, 160, 300, 520, 40, rgbaToInt(255, 255, 255, 35));
  drawRoundedRect(base, 460, 140, 280, 520, 40, rgbaToInt(255, 255, 255, 22));
  drawRoundedRect(base, 820, 220, 280, 420, 40, rgbaToInt(255, 255, 255, 30));
  drawRoundedRect(base, 1120, 260, 240, 340, 40, rgbaToInt(255, 255, 255, 24));
  drawCircle(base, 250, 650, 140, rgbaToInt(255, 255, 255, 40), 1);
  drawCircle(base, 380, 720, 100, rgbaToInt(255, 255, 255, 28), 1);
  drawCircle(base, 980, 620, 120, rgbaToInt(255, 255, 255, 24), 1);
  await saveImage(base, 'hero-banner.jpeg');
}

async function galleryImage(filename, label) {
  const width = 600;
  const height = 500;
  const base = await createGradient(width, height, {r: 58, g: 40, b: 84}, {r: 32, g: 13, b: 51});
  drawCircle(base, 450, 230, 70, colors.lightPurple, 0.35);
  drawCircle(base, 130, 210, 60, colors.purple, 0.33);
  drawCircle(base, 220, 120, 40, colors.white, 0.25);
  drawCircle(base, 360, 330, 48, colors.white, 0.22);
  await saveImage(base, filename);
}

async function saveImage(image, filename) {
  const outputPath = path.join(outputDir, filename);
  const ext = path.extname(filename).toLowerCase();
  const getBuffer = (img, mime) => new Promise((res, rej) => img.getBuffer(mime, (err, buf) => err ? rej(err) : res(buf)) );
  if (ext === '.jpeg' || ext === '.jpg') {
    const pngBuf = await getBuffer(image, 'image/png');
    await sharp(pngBuf).jpeg({ quality: 85 }).toFile(outputPath);
  } else {
    const buf = await getBuffer(image, 'image/png');
    await fs.promises.writeFile(outputPath, buf);
  }
}

async function aboutImage() {
  const width = 800;
  const height = 540;
  const base = await createGradient(width, height, {r: 48, g: 28, b: 72}, {r: 90, g: 45, b: 120});
  drawRoundedRect(base, 60, 60, 680, 420, 40, colors.white);
  drawRoundedRect(base, 120, 100, 220, 180, 30, colors.purple);
  drawRoundedRect(base, 320, 140, 230, 140, 30, colors.lightPurple);
  drawRoundedRect(base, 585, 130, 110, 90, 20, colors.purple);
  await saveImage(base, 'sobre.jpeg');
}

async function main() {
  await heroBanner();
  const products = [
    ['garrafas.jpeg', 'Garrafas'],
    ['squeezes.jpeg', 'Squeezes'],
    ['copos-termicos.jpeg', 'Copos Térmicos'],
    ['canecas.jpeg', 'Canecas'],
    ['chaveiros.jpeg', 'Chaveiros'],
    ['kits-corporativos.jpeg', 'Kits'],
    ['cadernos.jpeg', 'Cadernos'],
    ['ecobags.jpeg', 'Ecobags'],
    ['feiras.jpeg', 'Feiras'],
    ['casamentos.jpeg', 'Casamentos'],
    ['formaturas.jpeg', 'Formaturas'],
    ['promocionais.jpeg', 'Promocionais'],
  ];
  for (const [filename, label] of products) {
    await productCard(label, filename);
  }
  await aboutImage();
  const gallery = [
    ['projeto-1.jpeg','Garrafas'],
    ['projeto-2.jpeg','Kit Premium'],
    ['projeto-3.jpeg','Canecas'],
    ['projeto-4.jpeg','Ecobag'],
    ['projeto-5.jpeg','Chaveiros'],
    ['projeto-6.jpeg','Brindes'],
  ];
  for (const [filename, label] of gallery) {
    await galleryImage(filename, label);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
