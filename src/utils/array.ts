export const chunk = (arr: any[], size: number) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return arr.reduce(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment
    (acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]),
    [],
  );
};
