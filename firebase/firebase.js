import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Secret Manager mount path in Cloud Run
const gcpSecretPath = process.env.FIREBASE_ADMIN_KEY;

// Local JSON path
const localKeyPath = path.join(__dirname, "serviceAccountKey.json");

// Decide which key to load
let serviceAccount;

if (gcpSecretPath && fs.existsSync(gcpSecretPath)) {
  console.log("🔥 Using Firebase credentials from GCP Secret Manager");
  serviceAccount = JSON.parse(fs.readFileSync(gcpSecretPath, "utf8"));
} else {
  console.log("💻 Using local Firebase service account");
  serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf8"));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
