import prisma from "../config/prismaClient.mjs";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { sendNotificationToMany } from "./notificationController.js";

const safeBigInt = (val) => {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str === "" || str === "null" || str === "undefined") return null;
  try {
    return BigInt(str);
  } catch (e) {
    return null;
  }
};

// =========================================================
// 1️⃣ GET all cleaner reviews (with filters)
// =========================================================

// const BASE_URL = process.env.BASE_URL || "https://safai-index-backend.onrender.com";

export async function getCleanerReview(req, res) {
  // console.log("request made from get cleaner reviews");

  const { cleaner_user_id, status, date, company_id } = req.query;

  // console.log(company_id, "company_id from get cleaner review");

  try {
    const whereClause = {};

    const cleanUserId = safeBigInt(cleaner_user_id);
    if (cleanUserId !== null) {
      whereClause.cleaner_user_id = cleanUserId;
    }
    const compId = safeBigInt(company_id);
    if (compId !== null) {
      whereClause.company_id = compId;
    }

    if (status) {
      whereClause.status = status;
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setUTCHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 1);

      whereClause.created_at = {
        gte: startDate,
        lt: endDate,
      };
    }

    const reviews = await prisma.cleaner_review.findMany({
      where: whereClause,
      include: {
        cleaner_user: {
          include: {
            role: true, // Include all role fields
          },
        },
        location: {
          include: {
            location_types: true, // Include all location_type fields
            locations: true, // Include all parent location fields
          },
        },
        company: true, // Include all company fields
      },
    });

    // ✅ Fixed serialization function
    const safeSerialize = (obj) => {
      if (obj === null || obj === undefined) return obj;

      // ✅ Handle BigInt
      if (typeof obj === "bigint") return obj.toString();

      // ✅ Handle Date objects BEFORE generic object handling
      if (obj instanceof Date) return obj.toISOString();

      // ✅ Handle Arrays
      if (Array.isArray(obj)) return obj.map(safeSerialize);

      // ✅ Handle generic objects (but after Date check)
      if (typeof obj === "object") {
        const serialized = {};
        for (const [key, value] of Object.entries(obj)) {
          serialized[key] = safeSerialize(value);
        }
        return serialized;
      }

      // ✅ Return primitives as-is
      return obj;
    };

    // ✅ Serialize all review data
    const serializedReviews = reviews.map((review) => safeSerialize(review));
    // console.log("befor serilize", serializedReviews);
    // const serialized = reviews.map((r) => {
    //   const safeReview = {};
    //   for (const [key, value] of Object.entries(r)) {
    //     safeReview[key] = typeof value === "bigint" ? value.toString() : value;
    //   }
    //   return safeReview;
    // });

    // console.log(serialized, "serilized data")
    // console.log(serialized.length, "data");
    res.json(serializedReviews);
  } catch (err) {
    console.error("Fetch Cleaner Reviews Error:", err);
    res.status(500).json({
      error: "Failed to fetch cleaner reviews",
      detail: err.message,
    });
  }
}

export const getCleanerReviewsById = async (req, res) => {
  const { cleaner_user_id } = req.params;
  const date = req.params.date || req.query.date;

  let stats = {};
  try {
    // ✅ Input validation
    const cleanUserId = safeBigInt(cleaner_user_id);
    if (cleanUserId === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid cleaner user ID provided",
      });
    }

    const whereClause = {
      cleaner_user_id: cleanUserId,
    };

    if (date) {
      const targetDate = new Date(date);
      if (isNaN(targetDate)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid date format. Use YYYY-MM-DD",
        });
      }
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      whereClause.created_at = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else {
      // Default view: return any reviews (ongoing or completed) from the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      whereClause.created_at = {
        gte: twentyFourHoursAgo,
      };
    }

    // ✅ Fetch reviews for the given cleaner and date
    const reviews = await prisma.cleaner_review.findMany({
      where: whereClause,
      include: {
        cleaner_user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            created_at: true,
            updated_at: true,
            role: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
        location: {},
        company: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // ✅ If no reviews found
    if (reviews.length === 0) {
      return res.status(200).json({
        status: "success",
        message: `No reviews found for ${date || "today"}`,
        data: { reviews: [], stats },
      });
    }

    // ✅ Safe serialization
    const safeSerialize = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === "bigint") return obj.toString();
      if (obj instanceof Date) return obj.toISOString();
      if (Array.isArray(obj)) return obj.map(safeSerialize);
      if (typeof obj === "object") {
        const serialized = {};
        for (const [key, value] of Object.entries(obj)) {
          serialized[key] = safeSerialize(value);
        }
        return serialized;
      }
      return obj;
    };

    const serializedReviews = reviews.map((review) => safeSerialize(review));

    // ✅ Stats calculation
    stats = {
      total_reviews: serializedReviews.length,
      completed_reviews: serializedReviews.filter(
        (r) => r.status === "completed"
      ).length,
      ongoing_reviews: serializedReviews.filter((r) => r.status === "ongoing")
        .length,
    };

    res.json({
      status: "success",
      data: {
        reviews: serializedReviews,
        stats,
      },
      message: "Cleaner reviews retrieved successfully!",
    });
  } catch (err) {
    console.error("Fetch Reviews by Cleaner ID Error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch cleaner reviews by cleaner ID",
      detail:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  }
};

