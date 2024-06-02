import { getBooksData } from '@/datasources/openiti/books';
import { db } from '@/db';
import { chunk } from '@/utils/array';
import _bookLinks from '../../../test/link-books.json';
import { dedupeStrings } from '@/utils/string';

const allBooks = await getBooksData({ populateAuthor: true });
const chunkedBooks = chunk(allBooks, 100) as (typeof allBooks)[];

const openitiIdToVersions = allBooks.reduce(
  (acc, book) => ({
    ...acc,
    [book.id]: book.versionIds,
  }),
  {} as Record<string, string[]>,
);

const bookLinks = _bookLinks as unknown as Record<
  string,
  { id: string; name: string; score: string }
>; // openiti id -> data

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
    data: books.map(book => {
      const versions = book.versionIds.map(v => ({
        source: 'openiti',
        value: v,
      }));

      const bookLink = bookLinks[book.id];
      if (bookLink) {
        versions.unshift({ source: 'turath', value: String(bookLink.id) });
      }

      return {
        id: book.id,
        slug: book.slug,
        versions,
        numberOfVersions: book.versionIds.length,
        authorId: book.authorId,
      };
    }),
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
      return b.otherNames.map(entry => {
        const newNames = entry.texts;

        if (entry.locale === 'ar') {
          // add turath name if exists
          const bookLink = bookLinks[b.id];
          if (bookLink) {
            newNames.push(bookLink.name);
          }
        }

        return {
          bookId: b.id,
          ...entry,
          texts: dedupeStrings(newNames),
        };
      });
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
