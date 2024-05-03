const files = [
  './index-authors.ts',
  './index-books.ts',
  './index-genres.ts',
  './index-regions.ts',
  './index-search.ts',
];

for (const file of files) {
  await import(file);
}
