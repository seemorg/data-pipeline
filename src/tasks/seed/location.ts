import { db } from '@/db';

import locationsWithRegions from '~/data/distinct-locations-with-regions.json';
import regions from '~/data/regions.json';

import { getAuthorsData } from '@/datasources/openiti/authors';
import { chunk } from '@/utils/array';
import { toTitleCase } from '@/utils/string';
import { createUniqueSlug } from '@/datasources/openiti/utils';
import { LocationType } from '@prisma/client';
import localizedData from '../../../openai-batches/localize-locations-output.json';

const getLocalizedDataForEntry = (slug: string) => {
  return Object.entries((localizedData as any)[slug] as Record<string, { name: string }>);
};

const allAuthors = await getAuthorsData({ populateBooks: false });

type Region = {
  name: string;
  slug: string;
  nameArabic: string;
  currentPlace: string;
  overview: string;
};

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

const chunkedLocations = chunk(allLocations, 10) as (typeof allLocations)[];

const regionSlugToRegion = Object.values(regions).reduce(
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

const toReadableName = (location: string) => {
  return toTitleCase(
    location
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .trim(),
  );
};

const shouldReset =
  process.argv.includes('--reset') || process.argv.includes('"--reset"');
if (shouldReset) {
  console.log('[LOCATIONS] Resetting locations table');
  await db.location.deleteMany();
}

const typeToEnum: Record<string, LocationType> = {
  visited: LocationType.Visited,
  born: LocationType.Born,
  died: LocationType.Died,
  resided: LocationType.Resided,
};

let locationBatchIdx = 1;
for (const locations of chunkedLocations) {
  console.log(
    `[LOCATIONS] Seeding batch ${locationBatchIdx} / ${chunkedLocations.length}`,
  );

  const locationsWithTypes = locations.flatMap(location => {
    const name = toReadableName(location);
    const slug = createUniqueSlug(location, slugs);

    return (locationsToTypes[location] ?? []).map(type => {
      const id = `${type}@${location}`;
      const regionData = locationToRegionData[id.toLowerCase()];

      return {
        id,
        slug: slug,
        name: name,
        type,
        regionId: regionData?.slug ?? null,
        city: regionData?.city ?? null,
      };
    });
  });

  await db.location.createMany({
    data: locationsWithTypes.map(locationEntry => ({
      id: locationEntry.id,
      slug: locationEntry.slug,
      name: locationEntry.name,
      type: typeToEnum[locationEntry.type]!,
      ...(locationEntry.regionId && { regionId: locationEntry.regionId }),
      // ...(locationEntry.city && { cityCode: locationEntry.city }),
    })),
  });

  const cityNames = locationsWithTypes.flatMap(l => {
    const result = [];

    if (l.city) {
      result.push({ locationId: l.id, text: l.city, locale: 'en' });
      getLocalizedDataForEntry(l.city)?.forEach(([locale, data]) => {
        if (data.name) result.push({ locationId: l.id, text: data.name, locale });
        if (locale === 'fa')
          result.push({ locationId: l.id, text: data.name, locale: 'ar' });
      });
    }

    return result;
  });

  if (cityNames.length > 0)
    await db.locationCityName.createMany({
      data: cityNames,
    });

  locationBatchIdx++;
}
