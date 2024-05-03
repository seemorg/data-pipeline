import { db } from '@/db';

await db.book.deleteMany();

const files = ['./author.ts', './book.ts'];

for (const file of files) {
  await import(file);
}
