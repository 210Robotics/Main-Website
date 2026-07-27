export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

export function isAllowedImageType(value: string) {
  return allowedImageTypes.includes(value as (typeof allowedImageTypes)[number]);
}
