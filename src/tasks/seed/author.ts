import { db } from '../../db';
import { author, locationsToAuthors } from '../../db/schema';
import { getAuthorsData } from '@/datasources/openiti/authors';
import { chunk } from '@/utils/array';

const allAuthors = await getAuthorsData({ populateBooks: true });
const chunkedAuthors = chunk(allAuthors, 100) as (typeof allAuthors)[];

const shouldReset =
  process.argv.includes('--reset') || process.argv.includes('"--reset"');
if (shouldReset) {
  console.log('[AUTHORS] Resetting authors table');
  await db.delete(author);
  await db.delete(locationsToAuthors);
}

let authorBatchIdx = 1;
for (const authors of chunkedAuthors) {
  console.log(`[AUTHORS] Seeding batch ${authorBatchIdx} / ${chunkedAuthors.length}`);

  await db
    .insert(author)
    .values(authors.map(author => ({ ...author, numberOfBooks: author.booksCount })));

  const locationEntries = authors.flatMap(authorEntry => {
    return [...new Set(authorEntry.geographies.map(g => g.toLowerCase()))].map(
      geography => ({
        locationId: geography,
        authorId: authorEntry.id,
      }),
    );
  });

  if (locationEntries.length > 0) {
    await db.insert(locationsToAuthors).values(locationEntries);
  }

  authorBatchIdx++;
}
