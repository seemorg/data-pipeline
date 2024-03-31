import fs from 'fs';
import path from 'path';
import merge from 'lodash/merge';
import aliases from '../../../output/book-aliases.json';

const OUTPUT_PATH = path.resolve('output/clean-book-aliases.json');

const typedAliases = { ...aliases } as Record<string, Record<string, string[]>>;

Object.keys(typedAliases).forEach(word => {
  // if it's a number, remove it
  const noNumber = word.replace(/\d/g, '').trim();

  if (noNumber.length === 0) {
    // @ts-ignore
    typedAliases[word] = undefined;
    return;
  }

  // remove punctuation, and merge with the same word without punctuation (if it exists)
  const cleanWord = noNumber
    .replaceAll('&quot;', '')
    .replace(/[‏.»,!?;:"'،؛؟\-_(){}\[\]<>@#\$%\^&\*\+=/\\`~]/gi, '')
    .trim();

  if (cleanWord.length === 0) {
    // @ts-ignore
    typedAliases[word] = undefined;
    return;
  }

  if (cleanWord !== word) {
    typedAliases[cleanWord] = merge(typedAliases[cleanWord] || {}, typedAliases[word]);
    // @ts-ignore
    typedAliases[word] = undefined;
  }
});

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(typedAliases, null, 2), 'utf-8');
console.log('Done!');
