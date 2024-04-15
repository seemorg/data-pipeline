import { getLocationsData } from '@/datasources/openiti/locations';
import { getRegionsData } from '@/datasources/openiti/regions';
import { airtable } from '@/lib/airtable';
import { chunk } from '@/utils/array';

const distinctLocations = (await getLocationsData()).reduce(
  (acc, location) => {
    if (!location.regionId || !location.city || !location.cityArabic) return acc;

    acc[location.slug] = {
      city: location.city,
      cityArabic: location.cityArabic,
      regionId: location.regionId,
    };
    return acc;
  },
  {} as Record<string, { city: string; cityArabic: string; regionId: string }>,
);

const chunks = chunk(
  Object.values(distinctLocations),
  10,
) as (typeof distinctLocations)[string][][];

const regionSlugToArabicName = (await getRegionsData()).reduce(
  (acc, region) => {
    acc[region.slug] = region.arabicName;
    return acc;
  },
  {} as Record<string, string>,
);

const airtableRegions = await airtable('Regions').select().all();
const regionArabicNameToAirtableId = airtableRegions.reduce(
  (acc, record) => {
    acc[record.fields['Name (Arabic)'] as string] = record.getId();
    return acc;
  },
  {} as Record<string, string>,
);

let i = 1;
for (const chunk of chunks) {
  console.log(`Processing chunk ${i} / ${chunks.length}`);

  try {
    await airtable('Locations').create(
      chunk.map(record => {
        const regionArabicName = record.regionId
          ? regionSlugToArabicName[record.regionId]
          : null;
        const regionAirtableId = regionArabicName
          ? regionArabicNameToAirtableId[regionArabicName]
          : null;

        return {
          fields: {
            'Name (Arabic)': record.cityArabic,
            'Name (English)': record.city,
            ...(regionAirtableId
              ? {
                  Region: [regionAirtableId],
                }
              : {}),
          },
        };
      }),
    );
  } catch (error) {
    console.log(`Error processing chunk ${i} / ${chunks.length}: `);
    console.error(error);
  }

  i++;
}
