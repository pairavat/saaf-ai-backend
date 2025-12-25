// routes/reviewRoutes.js
import express from "express";
import prisma from "../config/prismaClient.mjs";
// import { upload, processAndUploadImages } from "../middleware/imageUpload.js";
import { upload, processAndUploadImages } from "../middlewares/imageUpload.js";
import { verifyToken } from "../utils/jwt.js";

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
  upload.fields([{ name: "images", maxCount: 5 }]),
  processAndUploadImages([
    { fieldName: "images", folder: "user-reviews", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const {
        toilet_id,
        score,
        description,
        anonymous,
        latitude,
        longitude,
        reason_ids = "[]",
        user_id,
      } = req.body;

      /* ---------------- VALIDATION ---------------- */
      if (!toilet_id)
        return res.status(400).json({ message: "toilet_id is required" });

      const rating = Number(score);
      if (isNaN(rating) || rating < 1 || rating > 10)
        return res.status(400).json({ message: "Invalid rating" });

      let parsedReasons = [];
      try {
        parsedReasons = JSON.parse(reason_ids);
      } catch {
        parsedReasons = [];
      }

      const imageUrls = req.uploadedFiles?.images || [];

      /* ---------------- CREATE ---------------- */
      const review = await prisma.user_review.create({
        data: {
          toilet_id: BigInt(toilet_id),
          location_id: BigInt(toilet_id),
          user_id: user_id ? BigInt(user_id) : null,
          anonymous: anonymous === "1" || anonymous === true,

          rating,
          description: description || "",
          reason_ids: parsedReasons,
          images: imageUrls,

          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
        },
      });
      await updateToiletReviewStats(BigInt(toilet_id));
      return res.status(201).json({
        success: true,
        data: normalizeBigInt(review),
        message: "Review submitted successfully",
      });
    } catch (error) {
      console.error("Review creation failed:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to submit review",
      });
    }
  }
);

// ----------- GET /api/reviews/user/:id --------------
reviewRoutes.get("/user-reviews", verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const review = await prisma.user_review.findMany({
      where: { user_id: BigInt(user_id) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    res.json({
      success: true,
      data: normalizeBigInt(review),
    });
  } catch (error) {
    console.error("Error fetching review:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch review",
    });
  }
});

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
      count: user_reviews.length,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user reviews",
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
        error: "Review not found",
      });
    }

    res.json({
      success: true,
      data: normalizeBigInt(review),
    });
  } catch (error) {
    console.error("Error fetching review:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch review",
    });
  }
});

reviewRoutes.get("/toilets/:id", async (req, res) => {
  try {
    const toiletId = BigInt(req.params.id);

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    const skip = (page - 1) * limit;

    const sort = req.query.sort || "recent"; // recent | highest | photos

    let orderBy = { created_at: "desc" };
    let where = { toilet_id: toiletId };

    if (sort === "highest") {
      orderBy = { rating: "desc" };
    }

    if (sort === "photos") {
      where.images = { isEmpty: false };
    }

    const reviews = await prisma.user_review.findMany({
      where,
      orderBy,
      skip,
      take: limit + 1, // 🔥 fetch 1 extra to detect hasMore
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
    });

    const hasMore = reviews.length > limit;
    if (hasMore) reviews.pop();

    const formatted = reviews.map((r) => ({
      ...normalizeBigInt(r),
      user: r.anonymous ? null : r.user,
    }));

    res.json({
      success: true,
      data: formatted,
      meta: {
        page,
        limit,
        hasMore,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

reviewRoutes.put(
  "/user-review/:id",
  upload.fields([{ name: "images", maxCount: 5 }]),
  processAndUploadImages([
    { fieldName: "images", folder: "user-reviews", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const reviewId = BigInt(req.params.id);
      const userId = req.user?.id;

      const existing = await prisma.user_review.findUnique({
        where: { id: reviewId },
      });

      if (!existing || existing.user_id?.toString() !== String(userId))
        return res.status(403).json({ message: "Unauthorized" });

      const images = req.uploadedFiles?.images || existing.images;

      const updated = await prisma.user_review.update({
        where: { id: reviewId },
        data: {
          rating: Number(req.body.score),
          description: req.body.description || "",
          images,
          anonymous: req.body.anonymous === "1",
        },
      });

      res.json({ success: true, data: normalizeBigInt(updated) });
    } catch (err) {
      res.status(500).json({ success: false });
    }
  }
);

reviewRoutes.delete("/user-review/:id", verifyToken, async (req, res) => {
  try {
    const reviewId = BigInt(req.params.id);
    const userId = req.user?.id;
    console.log(userId);

    const review = await prisma.user_review.findUnique({
      where: { id: reviewId },
    });

    if (!review || review.user_id?.toString() !== String(userId))
      return res.status(403).json({ message: "Unauthorized" });

    await prisma.user_review.delete({ where: { id: reviewId } });
    await updateToiletReviewStats(BigInt(toilet_id));
    res.json({ success: true, message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

async function updateToiletReviewStats(toiletId) {
  const agg = await prisma.user_review.aggregate({
    where: { toilet_id: toiletId },
    _count: { id: true },
    _avg: { rating: true },
  });

  await prisma.locations.update({
    where: { id: toiletId },
    data: {
      user_review_score: agg._avg.rating
        ? Number(agg._avg.rating.toFixed(1))
        : null,
    },
  });
}

const serializeBigInt = (obj) =>
  JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

export default reviewRoutes;
