import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


export async function uploadImage(buffer, folder) {
    try {
        // Compress the image with sharp
        const compressedImageBuffer = await sharp(buffer)
            .webp({ quality: 80 }) // Convert to WebP with 80% quality
            .toBuffer();

        // Upload the compressed image buffer to Cloudinary
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: folder,
                    resource_type: 'image',
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        console.log(result, "result");
                        resolve(result);
                    }
                }
            );

            console.log(compressedImageBuffer, "compressed image Buffer")
            uploadStream.end(compressedImageBuffer);
        });
    } catch (error) {
        console.error('Error in image upload utility:', error);
        throw new Error('Image upload failed.');
    }
}
