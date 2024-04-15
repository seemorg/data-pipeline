import { RegionDocument } from '@/types/region';
import distinctRegions from '~/data/regions.json';
import locationsWithRegions from '~/data/distinct-locations-with-regions.json';
import { getAuthorsData } from './authors';

export const getRegionsData = async (): Promise<RegionDocument[]> => {
  const regionSlugToCities = locationsWithRegions.reduce(
    (acc, entry) => {
      const slug = entry.region?.slug;
      const city = entry?.region?.city;

      if (slug && city) {
        if (acc[slug]) {
          acc[slug]!.push(city);
        } else {
          acc[slug] = [city];
        }
      }

      return acc;
    },
    {} as Record<string, string[]>,
  );

  const regionSlugToCounts = (await getAuthorsData({ populateBooks: true })).reduce(
    (acc, author) => {
      author.regions.forEach(region => {
        const [, slug] = region.split('@');
        if (!slug) return;

        if (acc[slug]) {
          acc[slug]!.authorsCount++;
          acc[slug]!.booksCount += author.booksCount;
        } else {
          acc[slug] = { authorsCount: 1, booksCount: author.booksCount };
        }
      });

      return acc;
    },
    {} as Record<string, { authorsCount: number; booksCount: number }>,
  );

  const allRegions = Object.values(distinctRegions) as {
    slug: string;
    name: string;
    nameArabic: string;
    currentPlace: string;
    overview: string;
  }[];

  return allRegions.map(region => {
    const subLocations = [...new Set(regionSlugToCities[region.slug])] ?? [];

    return {
      id: region.slug,
      slug: region.slug,
      name: region.name,
      arabicName: region.nameArabic,
      currentName: region.currentPlace,
      subLocations,
      subLocationsCount: subLocations.length,
      authorsCount: regionSlugToCounts[region.slug]?.authorsCount ?? 0,
      booksCount: regionSlugToCounts[region.slug]?.booksCount ?? 0,
      _popularity:
        (regionSlugToCounts[region.slug]?.booksCount ?? 0) +
        (regionSlugToCounts[region.slug]?.authorsCount ?? 0),
    };
  });
};
