import { getAuthorsData } from '@/datasources/openiti/authors';
import { getAllAuthors } from '@/datasources/turath/authors';
import natural from 'natural';
import path from 'path';
import fs from 'fs';
import { getAllBooks } from '@/datasources/turath/books';
import { getHighestScore, jaroWinkler, normalizeText } from './utils';

const AUTHORS_OUTPUT_PATH = path.resolve('test/link-authors.json');
const AUTHORS_CANDIDATES_PATH = path.resolve('test/link-authors-candidates.json');
const AUTHORS_CONFLICTS_PATH = path.resolve('test/link-authors-conflicts.json');

const BOOKS_OUTPUT_PATH = path.resolve('test/link-books.json');
const BOOKS_CANDIDATES_PATH = path.resolve('test/link-books-candidates.json');
const BOOKS_CONFLICTS_PATH = path.resolve('test/link-books-conflicts.json');

const openitiAuthors = await getAuthorsData({ populateBooks: true });
const openitiAuthorIdToAuthor = openitiAuthors.reduce(
  (acc, author) => {
    acc[author.id] = author;
    return acc;
  },
  {} as Record<string, (typeof openitiAuthors)[number]>,
);

const openitiBookIdToBook = openitiAuthors
  .flatMap(a => a.books)
  .reduce(
    (acc, book) => {
      acc[book.id] = book;
      return acc;
    },
    {} as Record<string, (typeof openitiAuthors)[number]['books'][number]>,
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

console.log(turathAuthors.filter(author => !author.death).length);

const THRESHOLD = 0.9;
const doesNamesMatch = (
  a: string | string[],
  b: string | string[],
  t = THRESHOLD,
): 'EXACT_MATCH' | 'NORMALIZED_MATCH' | 'JARO_WINKLER_MATCH' | null => {
  if (Array.isArray(a) || Array.isArray(b)) {
    let method: ReturnType<typeof doesNamesMatch> | null = null;

    for (const name of Array.isArray(a) ? a : [a]) {
      for (const name2 of Array.isArray(b) ? b : [b]) {
        method = doesNamesMatch(name, name2, t);
        if (method !== null) return method;
      }
    }

    return method;
  }

  if (a === b) return 'EXACT_MATCH';
  if (normalizeText(a) === normalizeText(b)) return 'NORMALIZED_MATCH';
  if (jaroWinkler(a, b) > t || jaroWinkler(normalizeText(a), normalizeText(b)) > t)
    return 'JARO_WINKLER_MATCH';

  return null;
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
const candidates: Record<
  string,
  { id: number; name: string; score: number; match_method: string }[]
> = {};
const candidatesIds: Record<string, Set<number>> = {};

let i = 1;
const total = Object.keys(deathYearToGroups).length;

for (const year in deathYearToGroups) {
  console.log(`Processing year ${year} (${i} / ${total})`);

  if (Number(year) === -1) continue;

  const data = deathYearToGroups[year]!;

  const batchOpenitiAuthors = Number(year) === -1 ? openitiAuthors : data.openiti;

  for (const openitiAuthor of batchOpenitiAuthors) {
    let found = false;

    for (const turathAuthor of data.turath) {
      // TODO: track these conflicts to resolve manually
      if (candidatesIds[openitiAuthor.id]?.has(turathAuthor.id)) continue;

      const openitiNames = getOpenitiNames(openitiAuthor);
      const turathName = turathAuthor.name;
      const method = doesNamesMatch(openitiNames, turathName, 0.6);

      if (method !== null) {
        // if (linkedAuthors.has(turathAuthor.id)) {
        //   conflicts[openitiAuthor.id] = {
        //     id: turathAuthor.id,
        //     name: turathAuthor.name,
        //   };
        // } else {
        //   result[openitiAuthor.id] = { id: turathAuthor.id, name: turathAuthor.name };
        //   linkedAuthors.add(turathAuthor.id);
        //   found = true;
        //   break;
        // }
        candidates[openitiAuthor.id] = candidates[openitiAuthor.id] || [];
        candidatesIds[openitiAuthor.id] = candidatesIds[openitiAuthor.id] || new Set();
        candidatesIds[openitiAuthor.id]!.add(turathAuthor.id);
        candidates[openitiAuthor.id]!.push({
          id: turathAuthor.id,
          name: turathAuthor.name,
          score: getHighestScore(openitiNames, [turathName]),
          match_method: method,
        });
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
            const method = doesNamesMatch(openitiBookTitles, turathBookTitle, 0.6);

            if (method !== null) {
              // if (linkedAuthors.has(turathAuthor.id)) {
              //   conflicts[openitiAuthor.id] = {
              //     id: turathAuthor.id,
              //     name: turathAuthor.name,
              //   };
              // } else {
              //   result[openitiAuthor.id] = {
              //     id: turathAuthor.id,
              //     name: turathAuthor.name,
              //   };
              //   linkedAuthors.add(turathAuthor.id);
              //   found = true;
              //   break;
              // }
              candidates[openitiAuthor.id] = candidates[openitiAuthor.id] || [];
              candidates[openitiAuthor.id]!.push({
                id: turathAuthor.id,
                name: turathAuthor.name,
                score: getHighestScore(openitiBookTitles, [turathBookTitle]),
                match_method: `${method} (book)`,
              });
              candidatesIds[openitiAuthor.id] =
                candidatesIds[openitiAuthor.id] || new Set();
              candidatesIds[openitiAuthor.id]!.add(turathAuthor.id);
            }
          }

          if (found) break;
        }
      }
    }
  }

  i++;
}

