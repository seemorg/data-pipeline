import { openai } from '@/lib/openai';
import fs from 'fs';
import path from 'path';
import { languages } from './languages';
import { jsonl, openaiBatchIdCache, openaiFileIdCache } from '@/lib/openai-batch/utils';
import type { ChatCompletion } from 'openai/resources/index.mjs';
import { getAuthorsData } from '@/datasources/openiti/authors';
import { chunk } from '@/utils/array';

const BATCH_INPUT_PATH = path.resolve('openai-batches/localize-authors/');
const OUTPUT_PATH = path.resolve('openai-batches/localize-authors-output/');

const task = process.argv.find(arg => arg.startsWith('--task='))?.split('=')?.[1];

if (!task) {
  console.error('Please provide a task (create, retrieve, check)');
  process.exit(1);
}

const authors = await getAuthorsData({ populateBooks: false });

if (task === 'check') {
  // check the status of the batch
  const filesInPath = fs.readdirSync(BATCH_INPUT_PATH);

  for (const batchFileName of filesInPath) {
    const batchId = openaiBatchIdCache.get(path.join(BATCH_INPUT_PATH, batchFileName));
    if (!batchId) {
      console.error('No Batch ID set for: ' + batchFileName);
      process.exit(1);
    }

    const batchResults = await openai.batches.retrieve(batchId);
    console.log(`${batchFileName}: [${batchResults.status}]`);
  }

  process.exit(0);
} else if (task === 'retrieve') {
  if (!fs.existsSync(BATCH_INPUT_PATH)) {
    console.error('Batch input file does not exist');
    process.exit(1);
  }

  const filesInPath = fs.readdirSync(BATCH_INPUT_PATH);

  for (const batchFileName of filesInPath) {
    const batchId = openaiBatchIdCache.get(path.join(BATCH_INPUT_PATH, batchFileName));
    if (!batchId) {
      console.error('No Batch ID set for: ' + batchFileName);
      process.exit(1);
    }

    const batchResults = await openai.batches.retrieve(batchId);
    // if status is not completed or cancelled, exit
    if (batchResults.status !== 'completed' && batchResults.status !== 'cancelled') {
      if (batchResults.errors?.data) {
        console.log('Errors:');
        console.log(batchResults.errors?.data);
      }

      console.error(`Batch Status: ${batchResults.status}`);
      continue;
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
      Record<string, { primaryName?: string; bio?: string }>
    > = {};

    let errors = '';

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

      try {
        const contentJson = JSON.parse(content);

        if (field === 'name') {
          const { primaryName } = contentJson;
          if (!primaryName) return;

          languageObject.primaryName = primaryName;
        } else if (field === 'bio') {
          const { bio } = contentJson;
          if (!bio) return;

          languageObject.bio = bio;
        }
      } catch (e) {
        console.log('Error parsing: ' + customId);
        errors += `${customId}: \n` + content + '\n';
      }
    });

    if (!fs.existsSync(OUTPUT_PATH)) {
      fs.mkdirSync(OUTPUT_PATH, { recursive: true });
    }

    fs.writeFileSync(
      path.join(OUTPUT_PATH, batchFileName.split('.')[0] + '.json'),
      JSON.stringify(results, null, 2),
      'utf-8',
    );

    fs.writeFileSync(
      path.join(OUTPUT_PATH, batchFileName.split('.')[0] + '-errors.txt'),
      errors,
      'utf-8',
    );

    console.log('Output written to: ', path.join(OUTPUT_PATH, batchFileName));
  }

  process.exit(0);
}

// task === 'create'
const batch = authors.flatMap(author => {
  const result = [];

  for (const language of languages) {
    if (language.code === 'en' || language.code === 'ar') continue;

    result.push({
      custom_id: `${author.id}:${language.code}:name`,
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: 'gpt-4-turbo',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `
You are an assistant that takes a JSON about a prominent historical figure as input, and returns the ${language.name} name of the figure.

Sample Output:
{
  "primaryName": "..."
}
              `,
          },
          {
            role: 'user',
            content: JSON.stringify({
              primaryArabicName: author.primaryArabicName,
              primaryLatinName: author.primaryLatinName,
              otherArabicNames: author.otherArabicNames,
              otherLatinNames: author.otherLatinNames,
            }),
          },
        ],
      },
    });
  }

  for (const language of languages) {
    if (language.code === 'en') continue;

    result.push({
      custom_id: `${author.id}:${language.code}:bio`,
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: 'gpt-4-turbo',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `
You are an assistant that takes a JSON about a prominent historical figure as input, and generates a bio in ${language.name} that's between 80 and 100 words.

In the bio:
Don't include other names for the figure
Don't include general statements like "key/prominent figure"
Do not include criticisms of the authors
Do not mention his birth or death dates
Do not mention the legacy and impact that he had
You can talk about their popular works

The readers of the bio are deeply knowledgeable of Islam and History.

Sample Output:
{
  "bio": "...",
}
            `,
          },
          {
            role: 'user',
            content: JSON.stringify({
              primaryArabicName: author.primaryArabicName,
              primaryLatinName: author.primaryLatinName,
              otherArabicNames: author.otherArabicNames,
              otherLatinNames: author.otherLatinNames,
            }),
          },
        ],
      },
    });
  }

  return result;
});

const chunks = chunk(batch, 50_000) as (typeof batch)[][];
let i = 1;

for (const ch of chunks) {
  const chunkPath = path.join(BATCH_INPUT_PATH, `batch-${i}.jsonl`);

  // ensure the directory exists
  if (!fs.existsSync(BATCH_INPUT_PATH)) {
    fs.mkdirSync(BATCH_INPUT_PATH, { recursive: true });
  }

  fs.writeFileSync(chunkPath, jsonl.serialize(ch), 'utf-8');

  console.log(`Uploading chunk ${i} / ${chunks.length} to OpenAI...`);

  // create an openai file
  const response = await openai.files.create({
    purpose: 'batch' as any,
    file: fs.createReadStream(chunkPath, 'utf-8'),
  });
  const fileId = response.id;
  openaiFileIdCache.set(chunkPath, fileId);

  console.log(`Creating batch for chunk ${i} / ${chunks.length}...`);

  const batchResponse = await openai.batches.create({
    input_file_id: fileId,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
  });

  openaiBatchIdCache.set(chunkPath, batchResponse.id);
  i++;
}

console.log('Done!');
