import fs from 'fs';
import path from 'path';

const AUTHORS_PATH = path.resolve('openiti-to-turath/authors.json');
const BOOKS_PATH = path.resolve('openiti-to-turath/books.json');

const openItiAuthors = JSON.parse(fs.readFileSync(AUTHORS_PATH, 'utf8'));
const openItiBooks = JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf8'));

const totalAuthors = Object.keys(openItiAuthors).length;
const linkedAuthors = Object.values(openItiAuthors).filter(a => a !== null).length;

const totalBooks = Object.keys(openItiBooks).length;
const linkedBooks = Object.values(openItiBooks).filter(a => a !== null).length;

console.log(
  `Total authors: ${linkedAuthors} / ${totalAuthors} (${((linkedAuthors / totalAuthors) * 100).toFixed(2)}%)`,
);
console.log(
  `Total books: ${linkedBooks} / ${totalBooks} (${((linkedBooks / totalBooks) * 100).toFixed(2)}%)`,
);
