import type { BookDocument } from './book';

export type AuthorDocument = {
  id: string;
  slug: string;
  bio: string;
  year: number;
  primaryArabicName?: string;
  otherArabicNames: string[];
  primaryLatinName?: string;
  otherLatinNames: string[];
  _nameVariations: string[];
  geographies: string[];
  regions: string[]; // region slugs

  booksCount: number;
  books: Omit<BookDocument, 'author' | 'year' | 'geographies' | 'regions' | 'authorId'>[];
};
