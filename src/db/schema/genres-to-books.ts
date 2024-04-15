import { pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { book, genre } from '.';

export const genresToBooks = pgTable(
  'genres_to_books',
  {
    genreId: text('genre_id')
      .references(() => genre.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    bookId: text('book_id')
      .references(() => book.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
  },
  t => ({
    pk: primaryKey({ columns: [t.genreId, t.bookId] }),
  }),
);
export const genresToBooksRelations = relations(genresToBooks, ({ one }) => ({
  genre: one(genre, {
    fields: [genresToBooks.genreId],
    references: [genre.id],
  }),
  book: one(book, {
    fields: [genresToBooks.bookId],
    references: [book.id],
  }),
}));
