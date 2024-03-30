// Given an input.json with a list of Arabic names, create an output.json with the same list of names but with more variations and transliterated into English.

import { getBooksData } from '@/datasources/openiti/books';
import { openai } from '@/lib/openai';
import { chunk } from '@/utils/array';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const OUTPUT_PATH = path.resolve('output/book-name-variations.json');
const outputExists = fs.existsSync(OUTPUT_PATH);

const output = (
  outputExists ? JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')) : {}
) as Record<
  string,
  {
    primary_name: string;
    variations: string[];
  }
>;

const schema = z.object({
  primary_name: z.string(),
  variations: z.array(z.string()),
});

const books = await getBooksData({ populateAuthor: false });
const chunks = chunk(books.slice(0, 5), 5) as (typeof books)[];

let i = 0;
for (const batch of chunks) {
  console.log(`Processing batch ${++i} of ${chunks.length}...`);
  i++;

  // const processedBatch = batch.filter(
  //   author => !authorsOutput[author.id] && author.primaryArabicName,
  // );
  const processedBatch = batch.filter(author => author.primaryArabicName);

  if (processedBatch.length === 0) continue;

  await Promise.all(
    processedBatch.map(async book => {
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `
You are an assistant that takes an Arabic name for an book as input, and returns a json with different variations of that name in english, and a primary name (most popular). Variations include: short forms (if they're popular or famous with that name), full names, and different transliterations with diacritics. Don't include duplicates.
  
The schema should match the following: 
Input: لأشباه والنظائر

Output: 
{
  "primary_name": "Ashbah wa al-Nazair",
  "variations": ["Al-Ashbah wa al-Nazair", "Ashbāh wa-al-Naẓāʾir", "Al-Ashbah wa'l-naza'ir", "Ashbah wa al-Nazair", "Ashbah wa al-Nazaer"]
}

The more popular names should appear first in the array.
`.trim(),
          },
          { role: 'user', content: book.primaryArabicName! },
        ],
        model: 'gpt-4-turbo-preview',
        response_format: { type: 'json_object' },
      });

      try {
        const result = completion.choices[0]?.message.content;
        if (!result) return;

        const parsedResult = schema.safeParse(JSON.parse(result));
        if (!parsedResult.success) return;

        output[book.id] = parsedResult.data;
      } catch (e) {}
    }),
  );

  // prettify the output and write it to the file
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
}
