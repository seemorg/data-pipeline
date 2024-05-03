import type { AuthorDocument, BookDocument } from '@/types';
import type { OpenITIAuthor } from '@/types/openiti';
import {
  convertGeographiesToRegions,
  createUniqueSlug,
  getNamesVariations,
} from './utils';
import { dedupeStrings } from '@/utils/string';
import authorBios from '../../../data/author-bios.json';
import authorIdToSlug from '../../../data/author-slugs.json';
import { getBooksData } from './books';
import { removeDiacritics } from '@/utils/diacritics';

import localizedData1 from '../../../openai-batches/localize-authors-output/batch-1.json';
import localizedData2 from '../../../openai-batches/localize-authors-output/batch-2.json';
import { LocalizedArrayEntry, LocalizedEntry } from '@/types/LocalizedEntry';

const localizedData = { ...localizedData1, ...localizedData2 };

const getLocalizedDataForEntry = (id: string) => {
  return Object.entries(
    ((localizedData as any)[id] ?? {}) as Record<
      string,
      { primaryName: string; bio?: string }
    >,
  );
};

const getAuthorBio = (id: string) => {
  return (authorBios as Record<string, { bio: string }>)[id]?.bio ?? undefined;
};

type ReturnedAuthorDocument<T extends boolean> = T extends true
  ? AuthorDocument
  : Omit<AuthorDocument, 'books' | 'booksCount'>;

let booksCache: Record<
  string,
  Omit<BookDocument, 'author' | 'authorId' | 'year' | 'geographies' | 'regions'>[]
> | null = null;
export const getAuthorsData = async <ShouldPopulate extends boolean>({
  populateBooks = true as ShouldPopulate,
  limit,
}: {
  populateBooks?: ShouldPopulate;
  limit?: number;
} = {}): Promise<ReturnedAuthorDocument<ShouldPopulate>[]> => {
  if (!booksCache) {
    booksCache = (await getBooksData({ populateAuthor: false })).reduce(
      (acc, book) => {
        const authorId = book.authorId;

        if (acc[authorId]) {
          acc[authorId]?.push(book);
        } else {
          acc[authorId] = [book];
        }
        return acc;
      },
      {} as Record<
        string,
        Omit<BookDocument, 'author' | 'authorId' | 'year' | 'geographies' | 'regions'>[]
      >,
    );
  }

  const authorsData: Record<string, OpenITIAuthor> = await (
    await fetch(
      'https://raw.githubusercontent.com/OpenITI/kitab-metadata-automation/master/output/OpenITI_Github_clone_all_author_meta.json?v1',
      {
        cache: 'no-store',
      },
    )
  ).json();

  const slugs = new Set<string>();

  const all = Object.values(authorsData);
  return (limit ? all.slice(0, limit) : all).map(author => {
    const [primaryArabicName, ...otherArabicNames] = dedupeStrings(author.author_ar);
    const primaryArabicNameWithoutDiacritics = primaryArabicName
      ? removeDiacritics(primaryArabicName)
      : null;

    const latinNames = [...author.author_lat];
    if (author.shuhra.length > 0) {
      latinNames.unshift(author.shuhra); // use shuhra as a primary name if it exists
    }

    if (author.full_name.length > 0) {
      latinNames.push(author.full_name);
    }

    const [primaryLatinName, ...otherLatinNames] = dedupeStrings(latinNames);
    const primaryLatinNameWithoutDiacritics = primaryLatinName
      ? removeDiacritics(primaryLatinName)
      : null;

    const id = author.uri;
    const slug =
      (authorIdToSlug as Record<string, string>)[id] ?? createUniqueSlug(id, slugs);
    const bio = getAuthorBio(id);
    const geographies = dedupeStrings(author.geo);
    const books = (booksCache ?? {})[id] ?? [];

    const localizedEntry = getLocalizedDataForEntry(id);

    const arabicName = primaryArabicNameWithoutDiacritics ?? primaryArabicName;
    const latinName = primaryLatinNameWithoutDiacritics ?? primaryLatinName;

    const primaryNames = [
      ...(arabicName ? [{ text: arabicName, locale: 'ar' }] : []),
      ...(latinName ? [{ text: latinName, locale: 'en' }] : []),
      ...(localizedEntry ?? [])
        .map(([locale, data]) => ({
          text: data.primaryName,
          locale,
        }))
        .filter(({ text }) => text),
    ] as LocalizedEntry[];

    const bios = [
      ...(bio ? [{ text: bio, locale: 'en' }] : []),
      ...(localizedEntry ?? [])
        .map(([locale, data]) => ({
          text: data.bio,
          locale,
        }))
        .filter(({ text }) => text),
    ] as LocalizedEntry[];

    const otherNames = [
      { texts: otherArabicNames, locale: 'ar' },
      { texts: otherLatinNames, locale: 'en' },
    ] as LocalizedArrayEntry[];

    const result = {
      id,
      slug,
      year: Number(author.date),
      primaryNames,
      bios,
      otherNames,
      geographies,
      regions: convertGeographiesToRegions(geographies),
      booksCount: books.length,
      ...(books && populateBooks ? { books } : {}),
    } satisfies Partial<AuthorDocument>;

    return {
      ...result,
      _popularity: result.booksCount,
      _nameVariations: getNamesVariations([
        primaryArabicName,
        primaryLatinName,
        ...primaryNames.map(({ text }) => text),
        ...result.otherNames.flatMap(({ texts }) => texts),
      ]),
    } as ReturnedAuthorDocument<ShouldPopulate>;
  });
};
