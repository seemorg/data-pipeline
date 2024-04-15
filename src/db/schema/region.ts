import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { location } from '.';

export const region = pgTable(
  'region',
  {
    id: text('id').primaryKey(), // region specific slug
    slug: text('slug').notNull(), // general slug
    name: text('name'),
    currentName: text('current_name'),
    arabicName: text('arabic_name'),
    overview: text('overview'),
  },
  table => {
    return {
      slugIdx: uniqueIndex('region_slug_index').on(table.slug),
    };
  },
);

export const regionRelations = relations(region, ({ many }) => ({
  locations: many(location),
}));
