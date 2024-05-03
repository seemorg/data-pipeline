import { getBooksData } from '@/datasources/openiti/books';
import { openai } from '@/lib/openai';
import fs from 'fs';
import path from 'path';
import { languages } from './languages';

const languagesWithoutArabic = languages.filter(lang => lang.code !== 'ar');
const languagesWithoutEnglish = languages.filter(lang => lang.code !== 'en');
const languagesWithoutArabicAndEnglish = languages.filter(
  lang => lang.code !== 'ar' && lang.code !== 'en',
);

const sampleBookSlugs = [
  'risala',
  'sahih', // sahih al-bukhari
  'sunan-3', // sunan ibn majah
  'riyad-salihin',
  'tafsir-quran-6',
  'bidaya-1', // al-bidaya wa al-nihaya ibn kathir
  'qisas-anbiya-1',
];

const outputPath = path.resolve('samples/books.json');
const books = (await getBooksData({ populateAuthor: true })).filter(book =>
  sampleBookSlugs.includes(book.slug),
);

const results = await Promise.all(
  books.map(async book => {
    return Promise.all(
      languagesWithoutArabicAndEnglish.map(async language => {
        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `
  You are an assistant that takes a JSON about a book as input, and returns the ${language.name} name of the book.
  
  Sample Output:
  {
    "primaryName": "..."
  }
        `,
              },
              {
                role: 'user',
                content: JSON.stringify({
                  primaryArabicName: book.primaryArabicName,
                  primaryLatinName: book.primaryLatinName,
                  otherArabicNames: book.otherArabicNames,
                  otherLatinNames: book.otherLatinNames,
                }),
              },
            ],
          });

          const result = response?.choices?.[0]?.message?.content;
          if (!result) return '';

          return { [book.id]: { [language.code]: JSON.parse(result) } };
        } catch (e) {
          return '';
        }
      }),
    );
  }),
);

fs.writeFileSync(
  outputPath,
  JSON.stringify(
    results.reduce(
      (acc, cur) => {
        cur.forEach((book: any) => {
          const bookId = Object.keys(book)[0]!;
          const bookData = book[bookId];
          if (!acc[bookId]) acc[bookId] = {};
          acc[bookId] = { ...acc[bookId], ...bookData };
        });
        return acc;
      },
      {} as Record<string, Record<string, Record<string, string>>>,
    ),
    null,
    2,
  ),
  'utf-8',
);
