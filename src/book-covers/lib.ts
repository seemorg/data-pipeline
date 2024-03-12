import { FileType } from '@/utils/file-type';
import core, { Browser } from 'puppeteer-core';

export const BOOK_COVER_WIDTH = 1600;
export const BOOK_COVER_HEIGHT = 2300;

let browser: Browser | null = null;
async function getPage() {
  const exePath =
    process.platform === 'win32'
      ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      : process.platform === 'linux'
        ? '/usr/bin/google-chrome'
        : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  const options = {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: exePath,
    headless: true,
  };

  if (!browser) {
    browser = await core.launch(options);
  }

  return await browser.newPage();
}

export async function getScreenshot(html: string, type: FileType) {
  const page = await getPage();

  await page.setViewport({ width: BOOK_COVER_WIDTH, height: BOOK_COVER_HEIGHT });
  await page.setContent(html);

  const file = await page.screenshot({ type });

  await page.close();

  return file;
}
