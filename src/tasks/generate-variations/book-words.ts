// Given an input.json with a list of Arabic names, create an output.json with the same list of names but with more variations and transliterated into English.
import { getBooksData } from '@/datasources/openiti/books';
import { chunk } from '@/utils/array';
import bigJson from 'big-json';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { APIQueue } from '../../lib/openai-queue';
import { env } from '@/env';

const OVERWRITE = true;
const OUTPUT_PATH = path.resolve('output/book-aliases.json');
const outputExists = fs.existsSync(OUTPUT_PATH);
let output = {} as Record<string, Record<string, string[]>>;

if (outputExists) {
  const readStream = fs.createReadStream(OUTPUT_PATH, { encoding: 'utf-8' });
  const parseStream = bigJson.createParseStream();

  parseStream.on('data', function (pojo) {
    output = pojo;
  });

  // @ts-ignore
  readStream.pipe(parseStream);
}

// a non-blocking function to sync the output to the file
const syncOutput = async () => {
  return new Promise<void>((resolve, reject) => {
    fs.createWriteStream(OUTPUT_PATH, { flags: 'w' }).write(
      JSON.stringify(output, null, 2),
      'utf-8',
      err => {
        if (err) reject(err);
        else {
          resolve();
        }
      },
    );
  });
};

const languages = [
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

const SYSTEM_PROMPT = `
You are an assistant that takes an Arabic word as an input and returns a json output with the many possible spellings of the word when written in Urdu:
  
The schema should match the following: 

Input: موطأ
Sample Output in English: 
{
  "variations": ["Muwatta", "Muwata", "Mowatta", "Mowata", "Muwatā", "Muwattā", "Mūwaṭṭā’"]
}
`.trim();

// Mūwāṭā
// Muwaṭṭa'
// Al-Muwāṭṭā'
// Mūwaṭā
// Al-Muwaṭa
//
// Muwāṭa'
// Al-Muwāṭa
// Muwattaa
// Mūwaṭā’
// Muwattā
//
// Al-Muwaṭṭā
// Muwata
// Mūṭā’
// Muwatta
// Muwatta'
// Al-Muwatta
// Al-Muwatta'
// Al-Muwaṭṭa'
// Al-Muwaṭṭā’

const schema = z.object({
  ...languages.reduce(
    (acc, lang) => {
      acc[lang.code] = z.array(z.string()).optional();
      return acc;
    },
    {} as Record<string, any>,
  ),
});

const books = await getBooksData({ populateAuthor: false, limit: 30 });
const queue = new APIQueue(env.OPENAI_API_KEY, {
  'gpt-4-turbo-preview': {
    requestsPerMinute: 5_000,
    tokensPerMinute: 600_000,
  },
});

const chunks = chunk(books, 3) as (typeof books)[];

let i = 1;
for (const batch of chunks) {
  console.log(`Processing batch ${i} of ${chunks.length}...`);
  i++;

  const processedBatch = batch.filter(book => book.primaryArabicName);
  if (processedBatch.length === 0) continue;

  let wordsInChunk = processedBatch.flatMap(book => book.primaryArabicName!.split(' '));
  if (!OVERWRITE) {
    wordsInChunk = wordsInChunk.filter(word => !output[word]);
  }

  if (wordsInChunk.length === 0) continue;

  await Promise.all(
    wordsInChunk.map(async word => {
      try {
        const completion = await queue.request({
          model: 'gpt-4-turbo-preview',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `"${word}"` },
          ],
        });

        const result = completion?.choices?.[0]?.message?.content;
        if (!result) return;

        const parsedResult = JSON.parse(result);
        // if (!parsedResult.success) return;

        output[word] = { ...(output[word] ?? {}), ur: parsedResult.variations };
      } catch (e) {
        console.log('Error');
      }
    }),
  );

  // every 5 chunks, sync the output to the file
  if (i % 5 === 0) {
    await syncOutput();
  }
}

await syncOutput();

// try {
//   const completion = await queue.request({
//     model: 'gpt-4-turbo-preview',
//     response_format: { type: 'json_object' },
//     messages: [
//       { role: 'system', content: SYSTEM_PROMPT },
//       { role: 'user', content: '"موطأ"' },
//     ],
//   });

//   const result = completion?.choices?.[0]?.message?.content;
//   if (result) {
//     const parsedResult = JSON.parse(result);
//     // if (!parsedResult.success) return;

//     output['موطأ'] = parsedResult;
//   }
// } catch (e) {
//   console.log('Error');
// }
// await syncOutput();