// now, we'll loop over the candidates and select the best match
// if there are multiple candidates for an author (both have a high score), we'll add them to the conflicts
const result: Record<string, { id: number; name: string }> = {};
// const conflicts: Record<string, { id: number; name: string }[]> = {};
const linkedAuthors: Record<
  number,
  { id: string; name: string | null; score: number }[]
> = {};

for (const authorId in candidates) {
  const authorCandidates = candidates[authorId]!;
  if (authorCandidates.length === 0) {
    continue;
  }

  let bestMatch = authorCandidates.reduce(
    (acc, cur) => (cur.score > acc.score ? cur : acc),
    authorCandidates[0]!,
  );
  // if (bestMatch.score < 0.85) bestMatch = null;

  // if (authorCandidates.length > 1) {
  //   conflicts[authorId] = authorCandidates.map(({ id, name }) => ({ id, name }));
  // }

  if (bestMatch) {
    result[authorId] = { id: bestMatch.id, name: bestMatch.name, score: bestMatch.score };
    if (!linkedAuthors[bestMatch.id]) linkedAuthors[bestMatch.id] = [];
    linkedAuthors[bestMatch.id]!.push({
      id: authorId,
      name:
        openitiAuthorIdToAuthor[authorId]!.primaryNames.find(
          name => (name.locale === 'ar' || name.locale === 'fa') && name.text,
        )?.text ?? null,
      score: bestMatch.score,
    });
  }
}

// get entries with multiple authors linked to the same turath author
const conflicts = Object.entries(linkedAuthors).reduce(
  (acc, [turathAuthorId, openitiAuthors]) => {
    if (openitiAuthors.length > 1 && !openitiAuthors.find(author => author.score === 1)) {
      acc[turathAuthorId] = openitiAuthors;
    }

    return acc;
  },
  {} as Record<string, (typeof linkedAuthors)[number]>,
);

// loop over conflicts and temporarily link them to the highest scoring author
for (const turathAuthorId in conflicts) {
  const authors = conflicts[turathAuthorId]!;
  const bestMatch = authors.reduce(
    (acc, cur) => (cur.score > acc.score ? cur : acc),
    authors[0]!,
  );

  result[bestMatch.id] = {
    id: Number(turathAuthorId),
    name: bestMatch.name as string,
    score: bestMatch.score,
  };

  for (const author of authors) {
    if (author.id !== bestMatch.id) {
      delete result[author.id]; // remove the other authors
    }
  }
}

