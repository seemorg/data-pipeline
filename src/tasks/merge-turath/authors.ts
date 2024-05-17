import { getAuthorsData } from '@/datasources/openiti/authors';
import { getAllAuthors } from '@/datasources/turath/authors';
import natural from 'natural';
import path from 'path';
import fs from 'fs';
import { getAllBooks } from '@/datasources/turath/books';
import { jaroWinkler, normalizeText } from './utils';

const openitiAuthors = await getAuthorsData({ populateBooks: true });
const openitiAuthorIdToAuthor = openitiAuthors.reduce(
  (acc, author) => {
    acc[author.id] = author;
    return acc;
  },
  {} as Record<string, (typeof openitiAuthors)[number]>,
);

const turathAuthors = await getAllAuthors();
const turathAuthorIdToBooks = (await getAllBooks()).reduce(
  (acc, book) => {
    acc[book.author_id] = acc[book.author_id] || [];
    acc[book.author_id]!.push(book);
    return acc;
  },
  {} as Record<number, Awaited<ReturnType<typeof getAllBooks>>>,
);

// count turath authors with year
console.log(
  `${turathAuthors.filter(author => author.death).length} / ${turathAuthors.length} authors have death year.`,
);

const OUTPUT_PATH = path.resolve('test/link-authors.json');
const CONFLICTS_OUTPUT_PATH = path.resolve('test/link-authors-conflicts.json');
const OUTPUT_PATH_BOOKS = path.resolve('test/link-books.json');

// const turathAuthor = turathAuthors.find(author => author.id === 7)!;
// const openitiAuthor = openitiAuthors.find(author => author.slug === 'suyuti')!;

// const tokenizer = new natural.WordTokenizer();
// const metaphone = new natural.Metaphone();

// function arePhoneticallySimilar(a: string, b: string) {
//   return metaphone.compare(normalizeText(a), normalizeText(b));
// }

// function semanticSimilarity(a: string, b: string) {
//   const tokensA = new Set(tokenizer.tokenize(normalizeText(a)));
//   const tokensB = new Set(tokenizer.tokenize(normalizeText(b)));

//   // jaccard similarity
//   const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
//   const union = new Set([...tokensA, ...tokensB]);
//   return intersection.size / union.size;
// }

const THRESHOLD = 0.9;
const doesNamesMatch = (a: string | string[], b: string | string[]): boolean => {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (Array.isArray(a) ? a : [a]).some(name =>
      (Array.isArray(b) ? b : [b]).some(name2 => doesNamesMatch(name, name2)),
    );
  }

  return (
    a === b ||
    normalizeText(a) === normalizeText(b) ||
    jaroWinkler(a, b) > THRESHOLD ||
    jaroWinkler(normalizeText(a), normalizeText(b)) > THRESHOLD
  );
};

const getOpenitiNames = (
  author:
    | (typeof openitiAuthors)[number]
    | (typeof openitiAuthors)[number]['books'][number],
) => {
  return [
    ...new Set(
      author.primaryNames
        .filter(name => name.locale === 'ar' || name.locale === 'fa')
        .map(name => name.text)
        .concat(
          author.otherNames
            .filter(name => name.locale === 'ar' || name.locale === 'fa')
            .flatMap(name => name.texts),
        ),
    ),
  ];
};

// console.log({
//   openitiNames: getOpenitiNames(openitiAuthor),
//   turathName: turathAuthor.name,
//   normalized: {
//     openiti: getOpenitiNames(openitiAuthor).map(normalizeText),
//     turath: normalizeText(turathAuthor.name),
//   },
//   match: doesNamesMatch(getOpenitiNames(openitiAuthor), turathAuthor.name),
//   scores: getOpenitiNames(openitiAuthor).map(name =>
//     jaroWinkler(name, turathAuthor.name),
//   ),
//   normalizedScores: getOpenitiNames(openitiAuthor).map(name =>
//     jaroWinkler(normalizeText(name), normalizeText(turathAuthor.name)),
//   ),
// });

/**
 *
 * {
  openitiNames: [
    'جلال الدين السيوطي',
    'جلال الدین سیوطی',
    'جلال الدين، أبو الفضل عبد الرحمان بن أبي بكر بن محمد جلال الدين الخضيري الأسيوطي'
  ],
  turathName: 'الجلال السيوطي',
  normalized: {
    openiti: [
      'جلال الدين السيوطي',
      'جلال الدین سیوطی',
      'جلال الدين، أبو الفضل عبد الرحمان بن أبي بكر بن محمد جلال الدين الخضيري الأسيوطي'
    ],
    turath: 'الجلال السيوطي'
  },
  match: false,
  scores: [ 0.7830687830687829, 0.6964285714285715, 0.544047619047619 ],
  normalizedScores: [ 0.7830687830687829, 0.6964285714285715, 0.544047619047619 ]
}
 */

const deathYearToGroups: Record<
  number,
  {
    openiti: typeof openitiAuthors;
    turath: typeof turathAuthors;
  }
> = {};

