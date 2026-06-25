import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import path from "path";
import fs from "fs";

let storage;
let bucket;
let useGCS = null; // null = uninitialized

function initGCS() {
  if (useGCS !== null) return;

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const clientEmail = process.env.GCP_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GCP_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_PROJECT_ID || process.env.PROJECT_ID;

  try {
    if (keyPath && fs.existsSync(keyPath)) {
      console.log("🔐 Using service account key from file:", keyPath);
      storage = new Storage({ keyFilename: keyPath });
      useGCS = true;
    } else if (clientEmail && privateKey) {
      console.log("🔐 Using service account credentials from .env");
      const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
      storage = new Storage({
        projectId: projectId || undefined,
        credentials: {
          client_email: clientEmail,
          private_key: formattedPrivateKey,
        },
      });
      useGCS = true;
    } else if (process.env.GCS_BUCKET_NAME) {
      console.log(
        "⚙️ Using application default credentials (Cloud Run or local gcloud auth)."
      );
      storage = new Storage();
      useGCS = true;
    } else {
      useGCS = false;
    }
    
    if (useGCS) {
      const bucketName = process.env.GCS_BUCKET_NAME;
      bucket = storage.bucket(bucketName);
    }
  } catch (e) {
    console.warn("⚠️ Failed to initialize GCS, falling back to local storage:", e.message);
    useGCS = false;
  }
}

// Same uploadImage function as before with local fallback...
export async function uploadImage(buffer, folder = "uploads") {
  try {
    initGCS();
    const compressedBuffer = await sharp(buffer)
      .webp({ quality: 80 })
      .toBuffer();

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}.webp`;

    if (useGCS && bucket) {
      try {
        const gcsFileName = `${folder}/${fileName}`;
        const file = bucket.file(gcsFileName);

        await file.save(compressedBuffer, {
          resumable: false,
          metadata: { contentType: "image/webp" },
        });

        const publicUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${gcsFileName}`;
        console.log("✅ Uploaded to GCS:", publicUrl);

        return { url: publicUrl };
      } catch (gcsError) {
        console.error("❌ GCS upload failed, falling back to local storage:", gcsError);
      }
    }

    // Local fallback: save to uploads/ folder
    const localDir = path.join(process.cwd(), "uploads", folder);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const filePath = path.join(localDir, fileName);
    await fs.promises.writeFile(filePath, compressedBuffer);

    const localPort = process.env.PORT || 8080;
    const publicUrl = `http://localhost:${localPort}/uploads/${folder}/${fileName}`;
    console.log("✅ Saved locally (fallback):", publicUrl);

    return { url: publicUrl };
  } catch (error) {
    console.error("❌ Image upload failed:", error);
    throw new Error("Image upload failed: " + error.message);
  }
}

