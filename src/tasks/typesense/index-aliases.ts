import { chunk } from '../../utils/array';
import nameAliases from '../../../data/name-aliases.json';
import { client } from '../../lib/typesense';

const INDEX_SHORT_NAME = 'authors';

const aliases = Object.keys(nameAliases as Record<string, string[]>)
  // @ts-ignore
  .filter(a => !!nameAliases[a] && nameAliases[a].length > 0)
  .map(alias => ({
    name: alias,
    // @ts-ignore
    aliases: [alias, ...nameAliases[alias]] as string[],
  }));

const aliasChunks = chunk(aliases, 50) as (typeof aliases)[];

let j = 1;
for (const chunk of aliasChunks) {
  console.log(`Indexing aliases batch ${j} / ${aliasChunks.length}`);
  await Promise.all(
    chunk.map((a, index) =>
      client
        .collections(INDEX_SHORT_NAME)
        .synonyms()
        .upsert(`chunk-${j}:idx-${index}`, { synonyms: a.aliases }),
    ),
  );
  j++;
}

console.log(`Indexed ${aliases.length} aliases`);
