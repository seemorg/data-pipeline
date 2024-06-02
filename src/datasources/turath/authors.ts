import type { TurathAllDataResponse } from '@/types/turath/all';

export const getAllAuthors = async () => {
  const data: TurathAllDataResponse = await (
    await fetch('https://files.turath.io/data-v3.json')
  ).json();

  return Object.entries(data.authors).map(([id, author]) => ({
    id: +id,
    ...author,
  }));
};
