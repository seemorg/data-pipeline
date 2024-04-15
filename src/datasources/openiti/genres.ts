import { GenreDocument } from '@/types/genre';
import { getBooksData } from './books';
import { toTitleCase } from '@/utils/string';
import { createUniqueSlug } from './utils';

const toReadableName = (id: string) => {
  const formatted = id.replace(/_/g, ' ').replace(/-/g, ' ').trim();

  const [src, newName] = formatted.split('@');
  return toTitleCase((newName ?? src) as string);
};

export const getGenresData = async (): Promise<GenreDocument[]> => {
  const books = await getBooksData({ populateAuthor: false });

  const genresToBooksCount: Record<string, number> = {};

  books.forEach(book => {
    book.genreTags.forEach(genre => {
      if (genresToBooksCount[genre]) {
        genresToBooksCount[genre]++;
      } else {
        genresToBooksCount[genre] = 1;
      }
    });
  });

  const slugs = new Set<string>();

  return Object.entries(genresToBooksCount).map(([id, booksCount]) => ({
    id,
    slug: createUniqueSlug(toReadableName(id), slugs),
    name: toReadableName(id),
    booksCount,
    _popularity: booksCount,
  }));
};
