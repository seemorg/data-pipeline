import fs from 'fs';
import path from 'path';

const CACHE_PATH = path.resolve('openai-batches/cache.json');

let filePathToCache: Record<string, { batchId?: string; fileId?: string }> = {};
if (fs.existsSync(CACHE_PATH)) {
  filePathToCache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
}

export const openaiFileIdCache = {
  get: (path: string): string | null => {
    return filePathToCache[path]?.fileId ?? null;
  },
  set: (path: string, fileId: string) => {
    filePathToCache[path] = {
      ...(filePathToCache[path] ?? {}),
      fileId,
    };
    fs.writeFileSync(CACHE_PATH, JSON.stringify(filePathToCache, null, 2), 'utf8');
  },
};

export const openaiBatchIdCache = {
  get: (path: string): string | null => {
    return filePathToCache[path]?.batchId ?? null;
  },
  set: (path: string, batchId: string) => {
    filePathToCache[path] = {
      ...(filePathToCache[path] ?? {}),
      batchId,
    };
    fs.writeFileSync(CACHE_PATH, JSON.stringify(filePathToCache, null, 2), 'utf8');
  },
};

export const jsonl = {
  serialize: (data: any[]): string => {
    return data.map(d => JSON.stringify(d)).join('\n');
  },
  deserialize: (data: string): any[] => {
    return data
      .trim()
      .split('\n')
      .map((d, idx) => {
        try {
          return JSON.parse(d);
        } catch (e) {
          console.error(`Error parsing line ${idx + 1}`);
          throw e;
        }
      });
  },
};
