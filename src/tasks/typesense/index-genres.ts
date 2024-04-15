import { client } from '../../lib/typesense';
import { chunk } from '@/utils/array';
import { getGenresData } from '@/datasources/openiti/genres';

const INDEX_SHORT_NAME = 'genres';
const INDEX_NAME = `${INDEX_SHORT_NAME}_${Date.now()}`;

console.log(`Fetching ${INDEX_SHORT_NAME} data...`);
const genres = await getGenresData();

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
      name: 'name',
      type: 'string',
    },
    {
      name: 'booksCount',
      type: 'int32',
    },
    {
      name: '_popularity',
      type: 'int32',
    },
  ],
});

const batches = chunk(genres, 200) as (typeof genres)[];

let i = 1;
for (const batch of batches) {
  console.log(`Indexing batch ${i} / ${batches.length}`);
  const responses = await client.collections(INDEX_NAME).documents().import(batch);

  if (responses.some(r => r.success === false)) {
    throw new Error(`Failed to index some ${INDEX_SHORT_NAME} on this batch`);
  }
  i++;
}

console.log(`Indexed ${genres.length} ${INDEX_SHORT_NAME}`);

try {
  const collection = await client.aliases(INDEX_SHORT_NAME).retrieve();

  console.log('Deleting old alias...');
  await client.collections(collection.collection_name).delete();
} catch (e) {}

console.log('Linking new collection to alias...');
await client.aliases().upsert(INDEX_SHORT_NAME, { collection_name: INDEX_NAME });
