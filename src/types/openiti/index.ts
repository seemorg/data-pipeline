export type OpenITIBook = {
  title_ar: string[];
  title_lat: string[];
  genre_tags: string[];
  versions: string[];
  relations: string[];
  uri: string; // gh uri authorUri.bookUri
};

export type OpenITIAuthor = {
  author_ar: string[];
  author_lat: string[];
  books: string[];
  date: string; // yyyy
  geo: string[];
  name_elements: string[];
  // author_name_from_uri: string;
  full_name: string;
  shuhra: string;
  uri: string; // gh uri
  vers_uri: string;
};
