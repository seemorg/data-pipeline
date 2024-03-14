import { getAuthorsData } from '@/datasources/openiti/authors';
import { env } from '@/env';
import { chunk } from '@/utils/array';

const authors = await getAuthorsData({ populateBooks: true });
const allBooks = authors.flatMap(author =>
  author.books.map(book => ({ ...book, authorId: author.id })),
);

const batches = chunk(allBooks.slice(0, 10), 5) as (typeof allBooks)[];

let i = 1;
for (const batch of batches) {
  console.log(`Processing batch ${i} / ${batches.length}`);
  i++;

  await Promise.all(
    batch.map(async book => {
      try {
        const slug = book.slug;
        const r2Url = `https://assets.digitalseem.org/covers/${slug}.png`;

        const data = new FormData();
        data.set('url', r2Url);

        const res = await fetch(
          'https://api.cloudflare.com/client/v4/accounts/0aa87b6d9adf50e3eee236b2902bec0d/images/v1',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.CLOUDFLARE_IMAGES_TOKEN}`,
            },
            body: data,
          },
        );
        console.log(res.status);
        console.log(await res.json());
      } catch (e) {
        console.error(e);
      }
    }),
  );
}
