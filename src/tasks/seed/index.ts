const files = ['./genre.ts', './region.ts', './location.ts', './author.ts', './book.ts'];

for (const file of files) {
  await import(file);
}
