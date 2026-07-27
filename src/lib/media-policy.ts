export const GALLERY_MEDIA_SOURCE = "drive";
export const DELETED_GALLERY_MEDIA_SOURCE = "drive-deleted";

export function isGalleryMediaSource(source: string) {
  return source === GALLERY_MEDIA_SOURCE;
}

