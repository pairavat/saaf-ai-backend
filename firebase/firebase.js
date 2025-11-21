import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gcpSecretPath = process.env.FIREBASE_ADMIN_KEY_SAFAI; // <— this matches Cloud Run

const localKeyPath = path.join(__dirname, "serviceAccountKey.json");

let serviceAccount;

if (gcpSecretPath && fs.existsSync(gcpSecretPath)) {
  console.log("🔥 Using Firebase Admin SDK from GCP Secret Manager");
  serviceAccount = JSON.parse(fs.readFileSync(gcpSecretPath, "utf8"));
} else {
  console.log("💻 Using local Firebase Admin SDK key");
  serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf8"));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
