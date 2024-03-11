import type { AuthorDocument } from './author';

export type BookDocument = {
  id: string;
  slug: string;
  authorId: string;
  primaryArabicName: string;
  otherArabicNames: string[];
  primaryLatinName: string;
  otherLatinNames: string[];
  _nameVariations: string[];
  versionIds: string[];
  genreTags: string[];

  // these are derived from the author
  author: Omit<AuthorDocument, 'books' | 'geographies' | 'booksCount'>;
  year: number;
  geographies: string[];
  regions: string[];
};
