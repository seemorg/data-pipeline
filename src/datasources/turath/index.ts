// we need to make 4 json files:
// 1. map of openiti authorId to openiti author info
// 2. map of openiti bookId to openiti book info
// 3. map of turath authorId to turath author info
// 4. map of turath bookId to turath book info

// import { getAuthorsData } from '../openiti/authors';
// import { getBooksData } from '../openiti/books';
// import { getAllAuthors } from './authors';
import { chunk } from '@/utils/array';
import { getAllBooks, getBookById } from './books';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.resolve('turath');

// const openItiBooks = await getBooksData({ populateAuthor: true });
// const openItiAuthors = await getAuthorsData({ populateBooks: false });

// const turathBooks = await getAllBooks();
// const turathAuthors = await getAllAuthors();

// const openItiAuthorIdToOpenItiAuthorInfo = openItiAuthors.reduce(
//   (acc, author) => {
//     acc[author.id] = {
//       names: author.primaryNames.filter(n => n.locale === 'en' || n.locale === 'ar'),
//       otherNames: author.otherNames.filter(n => n.locale === 'en' || n.locale === 'ar'),
//       deathYear: author.year,
//     };
//     return acc;
//   },
//   {} as Record<string, any>,
// );

// const openItiBookIdToOpenItiBookInfo = openItiBooks.reduce(
//   (acc, book) => {
//     acc[book.id] = {
//       names: book.primaryNames.filter(n => n.locale === 'en' || n.locale === 'ar'),
//       otherNames: book.otherNames.filter(n => n.locale === 'en' || n.locale === 'ar'),
//       authorId: book.author.id,
//     };
//     return acc;
//   },
//   {} as Record<string, any>,
// );

// const turathAuthorIdToTurathAuthorInfo = turathAuthors.reduce(
//   (acc, author) => {
//     acc[author.id] = {
//       name: author.name,
//       death: author.death,
//     };
//     return acc;
//   },
//   {} as Record<string, any>,
// );

// const turathBookIdToTurathBookInfo = turathBooks.reduce(
//   (acc, book) => {
//     acc[book.id] = {
//       name: book.name,
//       author: turathAuthorIdToTurathAuthorInfo[book.author_id],
//       authorId: book.author_id,
//     };
//     return acc;
//   },
//   {} as Record<string, any>,
// );

// // store files
``;
// // check dir
// if (!fs.existsSync(OUTPUT_DIR)) {
//   fs.mkdirSync(OUTPUT_DIR);
// }

// fs.writeFileSync(
//   path.resolve(OUTPUT_DIR, 'openitiBookInfo.json'),
//   JSON.stringify(openItiBookIdToOpenItiBookInfo, null, 2),
// );

// fs.writeFileSync(
//   path.resolve(OUTPUT_DIR, 'openitiAuthorInfo.json'),
//   JSON.stringify(openItiAuthorIdToOpenItiAuthorInfo, null, 2),
// );

// fs.writeFileSync(
//   path.resolve(OUTPUT_DIR, 'turathAuthorInfo.json'),
//   JSON.stringify(turathAuthorIdToTurathAuthorInfo, null, 2),
// );

// fs.writeFileSync(
//   path.resolve(OUTPUT_DIR, 'turathBookInfo.json'),
//   JSON.stringify(turathBookIdToTurathBookInfo, null, 2),
// );

// console.log('done');

const allBooks = (await getAllBooks()).filter(b => {
  // if the file already exists, skip
  return !fs.existsSync(path.resolve(OUTPUT_DIR, `${b.id}.json`));
});

const chunks = chunk(allBooks, 20) as (typeof allBooks)[];
let i = 1;

for (const chunk of chunks) {
  console.log(`Processing chunk ${i} / ${chunks.length}`);

  const results = await Promise.all(chunk.map(c => getBookById(c.id)));

  results.forEach(book => {
    fs.writeFileSync(
      path.resolve(OUTPUT_DIR, `${book.meta.id}.json`),
      JSON.stringify(book, null, 2),
    );
  });

  i++;
}
