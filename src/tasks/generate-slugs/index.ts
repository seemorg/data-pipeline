import { getAuthorsData } from '@/datasources/openiti/authors';
import { getBooksData } from '@/datasources/openiti/books';
import { createUniqueSlug } from '@/datasources/openiti/utils';
import fs from 'fs';
import path from 'path';

const AUTHORS_OUTPUT_PATH = path.resolve('data/author-slugs.json');
const BOOKS_OUTPUT_PATH = path.resolve('data/book-slugs.json');

const authorSlugsExists = fs.existsSync(AUTHORS_OUTPUT_PATH);
const authorSlugs = (
  authorSlugsExists ? JSON.parse(fs.readFileSync(AUTHORS_OUTPUT_PATH, 'utf8')) : {}
) as Record<string, string>; // id -> slug

const authorSlugsSet = new Set<string>();
const authors = await getAuthorsData({ populateBooks: false });

for (const author of authors) {
  const slug = createUniqueSlug(author.id, authorSlugsSet);
  authorSlugs[author.id] = slug;
}

// Save the slugs to a file
fs.writeFileSync(AUTHORS_OUTPUT_PATH, JSON.stringify(authorSlugs, null, 2));

const bookSlugsExists = fs.existsSync(BOOKS_OUTPUT_PATH);
const bookSlugs = (
  bookSlugsExists ? JSON.parse(fs.readFileSync(BOOKS_OUTPUT_PATH, 'utf8')) : {}
) as Record<string, string>; // id -> slug

const bookSlugsSet = new Set<string>();
const books = await getBooksData({ populateAuthor: false });

for (const book of books) {
  const [, bookId] = book.id.split('.');
  const slug = createUniqueSlug(bookId ?? book.id, bookSlugsSet);
  bookSlugs[book.id] = slug;
}

// Save the slugs to a file
fs.writeFileSync(BOOKS_OUTPUT_PATH, JSON.stringify(bookSlugs, null, 2));
