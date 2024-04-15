import { getBooksData } from '@/datasources/openiti/books';
import { airtable } from '@/lib/airtable';
import { chunk } from '@/utils/array';

const books = await getBooksData({ populateAuthor: false });
const chunks = chunk(books, 10) as (typeof books)[];

const authorIdToAirtableId = (await airtable('Authors').select().all()).reduce(
  (acc, record) => {
    acc[record.fields.id as string] = record.getId();
    return acc;
  },
  {} as Record<string, string>,
);

let i = 1;
for (const chunk of chunks) {
  console.log(`Processing chunk ${i} / ${chunks.length}`);

  try {
    await airtable('OpenITI Texts').create(
      chunk.map(record => {
        const authorAirtableId = authorIdToAirtableId[record.authorId];

        return {
          fields: {
            id: record.id,
            'Name (Arabic)': record.primaryArabicName,
            'Name (English)': record.primaryLatinName,
            'Other Names (comma separated)': record.otherArabicNames
              .concat(record.otherLatinNames)
              .join(', '),
            Author: authorAirtableId ? [authorAirtableId] : [],
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
