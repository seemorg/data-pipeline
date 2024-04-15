import { getAuthorsData } from '@/datasources/openiti/authors';
import { getLocationsData } from '@/datasources/openiti/locations';
import { airtable } from '@/lib/airtable';
import { chunk } from '@/utils/array';

const authors = await getAuthorsData();
const chunks = chunk(authors, 10) as (typeof authors)[];

const locationIdToCityName = (await getLocationsData()).reduce(
  (acc, location) => {
    if (location.id && location.city) acc[location.id] = location.city;
    return acc;
  },
  {} as Record<string, string>,
);

const cityNameToAirtableId = (await airtable('Locations').select().all()).reduce(
  (acc, record) => {
    acc[record.fields['Name (English)'] as string] = record.getId();
    return acc;
  },
  {} as Record<string, string>,
);

const getAirtableIdByLocationId = (locationId: string) => {
  const cityName = locationIdToCityName[locationId.toLowerCase()];
  if (!cityName) return null;

  return cityNameToAirtableId[cityName] ?? null;
};

let i = 1;
for (const chunk of chunks) {
  console.log(`Processing chunk ${i} / ${chunks.length}`);

  try {
    await airtable('Authors').create(
      chunk.map(record => {
        let bornLocation = null;
        const livedLocations: string[] = [];
        let diedLocation = null;

        record.geographies.forEach(geo => {
          const type = geo.split('@')[0]!;

          if (type === 'born') {
            bornLocation = getAirtableIdByLocationId(geo);
          } else if (type === 'visited' || type === 'resided') {
            const id = getAirtableIdByLocationId(geo);
            if (id) livedLocations.push(id);
          } else if (type === 'died') {
            diedLocation = getAirtableIdByLocationId(geo);
          }
        });

        return {
          fields: {
            id: record.id,
            'Name (Arabic)': record.primaryArabicName,
            'Name (English)': record.primaryLatinName,
            'Other Names (comma separated)': record.otherArabicNames
              .concat(record.otherLatinNames)
              .join(', '),
            'Died Year (AH)': record.year,
            'Bio (English)': record.bio,
            'Born Location': bornLocation ? [bornLocation] : [],
            'Lived Locations': livedLocations,
            'Died Location': diedLocation ? [diedLocation] : [],
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
