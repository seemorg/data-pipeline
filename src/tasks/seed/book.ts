import { getBooksData } from '@/datasources/openiti/books';
import { db } from '../../db';
import { book, genresToBooks } from '../../db/schema';
import { chunk } from '@/utils/array';

const allBooks = await getBooksData({ populateAuthor: true });
const chunkedBooks = chunk(allBooks, 100) as (typeof allBooks)[];

const shouldReset =
  process.argv.includes('--reset') || process.argv.includes('"--reset"');
if (shouldReset) {
  console.log('[BOOKS] Resetting books table');
  await db.delete(book);
  await db.delete(genresToBooks);
}

let bookBatchIdx = 1;
for (const books of chunkedBooks) {
  console.log(`[BOOKS] Seeding batch ${bookBatchIdx} / ${chunkedBooks.length}`);

  await db.insert(book).values(books);

  const genreEntries = books.flatMap(bookEntry => {
    return [...new Set(bookEntry.genreTags.map(g => g.toLowerCase()))].map(genreTag => ({
      genreId: genreTag,
      bookId: bookEntry.id,
    }));
  });

  if (genreEntries.length > 0) {
    await db.insert(genresToBooks).values(genreEntries);
  }

  bookBatchIdx++;
}
