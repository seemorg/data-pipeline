import { client } from '../../lib/typesense';
import { getAuthorsData } from '@/datasources/openiti/authors';
import { getBooksData } from '@/datasources/openiti/books';
import { getGenresData } from '@/datasources/openiti/genres';
import { getRegionsData } from '@/datasources/openiti/regions';
import { AuthorDocument, BookDocument } from '@/types';
import { GenreDocument } from '@/types/genre';
import { RegionDocument } from '@/types/region';
import { chunk } from '@/utils/array';

const INDEX_SHORT_NAME = 'all_documents';
const INDEX_NAME = `${INDEX_SHORT_NAME}_${Date.now()}`;

console.log('Creating index...');

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
      name: 'type',
      type: 'string',
      facet: true,
    },
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
      optional: true,
    },
    {
      name: 'primaryNames',
      type: 'object[]',
      optional: true,
    },
    {
      name: 'otherNames',
      type: 'object[]',
      optional: true,
    },
    {
      // this is an internal field that we'll use to search for name variations
      name: '_nameVariations',
      type: 'string[]',
      optional: true,
    },
    {
      name: '_popularity',
      type: 'int32',
      optional: true,
    },
    {
      name: 'author',
      type: 'object',
      optional: true,
    },
    {
      name: 'booksCount',
      type: 'int32',
      optional: true,
    },
  ],
});

const types = ['author', 'book', 'genre', 'region'] as const;

const getDataByType = async <T extends (typeof types)[number]>(type: T) => {
  if (type === 'author') {
    return await getAuthorsData({ populateBooks: true });
  }

  if (type === 'book') {
    return await getBooksData({ populateAuthor: true });
  }

  if (type === 'genre') {
    return await getGenresData();
  }

  return await getRegionsData();
};

for (const type of types) {
  const data = await getDataByType(type);

  if (!data) {
    console.log(`DATA LOADER FOR ${type} not implemented yet!`);
    continue;
  }

  console.log(`Indexing ${data.length} records of type: "${type}"`);

  const batches = chunk(data, 200) as (typeof data)[];

  let i = 1;
  for (const batch of batches) {
    const preparedBatch = batch.map(record => {
      if (type === 'author') {
        const authorDocument = record as AuthorDocument;

        return {
          id: authorDocument.id,
          slug: authorDocument.slug,
          year: authorDocument.year,
          primaryNames: authorDocument.primaryNames,
          otherNames: authorDocument.otherNames,
          booksCount: authorDocument.booksCount,
          _nameVariations: authorDocument._nameVariations,
          _popularity: authorDocument._popularity,
        };
      }

      if (type === 'book') {
        const bookDocument = record as BookDocument;

        return {
          id: bookDocument.id,
          slug: bookDocument.slug,
          year: bookDocument.year,
          primaryNames: bookDocument.primaryNames,
          otherNames: bookDocument.otherNames,
          _nameVariations: bookDocument._nameVariations,
          _popularity: bookDocument._popularity,
          author: {
            id: bookDocument.author.id,
            slug: bookDocument.author.slug,
            year: bookDocument.author.year,
            primaryNames: bookDocument.author.primaryNames,
            otherNames: bookDocument.author.otherNames,
            _nameVariations: bookDocument.author._nameVariations,
            _popularity: bookDocument.author._popularity,
          },
        };
      }

      if (type === 'genre') {
        const genreDocument = record as GenreDocument;

        return {
          id: genreDocument.id,
          slug: genreDocument.slug,
          booksCount: genreDocument.booksCount,
          primaryNames: [{ locale: 'en', text: genreDocument.name }],
          _popularity: genreDocument._popularity,
        };
      }

      if (type === 'region') {
        const regionDocument = record as RegionDocument;
        return {
          id: regionDocument.id,
          slug: regionDocument.slug,
          primaryNames: regionDocument.names,
          otherNames: regionDocument.currentNames,
          booksCount: regionDocument.booksCount,
          _nameVariations: regionDocument.subLocations,
          _popularity: regionDocument._popularity,
        };
      }

      return null;
    });

    console.log(`Indexing batch ${i} / ${batches.length}`);

    const responses = await client
      .collections(INDEX_NAME)
      .documents()
      .import(preparedBatch.filter(d => d !== null).map(d => ({ ...d, type })));

    if (responses.some(r => r.success === false)) {
      throw new Error('Failed to index some records on this batch');
    }

    i++;
  }

  console.log(`Indexed ${data.length} records of type: "${type}"`);
}

// const aliases = Object.keys(nameAliases as Record<string, string[]>)
//   // @ts-ignore
//   .filter(a => !!nameAliases[a] && nameAliases[a].length > 0)
//   .map(alias => ({
//     name: alias,
//     // @ts-ignore
//     aliases: [alias, ...nameAliases[alias]] as string[],
//   }));

// const aliasChunks = chunk(aliases, 50) as (typeof aliases)[];

// let j = 1;
// for (const chunk of aliasChunks) {
//   console.log(`Indexing aliases batch ${j} / ${aliasChunks.length}`);
//   await Promise.all(
//     chunk.map((a, index) =>
//       client
//         .collections(INDEX_NAME)
//         .synonyms()
//         .upsert(`chunk-${j}:idx-${index}`, { synonyms: a.aliases }),
//     ),
//   );
//   j++;
// }

// console.log(`Indexed ${aliases.length} aliases`);

try {
  const collection = await client.aliases(INDEX_SHORT_NAME).retrieve();

  console.log('Deleting old alias...');
  await client.collections(collection.collection_name).delete();
} catch (e) {}

console.log('Linking new collection to alias...');
await client.aliases().upsert(INDEX_SHORT_NAME, { collection_name: INDEX_NAME });

const { indexAliases: indexAuthorAliases } = await import('./index-author-aliases');
await indexAuthorAliases(INDEX_NAME);

const { indexAliases: indexBookAliases } = await import('./index-book-aliases');
await indexBookAliases(INDEX_NAME);