const booksCandidates: Record<string, { id: number; name: string; score: number }[]> = {};
const booksCandidatesIds: Record<string, Set<number>> = {};

for (const openitiAuthorId in result) {
  const turathAuthorId = result[openitiAuthorId]?.id;
  if (!turathAuthorId) continue;

  const openitiBooks = openitiAuthorIdToAuthor[openitiAuthorId]!.books;
  const turathBooks = turathAuthorIdToBooks[turathAuthorId]!;

  if (!turathBooks) continue;

  // compare the books to link them now
  for (const openitiBook of openitiBooks) {
    for (const turathBook of turathBooks) {
      if (booksCandidatesIds[openitiBook.id]?.has(turathBook.id)) continue;

      const openitiBookTitles = getOpenitiNames(openitiBook);
      const turathBookTitle = turathBook.name;
      const method = doesNamesMatch(openitiBookTitles, turathBookTitle, 0.6);

      if (method !== null) {
        booksCandidates[openitiBook.id] = booksCandidates[openitiBook.id] || [];
        booksCandidatesIds[openitiBook.id] =
          booksCandidatesIds[openitiBook.id] || new Set();
        booksCandidatesIds[openitiBook.id]!.add(turathBook.id);
        booksCandidates[openitiBook.id]!.push({
          id: turathBook.id,
          name: turathBook.name,
          score: getHighestScore(openitiBookTitles, [turathBookTitle]),
        });
      }
    }
  }
}

const booksResult: Record<string, { id: number; name: string; score: number }> = {};
const linkedBooks: Record<number, { id: string; name: string | null; score: number }[]> =
  {};

for (const bookId in booksCandidates) {
  const bookCandidates = booksCandidates[bookId]!;
  if (bookCandidates.length === 0) {
    continue;
  }

  let bestMatch = bookCandidates.reduce(
    (acc, cur) => (cur.score > acc.score ? cur : acc),
    bookCandidates[0]!,
  );
  if (bestMatch.score < 0.85) bestMatch = null;

  if (bestMatch) {
    booksResult[bookId] = {
      id: bestMatch.id,
      name: bestMatch.name,
      score: bestMatch.score,
    };
    if (!linkedBooks[bestMatch.id]) linkedBooks[bestMatch.id] = [];
    linkedBooks[bestMatch.id]!.push({
      id: bookId,
      name:
        openitiBookIdToBook[bookId]!.primaryNames.find(
          name => (name.locale === 'ar' || name.locale === 'fa') && name.text,
        )?.text ?? null,
      score: bestMatch.score,
    });
  }
}

const booksConflicts = Object.entries(linkedBooks).reduce(
  (acc, [turathBookId, openitiBooks]) => {
    if (openitiBooks.length > 1 && !openitiBooks.find(author => author.score === 1)) {
      acc[turathBookId] = openitiBooks;
    }

    return acc;
  },
  {} as Record<string, (typeof linkedBooks)[number]>,
);

fs.writeFileSync(AUTHORS_OUTPUT_PATH, JSON.stringify(result, null, 2));
fs.writeFileSync(AUTHORS_CANDIDATES_PATH, JSON.stringify(candidates, null, 2));
fs.writeFileSync(AUTHORS_CONFLICTS_PATH, JSON.stringify(conflicts, null, 2));

fs.writeFileSync(BOOKS_OUTPUT_PATH, JSON.stringify(booksResult, null, 2));
fs.writeFileSync(BOOKS_CANDIDATES_PATH, JSON.stringify(booksCandidates, null, 2));
fs.writeFileSync(BOOKS_CONFLICTS_PATH, JSON.stringify(booksConflicts, null, 2));

console.log('Done!');
console.log(
  `Linked ${Object.keys(result).length} / ${openitiAuthors.length} authors. Conflicts: ${
    Object.keys(conflicts).length
  }`,
);

console.log(
  `Linked ${Object.keys(booksResult).length} / ${openitiAuthors.reduce((acc, cur) => acc + cur.books.length, 0)} books. Conflicts: ${
    Object.keys(booksConflicts).length
  }`,
);

process.exit(0);
