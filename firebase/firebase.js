import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gcpSecretPath = process.env.FIREBASE_ADMIN_KEY_SAFAI; // <— this matches Cloud Run
console.log(
  "DEBUG: Checking secret file path:",
  process.env.FIREBASE_ADMIN_KEY_SAFAI
);

try {
  if (process.env.FIREBASE_ADMIN_KEY_SAFAI) {
    console.log(
      "DEBUG: fs.existsSync:",
      fs.existsSync(process.env.FIREBASE_ADMIN_KEY_SAFAI)
    );
  } else {
    console.log("DEBUG: Env var FIREBASE_ADMIN_KEY_SAFAI is NOT set");
  }
} catch (e) {
  console.log("DEBUG: Error checking secret file:", e.message);
}

const localKeyPath = path.join(__dirname, "serviceAccountKey.json");

let serviceAccount;

if (gcpSecretPath) {
  console.log("🔥 Using Firebase Admin SDK from GCP Secret Manager");
  serviceAccount = gcpSecretPath;
} else {
  console.log("💻 Using local Firebase Admin SDK key");
  serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf8"));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
