import type { AuthorDocument, BookDocument } from '@/types';
import type { OpenITIAuthor } from '@/types/openiti';
import {
  convertGeographiesToRegions,
  createUniqueSlug,
  getNamesVariations,
} from './utils';
import { dedupeStrings } from '@/utils/string';
import authorBios from '../../../data/author-bios.json';
import { getBooksData } from './books';

const getAuthorBio = (id: string) => {
  return (authorBios as Record<string, { bio: string }>)[id]?.bio ?? undefined;
};

type ReturnedAuthorDocument<T extends boolean> = T extends true
  ? AuthorDocument
  : Omit<AuthorDocument, 'books' | 'booksCount'>;

export const getAuthorsData = async <ShouldPopulate extends boolean>({
  populateBooks = true as ShouldPopulate,
}: {
  populateBooks?: ShouldPopulate;
} = {}): Promise<ReturnedAuthorDocument<ShouldPopulate>[]> => {
  const authorIdToBooks = populateBooks
    ? (await getBooksData({ populateAuthor: false })).reduce(
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
      )
    : {};

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

    const latinNames = [...author.author_lat];
    if (author.shuhra.length > 0) {
      latinNames.unshift(author.shuhra); // use shuhra as a primary name if it exists
    }

    if (author.full_name.length > 0) {
      latinNames.push(author.full_name);
    }

    const [primaryLatinName, ...otherLatinNames] = dedupeStrings(latinNames);

    const id = author.uri;
    const slug = createUniqueSlug(id, slugs);
    const bio = getAuthorBio(id);
    const geographies = dedupeStrings(author.geo);
    const books = authorIdToBooks[id] ?? undefined;

    const result = {
      id,
      slug,
      year: Number(author.date),
      primaryArabicName,
      otherArabicNames,
      primaryLatinName,
      otherLatinNames,
      geographies,
      regions: convertGeographiesToRegions(geographies),
      ...(bio ? { bio } : {}),
      ...(books ? { books, booksCount: books.length } : {}),
    } satisfies Partial<AuthorDocument>;

    return {
      ...result,
      _nameVariations: getNamesVariations([
        ...(result.primaryArabicName ? [result.primaryArabicName] : []),
        ...(result.primaryLatinName ? [result.primaryLatinName] : []),
        ...result.otherArabicNames,
        ...result.otherLatinNames,
      ]),
    } as ReturnedAuthorDocument<ShouldPopulate>;
  });
};
