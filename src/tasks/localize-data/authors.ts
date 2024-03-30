import { openai } from '@/lib/openai';
import { AuthorDocument } from '@/types';
import { chunk } from '@/utils/array';
import fs from 'fs';
import path from 'path';

const languages = [
  {
    code: 'ar',
    name: 'Arabic',
  },
  {
    code: 'fr',
    name: 'French',
  },
];

const languageCodeToLanguage = languages.reduce(
  (acc, lang) => {
    acc[lang.code] = lang;
    return acc;
  },
  {} as Record<string, (typeof languages)[number]>,
);

const OUTPUT_PATH = path.resolve('output/localized-bios.json');

// { authorId: { [languageCode]: bio } }
let currentLocalizedBios: Record<string, Record<string, string>> = {};

// check if file exists
if (fs.existsSync(OUTPUT_PATH)) {
  currentLocalizedBios = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
}

export const localizeAuthorBios = async (
  authors: AuthorDocument[],
): Promise<
  (AuthorDocument & {
    bios: Record<string, string>; // language -> bio
  })[]
> => {
  const batches = chunk(authors, 10) as AuthorDocument[][];

  for (const batch of batches) {
    const all = batch.flatMap(author => {
      return languages
        .map(language => {
          // if it already exists, skip
          if (
            currentLocalizedBios[author.id] &&
            currentLocalizedBios[author.id]![language.code]
          )
            return null;

          return {
            authorId: author.id,
            languageCode: language.code,
            bio: author.bio,
          };
        })
        .filter(a => a !== null) as {
        authorId: string;
        languageCode: string;
        bio: string;
      }[];
    });

    const indexToAuthorId = all.reduce(
      (acc, { authorId }, index) => {
        acc[index] = authorId;
        return acc;
      },
      {} as Record<number, string>,
    );

    const indexToLanguageCode = all.reduce(
      (acc, { languageCode }, index) => {
        acc[index] = languageCode;
        return acc;
      },
      {} as Record<number, string>,
    );

    const data = await openai.completions.create({
      model: 'gpt-4',
      prompt: all.map(({ bio, languageCode }) => {
        const lang = languageCodeToLanguage[languageCode]!;
        return `Translate the following English Biography text to ${lang.name}:\n\n${bio}`;
      }),
    });

    for (const choice of data.choices) {
      const authorId = indexToAuthorId[choice.index];
      const languageCode = indexToLanguageCode[choice.index];

      if (!authorId || !languageCode) continue;

      const bio = choice.text;

      if (!currentLocalizedBios[authorId]) {
        currentLocalizedBios[authorId] = {};
      }

      currentLocalizedBios[authorId]![languageCode] = bio;
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(currentLocalizedBios, null, 2), 'utf-8');
  }

  return [];
};
