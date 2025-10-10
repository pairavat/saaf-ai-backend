// import express from "express";
// import multer from "multer";

// import path from "path";
// import fs from "fs";
// import { fileURLToPath } from "url";
// import prisma from "../config/prismaClient.mjs";
// const reviewRoutes = express.Router();

// function normalizeBigInt(obj) {
//   return JSON.parse(
//     JSON.stringify(obj, (_, value) =>
//       typeof value === "bigint" ? Number(value) : value
//     )
//   );
// }

// // Handle __dirname in ES Modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Local uploads folder setup
// const uploadDir = path.join(__dirname, "..", "uploads");
// if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, "uploads/"),
//   filename: (req, file, cb) => {
//     const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, unique + "-" + file.originalname);
//   },
// });

// const upload = multer({ storage });

// // ----------- POST /api/user_review ------------
// reviewRoutes.post("/user-review", upload.array("images"), async (req, res) => {
//   console.log("post request made for user_review");
//   try {
//     const body = req.body;
//     console.log("Received body:", body);
//     console.log("files", req.files);

//     // Parse reason_ids safely
//     const reasonIds = JSON.parse(body.reason_ids || "[]");
//     const imageFilenames = req.files.map((file) => file.filename);

//     const lat = parseFloat(body.latitude);
//     const long = parseFloat(body.longitude);
//     const address = body.address;

//     // ✅ Step 2: Create the review with toilet_id
//     const review = await prisma.user_review.create({
//       data: {
//         name: body.name,
//         email: body.email,
//         phone: body.phone,
//         rating: parseFloat(body.rating),
//         reason_ids: reasonIds,
//         latitude: parseFloat(lat),
//         longitude: parseFloat(long),
//         description: body.description || "",
//         toilet_id: body.toilet_id,
//         // images: req.files?.map((file) => `/uploads/${file.filename}`) || [],
//         images: imageFilenames,
//       },
//     });

//     console.log("Review created:", review);
//     res.status(201).json({ success: true, data: normalizeBigInt(review) });
//   } catch (error) {
//     console.error("Review creation failed:", error);
//     res.status(400).json({ success: false, error: error.message });
//   }
// });

// // ----------- GET /api/user_review --------------//
// reviewRoutes.get("/", async (req, res) => {
//   try {
//     const user_review = await prisma.user_review.findMany({
//       orderBy: { created_at: "desc" },
//     });

//     res.json({ success: true, data: normalizeBigInt(user_review) }); // ✅ FIX HERE
//   } catch (error) {
//     console.error(error);
//     res
//       .status(500)
//       .json({ success: false, error: "Failed to fetch user_review" });
//   }
// });

// export default reviewRoutes;





// routes/reviewRoutes.js
import express from "express";
import prisma from "../config/prismaClient.mjs";
// import { upload, processAndUploadImages } from "../middleware/imageUpload.js";
import { upload , processAndUploadImages } from "../middlewares/imageUpload.js";

const reviewRoutes = express.Router();

function normalizeBigInt(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? Number(value) : value
    )
  );
}

// ----------- POST /api/reviews/user-review ------------
reviewRoutes.post(
  "/user-review", 
  upload.fields([{ name: 'images', maxCount: 5 }]), // Configure multer for multiple images
  processAndUploadImages([
    { fieldName: 'images', folder: 'user-reviews', maxCount: 5 }
  ]),
  async (req, res) => {
    console.log("POST request made for user_review");
    
    try {
      const body = req.body;
      console.log("Received body:", body);
      console.log("Uploaded files:", req.uploadedFiles);

      // Parse reason_ids safely
      const reasonIds = JSON.parse(body.reason_ids || "[]");
      
      // Get Cloudinary URLs from middleware
      const imageUrls = req.uploadedFiles?.images || [];

      const lat = parseFloat(body.latitude);
      const long = parseFloat(body.longitude);

      // Create the review with Cloudinary image URLs
      const review = await prisma.user_review.create({
        data: {
          name: body.name,
          email: body.email,
          phone: body.phone,
          rating: parseFloat(body.rating),
          reason_ids: reasonIds,
          latitude: lat,
          longitude: long,
          description: body.description || "",
          toilet_id: body.toilet_id ? BigInt(body.toilet_id) : null,
          images: imageUrls, // Store Cloudinary URLs
        },
      });

      console.log("Review created:", review);
      res.status(201).json({ 
        success: true, 
        data: normalizeBigInt(review),
        message: "Review submitted successfully!"
      });
      
    } catch (error) {
      console.error("Review creation failed:", error);
      res.status(400).json({ 
        success: false, 
        error: error.message,
        message: "Failed to submit review"
      });
    }
  }
);

// ----------- GET /api/reviews/ --------------
reviewRoutes.get("/", async (req, res) => {
  try {
    const { toilet_id, limit = 50 } = req.query;
    
    const whereClause = toilet_id ? { toilet_id: BigInt(toilet_id) } : {};
    
    const user_reviews = await prisma.user_review.findMany({
      where: whereClause,
      orderBy: { created_at: "desc" },
      take: parseInt(limit),
    });

    res.json({ 
      success: true, 
      data: normalizeBigInt(user_reviews),
      count: user_reviews.length
    });
    
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch user reviews" 
    });
  }
});

// ----------- GET /api/reviews/:id --------------
reviewRoutes.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const review = await prisma.user_review.findUnique({
      where: { id: BigInt(id) },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: "Review not found"
      });
    }

    res.json({ 
      success: true, 
      data: normalizeBigInt(review)
    });
    
  } catch (error) {
    console.error("Error fetching review:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch review" 
    });
  }
});

export default reviewRoutes;
