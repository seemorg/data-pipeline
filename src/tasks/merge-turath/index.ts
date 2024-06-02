// import algos from 'string-comparison';
// import { stringSimilarity } from 'string-similarity-js';
import crypto from 'crypto';
// import natural from 'natural';
// const TfIdf = natural.TfIdf;

import fs from 'fs';
import path from 'path';

// function chunkString(str: string, size: number = 1000) {
//   const chunks: string[] = [];
//   for (let i = 0; i < str.length; i += size) {
//     chunks.push(str.slice(i, i + size));
//   }

//   return chunks;
// }

// function averageSimilarity(a: string, b: string) {
//   const aChunks = chunkString(a);
//   const bChunks = chunkString(b);

//   let totalSimilarity = 0;
//   const length = Math.min(aChunks.length, bChunks.length);

//   for (let i = 0; i < length; i++) {
//     totalSimilarity += natural.LevenshteinDistanceSearch(
//       aChunks[i]!,
//       bChunks[i]!,
//     ).distance;
//   }

//   return totalSimilarity / length;
// }

// function getTfIdfVectors(doc1: string, doc2: string) {
//   const tfidf = new TfIdf();
//   tfidf.addDocument(doc1);
//   tfidf.addDocument(doc2);

//   const doc1Vector: number[] = [];
//   const doc2Vector: number[] = [];
//   const allTerms = new Set<string>();

//   // Gather all terms from both documents
//   tfidf.documents.forEach(doc => {
//     Object.keys(doc).forEach(term => {
//       allTerms.add(term);
//     });
//   });

//   // Build vectors for both documents
//   allTerms.forEach(term => {
//     doc1Vector.push(tfidf.tfidf(term, 0));
//     doc2Vector.push(tfidf.tfidf(term, 1));
//   });

//   return [doc1Vector, doc2Vector];
// }

// function cosineSimilarity(vecA: number[], vecB: number[]) {
//   const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i]!, 0);
//   const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
//   const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
//   return (dotProduct / (magnitudeA * magnitudeB)) * 100;
// }

function tokenize(text: string) {
  return text.split(/\W+/).filter(token => token.length > 0);
}

function hashToken(token: string) {
  return crypto.createHash('md5').update(token).digest('hex');
}

function hexToBinary(hex: string) {
  return hex
    .split('')
    .map(char => parseInt(char, 16).toString(2).padStart(4, '0'))
    .join('');
}

function computeSimHash(text: string) {
  const tokens = tokenize(text);
  const hashBits = 128; // Number of bits in MD5 hash
  const vector = new Array(hashBits).fill(0);

  tokens.forEach(token => {
    const tokenHash = hashToken(token);
    const binaryHash = hexToBinary(tokenHash);

    for (let i = 0; i < hashBits; i++) {
      vector[i] += binaryHash[i] === '1' ? 1 : -1;
    }
  });

  return vector.map(bit => (bit >= 0 ? '1' : '0')).join('');
}

function hammingDistance(hash1: string, hash2: string) {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
}

function similarity(hash1: string, hash2: string) {
  const distance = hammingDistance(hash1, hash2);
  return ((hash1.length - distance) / hash1.length) * 100;
}

const OUTPUT_PATH = path.resolve('test/scores.json');

const dump = JSON.parse(fs.readFileSync(path.resolve('test/sample.json'), 'utf8')) as {
  turath: { id: number; text: string };
  openiti: { id: string; versions: { id: string; text: string | null }[] };
}[];

// turath id -> { version id -> score }
const finalMap: Record<number, Record<string, number>> = {};
const before = Date.now();

const texts = dump.flatMap(({ openiti }) => openiti.versions);

for (const entry of dump) {
  const { turath } = entry;

  for (const version of texts) {
    if (!version.text) continue;

    // const score = averageSimilarity(turath.text, version.text);
    // const score = averageSimilarity(turath.text, version.text);
    // const [vecA, vecB] = getTfIdfVectors(turath.text, version.text);
    // const score = cosineSimilarity(vecA!, vecB!);

    if (!finalMap[turath.id]) finalMap[turath.id] = {};

    const simHash1 = computeSimHash(turath.text);
    const simHash2 = computeSimHash(version.text);

    const similarityScore = similarity(simHash1, simHash2);

    finalMap[turath.id]![version.id] = similarityScore;
  }
}

const after = Date.now();
console.log(`Took ${((after - before) / 1000).toFixed(1)}s`);

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalMap, null, 2));
