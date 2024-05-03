import { openai } from '@/lib/openai';
import fs from 'fs';
import path from 'path';
import { languages } from './languages';
import { jsonl, openaiBatchIdCache, openaiFileIdCache } from '@/lib/openai-batch/utils';
import { getRegionsData } from '@/datasources/openiti/regions';
import type { ChatCompletion } from 'openai/resources/index.mjs';

const BATCH_INPUT_PATH = path.resolve('openai-batches/localize-regions.jsonl');
const OUTPUT_PATH = path.resolve('openai-batches/localize-regions-output.json');

const task = process.argv.find(arg => arg.startsWith('--task='))?.split('=')?.[1];

if (!task) {
  console.error('Please provide a task (create, retrieve)');
  process.exit(1);
}

const regions = await getRegionsData();

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

  // authorId -> languageCode -> { primaryName, bio }
  const results: Record<
    string,
    Record<string, { primaryName?: string; currentName?: string; overview?: string }>
  > = {};

  outputData.forEach(response => {
    const customId = response.custom_id;
    const body = response.response.body;

    const [regionId, languageCode, field] = customId.split(':');

    if (!regionId || !languageCode || !field) {
      return;
    }

    if (!results[regionId]) {
      results[regionId] = {};
    }

    if (!results[regionId]![languageCode]) {
      results[regionId]![languageCode] = {};
    }

    const languageObject = results[regionId]![languageCode]!;

    const content = body.choices[0]?.message?.content;
    if (!content) {
      return;
    }

    const contentJson = JSON.parse(content);

    if (field === 'name') {
      const { primaryName, currentName } = contentJson;
      if (!primaryName || !currentName) return;

      languageObject.primaryName = primaryName;
      languageObject.currentName = currentName;
    } else if (field === 'overview') {
      const { overview } = contentJson;
      if (!overview) return;

      languageObject.overview = overview;
    }
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  console.log('Output written to: ', OUTPUT_PATH);

  process.exit(0);
}

// task === 'create'
const batch = regions.flatMap(region => {
  const result = [];

  for (const language of languages) {
    if (language.code === 'en' || language.code === 'ar') continue;

    result.push({
      custom_id: `${region.id}:${language.code}:name`,
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: 'gpt-4-turbo',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `
You are an assistant that takes a JSON about a region as input, and returns the primary and current names of the region in ${language.name}.

Sample Output:
{
  "primaryName": "...",
  "currentName": "..."
}
              `,
          },
          {
            role: 'user',
            content: JSON.stringify({
              primaryName: region.name,
              primaryArabicName: region.arabicName,
              currentName: region.currentName,
            }),
          },
        ],
      },
    });
  }

  for (const language of languages) {
    if (language.code === 'en') continue;

    result.push({
      custom_id: `${region.id}:${language.code}:overview`,
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: 'gpt-4-turbo',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `
You are an assistant that takes a JSON about important regions in Islamic History as input, and generates an overview in ${language.name} that's between 80 and 100 words.

The readers of the bio are deeply knowledgeable of Islam and History. 

Sample Output: 
{
  "overview": "...",
}
              `,
          },
          {
            role: 'user',
            content: JSON.stringify({
              primaryName: region.name,
              primaryArabicName: region.arabicName,
              currentName: region.currentName,
            }),
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
