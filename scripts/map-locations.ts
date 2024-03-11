import type { Place } from '../src/types';
import path from 'path';
import locations from '../data/distinct-locations.json';
import regions from '../data/regions.json';

import slugify from 'slugify';
import fs from 'fs';

const URL =
  'https://raw.githubusercontent.com/althurayya/althurayya.github.io/master/master/places.json';

const { features: mappings } = (await (await fetch(URL)).json()) as {
  features: Place[];
};

const regionUriToSlug = Object.keys(regions).reduce(
  (acc, uri) => {
    acc[uri.toLowerCase()] = (regions as any)[uri]!.slug;
    return acc;
  },
  {} as Record<string, string>,
);

const uriToRegionData = mappings.reduce(
  (acc, place) => {
    acc[place.properties.cornuData.cornu_URI] = {
      regionSlug: slugify(place.properties.cornuData.region_code, { lower: true }),
      city: place.properties.cornuData.toponym_buckwalter ?? null,
    };
    return acc;
  },
  {} as Record<string, { regionSlug: string; city: string }>,
);

const newLocationsMap = locations.map(location => {
  const [, uri = ''] = location.split('@');

  if (!uri?.includes('_RE')) {
    const region = uriToRegionData[uri] ?? null;

    return {
      location,
      regionId: region?.regionSlug ?? null,
    };
  }

  const [uriWithoutRE = ''] = uri.toLowerCase().split('_re');
  const regionSlug = regionUriToSlug[`${uriWithoutRE}_re`] ?? null;

  return {
    location,
    regionId: regionSlug,
  };
});

fs.writeFileSync(
  path.resolve('output/distinct-locations-with-regions.json'),
  JSON.stringify(newLocationsMap, null, 2),
);