for (const author of openitiAuthors) {
  let key = -1;
  if (author.year) key = author.year;

  if (!deathYearToGroups[key]) {
    deathYearToGroups[key] = {
      openiti: [],
      turath: [],
    };
  }

  deathYearToGroups[key]!.openiti.push(author);
}

for (const author of turathAuthors) {
  let key = -1;
  if (author.death) key = author.death;

  if (!deathYearToGroups[key]) {
    deathYearToGroups[key] = {
      openiti: [],
      turath: [],
    };
  }

  deathYearToGroups[key]!.turath.push(author);
}

// openiti id -> turath id
const result: Record<string, number> = {};
const conflicts: Record<string, number> = {};
const linkedAuthors = new Set<number>();

let i = 1;
const total = Object.keys(deathYearToGroups).length;

for (const year in deathYearToGroups) {
  console.log(`Processing year ${year} (${i} / ${total})`);

  if (Number(year) === -1) continue;

  const data = deathYearToGroups[year]!;

  const batchOpenitiAuthors =
    Number(year) === -1 ? openitiAuthors.filter(({ id }) => !result[id]) : data.openiti;

  for (const openitiAuthor of batchOpenitiAuthors) {
    let found = false;

    for (const turathAuthor of data.turath) {
      // TODO: track these conflicts to resolve manually
      // if (linkedAuthors.has(turathAuthor.id)) continue;

      const openitiNames = getOpenitiNames(openitiAuthor);
      const turathName = turathAuthor.name;

      if (doesNamesMatch(openitiNames, turathName)) {
        if (linkedAuthors.has(turathAuthor.id)) {
          conflicts[openitiAuthor.id] = {
            id: turathAuthor.id,
            name: turathAuthor.name,
          };
        } else {
          result[openitiAuthor.id] = { id: turathAuthor.id, name: turathAuthor.name };
          linkedAuthors.add(turathAuthor.id);
          found = true;
          break;
        }
      } else {
        // compare their books
        const openitiBooks = openitiAuthor.books;
        const turathBooks =
          turathAuthor.id in turathAuthorIdToBooks
            ? turathAuthorIdToBooks[turathAuthor.id]!
            : [];
        for (const openitiBook of openitiBooks) {
          for (const turathBook of turathBooks) {
            const openitiBookTitles = getOpenitiNames(openitiBook);
            const turathBookTitle = turathBook.name;
            if (doesNamesMatch(openitiBookTitles, turathBookTitle)) {
              if (linkedAuthors.has(turathAuthor.id)) {
                conflicts[openitiAuthor.id] = {
                  id: turathAuthor.id,
                  name: turathAuthor.name,
                };
              } else {
                result[openitiAuthor.id] = {
                  id: turathAuthor.id,
                  name: turathAuthor.name,
                };
                linkedAuthors.add(turathAuthor.id);
                found = true;
                break;
              }
            }
          }
          if (found) break;
        }
      }
    }
  }

  i++;
}

// const booksResult: Record<string, number> = {};
// const linkedBooks = new Set<number>();

// for (const openitiAuthorId in result) {
//   const turathAuthorId = result[openitiAuthorId]?.id;
//   if (!turathAuthorId) continue;

//   const openitiBooks = openitiAuthorIdToAuthor[openitiAuthorId]!.books;
//   const turathBooks = turathAuthorIdToBooks[turathAuthorId]!;

//   if (!turathBooks) continue;

//   // compare the books to link them now
//   for (const openitiBook of openitiBooks) {
//     for (const turathBook of turathBooks) {
//       const openitiBookTitle = openitiBook.primaryNames
//         .filter(name => name.locale === 'ar' || 'fa')
//         .map(name => name.text)
//         .concat(
//           openitiBook.otherNames
//             .filter(name => name.locale === 'ar' || 'fa')
//             .flatMap(name => name.texts),
//         );
//       const turathBookTitle = turathBook.name;

//       if (
//         openitiBookTitle.some(
//           name =>
//             name === turathBookTitle ||
//             normalizeText(name) === normalizeText(turathBookTitle) ||
//             arePhoneticallySimilar(name, turathBookTitle) ||
//             semanticSimilarity(name, turathBookTitle) > 0.5,
//         ) &&
//         !linkedBooks.has(turathBook.id)
//       ) {
//         booksResult[openitiBook.id] = { id: turathBook.id, name: turathBook.name };
//         linkedBooks.add(turathBook.id);
//       }
//     }
//   }
// }

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
fs.writeFileSync(CONFLICTS_OUTPUT_PATH, JSON.stringify(conflicts, null, 2));
// fs.writeFileSync(OUTPUT_PATH_BOOKS, JSON.stringify(booksResult, null, 2));

console.log(`Done!`);
console.log(
  `Linked ${Object.keys(result).length} / ${openitiAuthors.length} authors. Conflicts: ${Object.keys(conflicts).length}`,
);
// console.log(
//   `Linked ${Object.keys(booksResult).length} / ${openitiAuthors.reduce((acc, cur) => acc + cur.books.length, 0)} books.`,
// );
