CREATE TABLE IF NOT EXISTS "author" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"primary_arabic_name" text,
	"other_arabic_names" json DEFAULT '[]'::json NOT NULL,
	"primary_latin_name" text,
	"other_latin_names" json DEFAULT '[]'::json NOT NULL,
	"year" integer NOT NULL,
	"number_of_books" integer DEFAULT 0 NOT NULL,
	"bio" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "book" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"author_id" text NOT NULL,
	"primary_arabic_name" text,
	"other_arabic_names" json DEFAULT '[]'::json NOT NULL,
	"primary_latin_name" text,
	"other_latin_names" json DEFAULT '[]'::json NOT NULL,
	"version_ids" json DEFAULT '[]'::json NOT NULL,
	"number_of_versions" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "genre" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "location" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"region_id" text,
	"city_code" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "genres_to_books" (
	"genre_id" text NOT NULL,
	"book_id" text NOT NULL,
	CONSTRAINT "genres_to_books_genre_id_book_id_pk" PRIMARY KEY("genre_id","book_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locations_to_authors" (
	"location_id" text NOT NULL,
	"author_id" text NOT NULL,
	CONSTRAINT "locations_to_authors_location_id_author_id_pk" PRIMARY KEY("location_id","author_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "region" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text,
	"current_name" text,
	"arabic_name" text,
	"overview" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "author_slug_index" ON "author" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "genre_slug_index" ON "genre" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "location_slug_index" ON "location" ("slug","type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "region_slug_index" ON "region" ("slug");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book" ADD CONSTRAINT "book_author_id_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "author"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "location" ADD CONSTRAINT "location_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "genres_to_books" ADD CONSTRAINT "genres_to_books_genre_id_genre_id_fk" FOREIGN KEY ("genre_id") REFERENCES "genre"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "genres_to_books" ADD CONSTRAINT "genres_to_books_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "book"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations_to_authors" ADD CONSTRAINT "locations_to_authors_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations_to_authors" ADD CONSTRAINT "locations_to_authors_author_id_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "author"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
