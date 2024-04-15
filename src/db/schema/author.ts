import { pgTable, integer, json, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { book, locationsToAuthors } from '.';

export const author = pgTable(
  'author',
  {
    id: text('id').primaryKey(), // author specific slug
    slug: text('slug').notNull(), // general slug
    primaryArabicName: text('primary_arabic_name'),
    otherArabicNames: json('other_arabic_names').$type<string[]>().default([]).notNull(),
    primaryLatinName: text('primary_latin_name'),
    otherLatinNames: json('other_latin_names').$type<string[]>().default([]).notNull(),
    year: integer('year').notNull(), // year in hijri
    numberOfBooks: integer('number_of_books').default(0).notNull(),
    bio: text('bio'),
  },
  table => {
    return {
      slugIdx: uniqueIndex('author_slug_index').on(table.slug),
    };
  },
);

export const authorRelations = relations(author, ({ many }) => ({
  books: many(book),
  locations: many(locationsToAuthors),
}));
