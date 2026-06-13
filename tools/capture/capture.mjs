import { chromium } from 'playwright';
import { mkdirSync, rmSync, renameSync } from 'fs';

const URL = 'https://flarepoint.nl/moncom';
const RECORD_MS = 30500; // ~ one full 28.6s layout cycle + margin
const VID_DIR = 'tools/capture/video';
const W = 1600, H = 1000;

rmSync(VID_DIR, { recursive: true, force: true });
mkdirSync(VID_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: VID_DIR, size: { width: W, height: H } },
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
const station = page.locator('[data-bay-name*="MonCOM"]').first();
if (await station.count()) await station.click().catch(() => {});
await page.locator('#bays').scrollIntoViewIfNeeded().catch(() => {});

const canvas = page.locator('#bay-04 .bay__canvas canvas').first();
await canvas.waitFor({ state: 'attached', timeout: 30000 });
await page.waitForFunction(() => {
  const c = document.querySelector('#bay-04 .bay__canvas canvas');
  return c && c.clientWidth > 50 && c.clientHeight > 50;
}, { timeout: 30000 });

const box = await canvas.boundingBox();
console.log('CANVAS_BOX', JSON.stringify(box));

await page.waitForTimeout(RECORD_MS);

const video = page.video();
await context.close(); // finalizes the webm
const src = await video.path();
renameSync(src, `${VID_DIR}/wall.webm`);
console.log('wrote', `${VID_DIR}/wall.webm`);
await browser.close();
