import type { LocalizedArrayEntry, LocalizedEntry } from './LocalizedEntry';
import type { BookDocument } from './book';

export type AuthorDocument = {
  id: string;
  slug: string;
  year: number;

  primaryNames: LocalizedEntry[];
  otherNames: LocalizedArrayEntry[];
  bios: LocalizedEntry[];

  _nameVariations: string[];
  _popularity: number;
  geographies: string[];
  regions: string[]; // region slugs

  booksCount: number;
  books: Omit<BookDocument, 'author' | 'year' | 'geographies' | 'regions' | 'authorId'>[];
};
