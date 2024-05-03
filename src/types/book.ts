import type { LocalizedArrayEntry, LocalizedEntry } from './LocalizedEntry';
import type { AuthorDocument } from './author';

export type BookDocument = {
  id: string;
  slug: string;
  authorId: string;

  primaryNames: LocalizedEntry[];
  otherNames: LocalizedArrayEntry[];

  _nameVariations: string[];
  _popularity: number;
  versionIds: string[];
  genreTags: string[];

  // these are derived from the author
  author: Omit<AuthorDocument, 'books' | 'geographies' | 'booksCount'>;
  year: number;
  geographies: string[];
  regions: string[];
};
