import type { BookDocument } from '@/types';
import type { OpenITIBook } from '@/types/openiti';
import { dedupeStrings } from '@/utils/string';
import { createUniqueSlug, getNamesVariations } from './utils';
import { getAuthorsData } from './authors';
import bookIdToSlug from '../../../data/book-slugs.json';
import bookIdToNames from '../../../output/book-name-variations.json';
import { removeDiacritics } from '@/utils/diacritics';

type ReturnedBookDocument<T extends boolean> = T extends true
  ? BookDocument
  : Omit<BookDocument, 'author' | 'geographies' | 'region' | 'year'>;

const slugs = new Set<string>();

export const getBooksData = async <ShouldPopulate extends boolean>({
  populateAuthor = true as ShouldPopulate,
  limit,
}: {
  populateAuthor?: ShouldPopulate;
  limit?: number;
} = {}): Promise<ReturnedBookDocument<ShouldPopulate>[]> => {
  const authorIdToAuthor = populateAuthor
    ? (await getAuthorsData({ populateBooks: false })).reduce(
        (acc, author) => {
          acc[author.id] = author;
          return acc;
        },
        {} as Record<string, Awaited<ReturnType<typeof getAuthorsData>>[number]>,
      )
    : {};

  const booksData: Record<string, OpenITIBook> = await (
    await fetch(
      'https://raw.githubusercontent.com/OpenITI/kitab-metadata-automation/master/output/OpenITI_Github_clone_all_book_meta.json?v1',
    )
  ).json();

  // filter out books without uri or don't have arabic or latin title
  const filteredData = Object.values(booksData).filter(book => {
    return !!book.uri && (book.title_ar.length > 0 || book.title_lat.length > 0);
  });

  return (limit ? filteredData.slice(0, limit) : filteredData).map(book => {
    const [primaryArabicName, ...otherArabicNames] = dedupeStrings(book.title_ar);
    const primaryArabicNameWithoutDiacritics = primaryArabicName
      ? removeDiacritics(primaryArabicName)
      : null;

    const [primaryLatinName, ...otherLatinNames] = dedupeStrings(book.title_lat);
    const primaryLatinNameWithoutDiacritics = primaryLatinName
      ? removeDiacritics(primaryLatinName)
      : null;

    const id = book.uri;
    const [authorId, bookId] = book.uri.split('.');
    const slug =
      (bookIdToSlug as Record<string, string>)[id] ??
      createUniqueSlug(bookId ?? id, slugs);
    const author = authorId ? authorIdToAuthor[authorId] : undefined;

    let extraProperties: Record<string, any> = {};

    if (author) {
      const { geographies, regions, year } = author;
      extraProperties.geographies = geographies;
      extraProperties.regions = regions;
      extraProperties.year = year;
    }

    // TODO: add
    const bookNames = null as unknown as null | {
      primary_name: string;
      variations: string[];
    };

    const result = {
      id,
      slug,
      authorId,
      ...(primaryArabicNameWithoutDiacritics && {
        primaryArabicName: primaryArabicNameWithoutDiacritics,
      }),
      otherArabicNames,
      ...(bookNames
        ? {
            primaryLatinName: bookNames.primary_name,
          }
        : primaryLatinNameWithoutDiacritics
          ? {
              primaryLatinName: primaryLatinNameWithoutDiacritics,
            }
          : {}),
      otherLatinNames: [
        ...(otherLatinNames ?? []),
        ...(bookNames
          ? // if we already generated a primary name, use the on in the data as one of the variations
            [...bookNames.variations, ...(primaryLatinName ? [primaryLatinName] : [])]
          : []),
      ],
      genreTags: dedupeStrings(book.genre_tags.map(g => g.toLowerCase())),
      versionIds: book.versions,
      ...(author ? { author, ...extraProperties } : {}),
    } satisfies Partial<BookDocument>;

    return {
      ...result,
      _nameVariations: getNamesVariations([
        primaryArabicName,
        primaryLatinName,
        ...result.otherArabicNames,
        ...result.otherLatinNames,
      ]),
    } as ReturnedBookDocument<ShouldPopulate>;
  });
};
