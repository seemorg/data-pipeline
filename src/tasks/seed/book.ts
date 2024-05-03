import { getBooksData } from '@/datasources/openiti/books';
import { db } from '@/db';
import { chunk } from '@/utils/array';

const allBooks = await getBooksData({ populateAuthor: true });
const chunkedBooks = chunk(allBooks, 100) as (typeof allBooks)[];

const shouldReset =
  process.argv.includes('--reset') || process.argv.includes('"--reset"');
if (shouldReset) {
  console.log('[BOOKS] Resetting books table');
  await db.book.deleteMany();
}

let bookBatchIdx = 1;
for (const books of chunkedBooks) {
  console.log(`[BOOKS] Seeding batch ${bookBatchIdx} / ${chunkedBooks.length}`);

  const bookToGenres = books
    .flatMap(bookEntry => {
      return [...new Set(bookEntry.genreTags.map(g => g.toLowerCase()))].map(
        genreTag => ({
          genreId: genreTag,
          bookId: bookEntry.id,
        }),
      );
    })
    .reduce(
      (acc, entry) => {
        const old = acc[entry.bookId] || [];
        acc[entry.bookId] = old.concat(entry.genreId);

        return acc;
      },
      {} as Record<string, string[]>,
    );

  await db.book.createMany({
    data: books.map(book => ({
      id: book.id,
      slug: book.slug,
      // primaryArabicName: book.primaryArabicName,
      // primaryLatinName: book.primaryLatinName,
      // otherArabicNames: book.otherArabicNames,
      // otherLatinNames: book.otherLatinNames,
      versionIds: book.versionIds,
      numberOfVersions: book.versionIds.length,
      authorId: book.authorId,
    })),
  });

  await db.bookPrimaryName.createMany({
    data: books.flatMap(b => {
      return b.primaryNames.map(entry => ({
        bookId: b.id,
        ...entry,
      }));
    }),
  });

  await db.bookOtherNames.createMany({
    data: books.flatMap(b => {
      return b.otherNames.map(entry => ({
        bookId: b.id,
        ...entry,
      }));
    }),
  });

  await Promise.all(
    Object.entries(bookToGenres).map(async ([bookId, genreIds]) => {
      await db.book.update({
        where: { id: bookId },
        data: {
          genres: {
            connect: genreIds.map(g => ({ id: g })),
          },
        },
      });
    }),
  );

  bookBatchIdx++;
}
