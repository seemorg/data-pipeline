import { db } from '@/db';

await db.book.deleteMany();

const files = ['./region.ts', './location.ts', './genre.ts', './author.ts', './book.ts'];

for (const file of files) {
  await import(file);
}
