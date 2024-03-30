import { getScreenshot } from './lib';
import { getCollectionHtml } from './html';
import fs from 'fs/promises';
import path from 'path';

import { generatePatternWithColors } from './pattern';
import { chunk } from '@/utils/array';
import { collections } from './collections';
import slugify from 'slugify';

const ensureDir = async (dir: string) => {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
};

const batches = chunk(collections, 5) as (typeof collections)[];
let i = 1;

const allSlugs = new Set(
  collections.map(collection => slugify(collection.name, { lower: true })),
);

for (const batch of batches) {
  console.log(`Processing batch ${i} / ${batches.length}`);
  i++;

  await Promise.all(
    batch.map(async collection => {
      const coverKey = `${slugify(collection.name, { lower: true })}.png`;

      try {
        const result = await generatePatternWithColors(coverKey, allSlugs);
        if (!result) return;

        const { containerColor, patternBuffer } = result;

        const bgBase64 = patternBuffer.toString('base64');

        // console.log('Generating cover...');
        const file = await getScreenshot(
          getCollectionHtml({
            title: collection.arabicName,
            containerColor,
            bgBase64,
          }),
          'png',
          { width: 1000, height: 1000 },
        );

        // console.log('Uploading cover...');
        await ensureDir(path.resolve('generated'));
        await ensureDir(path.resolve('generated/collections'));
        await fs.writeFile(path.resolve(`generated/collections/${coverKey}`), file);
      } catch (e) {
        console.log(e);
      }
    }),
  );
}

console.log('Done!');
process.exit(0);
