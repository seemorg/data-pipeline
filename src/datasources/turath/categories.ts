import type { TurathAllDataResponse } from '@/types/turath/all';

export const getAllCategories = async () => {
  const data: TurathAllDataResponse = await (
    await fetch('https://files.turath.io/data-v3.json')
  ).json();

  return Object.values(data.cats);
};

console.log(await getAllCategories());
