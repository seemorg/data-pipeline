import { getRegionsData } from '@/datasources/openiti/regions';
import { airtable } from '@/lib/airtable';
import { chunk } from '@/utils/array';

const regions = await getRegionsData();
const chunks = chunk(regions, 10) as (typeof regions)[];

let i = 1;
for (const chunk of chunks) {
  console.log(`Processing chunk ${i} / ${chunks.length}`);

  try {
    await airtable('Regions').create(
      chunk.map(record => ({
        fields: {
          'Name (Arabic)': record.arabicName,
          'Name (English)': record.name,
        },
      })),
    );
  } catch (error) {
    console.log(`Error processing chunk ${i} / ${chunks.length}: `);
    console.error(error);
  }

  i++;
}
