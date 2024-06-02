import { removeDiacritics } from '@/utils/diacritics';
// Calculate the Jaro similarity between two strings
function jaroDistance(s1: string, s2: string) {
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;

  let matches = 0;
  const hashS1 = Array(len1).fill(false);
  const hashS2 = Array(len2).fill(false);

  // Find matching characters
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);

    for (let j = start; j < end; j++) {
      if (hashS2[j]) continue;
      if (s1[i] !== s2[j]) continue;
      hashS1[i] = true;
      hashS2[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let t = 0;
  let point = 0;
  for (let i = 0; i < len1; i++) {
    if (hashS1[i]) {
      while (!hashS2[point]) point++;
      if (s1[i] !== s2[point++]) t++;
    }
  }
  t /= 2;

  // Calculate Jaro distance
  const jaro = (matches / len1 + matches / len2 + (matches - t) / matches) / 3;
  return jaro;
}

// Apply the Winkler adjustment to the Jaro distance
export function jaroWinkler(s1: string, s2: string, scalingFactor = 0.1) {
  const jaroDist = jaroDistance(s1, s2);

  // Compute the length of common prefix up to 4 characters
  let prefix = 0;
  const limit = Math.min(s1.length, s2.length, 4);
  while (prefix < limit && s1[prefix] === s2[prefix]) {
    prefix++;
  }

  // Winkler adjustment
  return jaroDist + prefix * scalingFactor * (1 - jaroDist);
}

export function getHighestScore(s1: string[], s2: string[]) {
  let highest = 0;

  for (const a of s1) {
    for (const b of s2) {
      const score = jaroWinkler(a, b);
      if (score > highest) highest = score;
    }
  }

  for (const a of s1) {
    for (const b of s2) {
      const score = jaroWinkler(normalizeText(a), normalizeText(b));
      if (score > highest) highest = score;
    }
  }

  return highest;
}

export function normalizeText(text: string) {
  return (
    removeDiacritics(
      text
        // replace anything between parentheses or brackets
        .replace(/[\(\[].*?[\)\]]/g, '')
        .normalize('NFD'),
    )
      .replace(/[\u0641\u0642]/g, '\u0641') // Feh and Qaf
      .replace(/[\u0621-\u0623\u0625-\u0627]/g, '\u0627') // Hamza variations to Aleph
      .replace(/[\u0649\u064A]/g, '\u064A') // Alef Maksura and Yeh to Yeh
      .replace(/[\u0629]/g, '\u0647') // Teh Marbuta to Heh
      .replace(/[\u0624\u0626]/g, '\u0648') // Waw with Hamza and Yeh with Hamza to Waw

      // TODO: change ibn to bin
      .normalize('NFC')
      // remove ال word prefix
      .replace(/\bال/g, '')
  );
}
