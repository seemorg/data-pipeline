import { getContrastColor } from './color';
import fs from 'fs';
import path from 'path';

const template = fs
  .readFileSync(path.resolve('src/book-covers/template.html'))
  .toString();

const font = fs
  .readFileSync(path.resolve('src/book-covers/fonts/Amiri-Regular.ttf'))
  .toString('base64');

export const getBookHtml = ({
  title,
  author,
  containerColor,
  bgBase64,
}: {
  title: string;
  author: string;
  containerColor: string;
  bgBase64: string;
}) => {
  // black or white, depending on the background contrast
  const textColor = getContrastColor(containerColor);

  return template
    .replaceAll('{{title}}', title)
    .replaceAll('{{author}}', author)
    .replaceAll('{{containerColor}}', containerColor)
    .replaceAll('{{textColor}}', textColor)
    .replaceAll('{{bgBase64}}', bgBase64)
    .replaceAll('{{font}}', font);
};
