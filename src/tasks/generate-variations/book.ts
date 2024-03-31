// Given an input.json with a list of Arabic names, create an output.json with the same list of names but with more variations and transliterated into English.

import { getBooksData } from '@/datasources/openiti/books';
import { openai } from '@/lib/openai';
import { chunk } from '@/utils/array';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const OUTPUT_PATH = path.resolve('output/book-name-variations.json');
const outputExists = fs.existsSync(OUTPUT_PATH);

const languages = [
  {
    code: 'ar',
    name: 'Arabic',
  },
  {
    code: 'en',
    name: 'English',
  },
  {
    code: 'fa',
    name: 'Persian',
  },
  {
    code: 'ur',
    name: 'Urdu',
  },
  {
    code: 'hi',
    name: 'Hindi',
  },
  {
    code: 'fr',
    name: 'French',
  },
  {
    code: 'tr',
    name: 'Turkish',
  },
  {
    code: 'es',
    name: 'Spanish',
  },
  {
    code: 'ms',
    name: 'Malay',
  },
  {
    code: 'ru',
    name: 'Russian',
  },
  {
    code: 'bn',
    name: 'Bengali',
  },
  {
    code: 'ha',
    name: 'Hausa',
  },
  {
    code: 'so',
    name: 'Somali',
  },
  {
    code: 'ps',
    name: 'Pashto',
  },
];

const languageSchema = z.object({
  translation: z.string(),
  transliteration: z.string(),
});

const output = (
  outputExists ? JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')) : {}
) as Record<string, Record<string, z.infer<typeof languageSchema>>>;

const schema = z.object({
  ar: languageSchema,
  en: languageSchema,
  fa: languageSchema,
  ur: languageSchema,
  hi: languageSchema,
  fr: languageSchema,
  tr: languageSchema,
  es: languageSchema,
  ms: languageSchema,
  ru: languageSchema,
  bn: languageSchema,
  ha: languageSchema,
  so: languageSchema,
  ps: languageSchema,
});

console.log('loading books...');

const books = await getBooksData({ populateAuthor: false, limit: 5 });
console.log('done...');

const chunks = chunk(books, 5) as (typeof books)[];

let i = 1;
for (const batch of chunks) {
  console.log(`Processing batch ${i} of ${chunks.length}...`);
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
You are an assistant that takes an Arabic name for a book as input, and returns a json with each locale code that maps to a translation and transliteration of the name, both in that language.

Supported locales are only: ${languages.map(l => `${l.code} (${l.name})`).join(', ')}
  
The schema should match the following: 
Input: لأشباه والنظائر

Output: 
{
  "en": {
    "translation": "Similarities and Parallels",
    "transliteration": "Al-Ashbah wa al-Nazair"
  },
  "ar": {
    "translation": "لأشباه والنظائر",
    "transliteration": "لأشباه والنظائر"
  },
  "hi": {
    "translation": "समानताएं और समांतर",
    "transliteration": "समानताएं और समांतर"
  }
  ...
}
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
