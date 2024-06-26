import { client } from '../../lib/typesense';
import { chunk } from '@/utils/array';
import { getRegionsData } from '@/datasources/openiti/regions';

const INDEX_SHORT_NAME = 'regions';
const INDEX_NAME = `${INDEX_SHORT_NAME}_${Date.now()}`;

console.log(`Fetching ${INDEX_SHORT_NAME} data...`);
const regions = await getRegionsData();

console.log(`Creating ${INDEX_SHORT_NAME} index...`);

let hasCollectionAliases = true;
try {
  await client.aliases(INDEX_SHORT_NAME).retrieve();
} catch (e) {
  hasCollectionAliases = false;
}

if (!hasCollectionAliases) {
  try {
    await client.collections(INDEX_SHORT_NAME).delete();
  } catch (e) {}
}

await client.collections().create({
  name: INDEX_NAME,
  enable_nested_fields: true,
  fields: [
    {
      name: 'id',
      type: 'string',
    },
    {
      name: 'slug',
      type: 'string',
    },
    {
      name: 'names',
      type: 'object[]',
    },
    {
      name: 'currentNames',
      type: 'object[]',
    },

    {
      name: 'subLocations',
      type: 'string[]',
    },
    {
      name: 'subLocationsCount',
      type: 'int32',
    },
    {
      name: 'booksCount',
      type: 'int32',
    },
    {
      name: 'authorsCount',
      type: 'int32',
    },
    {
      name: '_popularity',
      type: 'int32',
    },
  ],
});

const batches = chunk(regions, 200) as (typeof regions)[];

let i = 1;
for (const batch of batches) {
  console.log(`Indexing batch ${i} / ${batches.length}`);
  const responses = await client.collections(INDEX_NAME).documents().import(batch);

  if (responses.some(r => r.success === false)) {
    throw new Error(`Failed to index some ${INDEX_SHORT_NAME} on this batch`);
  }
  i++;
}

console.log(`Indexed ${regions.length} ${INDEX_SHORT_NAME}`);

try {
  const collection = await client.aliases(INDEX_SHORT_NAME).retrieve();

  console.log('Deleting old alias...');
  await client.collections(collection.collection_name).delete();
} catch (e) {}

console.log('Linking new collection to alias...');
await client.aliases().upsert(INDEX_SHORT_NAME, { collection_name: INDEX_NAME });