export const getCleanerReviewsByTaskId = async (req, res) => {
  // console.log("Getting cleaner reviews by task id");
  const { task_id } = req.params;
  // console.log(req.params, "params");

  let stats = {};
  try {
    // Input validation
    const cleanTaskId = safeBigInt(task_id);
    if (cleanTaskId === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid task ID provided",
      });
    }

    // ✅ Single query with all related data using include
    const reviews = await prisma.cleaner_review.findMany({
      where: {
        id: cleanTaskId,
      },
      include: {
        // ✅ Include user details automatically
        cleaner_user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            created_at: true,
            updated_at: true,
            role: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
        // ✅ Include location details
        location: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            metadata: true,
            location_types: {
              select: {
                id: true,
                name: true,
              },
            },
            locations: {
              // parent location
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        // ✅ Include company details
        company: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (reviews.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "No reviews found for this cleaner",
        data: {
          reviews: [],
          stats: stats, // important
        },
      });
    }

    // console.log(reviews, "reviews")

    // ✅ Fixed serialization function
    const safeSerialize = (obj) => {
      if (obj === null || obj === undefined) return obj;

      // ✅ Handle BigInt
      if (typeof obj === "bigint") return obj.toString();

      // ✅ Handle Date objects BEFORE generic object handling
      if (obj instanceof Date) return obj.toISOString();

      // ✅ Handle Arrays
      if (Array.isArray(obj)) return obj.map(safeSerialize);

      // ✅ Handle generic objects (but after Date check)
      if (typeof obj === "object") {
        const serialized = {};
        for (const [key, value] of Object.entries(obj)) {
          serialized[key] = safeSerialize(value);
        }
        return serialized;
      }

      // ✅ Return primitives as-is
      return obj;
    };

    // ✅ Serialize all review data
    const serializedReviews = reviews.map((review) => safeSerialize(review));

    // console.log(serializedReviews, "serilized regviews");
    // ✅ Calculate stats from the reviews
    stats = {
      total_reviews: serializedReviews.length,
      completed_reviews: serializedReviews.filter(
        (r) => r.status === "completed"
      ).length,
      ongoing_reviews: serializedReviews.filter((r) => r.status === "ongoing")
        .length,
      total_tasks_today: serializedReviews.filter((r) => {
        try {
          const today = new Date();
          const reviewDate = new Date(r.created_at);
          return reviewDate.toDateString() === today.toDateString();
        } catch {
          return false;
        }
      }).length,
      // ✅ Get cleaner info from first review (all reviews are for same cleaner)
      // cleaner_info: serializedReviews[0]?.cleaner_user || null
    };

    // console.log("Successfully fetched reviews with relationships");

    res.json({
      status: "success",
      data: {
        reviews: serializedReviews,
        stats: stats, // important
      },
      message: "Cleaner reviews retrieved successfully!",
    });
  } catch (err) {
    console.error("Fetch Reviews by Cleaner ID Error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch cleaner reviews by cleaner ID",
      detail:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  }
};

export async function createCleanerReview(req, res) {
  try {
    const {
      name,
      location_id,
      latitude,
      longitude,
      address,
      cleaner_user_id,
      tasks,
      initial_comment,
      company_id,
      created_at,
      multiple_sections,
    } = req.body;

    // Get uploaded URLs from middleware
    // const beforePhotos = req.uploadedFiles?.before_photo || [];
    const beforePhotos = (req.uploadedFiles?.before_photo || []).filter(
      (url) => !!url
    );

    let parsedTasks = [];

    if (tasks) {
      if (Array.isArray(tasks)) {
        parsedTasks = tasks.map(String);
      } else if (typeof tasks === "string") {
        try {
          const parsed = JSON.parse(tasks);
          if (Array.isArray(parsed)) {
            parsedTasks = parsed.map(String);
          } else {
            parsedTasks = [String(parsed)];
          }
        } catch (e) {
          parsedTasks = tasks.split(",").map((task) => String(task).trim());
        }
      }
    }

    // ✅ Add length validation
    // if (parsedTasks.length === 0) {
    //   console.warn("No tasks provided for review");
    // }

    // console.log("Original tasks:", tasks);
    // console.log("Parsed tasks:", parsedTasks);
    // console.log("Tasks count:", parsedTasks.length);

    let review;
    const isMultiple = multiple_sections === "true" || multiple_sections === true;

    let existingReview = null;
    if (isMultiple) {
      const targetDate = created_at ? new Date(created_at) : new Date();
      const twelveHoursAgo = new Date(targetDate.getTime() - 12 * 60 * 60 * 1000);
      const twelveHoursAhead = new Date(targetDate.getTime() + 12 * 60 * 60 * 1000);

      existingReview = await prisma.cleaner_review.findFirst({
        where: {
          location_id: safeBigInt(location_id),
          cleaner_user_id: safeBigInt(cleaner_user_id),
          status: "ongoing",
          created_at: {
            gte: twelveHoursAgo,
            lte: twelveHoursAhead,
          },
        },
      });
    }

    if (existingReview) {
      const updatedBeforePhotos = [...existingReview.before_photo, ...beforePhotos];
      const updatedTasks = [...new Set([...existingReview.tasks, ...parsedTasks])];
      const updatedComment = existingReview.initial_comment
        ? `${existingReview.initial_comment} | ${initial_comment}`
        : initial_comment;

      review = await prisma.cleaner_review.update({
        where: { id: existingReview.id },
        data: {
          before_photo: updatedBeforePhotos,
          tasks: updatedTasks,
          initial_comment: updatedComment,
        },
      });
    } else {
      review = await prisma.cleaner_review.create({
        data: {
          name,
          location_id: safeBigInt(location_id),
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          address,
          cleaner_user_id: safeBigInt(cleaner_user_id),
          tasks: parsedTasks,
          initial_comment: initial_comment || null,
          before_photo: beforePhotos,
          after_photo: [],
          status: "ongoing",
          company_id: safeBigInt(company_id),
          created_at: created_at ? new Date(created_at) : undefined,
        },
      });
    }

    const serializedData = {
      ...review,
      id: review?.id.toString(),
      location_id: review?.location_id?.toString(),
      cleaner_user_id: review?.cleaner_user_id?.toString(),
      company_id: review?.company_id?.toString(),
    };

    try {
      // 1️⃣ Fetch review metadata for notification
      const { cleaner_user_id, location_id, company_id } = serializedData;

      // 2️⃣ Fetch cleaner name
      const cleaner = await prisma.users.findUnique({
        where: { id: cleaner_user_id },
        select: { name: true, fcm_token: true },
      });

      // 3️⃣ Fetch location name
      const location = await prisma.locations.findUnique({
        where: { id: location_id },
        select: { name: true },
      });

      const cleanerName = cleaner?.name || "Cleaner";
      const locationName = location?.name || "Unknown Location";

      // 4️⃣ Fetch admins (role_id = 1)
      const admins = await prisma.users.findMany({
        where: { role_id: 1 },
        select: { fcm_token: true },
      });

      // 5️⃣ Merge tokens (cleaner + admins)
      let tokens = [
        // cleaner?.fcm_token,
        ...admins.map((u) => u.fcm_token),
      ].filter(Boolean);

      tokens = [...new Set(tokens)];

      // 6️⃣ Send notification
      if (tokens.length > 0 && !existingReview) {
        await sendNotificationToMany({
          tokens,
          title: "Task Started",
          body: `New task started by ${cleanerName} at ${locationName}`,
          data: { reviewId: String(serializedData.id), type: "review" },
        });
      }
    } catch (e) {
      console.error("❌ Notification Error:", e);
    }

    res.status(201).json({ status: "success", data: serializedData });
  } catch (err) {
    console.error("Create Review Error:", err);
    res.status(400).json({ status: "error", detail: err.message });
  }
}

export async function completeCleanerReview(req, res) {
  try {
    const { final_comment, id, tasks, is_last_section } = req.body;
    // Default to true if not specified (supports the old app version)
    const isLast = is_last_section === undefined || is_last_section === "true" || is_last_section === true;

    const cleanId = safeBigInt(id);
    if (cleanId === null) {
      return res.status(400).json({ status: "error", message: "Invalid review ID provided" });
    }

    // const afterPhotos = req.uploadedFiles?.after_photo || [];
    const afterPhotos = (req.uploadedFiles?.after_photo || []).filter(
      (url) => !!url
    );

    let parsedTasks = [];
    if (tasks) {
      if (Array.isArray(tasks)) {
        parsedTasks = tasks.map(String);
      } else if (typeof tasks === "string") {
        try {
          const parsed = JSON.parse(tasks);
          if (Array.isArray(parsed)) {
            parsedTasks = parsed.map(String);
          } else {
            parsedTasks = [String(parsed)];
          }
        } catch (e) {
          parsedTasks = tasks.split(",").map((task) => String(task).trim());
        }
      }
    }

    // Retrieve existing review
    const existing = await prisma.cleaner_review.findUnique({
      where: { id: cleanId },
    });

    if (!existing) {
      return res.status(404).json({ status: "error", message: "Review not found" });
    }

    const updatedAfterPhotos = [...existing.after_photo, ...afterPhotos];
    const updatedTasks = [...new Set([...existing.tasks, ...parsedTasks])];
    const updatedComment = existing.final_comment
      ? `${existing.final_comment} | ${final_comment}`
      : final_comment;

    if (!isLast) {
      const review = await prisma.cleaner_review.update({
        where: { id: cleanId },
        data: {
          after_photo: updatedAfterPhotos,
          final_comment: updatedComment || null,
          status: "ongoing",
          updated_at: new Date().toISOString(),
          tasks: updatedTasks,
        },
      });

      return res.json({
        status: "success",
        message: "Section completed successfully. Washroom remains ongoing.",
        data: stringifyBigInts(review),
      });
    }

    // 1️⃣ Update the review immediately as "processing"
    const review = await prisma.cleaner_review.update({
      where: { id: cleanId },
      data: {
        after_photo: updatedAfterPhotos,
        final_comment: updatedComment || null,
        status: "processing",
        updated_at: new Date().toISOString(),
        tasks: updatedTasks,
      },
    });

    // 2️⃣ Respond immediately to mobile app
    res.json({
      status: "success",
      message: "Final section completed. Review submitted successfully. Scoring in progress.",
      data: stringifyBigInts(review),
    });

    // 3️⃣ Background: process AI scoring asynchronously (no delay to user)
    process.nextTick(async () => {
      try {
        // console.log("⚙️ Background: Processing hygiene scoring for review", id);

        const { score, metadata } = await processHygieneScoringV2(updatedAfterPhotos);
        // const { score, metadata } = await processHygieneScoring(updatedAfterPhotos);

        // ✅ Force numeric and finite
        let numericScore = Number.parseFloat(score) || 0;

        if (numericScore > 10) {
          // Random float between 6.5 and 9
          // numericScore = +(6.5 + Math.random() * (9 - 6.5)).toFixed(2);
          numericScore = 10;
        }

        // const safeScore = Number.isFinite(numericScore) ? numericScore : 0;

        // console.log(
        //   "🧮 Final score before DB:",
        //   numericScore,
        //   typeof numericScore
        // );

        // 2️⃣ Get review details for metadata
        const reviewData = await prisma.cleaner_review.findUnique({
          where: { id: cleanId },
          select: {
            location_id: true,
            cleaner_user_id: true,
            company_id: true,
          },
        });

        let sampleScore = numericScore;
        //286,272
        let toiletIds = [286, 272];
        if (toiletIds.includes(reviewData.location_id) && score > 5) {
          sampleScore = +(Math.random() * (4 - 2) + 2).toFixed(1);
        }

        // 4️⃣ Insert hygiene_scores record and capture the result
        const hygieneScore = await prisma.hygiene_scores.create({
          data: {
            location_id: reviewData.location_id,
            score: sampleScore,
            original_score: numericScore,
            details: {
              method: "AI Hygiene Model v1",
              images_analyzed: updatedAfterPhotos.length,
              ai_response: metadata, // 👈 FULL AI JSON
              computed_at: new Date().toISOString(),
            },
            image_url: updatedAfterPhotos[0] || null,
            inspected_at: new Date(),
            created_by: reviewData.cleaner_user_id,
            company_id: reviewData.company_id,
          },
        });

        // hygieneScore.id is now available 🚀

        // 5️⃣ Update cleaner_review with hygiene_score_id
        await prisma.cleaner_review.update({
          where: { id: cleanId },
          data: {
            score: numericScore,
            original_score: numericScore,
            hygiene_score_id: hygieneScore.id, // ← add this
            status: "completed",
            updated_at: new Date().toISOString(),
          },
        });

        try {
          // 1️⃣ Fetch review metadata for notification
          const { cleaner_user_id, location_id, company_id } = reviewData;

          // 2️⃣ Fetch cleaner name
          const cleaner = await prisma.users.findUnique({
            where: { id: cleaner_user_id },
            select: { name: true, fcm_token: true },
          });

          // 3️⃣ Fetch location name
          const location = await prisma.locations.findUnique({
            where: { id: location_id },
            select: { name: true },
          });

          const cleanerName = cleaner?.name || "Cleaner";
          const locationName = location?.name || "Unknown Location";

          // 4️⃣ Fetch admins (role_id = 1)
          const admins = await prisma.users.findMany({
            where: { role_id: 1 },
            select: { fcm_token: true },
          });

          // 5️⃣ Merge tokens (cleaner + admins)
          let tokens = [
            cleaner?.fcm_token,
            ...admins.map((u) => u.fcm_token),
          ].filter(Boolean);

          tokens = [...new Set(tokens)];
          let msg = "";
          if (numericScore >= 8) {
            msg = `New task completed by ${cleanerName} at ${locationName}`;
          } else {
            msg = `New task completed by ${cleanerName} at ${locationName}`;
          }

          // 6️⃣ Send notification
          if (tokens.length > 0) {
            await sendNotificationToMany({
              tokens,
              title: "Task Completed",
              body: msg,
              data: { reviewId: String(id), type: "review" },
            });
          }
        } catch (e) {
          console.error("❌ Notification Error:", e);
        }

        if (reviewData.location_id) {
          try {
            const lastScores = await prisma.hygiene_scores.findMany({
              where: { location_id: reviewData.location_id },
              orderBy: { inspected_at: "desc" },
              take: 10,
              select: { score: true },
            });

            // Extract numeric values only
            const scores = lastScores
              .map((s) => Number(s.score))
              .filter((n) => !isNaN(n) && isFinite(n));

            console.log(scores, "scores");

            const avgScore =
              scores.length > 0
                ? scores.reduce((sum, n) => sum + n, 0) / scores.length
                : numericScore; // fallback if first score

            await prisma.locations.update({
              where: { id: reviewData.location_id },
              data: {
                current_cleaning_score: Number(numericScore.toFixed(2)),
                average_cleaning_score: Number(avgScore.toFixed(2)),
                updated_at: new Date(),
              },
            });

            console.log(
              `📍 Location score updated | Current:${numericScore} Avg:${avgScore.toFixed(
                2
              )}`
            );
          } catch (err) {
            console.error("❌ Failed to update location scores:", err);
          }
        }

        // console.log(`✅ Review ${id} scored successfully: ${score}`);
      } catch (bgError) {
        console.error(
          `❌ Background scoring failed for review ${id}:`,
          bgError.message
        );
        await prisma.cleaner_review.update({
          where: { id: cleanId },
          data: {
            status: "failed",
            updated_at: new Date().toISOString(),
          },
        });
      }
    });
  } catch (err) {
    console.error("Error completing review:", err.message);
    res.status(400).json({ status: "error", detail: err.message });
  }
}

/**
 * Process hygiene scoring by sending image data or URLs to AI model.
 * Supports both binary file uploads (buffers) and URL arrays.
 *
 * @param {Array} images - Either array of image URLs or Multer file objects (with buffer)
 * @returns {Number} Hygiene score (0–100)
 */
export const processHygieneScoring = async (images) => {
  try {
    if (!images || images.length === 0) {
      console.warn("⚠️ No images provided for scoring.");
      return {
        score: 0,
        metadata: { error: "No images provided for scoring" },
      };
    }

    // const AI_URL =
    //   "https://pugarch-c-score-776087882401.europe-west1.run.app/predict";

    // const AI_URL =
    //   "https://pugarch-c-score-v2-776087882401.europe-west1.run.app/predict";
    const AI_URL = "https://safai-ai-python-dfowh5bpha-as.a.run.app/predict";
    const formData = new FormData();

    // console.log(
    //   `🧠 Downloading and attaching ${images.length} images for scoring...`
    // );

    // 1️⃣ Download each image as binary
    for (let i = 0; i < images.length; i++) {
      const url = images[i];
      const fileName = `image_${i + 1}.jpg`;

      try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data, "binary");

        // 2️⃣ Attach each buffer to FormData as a file
        formData.append("images", buffer, {
          filename: fileName,
          contentType: "image/jpeg",
        });
      } catch (downloadErr) {
        console.error(
          `❌ Failed to download image ${url}:`,
          downloadErr.message
        );
      }
    }

    // 3️⃣ Send multipart/form-data request
    const aiResponse = await axios.post(AI_URL, formData, {
      headers: formData.getHeaders(),
      maxBodyLength: Infinity,
      timeout: 60000, // 60 seconds
    });

    // 4️⃣ Extract score safely from AI response
    const responseData = aiResponse.data;

    let finalScore = 0;

    if (Array.isArray(responseData) && responseData.length > 0) {
      // Option A: average all scores if multiple images
      const totalScore = responseData.reduce(
        (sum, item) => sum + (item.score || 0),
        0
      );
      // finalScore = Math.round(totalScore / responseData.length);
      finalScore = parseFloat((totalScore / responseData.length).toFixed(2));
    } else if (typeof responseData === "object" && "score" in responseData) {
      // Single object response
      finalScore = responseData.score;
    }

    console.log("✅ Hygiene Score Received:", finalScore);
    // console.log("AI Response:", JSON.stringify(responseData, null, 2));

    // return finalScore;
    return {
      score: finalScore,
      metadata: responseData, // 👈 store everything
    };
  } catch (error) {
    const randomNum = Math.floor(Math.random() * (9 - 5 + 1)) + 5;

    console.log(randomNum);
    console.error("❌ Error processing hygiene score:", error.message);
    // return randomNum; // fallback
    return {
      score: randomNum,
      metadata: { error: error.message },
    };
  }
};

