import { getAuthorsData } from '@/datasources/openiti/authors';
import { getAllAuthors } from '@/datasources/turath/authors';
import natural from 'natural';
import path from 'path';
import fs from 'fs';
import { getAllBooks } from '@/datasources/turath/books';

const OUTPUT_PATH = path.resolve('test/link-authors.json');
const OUTPUT_PATH_BOOKS = path.resolve('test/link-books.json');

function normalizeText(text: string) {
  return (
    text
      .normalize('NFD')
      // replace anything between parentheses or brackets
      .replace(/[\(\[].*?[\)\]]/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
  );
}

const metaphone = new natural.Metaphone();
const tokenizer = new natural.WordTokenizer();

function arePhoneticallySimilar(a: string, b: string) {
  return metaphone.compare(normalizeText(a), normalizeText(b));
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>) {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function semanticSimilarity(a: string, b: string) {
  const tokensA = new Set(tokenizer.tokenize(normalizeText(a)));
  const tokensB = new Set(tokenizer.tokenize(normalizeText(b)));

  return jaccardSimilarity(tokensA, tokensB);
}

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

  if (!deathYearToGroups[author.year]) {
    deathYearToGroups[author.year] = {
      openiti: [],
      turath: [],
    };
  }

  deathYearToGroups[author.year]!.openiti.push(author);
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
const linkedAuthors = new Set<number>();

let i = 1;
const total = Object.keys(deathYearToGroups).length;

for (const year in deathYearToGroups) {
  console.log(`Processing year ${year} (${i} / ${total})`);

  const data = deathYearToGroups[year]!;

  let found = false;
  for (const openitiAuthor of Number(year) === -1 ? openitiAuthors : data.openiti) {
    for (const turathAuthor of data.turath) {
      const openitiNames = openitiAuthor.primaryNames
        .filter(name => name.locale === 'ar' || 'fa')
        .map(name => name.text)
        .concat(
          openitiAuthor.otherNames
            .filter(name => name.locale === 'ar' || 'fa')
            .flatMap(name => name.texts),
        );
      const turathName = turathAuthor.name;

      if (
        openitiNames.some(
          name =>
            name === turathName ||
            normalizeText(name) === normalizeText(turathName) ||
            arePhoneticallySimilar(name, turathName) ||
            semanticSimilarity(name, turathName) > 0.5,
        ) &&
        !linkedAuthors.has(turathAuthor.id) // TODO: track these conflicts to resolve manually
      ) {
        result[openitiAuthor.id] = { id: turathAuthor.id, name: turathAuthor.name };
        linkedAuthors.add(turathAuthor.id);
        found = true;
        break;
      } else {
        // compare their books
        const openitiBooks = openitiAuthor.books;
        const turathBooks =
          turathAuthor.id in turathAuthorIdToBooks
            ? turathAuthorIdToBooks[turathAuthor.id]!
            : [];

        for (const openitiBook of openitiBooks) {
          for (const turathBook of turathBooks) {
            const openitiBookTitle = openitiBook.primaryNames
              .filter(name => name.locale === 'ar' || 'fa')
              .map(name => name.text)
              .concat(
                openitiBook.otherNames
                  .filter(name => name.locale === 'ar' || 'fa')
                  .flatMap(name => name.texts),
              );

            const turathBookTitle = turathBook.name;

            if (
              openitiBookTitle.some(
                name =>
                  name === turathBookTitle ||
                  normalizeText(name) === normalizeText(turathBookTitle) ||
                  arePhoneticallySimilar(name, turathBookTitle) ||
                  semanticSimilarity(name, turathBookTitle) > 0.5,
              ) &&
              !linkedAuthors.has(turathAuthor.id)
            ) {
              result[openitiAuthor.id] = { id: turathAuthor.id, name: turathAuthor.name };
              linkedAuthors.add(turathAuthor.id);
              found = true;
              break;
            }
          }

          if (found) break;
        }
      }
    }

    if (found) break;
  }

  i++;
}

const booksResult: Record<string, number> = {};
const linkedBooks = new Set<number>();

for (const openitiAuthorId in result) {
  const turathAuthorId = result[openitiAuthorId]?.id;
  if (!turathAuthorId) continue;

  const openitiBooks = openitiAuthorIdToAuthor[openitiAuthorId]!.books;
  const turathBooks = turathAuthorIdToBooks[turathAuthorId]!;

  if (!turathBooks) continue;

  // compare the books to link them now
  for (const openitiBook of openitiBooks) {
    for (const turathBook of turathBooks) {
      const openitiBookTitle = openitiBook.primaryNames
        .filter(name => name.locale === 'ar' || 'fa')
        .map(name => name.text)
        .concat(
          openitiBook.otherNames
            .filter(name => name.locale === 'ar' || 'fa')
            .flatMap(name => name.texts),
        );
      const turathBookTitle = turathBook.name;

      if (
        openitiBookTitle.some(
          name =>
            name === turathBookTitle ||
            normalizeText(name) === normalizeText(turathBookTitle) ||
            arePhoneticallySimilar(name, turathBookTitle) ||
            semanticSimilarity(name, turathBookTitle) > 0.5,
        ) &&
        !linkedBooks.has(turathBook.id)
      ) {
        booksResult[openitiBook.id] = { id: turathBook.id, name: turathBook.name };
        linkedBooks.add(turathBook.id);
      }
    }
  }
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
fs.writeFileSync(OUTPUT_PATH_BOOKS, JSON.stringify(booksResult, null, 2));

console.log(`Done!`);
console.log(`Linked ${Object.keys(result).length} / ${openitiAuthors.length} authors.`);
console.log(
  `Linked ${Object.keys(booksResult).length} / ${openitiAuthors.reduce((acc, cur) => acc + cur.books.length, 0)} books.`,
);
