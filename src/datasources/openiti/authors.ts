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
import authorIdToNames from '../../../output/author-name-variations.json';
import { removeDiacritics } from '@/utils/diacritics';

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
}: {
  populateBooks?: ShouldPopulate;
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

  return Object.values(authorsData).map(author => {
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

    const authorNames = (
      authorIdToNames as Record<string, { primary_name: string; variations: string[] }>
    )[id];

    const result = {
      id,
      slug,
      year: Number(author.date),
      ...(primaryArabicNameWithoutDiacritics && {
        primaryArabicName: primaryArabicNameWithoutDiacritics,
      }),
      otherArabicNames,
      ...(authorNames
        ? {
            primaryLatinName: authorNames.primary_name,
          }
        : primaryLatinNameWithoutDiacritics
          ? {
              primaryLatinName: primaryLatinNameWithoutDiacritics,
            }
          : {}),
      otherLatinNames: [
        ...(otherLatinNames ?? []),
        ...(authorNames
          ? // if we already generated a primary name, use the on in the data as one of the variations
            [...authorNames.variations, ...(primaryLatinName ? [primaryLatinName] : [])]
          : []),
      ],
      geographies,
      regions: convertGeographiesToRegions(geographies),
      booksCount: books.length,
      ...(bio ? { bio } : {}),
      ...(books && populateBooks ? { books } : {}),
    } satisfies Partial<AuthorDocument>;

    return {
      ...result,
      _popularity: result.booksCount,
      _nameVariations: getNamesVariations([
        primaryArabicName,
        primaryLatinName,
        ...result.otherArabicNames,
        ...result.otherLatinNames,
      ]),
    } as ReturnedAuthorDocument<ShouldPopulate>;
  });
};
