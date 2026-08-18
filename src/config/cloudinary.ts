import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

export default cloudinary;

export const uploadToCloudinary = async (
  filePath: string,
  folder: string = 'unipulse',
  options: any = {}
): Promise<{ url: string; publicId: string }> => {
  const targetFolder = env.cloudinaryFolderPrefix
    ? `${env.cloudinaryFolderPrefix}/${folder}`
    : folder;

  const result = await cloudinary.uploader.upload(filePath, {
    folder: targetFolder,
    resource_type: 'auto',
    ...options,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  await cloudinary.uploader.destroy(publicId);
};
