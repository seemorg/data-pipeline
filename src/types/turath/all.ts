declare global {
  namespace PrismaJson {
    type BookVersion = { source: 'openiti' | 'turath'; value: string };
  }
}

export interface TurathAllDataResponse {
  cats: Record<string, { name: string; books: number[] }>;
  authors: Record<string, { name: string; death: number; books: number[] }>;
  books: Record<
    string,
    {
      id: number;
      name: string;
      author_id: number;
      cat_id: number;
      has_pdf: boolean;
      size: number; // in kb
      page_count: number;
    }
  >;
}
