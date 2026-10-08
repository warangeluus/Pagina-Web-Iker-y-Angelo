import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';

// Reproduce the existing typographic identity as real PNGs; no new dependencies.
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage();
  for (const size of [192, 512]) {
    const png = await page.evaluate(size => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#171916';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#d5fa48';
      ctx.fillRect(size * .14, size * .76, size * .72, size * .055);
      ctx.font = `900 ${size * .43}px "Arial Black", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('US', size * .5, size * .48, size * .76);
      return canvas.toDataURL('image/png').split(',')[1];
    }, size);
    await writeFile(new URL(`../assets/img/icon-${size}.png`, import.meta.url), Buffer.from(png, 'base64'));
  }
} finally { await browser.close(); }
