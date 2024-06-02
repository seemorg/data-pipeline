import type { TurathAllDataResponse } from '@/types/turath/all';
import type { TurathBookResponse } from '@/types/turath/book';

const bookKeysMap = `
meta id name type printed pdf_links info info_long version \
author_id cat_id date_built author_page_start indexes volumes \
headings print_pg_to_pg volume_bounds page_map page_headings non_author
`
  .trim()
  .split(' ');

const unObfuscateKeys = (s: string) =>
  s.replace(/"([ً-ٟ])":/g, (m, m1) => `"${bookKeysMap[m1.charCodeAt(0) - 0x064b]}":`);

export const getAllBooks = async () => {
  const data: TurathAllDataResponse = await (
    await fetch('https://files.turath.io/data-v3.json')
  ).json();

  return Object.values(data.books);
};

export const getBookById = async (id: number | string) => {
  const text = await (await fetch(`https://files.turath.io/books-v3/${id}.json`)).text();
  return JSON.parse(unObfuscateKeys(text)) as TurathBookResponse;
};
