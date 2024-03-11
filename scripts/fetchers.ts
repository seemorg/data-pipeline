export const getParsedBookVersions = async (bookId: string, versionIds: string[]) => {
  const [authorId, bookName] = bookId.split('.');
  if (!authorId || !bookName) {
    return null;
  }

  const allVersions = await Promise.all(
    versionIds.map(async versionId => {
      const response = await fetch(
        `https://raw.githubusercontent.com/OpenITI/RELEASE/2385733573ab800b5aea09bc846b1d864f475476/data/${authorId}/${bookId}/${versionId}`,
      );
      const text = await response.text();

      return text;
    }),
  );

  return allVersions;
};
