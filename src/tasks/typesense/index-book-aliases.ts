import { chunk } from '../../utils/array';
import nameAliases from '../../../output/clean-book-aliases.json';
import { client } from '../../lib/typesense';
import { dedupeStrings } from '@/utils/string';
import { getNamesVariations } from '@/datasources/openiti/utils';

export const indexAliases = async (collection: string) => {
  const typedAliases = nameAliases as Record<
    string,
    {
      en: string[];
    }
  >;

  const aliases = Object.keys(typedAliases)
    .filter(
      a =>
        !!typedAliases[a] &&
        Object.keys(typedAliases[a]!).length > 0 &&
        typedAliases[a]!.en.length > 0,
    )
    .map(alias => ({
      name: alias,
      aliases: dedupeStrings([
        alias,
        ...getNamesVariations(Object.values(typedAliases[alias]!).flat()),
      ] as string[]),
    }));

  const aliasChunks = chunk(aliases, 30) as (typeof aliases)[];

  let j = 1;
  for (const chunk of aliasChunks) {
    console.log(`Indexing aliases batch ${j} / ${aliasChunks.length}`);

    try {
      await Promise.all(
        chunk.map((a, index) =>
          client
            .collections(collection)
            .synonyms()
            .upsert(`chunk-${j}:idx-${index}`, { synonyms: a.aliases }),
        ),
      );
    } catch (e) {}

    j++;
  }

  console.log(`Indexed ${aliases.length} aliases`);
};
