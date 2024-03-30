import { removeDiacritics } from '@/utils/diacritics';
import geographiesWithRegions from '../../../data/distinct-locations-with-regions.json';
import { dedupeStrings } from '@/utils/string';

/**
 * This method returns an array of name variations for a given name.
 */
export const getNamesVariations = (names: (string | null | undefined)[]) => {
  const newVariations: string[] = [];

  (names.filter(n => n !== null && typeof n !== 'undefined') as string[]).forEach(
    name => {
      const nameWithoutDiactrics = removeDiacritics(name);

      if (nameWithoutDiactrics !== name && !names.includes(nameWithoutDiactrics))
        newVariations.push(nameWithoutDiactrics);

      const nameWithoutAl = nameWithoutDiactrics.replace(/(al-)/gi, '');
      if (nameWithoutAl !== nameWithoutDiactrics && !names.includes(nameWithoutAl))
        newVariations.push(nameWithoutAl);
    },
  );

  return newVariations;
};

/**
 * A function to slugify an id.
 *
 * Example:
 * - 0001AbuTalibCabdManaf -> abu-talib-cabd-manaf
 *
 * @param {string} id
 * @returns {string}
 */
export const slugifyId = (id: string, removeLeadingNumbers: boolean = true): string => {
  const noLeadingNumbers = removeLeadingNumbers ? id.replace(/^\d+/, '') : id;
  return noLeadingNumbers
    .replaceAll(' ', '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
};

export const createUniqueSlug = (id: string, previousSlugs?: Set<string>) => {
  let number = 0;
  while (true) {
    const slug = number === 0 ? slugifyId(id) : `${slugifyId(id)}-${number}`;

    if (!previousSlugs) return slug;

    if (!previousSlugs.has(slug)) {
      previousSlugs.add(slug);
      return slug;
    }

    number++;
  }
};

const geoToRegionSlug = geographiesWithRegions.reduce(
  (acc, current) => {
    if (current.region) {
      const loc = current.location.toLowerCase();
      const prefix = loc.split('@')[0];
      acc[loc] = `${prefix}@${current.region.slug}`;
    }

    return acc;
  },
  {} as Record<string, string>,
);

export const convertGeographiesToRegions = (geographies: string[]) => {
  return dedupeStrings(
    geographies.map(g => geoToRegionSlug[g.toLowerCase()]).filter(g => !!g) as string[],
  );
};
