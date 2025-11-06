import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import path from "path";
import fs from "fs";

// Auto-detect credentials
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (keyPath && fs.existsSync(keyPath)) {
  console.log("🔐 Using service account key from:", keyPath);
} else {
  console.log(
    "⚙️ Using application default credentials (Cloud Run or local gcloud auth)."
  );
}

const storage = new Storage(keyPath ? { keyFilename: keyPath } : {});

const bucketName = process.env.GCS_BUCKET_NAME;
const bucket = storage.bucket(bucketName);

// Same uploadImage function as before...
export async function uploadImage(buffer, folder = "uploads") {
  try {
    const compressedBuffer = await sharp(buffer)
      .webp({ quality: 80 })
      .toBuffer();

    const fileName = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}.webp`;
    const file = bucket.file(fileName);

    await file.save(compressedBuffer, {
      resumable: false,
      metadata: { contentType: "image/webp" },
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    console.log("✅ Uploaded to GCS:", publicUrl);

    return { url: publicUrl };
  } catch (error) {
    console.error("❌ GCS upload failed:", error);
    throw new Error("Image upload failed");
  }
}
