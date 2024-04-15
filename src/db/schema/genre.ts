import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { genresToBooks } from '.';

export const genre = pgTable(
  'genre',
  {
    id: text('id').primaryKey(), // author specific slug
    slug: text('slug').notNull(), // general slug
    name: text('name').notNull(),
  },
  table => {
    return {
      slugIdx: uniqueIndex('genre_slug_index').on(table.slug),
    };
  },
);

export const genreRelations = relations(genre, ({ many }) => ({
  books: many(genresToBooks),
}));
