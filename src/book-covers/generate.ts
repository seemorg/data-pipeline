import { getScreenshot } from './lib';
import { getBookHtml } from './html';

import { generatePatternWithColors } from './pattern';
import { getAuthorsData } from '@/datasources/openiti/authors';
import { listAllObjects, uploadToR2 } from '@/lib/r2';
import { chunk } from '@/utils/array';

const authors = await getAuthorsData({ populateBooks: true });

// const totalBooks = authors.reduce((acc, author) => acc + author.books.length, 0);

const objects = new Set<string>((await listAllObjects('covers/')).map(o => o.Key ?? ''));
const failed: string[] = [];

const batches = chunk(authors, 10) as (typeof authors)[];
let i = 1;

for (const batch of batches) {
  console.log(`Processing batch ${i} / ${batches.length}`);
  i++;

  await Promise.all(
    batch.map(async author => {
      const books = author.books;
      const bookBatches = chunk(books, 5) as (typeof books)[];

      for (const bookBatch of bookBatches) {
        await Promise.all(
          bookBatch.map(async book => {
            const coverKey = `covers/${book.slug}.png`;
            if (objects.has(coverKey)) {
              return;
            }

            try {
              const result = await generatePatternWithColors(book.slug);
              if (!result) return;

              const { containerColor, patternBuffer } = result;

              const bgBase64 = patternBuffer.toString('base64');

              // console.log('Generating cover...');
              const file = await getScreenshot(
                getBookHtml({
                  title: book.primaryArabicName ?? book.primaryLatinName,
                  author: author.primaryArabicName ?? author.primaryLatinName ?? '',
                  containerColor,
                  bgBase64,
                }),
                'png',
              );

              // console.log('Uploading cover...');
              await uploadToR2(coverKey, file, {
                contentType: 'image/png',
              });
            } catch (e) {
              console.log(e);
              failed.push(book.slug);
            }
          }),
        );
      }
    }),
  );
}

console.log('Done!');
console.log(JSON.stringify(failed, null, 2));
process.exit(0);
