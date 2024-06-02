import { db } from '@/db';
import _authorLinks from '../../../test/link-authors.json';
import _bookLinks from '../../../test/link-books.json';
import { getBooksData } from '@/datasources/openiti/books';
import { chunk } from '@/utils/array';
import { dedupeStrings } from '@/utils/string';

const authorLinks = _authorLinks as unknown as Record<
  string,
  { id: string; name: string; score: string }
>; // openiti id -> data

const bookLinks = _bookLinks as unknown as Record<
  string,
  { id: string; name: string; score: string }
>; // openiti id -> data

const openitiIdToVersions = (await getBooksData()).reduce(
  (acc, book) => ({
    ...acc,
    [book.id]: book.versionIds,
  }),
  {} as Record<string, string[]>,
);

const main = async () => {
  const books = await db.book.findMany({
    select: {
      id: true,
      versions: true,
      // otherNameTranslations: { where: { locale: 'ar' } },
    },
  });

  const bChunks = chunk(
    books.filter(b => b.versions.length === 0),
    50,
  ) as (typeof books)[];
  let i = 1;
  for (const batch of bChunks) {
    console.log(`Batch ${i} / ${bChunks.length}`);

    await db.$transaction(
      batch.flatMap(book => {
        const openitiId = book.id;
        const versions = (openitiIdToVersions[openitiId] || []).map(v => ({
          source: 'openiti',
          value: v,
        }));

        const bookLink = bookLinks[book.id];
        if (bookLink) {
          versions.unshift({ source: 'turath', value: String(bookLink.id) });
        }

        // const newNames = dedupeStrings(
        //   (book.otherNameTranslations[0]?.texts || []).concat(bookLink.name),
        // );

        return [
          db.book.update({
            where: { id: book.id },
            data: {
              versions,
            },
          }),
          // db.bookOtherNames.upsert({
          //   where: { bookId_locale: { bookId: book.id, locale: 'ar' } },
          //   create: {
          //     bookId: book.id,
          //     locale: 'ar',
          //     texts: newNames,
          //   },
          //   update: { texts: newNames },
          // }),
        ];
      }),
    );

    i++;
  }

  // const authors = await db.author.findMany({
  //   select: { id: true, otherNameTranslations: { where: { locale: 'ar' } } },
  // });
  // const aChunks = chunk(
  //   authors.filter(a => !!authorLinks[a.id]),
  //   50,
  // ) as (typeof authors)[];
  // i = 1;

  // for (const batch of aChunks) {
  //   console.log(`Batch ${i} / ${aChunks.length}`);

  //   await db.$transaction(
  //     batch.map(author => {
  //       const authorLink = authorLinks[author.id]!;
  //       const newNames = dedupeStrings(
  //         (author.otherNameTranslations[0]?.texts || []).concat(authorLink.name),
  //       );

  //       return db.authorOtherNames.upsert({
  //         where: { authorId_locale: { authorId: author.id, locale: 'ar' } },
  //         create: {
  //           authorId: author.id,
  //           locale: 'ar',
  //           texts: newNames,
  //         },
  //         update: { texts: newNames },
  //       });
  //     }),
  //   );

  //   i++;
  // }

  console.log('Done!');
};

main().finally(() => process.exit(0));
