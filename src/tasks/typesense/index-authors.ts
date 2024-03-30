import { client } from '../../lib/typesense';

import fs from 'fs/promises';
import { getAuthorsData } from '@/datasources/openiti/authors';
import { chunk } from '@/utils/array';
import path from 'path';

const INDEX_SHORT_NAME = 'authors';
const INDEX_NAME = `${INDEX_SHORT_NAME}_${Date.now()}`;

console.log('Fetching authors data...');
const authors = await getAuthorsData({ populateBooks: true });

console.log('Creating authors index...');

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
      name: 'year',
      type: 'int32',
      facet: true,
    },
    {
      name: 'primaryArabicName',
      type: 'string',
      optional: true,
    },
    {
      name: 'otherArabicNames',
      type: 'string[]',
    },
    {
      name: 'primaryLatinName',
      type: 'string',
      optional: true,
    },
    {
      name: 'otherLatinNames',
      type: 'string[]',
    },
    {
      name: 'geographies',
      type: 'string[]',
      facet: true,
    },
    {
      name: 'regions',
      type: 'string[]',
      facet: true,
    },
    {
      // this is an internal field that we'll use to search for name variations
      name: '_nameVariations',
      type: 'string[]',
      optional: true,
    },
    {
      name: 'books',
      type: 'object[]',
      index: false, // don't index books
      optional: true,
    },
    {
      name: 'booksCount',
      type: 'int32',
      optional: true,
    },
  ],
});

const batches = chunk(authors, 200) as (typeof authors)[];

// const foundVariations: object[] = [];

let i = 1;
for (const batch of batches) {
  console.log(`Indexing batch ${i} / ${batches.length}`);

  const responses = await client.collections(INDEX_NAME).documents().import(batch);

  if (responses.some(r => r.success === false)) {
    throw new Error('Failed to index some authors on this batch');
  }
  i++;
}
console.log(`Indexed ${authors.length} authors`);
console.log('\n');

try {
  const collection = await client.aliases(INDEX_SHORT_NAME).retrieve();

  console.log('Deleting old alias...');
  await client.collections(collection.collection_name).delete();
} catch (e) {}

console.log('Linking new collection to alias...');
await client.aliases().upsert(INDEX_SHORT_NAME, { collection_name: INDEX_NAME });

// save distinct tags to file
const tags = [
  ...authors.reduce((acc, author) => {
    author.geographies.forEach(tag => {
      if (!acc.has(tag)) acc.add(tag);
    });
    return acc;
  }, new Set<string>()),
];

await fs.writeFile(
  path.resolve('output/distinct-tags.json'),
  JSON.stringify(tags, null, 2),
  'utf-8',
);
