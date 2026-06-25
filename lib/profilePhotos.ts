import { supabase } from '@/lib/supabase';

export const PROFILE_PHOTOS_BUCKET = 'profile-photos';

export function getProfilePhotoPath(userId: string, fileName: string, contentType: string) {
  return `${userId}/avatar.${getImageFileExtension(fileName, contentType)}`;
}

export async function uploadProfilePhoto(file: Blob, photoPath: string, contentType: string) {
  return supabase.storage.from(PROFILE_PHOTOS_BUCKET).upload(photoPath, file, {
    cacheControl: '3600',
    contentType,
    upsert: true,
  });
}

export async function createProfilePhotoSignedUrl(photoPath: string) {
  return supabase.storage.from(PROFILE_PHOTOS_BUCKET).createSignedUrl(photoPath, 60 * 60);
}

export async function getProfilePhotoPreviewUrl(photoPath: string | null | undefined) {
  if (!photoPath) {
    return null;
  }

  const { data, error } = await createProfilePhotoSignedUrl(photoPath);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

export async function removeProfilePhoto(photoPath: string) {
  return supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([photoPath]);
}

function getImageFileExtension(fileName: string, contentType: string) {
  const cleanFileName = fileName.toLowerCase();
  const extension = cleanFileName.split('.').pop();

  if (extension === 'jpg' || extension === 'jpeg' || extension === 'png' || extension === 'webp') {
    return extension === 'jpg' ? 'jpeg' : extension;
  }

  if (contentType.includes('png')) {
    return 'png';
  }

  if (contentType.includes('webp')) {
    return 'webp';
  }

  return 'jpeg';
}
