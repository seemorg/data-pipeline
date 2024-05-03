import { db } from '@/db';
import { chunk } from '@/utils/array';
import { getRegionsData } from '@/datasources/openiti/regions';

const allRegions = await getRegionsData();

const chunks = chunk(allRegions, 10) as (typeof allRegions)[];

const shouldReset =
  process.argv.includes('--reset') || process.argv.includes('"--reset"');
if (shouldReset) {
  console.log('[REGIONS] Resetting regions table');
  await db.region.deleteMany();
}

let batchIdx = 1;
for (const regions of chunks) {
  console.log(`[REGIONS] Seeding batch ${batchIdx} / ${chunks.length}`);

  await db.region.createMany({
    data: regions.map(entry => ({
      id: entry.slug,
      slug: entry.slug,
      numberOfBooks: entry.booksCount,
      numberOfAuthors: entry.authorsCount,
    })),
  });

  await db.regionName.createMany({
    data: regions.flatMap(r => {
      return r.names.map(entry => ({
        regionId: r.id,
        ...entry,
      }));
    }),
  });

  await db.regionCurrentName.createMany({
    data: regions.flatMap(r => {
      return r.currentNames.map(entry => ({
        regionId: r.id,
        ...entry,
      }));
    }),
  });

  await db.regionOverview.createMany({
    data: regions.flatMap(r => {
      return r.overviews.map(entry => ({
        regionId: r.id,
        ...entry,
      }));
    }),
  });

  batchIdx++;
}
