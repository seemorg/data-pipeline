import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { locationsToAuthors, region } from '.';

export const location = pgTable(
  'location',
  {
    id: text('id').primaryKey(), // author specific slug
    slug: text('slug').notNull(), // general slug
    name: text('name').notNull(),
    type: text('type').notNull(), // visited, resided, born, died
    regionId: text('region_id').references(() => region.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    city: text('city_code'),
  },
  table => {
    return {
      slugIdx: uniqueIndex('location_slug_index').on(table.slug, table.type),
    };
  },
);

export const locationRelations = relations(location, ({ many, one }) => ({
  authors: many(locationsToAuthors),
  region: one(region, {
    fields: [location.regionId],
    references: [region.id],
  }),
}));
