import { getAuthorsData } from '@/datasources/openiti/authors';
import { openai } from '@/lib/openai';
import fs from 'fs';
import path from 'path';
import { languages } from './languages';

const languagesWithoutArabic = languages.filter(lang => lang.code !== 'ar');
const languagesWithoutEnglish = languages.filter(lang => lang.code !== 'en');
const languagesWithoutArabicAndEnglish = languages.filter(
  lang => lang.code !== 'ar' && lang.code !== 'en',
);

const sampleAuthorSlugs = [
  'nawawi',
  'ibn-taymiyya',
  'bukhari',
  'ibn-hazm',
  'ibn-maja',
  'ibn-hanbal',
];

const authors = (await getAuthorsData({ populateBooks: false })).filter(author =>
  sampleAuthorSlugs.includes(author.slug),
);

// const outputPath = path.resolve('samples/authors-names.json');
// const results = await Promise.all(
//   authors.map(async author => {
//     return await Promise.all(
//       languagesWithoutArabicAndEnglish.map(async language => {
//         try {
//           const response = await openai.chat.completions.create({
//             model: 'gpt-4-turbo',
//             response_format: { type: 'json_object' },
//             messages: [
//               {
//                 role: 'system',
//                 content: `
//   You are an assistant that takes a JSON about a prominent historical figure as input, and returns the ${language.name} name of the figure.

//   Sample Output:
//   {
//     "primaryName": "..."
//   }
//         `,
//               },
//               {
//                 role: 'user',
//                 content: JSON.stringify({
//                   primaryArabicName: author.primaryArabicName,
//                   primaryLatinName: author.primaryLatinName,
//                   otherArabicNames: author.otherArabicNames,
//                   otherLatinNames: author.otherLatinNames,
//                 }),
//               },
//             ],
//           });

//           const result = response?.choices?.[0]?.message?.content;
//           if (!result) return '';

//           return { [author.id]: { [language.code]: JSON.parse(result) } };
//         } catch (e) {
//           return '';
//         }
//       }),
//     );
//   }),
// );

// fs.writeFileSync(
//   outputPath,
//   JSON.stringify(
//     results.reduce(
//       (acc, cur) => {
//         cur.forEach((author: any) => {
//           const authorId = Object.keys(author)[0]!;
//           const authorData = author[authorId];
//           if (!acc[authorId]) acc[authorId] = {};
//           acc[authorId] = { ...acc[authorId], ...authorData };
//         });
//         return acc;
//       },
//       {} as Record<string, Record<string, Record<string, string>>>,
//     ),
//     null,
//     2,
//   ),
//   'utf-8',
// );

// // ---------------
// const outputPath = path.resolve('samples/authors-bios.json');
// const results = await Promise.all(
//   authors.map(async author => {
//     return await Promise.all(
//       languagesWithoutEnglish.map(async language => {
//         try {
//           const response = await openai.chat.completions.create({
//             model: 'gpt-4-turbo',
//             response_format: { type: 'json_object' },
//             messages: [
//               {
//                 role: 'system',
//                 content: `
// You are an assistant that takes a JSON about a prominent historical figure as input, and generates a bio in ${language.name} that's between 80 and 100 words.

// In the bio:
// Don't include other names for the figure
// Don't include general statements like "key/prominent figure"
// Do not include criticisms of the authors
// Do not mention his birth or death dates
// Do not mention the legacy and impact that he had
// You can talk about their popular works

// The readers of the bio are deeply knowledgeable of Islam and History.

// Sample Output:
// {
//   "bio": "...",
// }
//         `,
//               },
//               {
//                 role: 'user',
//                 content: JSON.stringify({
//                   primaryArabicName: author.primaryArabicName,
//                   primaryLatinName: author.primaryLatinName,
//                   otherArabicNames: author.otherArabicNames,
//                   otherLatinNames: author.otherLatinNames,
//                 }),
//               },
//             ],
//           });

//           const result = response?.choices?.[0]?.message?.content;
//           if (!result) return '';

//           return { [author.id]: { [language.code]: JSON.parse(result) } };
//         } catch (e) {
//           return '';
//         }
//       }),
//     );
//   }),
// );

// fs.writeFileSync(
//   outputPath,
//   JSON.stringify(
//     results.reduce(
//       (acc, cur) => {
//         cur.forEach((author: any) => {
//           const authorId = Object.keys(author)[0]!;
//           const authorData = author[authorId];
//           if (!acc[authorId]) acc[authorId] = {};
//           acc[authorId] = { ...acc[authorId], ...authorData };
//         });
//         return acc;
//       },
//       {} as Record<string, Record<string, Record<string, string>>>,
//     ),
//     null,
//     2,
//   ),
//   'utf-8',
// );
