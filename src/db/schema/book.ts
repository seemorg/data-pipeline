import { pgTable, text, json, integer } from 'drizzle-orm/pg-core';
import { author, genresToBooks } from '.';
import { relations } from 'drizzle-orm';

export const book = pgTable('book', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(), // general slug
  authorId: text('author_id')
    .notNull()
    .references(() => author.id),
  primaryArabicName: text('primary_arabic_name'),
  otherArabicNames: json('other_arabic_names').$type<string[]>().default([]).notNull(),
  primaryLatinName: text('primary_latin_name'),
  otherLatinNames: json('other_latin_names').$type<string[]>().default([]).notNull(),
  versionIds: json('version_ids').$type<string[]>().default([]).notNull(),
  numberOfVersions: integer('number_of_versions').default(0).notNull(),
});

export const bookRelations = relations(book, ({ one, many }) => ({
  author: one(author, {
    fields: [book.authorId],
    references: [author.id],
  }),
  genres: many(genresToBooks),
}));
