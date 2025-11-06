import multer from "multer";
// import { uploadImage } from '../utils/cloudinary.js';
// import { uploadImage } from '../utils/cloudinary.js';
import { uploadImage } from "../utils/gcsUpload.js";
// Configure multer to use memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

console.log(upload, "from imageUpload");
// Middleware to process and upload images to Cloudinary
export const processAndUploadImages = (fieldConfigs) => {
  return async (req, res, next) => {
    try {
      // Process each field configuration
      for (const config of fieldConfigs) {
        const { fieldName, folder, maxCount } = config;

        if (req.files && req.files[fieldName]) {
          const uploadedUrls = [];

          for (const file of req.files[fieldName]) {
            try {
              const result = await uploadImage(file.buffer, folder);
              console.log(result, "result from image UPload");
              uploadedUrls.push(result.url);
            } catch (uploadError) {
              console.error(`Failed to upload ${fieldName}:`, uploadError);
              return res.status(500).json({
                status: "error",
                message: `Failed to upload ${fieldName}`,
                detail: uploadError.message,
                error: uploadError,
              });
            }
          }

          // Replace file objects with Cloudinary URLs
          req.uploadedFiles = req.uploadedFiles || {};
          req.uploadedFiles[fieldName] = uploadedUrls.filter(Boolean);
        }
      }

      next();
    } catch (error) {
      console.error("Image processing middleware error:", error);
      res.status(500).json({
        status: "error",
        message: "Image processing failed",
        detail: error.message,
      });
    }
  };
};

// Export multer upload for field configuration
export { upload };
