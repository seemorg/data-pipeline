import { airtable } from '@/lib/airtable';
import { chunk } from '@/utils/array';
import fs from 'fs';

const airtableTexts = await airtable('Texts').select().all();
fs.writeFileSync(
  'airtable-texts.json',
  JSON.stringify(
    airtableTexts.map(r => r._rawJson),
    null,
    2,
  ),
);

const allGenres = airtableTexts.flatMap(record => {
  const oldGenres = record.fields['Name (Arabic)'] as string;
  return oldGenres.split('/').map(genre => genre.trim());
});

// create genres
const airtableGenres = await airtable('Genres').select().all();
const existingGenres = new Set(
  airtableGenres.map(record => record.fields['Name (Arabic)'] as string),
);
const genreNameToAirtableId = airtableGenres.reduce(
  (acc, record) => {
    acc[record.fields['Name (Arabic)'] as string] = record.getId();
    return acc;
  },
  {} as Record<string, string>,
);

const genreChunks = chunk(
  allGenres.filter(g => !existingGenres.has(g)),
  10,
) as (typeof allGenres)[];

let genreCurrentChunk = 1;
for (const chunk of genreChunks) {
  console.log(`[GENRES] Processing chunk ${genreCurrentChunk} / ${genreChunks.length}`);

  const results = await airtable('Genres').create(
    chunk.map(genre => ({
      fields: {
        'Name (Arabic)': genre,
      },
    })),
  );

  results.forEach((result, i) => {
    genreNameToAirtableId[chunk[i]!] = result.getId();
  });

  genreCurrentChunk++;
}

// update books with genres
const recordsToUpdate = airtableTexts.filter(record => {
  const oldGenres = record.fields['Name (Arabic)'] as string;
  return oldGenres && !(record.fields['Genres'] as string[])?.length;
});

const textChunks = chunk(recordsToUpdate, 10) as (typeof recordsToUpdate)[];
let textCurrentChunk = 1;

for (const chunk of textChunks) {
  console.log(`[TEXTS] Processing chunk ${textCurrentChunk} / ${textChunks.length}`);

  try {
    await airtable('Texts').update(
      chunk.map(record => {
        const oldGenres = record.fields['Name (Arabic)'] as string;
        const genres = oldGenres.split('/').map(genre => genre.trim());

        return {
          id: record.getId(),
          fields: {
            'Name (Arabic)': '',
            Genres: genres.map(genre => genreNameToAirtableId[genre]!),
          },
        };
      }),
    );
  } catch (error) {
    console.log(`Error processing chunk ${textCurrentChunk} / ${textChunks.length}: `);
    console.error(error);
  }

  textCurrentChunk++;
}
