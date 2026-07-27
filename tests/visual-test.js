const puppeteer = require('puppeteer');
const fs = require('fs');
const http = require('http');

const url = 'http://localhost:8080/';
const outDir = './tests/screenshots';

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 900, height: 800 },
  { name: 'mobile-large', width: 428, height: 926 }, // iPhone Pro Max approx
  { name: 'mobile-medium', width: 390, height: 844 },
  { name: 'mobile-small', width: 375, height: 667 }
];

async function waitForServer(retries = 20, delay = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise((res, rej) => {
        const req = http.get(url, (r) => {
          res();
        });
        req.on('error', rej);
      });
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Server did not start in time');
}

(async () => {
  try {
    await waitForServer();
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      // Give some time for fonts/images
      await page.waitForTimeout(1000);
      const path = `${outDir}/homepage-${vp.name}-${vp.width}x${vp.height}.png`;
      await page.screenshot({ path, fullPage: true });
      console.log('Captured', path);
    }

    await browser.close();
    console.log('Visual tests completed. Screenshots in', outDir);
    process.exit(0);
  } catch (err) {
    console.error('Visual test failed:', err);
    process.exit(1);
  }
})();
