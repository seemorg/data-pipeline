import { env } from '@/env';
import { listAllObjects, uploadToR2 } from '@/lib/r2';
import { sleep } from '@/utils/functions';
import Vibrant from 'node-vibrant';
// import * as ColorTheif from 'colorthief';

interface CreatePredictionResponse {
  id: string;
  model: string;
  version: string;
  input: Record<string, any>;
  logs: string;
  error?: any;
  status: string;
  created_at: string;
  urls: {
    cancel: string;
    get: string;
  };
}

export const generatePattern = async ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => {
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
    },
    body: JSON.stringify({
      version: 'a42692c54c0f407f803a0a8a9066160976baedb77c91171a01730f9b0d7beeff',
      input: {
        width,
        height,
        prompt: 'Islamic pattern',
        // scheduler: 'K-LMS',
        // num_outputs: 1,
        // guidance_scale: 7.5,
        // prompt_strength: 0.8,
        // num_inference_steps: 50,
      },
    }),
  });

  if (response.status !== 201) {
    let error = await response.json();
    console.log(error.detail);
    throw new Error(error.detail);
  }

  const prediction: CreatePredictionResponse = await response.json();
  let logs = prediction.logs;

  while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
    await sleep(1000);
    const { error, data, detail } = await fetchPredictionById(prediction.id);

    if (error) {
      console.log(`Error: ${detail}`);
      throw new Error(detail);
    }

    logs = data.logs;
    console.log(`Status: ${data.status}, Percent: ${parseLogs(logs)}%`);

    if (data.status === 'succeeded') {
      return data.output;
    }

    if (data.status === 'failed') {
      throw new Error(data.error);
    }
  }
};

const parseLogs = (logs: string) => {
  if (!logs) {
    return 0;
  } else {
    const lastLine = logs.split('\n').slice(-1)[0];
    const pct = lastLine?.split('%')[0] || 0;
    return pct;
  }
};

const fetchPredictionById = async (id: string) => {
  const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: {
      Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status !== 200) {
    let error = await response.json();
    return { error: true as const, detail: error?.detail };
  }

  const data = (await response.json()) as GetPredictionResponse;
  return { error: false as const, data };
};

interface GetPredictionResponse {
  id: string;
  model: string;
  version: string;
  input: Record<string, any>;
  logs: string;
  output: string;
  error?: any;
  status: string;
  created_at: string;
  started_at: string;
  completed_at: string;
  metrics: {
    predict_time: number;
  };
  urls: {
    cancel: string;
    get: string;
  };
}

export async function generatePatternWithColors(
  slug: string,
  objects: Set<string>,
  override = false,
) {
  const key = `patterns/${slug}.png`;
  let patternUrl;
  let pattern;

  if (objects.has(key) && !override) {
    patternUrl = `https://assets.digitalseem.org/${key}`;
    pattern = await fetch(patternUrl);
  } else {
    const url = await generatePattern({ width: 512, height: 512 });
    if (!url) return;

    patternUrl = url;
    pattern = await fetch(patternUrl);
  }

  let patternBuffer = Buffer.from(await pattern.arrayBuffer());

  if (!objects.has(key) || override) {
    console.log('Uploading pattern...');
    await uploadToR2(`patterns/${slug}.png`, patternBuffer, {
      contentType: 'image/png',
    });
  }

  let palette = await Vibrant.from(patternBuffer).getPalette();
  let colors = [
    palette.Vibrant,
    palette.LightVibrant,
    palette.DarkVibrant,
    palette.Muted,
    palette.DarkMuted,
    palette.LightMuted,
  ];

  // make sure the whole image is not black
  const isValidPattern = colors.some(c => c?.hex !== '#000000' && c?.hex !== '#000');
  if (isValidPattern) {
    const containerColor =
      colors.sort((a, b) => (b?.population ?? 1) - (a?.population ?? 1))[0]?.hex ??
      '#000';

    return { containerColor, patternBuffer };
  }

  // generate again
  return generatePatternWithColors(slug, objects, true);
}
