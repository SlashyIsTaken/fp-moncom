import { chromium } from 'playwright';

const URL = 'https://flarepoint.nl/moncom';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});

const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

page.on('console', (m) => console.log('[page]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });

// Activate the MonCOM bay (4th station / carousel slide).
const station = page.locator('[data-bay-name*="MonCOM"]').first();
if (await station.count()) {
  await station.click().catch(() => {});
}
await page.locator('#bays').scrollIntoViewIfNeeded().catch(() => {});

// Wait for the Three.js canvas to mount inside the MonCOM bay and gain size.
const canvas = page.locator('#bay-04 .bay__canvas canvas').first();
await canvas.waitFor({ state: 'attached', timeout: 30000 });
await page.waitForFunction(() => {
  const c = document.querySelector('#bay-04 .bay__canvas canvas');
  return c && c.clientWidth > 50 && c.clientHeight > 50;
}, { timeout: 30000 });

// Let the scene spin up and advance a couple of layouts so we don't capture frame 0.
await page.waitForTimeout(6000);

const box = await canvas.boundingBox();
console.log('canvas box:', JSON.stringify(box));
await canvas.screenshot({ path: 'tools/capture/verify.png' });
console.log('wrote tools/capture/verify.png');

await browser.close();
