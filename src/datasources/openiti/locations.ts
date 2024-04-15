import { getAuthorsData } from './authors';
import rawRegions from '~/data/regions.json';
import locationsWithRegions from '~/data/distinct-locations-with-regions.json';
import locationIdToSlug from '~/data/location-slugs.json';
import localizedCities from '~/output/localized-cities.json';
import { createUniqueSlug, toReadableName } from './utils';

type Region = {
  name: string;
  slug: string;
  nameArabic: string;
  currentPlace: string;
  overview: string;
};

export const getLocationsData = async () => {
  const allAuthors = await getAuthorsData({ populateBooks: false });

  // example: { "Jazirat_Arab": ['died', 'born'] }
  const locationsToTypes = [
    ...new Set<string>(
      allAuthors.flatMap(author => author.geographies.map(g => g.toLowerCase())),
    ),
  ].reduce(
    (acc, location) => {
      const [prefix, name] = location.split('@') as [string, string];
      if (acc[name]) {
        acc[name]!.push(prefix);
      } else {
        acc[name] = [prefix];
      }
      return acc;
    },
    {} as Record<string, string[]>,
  );

  const allLocations = Object.keys(locationsToTypes);

  const regionSlugToRegion = Object.values(rawRegions).reduce(
    (acc, entry) => {
      acc[entry.slug] = entry;
      return acc;
    },
    {} as Record<string, Region>,
  );

  const locationToRegionData = locationsWithRegions.reduce(
    (acc, entry) => {
      const slug = entry.region?.slug;
      if (slug) {
        const region = regionSlugToRegion[slug] ?? null;
        if (region) {
          acc[entry.location.toLowerCase()] = { ...region, city: entry.region?.city };
        }
      }
      return acc;
    },
    {} as Record<string, (Region & { city?: string }) | null>,
  );

  const slugs = new Set<string>();

  const locationsWithTypes = allLocations.flatMap(location => {
    const name = toReadableName(location);
    const slug =
      (locationIdToSlug as Record<string, string>)[location] ??
      createUniqueSlug(name, slugs);

    return (locationsToTypes[location] ?? []).map(type => {
      const id = `${type}@${location}`;
      const regionData = locationToRegionData[id.toLowerCase()];

      return {
        id,
        slug,
        name,
        type,
        city: regionData?.city ?? null,
        cityArabic: regionData?.city
          ? (localizedCities as Record<string, { ar: string }>)[regionData.city]?.ar ??
            null
          : null,
        regionId: regionData?.slug ?? null,
      };
    });
  });

  return locationsWithTypes;
};
