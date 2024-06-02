import { getAuthorsData } from '@/datasources/openiti/authors';
import { db } from '@/db';
import { chunk } from '@/utils/array';
import _authorLinks from '../../../test/link-authors.json';
import { dedupeStrings } from '@/utils/string';

const allAuthors = await getAuthorsData({ populateBooks: true });
const chunkedAuthors = chunk(allAuthors, 100) as (typeof allAuthors)[];

const authorLinks = _authorLinks as unknown as Record<
  string,
  { id: string; name: string; score: string }
>; // openiti id -> data

const shouldReset =
  process.argv.includes('--reset') || process.argv.includes('"--reset"');
if (shouldReset) {
  console.log('[AUTHORS] Resetting authors table');
  await db.author.deleteMany();
}

let authorBatchIdx = 1;
for (const authors of chunkedAuthors) {
  console.log(`[AUTHORS] Seeding batch ${authorBatchIdx} / ${chunkedAuthors.length}`);

  const locationEntries = authors
    .flatMap(authorEntry => {
      return [...new Set(authorEntry.geographies.map(g => g.toLowerCase()))].map(
        geography => ({
          locationId: geography,
          authorId: authorEntry.id,
        }),
      );
    })
    .reduce(
      (acc, entry) => {
        const old = acc[entry.authorId] || [];
        acc[entry.authorId] = old.concat(entry.locationId);

        return acc;
      },
      {} as Record<string, string[]>,
    );

  await db.author.createMany({
    data: authors.map(author => ({
      id: author.id,
      slug: author.slug,
      year: author.year,
      numberOfBooks: author.booksCount,
    })),
  });

  await db.authorPrimaryName.createMany({
    data: authors.flatMap(a => {
      return a.primaryNames.map(entry => ({
        authorId: a.id,
        ...entry,
      }));
    }),
  });

  await db.authorOtherNames.createMany({
    data: authors.flatMap(a => {
      return a.otherNames.map(entry => {
        const newNames = entry.texts;

        if (entry.locale === 'ar') {
          const authorLink = authorLinks[a.id];
          if (authorLink) {
            newNames.push(authorLink.name);
          }
        }

        return {
          authorId: a.id,
          ...entry,
          texts: dedupeStrings(newNames),
        };
      });
    }),
  });

  await db.authorBio.createMany({
    data: authors.flatMap(a => {
      return a.bios.map(entry => ({
        authorId: a.id,
        ...entry,
      }));
    }),
  });

  await Promise.all(
    Object.entries(locationEntries).map(async ([authorId, locationIds]) => {
      await db.author.update({
        where: { id: authorId },
        data: {
          locations: {
            connect: locationIds.map(l => ({ id: l })),
          },
        },
      });
    }),
  );

  authorBatchIdx++;
}
