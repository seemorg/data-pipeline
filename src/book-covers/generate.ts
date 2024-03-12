import { getScreenshot } from './lib';
import { getBookHtml } from './html';

import { generatePatternWithColors } from './pattern';
import { getAuthorsData } from '@/datasources/openiti/authors';
import { uploadToR2 } from '@/lib/r2';

const authors = await getAuthorsData({ populateBooks: true });

const totalBooks = authors.reduce((acc, author) => acc + author.books.length, 0);
let i = 1;

const failed = [];
for (const author of authors) {
  const books = author.books;

  for (const book of books) {
    console.log(`Processing book ${i} / ${totalBooks}`);
    i++;

    try {
      const result = await generatePatternWithColors(book.slug);
      if (!result) continue;

      const { containerColor, patternBuffer } = result;

      const bgBase64 = patternBuffer.toString('base64');

      console.log('Generating cover...');
      const file = await getScreenshot(
        getBookHtml({
          title: book.primaryArabicName ?? book.primaryLatinName,
          author: author.primaryArabicName ?? author.primaryLatinName ?? '',
          containerColor,
          bgBase64,
        }),
        'png',
      );

      console.log('Uploading cover...');
      await uploadToR2(`covers/${book.slug}.png`, file, {
        contentType: 'image/png',
      });
    } catch (e) {
      console.log(e);

      failed.push(book.slug);
    }
  }
}

console.log('Done!');
console.log(JSON.stringify(failed, null, 2));
process.exit(0);
