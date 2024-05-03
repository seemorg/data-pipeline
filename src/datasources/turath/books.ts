import fs from 'fs';
import path from 'path';
// const https://files.turath.io/books-v3/149871.json

interface Data {
  cats: Record<string, { name: string; books: number[] }>;
  authors: Record<string, { name: string; death: number; books: number[] }>;
  books: Record<
    string,
    {
      id: number;
      author_id: number;
      cat_id: number;
      has_pdf: boolean;
      size: number;
      page_count: number;
      name: string;
      death: number;
      books: number[];
    }
  >;
}

const dataUrl = 'https://files.turath.io/data-v3.json';

// console.log(await (await fetch('https://files.turath.io/books-v3/147927.json')).json());
