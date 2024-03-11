import { getScreenshot } from './lib';
import { getBookHtml } from './html';

import { generatePatternWithColors } from './pattern';
import { getAuthorsData } from '@/datasources/openiti/authors';
import { uploadToR2 } from '@/lib/r2';

const authors = await getAuthorsData({ populateBooks: true });

const totalBooks = authors.reduce((acc, author) => acc + author.books.length, 0);
let i = 1;

for (const author of authors) {
  const books = author.books;

  for (const book of books) {
    console.log(`Processing book ${i} / ${totalBooks}`);

    try {
      const result = await generatePatternWithColors(book.slug);
      if (!result) continue;

      const { containerColor, patternBuffer } = result;

      // store the pattern
      // await fs.writeFile(path.resolve(`covers/pattern-${book.slug}.png`), patternBuffer);

      // const bgPath = path.resolve('src/book-covers/bg-2.png');
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

      // await ensureDir(path.resolve('covers'));
      // await ensureDir(path.resolve(`covers/ghazali`));
      // await fs.writeFile(path.resolve(`covers/ghazali/${book.slug}.png`), file);
      console.log('Uploading cover...');
      await uploadToR2(`covers/${book.slug}.png`, file, {
        contentType: 'image/png',
      });
    } catch (e) {}

    i++;
  }
}

console.log('Done!');
process.exit(0);
