import type { BookDocument } from '@/types';
import type { OpenITIBook } from '@/types/openiti';
import { dedupeStrings } from '@/utils/string';
import { createUniqueSlug, getNamesVariations } from './utils';
import { getAuthorsData } from './authors';

type ReturnedBookDocument<T extends boolean> = T extends true
  ? BookDocument
  : Omit<BookDocument, 'author' | 'geographies' | 'region' | 'year'>;

const slugs = new Set<string>();

export const getBooksData = async <ShouldPopulate extends boolean>({
  populateAuthor = true as ShouldPopulate,
}: {
  populateAuthor?: ShouldPopulate;
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

  return Object.values(booksData)
    .filter(book => {
      // filter out books without uri or don't have arabic or latin title
      return !!book.uri && (book.title_ar.length > 0 || book.title_lat.length > 0);
    })
    .map(book => {
      const [primaryArabicName, ...otherArabicNames] = dedupeStrings(book.title_ar);
      const [primaryLatinName, ...otherLatinNames] = dedupeStrings(book.title_lat);

      const id = book.uri;
      const [authorId, bookId] = book.uri.split('.');
      const slug = createUniqueSlug(bookId ?? id, slugs);
      const author = authorId ? authorIdToAuthor[authorId] : undefined;

      let extraProperties: Record<string, any> = {};

      if (author) {
        const { geographies, regions, year } = author;
        extraProperties.geographies = geographies;
        extraProperties.regions = regions;
        extraProperties.year = year;
      }

      const result = {
        id,
        slug,
        authorId,
        primaryArabicName,
        otherArabicNames,
        primaryLatinName,
        otherLatinNames,
        genreTags: dedupeStrings(book.genre_tags.map(g => g.toLowerCase())),
        versionIds: book.versions,
        ...(author ? { author, ...extraProperties } : {}),
      } satisfies Partial<BookDocument>;

      return {
        ...result,
        _nameVariations: getNamesVariations([
          ...(result.primaryArabicName ? [result.primaryArabicName] : []),
          ...(result.primaryLatinName ? [result.primaryLatinName] : []),
          ...result.otherArabicNames,
          ...result.otherLatinNames,
        ]),
      } as ReturnedBookDocument<ShouldPopulate>;
    });
};