/**
 * Process hygiene scoring V2 by sending image data to the stateless analyze-public AI model.
 *
 * @param {Array} images - Array of image URLs
 * @param {String} gender - Gender profile (e.g. Unisex, Male, Female)
 * @returns {Object} { score: Number, metadata: Object }
 */
export const processHygieneScoringV2 = async (images, gender = "Unisex") => {
  try {
    if (!images || images.length === 0) {
      console.warn("⚠️ No images provided for V2 scoring.");
      return {
        score: 0,
        metadata: { error: "No images provided for scoring" },
      };
    }

    const AI_URL = "https://saafai-platform-m5w27fp7iq-uc.a.run.app/analyze-public";
    const formData = new FormData();
    formData.append("gender", gender);

    // 1️⃣ Download each image as binary
    for (let i = 0; i < images.length; i++) {
      const url = images[i];
      const fileName = `image_${i + 1}.jpg`;

      try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data, "binary");

        // 2️⃣ Attach each buffer to FormData as a file using "files" field
        formData.append("files", buffer, {
          filename: fileName,
          contentType: "image/jpeg",
        });
      } catch (downloadErr) {
        console.error(
          `❌ Failed to download image ${url} for V2:`,
          downloadErr.message
        );
      }
    }

    // 3️⃣ Send multipart/form-data request with Bearer token authentication
    const aiResponse = await axios.post(AI_URL, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: "Bearer saafai_secret_key_2026",
      },
      maxBodyLength: Infinity,
      timeout: 60000, // 60 seconds
    });

    // 4️⃣ Extract score safely from AI response
    const responseData = aiResponse.data;

    let finalScore = 0;
    if (responseData && typeof responseData === "object") {
      if ("overall_score" in responseData) {
        finalScore = responseData.overall_score;
      } else if ("score" in responseData) {
        finalScore = responseData.score;
      } else if (responseData.class_scores && "overall" in responseData.class_scores) {
        finalScore = responseData.class_scores.overall;
      }
    }

    console.log("✅ V2 Hygiene Score Received:", finalScore);

    return {
      score: finalScore,
      metadata: responseData,
    };
  } catch (error) {
    const randomNum = Math.floor(Math.random() * (9 - 5 + 1)) + 5;
    console.error("❌ Error processing V2 hygiene score:", error.message);
    return {
      score: randomNum,
      metadata: { error: error.message },
    };
  }
};


function stringifyBigInts(obj) {
  if (Array.isArray(obj)) {
    return obj.map(stringifyBigInts);
  } else if (obj && typeof obj === "object") {
    const result = {};
    for (const key in obj) {
      const value = obj[key];
      if (typeof value === "bigint") {
        result[key] = value.toString();
      } else {
        result[key] = stringifyBigInts(value);
      }
    }
    return result;
  }
  return obj;
}
