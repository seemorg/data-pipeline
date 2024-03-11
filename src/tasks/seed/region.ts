import { db } from '../../db';
import { region as regionTable } from '../../db/schema';
import distinctRegions from '../../../data/regions.json';
import { chunk } from '@/utils/array';

const allRegions = Object.values(distinctRegions) as {
  slug: string;
  name: string;
  nameArabic: string;
  currentPlace: string;
  overview: string;
}[];

const chunks = chunk(allRegions, 10) as (typeof allRegions)[];

const shouldReset =
  process.argv.includes('--reset') || process.argv.includes('"--reset"');
if (shouldReset) {
  console.log('[REGIONS] Resetting regions table');
  await db.delete(regionTable);
}

let batchIdx = 1;
for (const regions of chunks) {
  console.log(`[REGIONS] Seeding batch ${batchIdx} / ${chunks.length}`);

  await db.insert(regionTable).values(
    regions.map(entry => ({
      id: entry.slug,
      slug: entry.slug,
      name: entry.name,
      currentName: entry.currentPlace,
      arabicName: entry.nameArabic,
      overview: entry.overview,
    })),
  );

  batchIdx++;
}
