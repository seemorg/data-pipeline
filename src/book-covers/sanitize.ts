import { listAllObjects, uploadToR2 } from '@/lib/r2';
import { generatePatternWithColors } from './pattern';
import { getScreenshot } from './lib';
import { getBookHtml } from './html';
import { getAuthorsData } from '@/datasources/openiti/authors';

const objects = (await listAllObjects('patterns/')).filter(object => object.Size === 842);

if (objects.length === 0) {
  console.log('No invalid patterns found');
  process.exit(0);
}

console.log(`Found ${objects.length} invalid patterns`);

const authors = await getAuthorsData({ populateBooks: true });
const authorIdToAuthor = authors.reduce(
  (acc, { books, ...author }) => {
    acc[author.id] = author;
    return acc;
  },
  {} as Record<string, Omit<(typeof authors)[number], 'books'>>,
);

const allBooks = authors.flatMap(author =>
  author.books.map(book => ({ ...book, authorId: author.id })),
);
const slugToBook = allBooks.reduce(
  (acc, book) => {
    acc[book.slug] = book;
    return acc;
  },
  {} as Record<string, (typeof allBooks)[number]>,
);

let i = 1;
for (const object of objects) {
  console.log(`Processing pattern ${i} / ${objects.length}`);
  i++;

  // regenerate pattern and cover
  const slug = object.Key?.replace('patterns/', '')?.replace('.png', '');

  if (!slug) {
    console.log('Invalid slug');
    continue;
  }

  const book = slugToBook[slug];
  if (!book) {
    console.log('Book not found');
    continue;
  }

  const author = authorIdToAuthor[book.authorId];
  if (!author) {
    console.log('Author not found');
    continue;
  }

  const coverKey = `covers/${slug}.png`;

  let patternResult: Awaited<ReturnType<typeof generatePatternWithColors>>;

  while (!patternResult) {
    try {
      patternResult = await generatePatternWithColors(slug, new Set());
    } catch (e) {}
  }

  const { containerColor, patternBuffer } = patternResult;
  const bgBase64 = patternBuffer.toString('base64');
  const html = getBookHtml({
    title: book.primaryArabicName ?? book.primaryLatinName,
    author: author.primaryArabicName ?? author.primaryLatinName ?? '',
    containerColor,
    bgBase64,
  });

  let coverFile: Buffer | undefined;
  while (!coverFile) {
    try {
      console.log('Generating cover...');
      coverFile = await getScreenshot(html, 'png');
      console.log('Uploading cover...');
    } catch (e) {}
  }

  let success = false;
  while (!success) {
    try {
      await uploadToR2(coverKey, coverFile, {
        contentType: 'image/png',
      });
      success = true;
    } catch (e) {
      success = false;
    }
  }
}
