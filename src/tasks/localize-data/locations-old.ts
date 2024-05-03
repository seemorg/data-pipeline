import { getLocationsData } from '@/datasources/openiti/locations';
import { env } from '@/env';
import APIQueue from '@/lib/openai-queue';
import { chunk } from '@/utils/array';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const OVERWRITE = true;

const OUTPUT_PATH = path.resolve('output/localized-cities.json');

// { city: { [languageCode]: name } }
let currentLocalizedCities: Record<string, Record<string, string>> = {};

// check if file exists
if (fs.existsSync(OUTPUT_PATH)) {
  currentLocalizedCities = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
}

const cities = [
  ...new Set(
    (await getLocationsData()).map(l => l.city).filter(c => c !== null) as string[],
  ),
];

const schema = z.object({
  ar: z.string(),
});

const queue = new APIQueue(env.OPENAI_API_KEY, {
  'gpt-4-turbo-preview': {
    requestsPerMinute: 5_000,
    tokensPerMinute: 600_000,
  },
});

const batches = chunk(cities, 5) as (typeof cities)[];

let i = 1;
for (const batch of batches) {
  console.log(`Processing batch ${i} / ${batches.length}...`);
  i++;

  const processedBatch = batch.filter(city => {
    if (!OVERWRITE) {
      if (currentLocalizedCities[city] && currentLocalizedCities[city]!.ar) return false;
    }

    return true;
  });

  if (processedBatch.length === 0) continue;

  await Promise.all(
    processedBatch.map(async city => {
      try {
        const completion = await queue.request({
          model: 'gpt-4-turbo-preview',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `
You are an assistant that takes a city name in English as an input and returns a json output with the city name in Arabic.

The schema should match the following: 

Input: al-Madina
Sample Output in English: 
{
  "ar": "المدينة"
}
            `,
            },
            { role: 'user', content: `"${city}"` },
          ],
        });

        const result = completion?.choices?.[0]?.message?.content;
        if (!result) return;

        const parsedResult = schema.safeParse(JSON.parse(result));
        if (!parsedResult.success) return;

        currentLocalizedCities[city] = {
          ...(currentLocalizedCities[city] ?? {}),
          ar: parsedResult.data.ar,
        };
      } catch (e) {
        console.log('Error');
      }
    }),
  );

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(currentLocalizedCities, null, 2));
}
