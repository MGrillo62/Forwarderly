import { cloudinary, isCloudinaryConfigured } from './cloudinary';

export function getPublicIdFromUrl(url: string): string | null {
  try {
    if (!url.includes('cloudinary.com')) return null;
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    
    let publicIdWithExt = parts[1];
    const versionMatch = publicIdWithExt.match(/^v\d+\/(.+)$/);
    if (versionMatch) {
      publicIdWithExt = versionMatch[1];
    }
    
    const lastDotIndex = publicIdWithExt.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      return publicIdWithExt.substring(0, lastDotIndex);
    }
    return publicIdWithExt;
  } catch (error) {
    console.error('Error parsing public_id from Cloudinary URL:', error);
    return null;
  }
}

export function getResourceTypeFromUrl(url: string): string {
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return 'image';
    const urlBeforeUpload = parts[0];
    const slashParts = urlBeforeUpload.split('/');
    const resourceType = slashParts[slashParts.length - 1];
    if (['image', 'raw', 'video'].includes(resourceType)) {
      return resourceType;
    }
    return 'image';
  } catch (error) {
    return 'image';
  }
}

export async function deleteFileFromCloudinary(url: string): Promise<boolean> {
  if (!url) return false;

  if (!isCloudinaryConfigured) {
    console.log('Cloudinary not configured. Skipping file deletion.');
    return true;
  }

  const publicId = getPublicIdFromUrl(url);
  const resourceType = getResourceTypeFromUrl(url);
  if (!publicId) return false;

  try {
    console.log(`Deleting file from Cloudinary: ${publicId} (${resourceType})`);
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    console.log('Cloudinary deletion result:', result);
    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    return false;
  }
}
