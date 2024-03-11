export const dedupeStrings = (names: string[]) => {
  return Array.from(new Set(names.map(n => n.trim())));
};

export const toTitleCase = (str: string) => {
  return str.replace(
    /\w\S*/g,
    txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase(),
  );
};
