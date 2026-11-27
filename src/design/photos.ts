// Drop a photo into src/assets/photos named after the product id (for example
// aeris-q40.jpg) and it replaces the drawing. See docs/PHOTO_CREDITS.md.
import type { Product } from '../domain/types.ts';

const files = import.meta.glob<string>('../assets/photos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byId = new Map(
  Object.entries(files).map(([path, url]) => [path.split('/').at(-1)!.replace(/\.[^.]+$/, '').toLowerCase(), url]),
);

export const hasPhoto = (product: Product) => byId.has(product.id);
export const imageFor = (product: Product) => byId.get(product.id) ?? product.images[0]!;
export const imageAlt = (product: Product) =>
  hasPhoto(product) ? `Representative photo for ${product.name}` : `Illustration of ${product.name}`;
