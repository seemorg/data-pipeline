import { db } from '../../db';
import { genre } from '../../db/schema';
import { chunk } from '@/utils/array';
import { getGenresData } from '@/datasources/openiti/genres';

const allGenres = await getGenresData();
const chunkedGenres = chunk(allGenres, 100) as (typeof allGenres)[];

const shouldReset =
  process.argv.includes('--reset') || process.argv.includes('"--reset"');
if (shouldReset) {
  console.log('[GENRES] Resetting genres table');
  await db.delete(genre);
}

let genreBatchIdx = 1;
for (const genres of chunkedGenres) {
  console.log(`[GENRES] Seeding batch ${genreBatchIdx} / ${chunkedGenres.length}`);

  try {
    await db.insert(genre).values(genres);
  } catch (e) {
    console.log(e);
    console.log(genres);
  }

  genreBatchIdx++;
}
