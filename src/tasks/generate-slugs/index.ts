import { getAuthorsData } from '@/datasources/openiti/authors';
import { getBooksData } from '@/datasources/openiti/books';
import { getLocationsData } from '@/datasources/openiti/locations';
import { createUniqueSlug } from '@/datasources/openiti/utils';
import fs from 'fs';
import path from 'path';

const AUTHORS_OUTPUT_PATH = path.resolve('data/author-slugs.json');
const BOOKS_OUTPUT_PATH = path.resolve('data/book-slugs.json');
const LOCATIONS_OUTPUT_PATH = path.resolve('data/location-slugs.json');

// ---- Authors ----
const authorSlugsExists = fs.existsSync(AUTHORS_OUTPUT_PATH);
const authorSlugs = (
  authorSlugsExists ? JSON.parse(fs.readFileSync(AUTHORS_OUTPUT_PATH, 'utf8')) : {}
) as Record<string, string>; // id -> slug

const authorSlugsSet = new Set<string>();
const authors = await getAuthorsData({ populateBooks: false });

for (const author of authors) {
  if (authorSlugs[author.id]) continue;

  const slug = createUniqueSlug(author.id, authorSlugsSet);
  authorSlugs[author.id] = slug;
}

// Save the slugs to a file
fs.writeFileSync(AUTHORS_OUTPUT_PATH, JSON.stringify(authorSlugs, null, 2));

// ---- Books ----
const bookSlugsExists = fs.existsSync(BOOKS_OUTPUT_PATH);
const bookSlugs = (
  bookSlugsExists ? JSON.parse(fs.readFileSync(BOOKS_OUTPUT_PATH, 'utf8')) : {}
) as Record<string, string>; // id -> slug

const bookSlugsSet = new Set<string>();
const books = await getBooksData({ populateAuthor: false });

for (const book of books) {
  if (bookSlugs[book.id]) continue;

  const [, bookId] = book.id.split('.');
  const slug = createUniqueSlug(bookId ?? book.id, bookSlugsSet);
  bookSlugs[book.id] = slug;
}

// Save the slugs to a file
fs.writeFileSync(BOOKS_OUTPUT_PATH, JSON.stringify(bookSlugs, null, 2));

// ---- Locations ----
const locationsSlugsExists = fs.existsSync(LOCATIONS_OUTPUT_PATH);
const locationsSlugs = (
  locationsSlugsExists ? JSON.parse(fs.readFileSync(LOCATIONS_OUTPUT_PATH, 'utf8')) : {}
) as Record<string, string>; // location -> slug

const locationsSlugsSet = new Set<string>();
const locationsData = await getLocationsData();
const locationIdToName = locationsData.reduce(
  (acc, location) => {
    const id = location.id.split('@')[1];
    if (id) acc[id] = location.name;

    return acc;
  },
  {} as Record<string, string>,
);

const allDistinctLocationsIds = Object.keys(locationIdToName);

for (const locationId of allDistinctLocationsIds) {
  if (locationsSlugs[locationId]) continue;

  const name = locationIdToName[locationId]!;
  const slug = createUniqueSlug(name, locationsSlugsSet);
  locationsSlugs[locationId] = slug;
}

// Save the slugs to a file
fs.writeFileSync(LOCATIONS_OUTPUT_PATH, JSON.stringify(locationsSlugs, null, 2));
