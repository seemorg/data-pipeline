import { openai } from '@/lib/openai';
import fs from 'fs';
import path from 'path';
import { languages } from './languages';
import { jsonl, openaiBatchIdCache, openaiFileIdCache } from '@/lib/openai-batch/utils';
import { getLocationsData } from '@/datasources/openiti/locations';
import type { ChatCompletion } from 'openai/resources/index.mjs';

const BATCH_INPUT_PATH = path.resolve('openai-batches/localize-locations.jsonl');
const OUTPUT_PATH = path.resolve('openai-batches/localize-locations-output.json');

const task = process.argv.find(arg => arg.startsWith('--task='))?.split('=')?.[1];

if (!task) {
  console.error('Please provide a task (create, retrieve)');
  process.exit(1);
}

const cities = [
  ...new Set(
    (await getLocationsData()).map(l => l.city).filter(c => c !== null) as string[],
  ),
];

if (task === 'retrieve') {
  if (!fs.existsSync(BATCH_INPUT_PATH)) {
    console.error('Batch input file does not exist');
    process.exit(1);
  }

  const batchId = openaiBatchIdCache.get(BATCH_INPUT_PATH);
  if (!batchId) {
    console.error('No Batch ID set');
    process.exit(1);
  }

  const batchResults = await openai.batches.retrieve(batchId);
  // if status is not completed or cancelled, exit
  if (batchResults.status !== 'completed' && batchResults.status !== 'cancelled') {
    console.error(`Batch Status: ${batchResults.status}`);
    process.exit(1);
  }

  const outputId = batchResults.output_file_id;
  if (!outputId) {
    console.error('No output file ID');
    process.exit(1);
  }

  const output = await openai.files.content(outputId);
  const outputText = await output.text();

  const outputData = jsonl.deserialize(outputText) as {
    custom_id: string;
    response: {
      body: ChatCompletion;
    };
  }[];

  // authorId -> languageCode -> { name }
  const results: Record<string, Record<string, { name?: string }>> = {};

  outputData.forEach(({ custom_id, response: { body } }) => {
    const [city, languageCode, field] = custom_id.split(':');
    if (!city || !languageCode || !field) {
      return;
    }

    if (!results[city]) {
      results[city] = {};
    }

    if (!results[city]![languageCode]) {
      results[city]![languageCode] = {};
    }

    const content = body.choices[0]?.message?.content;
    if (!content) {
      return;
    }

    const contentJson = JSON.parse(content);

    if (field === 'name') {
      const name = contentJson.name;
      if (!name) return;
      results[city]![languageCode]!.name = name;
    }
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  console.log('Output written to: ', OUTPUT_PATH);

  process.exit(0);
}

// task === 'create'
const batch = cities.flatMap(city => {
  const result = [];

  for (const language of languages) {
    if (language.code === 'en' || language.code === 'ar') continue;

    result.push({
      custom_id: `${city}:${language.code}:name`,
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: 'gpt-4-turbo',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `
You are an assistant that takes a city name in English as an input and returns a json output with the city name in ${language.name}.

The schema should match the following: 

Sample Output: 
{
  "name": "..."
}
              `,
          },
          {
            role: 'user',
            content: `"${city}"`,
          },
        ],
      },
    });
  }

  return result;
});

fs.writeFileSync(BATCH_INPUT_PATH, jsonl.serialize(batch), 'utf-8');

console.log('Uploading file to OpenAI...');

// create an openai file
const response = await openai.files.create({
  purpose: 'batch' as any,
  file: fs.createReadStream(BATCH_INPUT_PATH, 'utf-8'),
});
const fileId = response.id;
openaiFileIdCache.set(BATCH_INPUT_PATH, fileId);

console.log('Creating batch...');

const batchResponse = await openai.batches.create({
  input_file_id: fileId,
  endpoint: '/v1/chat/completions',
  completion_window: '24h',
});

openaiBatchIdCache.set(BATCH_INPUT_PATH, batchResponse.id);

console.log('Done!');
