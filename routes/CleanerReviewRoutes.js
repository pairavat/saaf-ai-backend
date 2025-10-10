// import express from "express";
// import multer from "multer";
// import {
//   getCleanerReview,
//   getCleanerReviewsById,
//   createCleanerReview,
//   completeCleanerReview,
// } from "../controller/cleanerReviewController.js";

// const clean_review_Router = express.Router();

// // Multer storage config
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, "uploads/"),
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     const ext = file.originalname.split(".").pop();
//     cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
//   },
// });

// // Multer instance
// const upload = multer({ storage });

// // Debug middleware (logs after multer processes)
// const debugFields = (req, res, next) => {
//   console.log("---- Incoming Form Data ----");
//   console.log("Body:", req.body);
//   console.log("Files:", req.files);
//   next();
// };

// // ----------------------------
// // Routes
// // ----------------------------
// clean_review_Router.get("/", getCleanerReview); // /api/cleaner-reviews?cleaner_user_id=123
// clean_review_Router.get("/:cleaner_user_id", getCleanerReviewsById);

// // Start review (before photos)
// clean_review_Router.post(
//   "/initiated",
//   upload.fields([{ name: "before_photo", maxCount: 5 }]),
//   debugFields,
//   createCleanerReview
// );

// // Complete review (after photos)
// clean_review_Router.post(
//   "/completed",
//   upload.fields([{ name: "after_photo", maxCount: 5 }]),
//   debugFields,
//   completeCleanerReview
// );

// export default clean_review_Router;


import express from "express";
import {
  getCleanerReview,
  getCleanerReviewsById,
  createCleanerReview,
  completeCleanerReview,
  getCleanerReviewsByTaskId,
} from "../controller/cleanerReviewController.js";
// import { upload, processAndUploadImages } from "../middleware/imageUpload.js";
import { upload, processAndUploadImages } from "../middlewares/imageUpload.js";

const clean_review_Router = express.Router();

// Debug middleware (optional)
const debugFields = (req, res, next) => {
  console.log("---- Incoming Form Data ----");
  console.log("Body:", req.body);
  console.log("Uploaded Files:", req.uploadedFiles);
  next();
};

// Routes
clean_review_Router.get("/", getCleanerReview);
clean_review_Router.get("/:cleaner_user_id", getCleanerReviewsById);
clean_review_Router.get("/task/:task_id", getCleanerReviewsByTaskId);

// Start review (before photos)
clean_review_Router.post(
  "/initiated",
  upload.fields([{ name: "before_photo", maxCount: 5 }]),
  processAndUploadImages([
    { fieldName: "before_photo", folder: "before_photos", maxCount: 5 }
  ]),
  debugFields,
  createCleanerReview
);

// Complete review (after photos)
clean_review_Router.post(
  "/completed",
  upload.fields([{ name: "after_photo", maxCount: 5 }]),
  processAndUploadImages([
    { fieldName: "after_photo", folder: "after_photos", maxCount: 5 }
  ]),
  debugFields,
  completeCleanerReview
);

export default clean_review_Router;
