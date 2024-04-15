import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { author, location } from '.';

export const locationsToAuthors = pgTable(
  'locations_to_authors',
  {
    locationId: text('location_id')
      .references(() => location.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
    authorId: text('author_id')
      .references(() => author.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
  },
  t => ({
    pk: primaryKey({ columns: [t.locationId, t.authorId] }),
  }),
);
export const locationsToAuthorsRelations = relations(locationsToAuthors, ({ one }) => ({
  location: one(location, {
    fields: [locationsToAuthors.locationId],
    references: [location.id],
  }),
  author: one(author, {
    fields: [locationsToAuthors.authorId],
    references: [author.id],
  }),
}));
