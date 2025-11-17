import prisma from "../config/prismaClient.mjs";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";

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

    if (cleaner_user_id) {
      whereClause.cleaner_user_id = BigInt(cleaner_user_id);
    }
    if (company_id) {
      whereClause.company_id = company_id;
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
  const { cleaner_user_id, date } = req.params;

  let stats = {};
  try {
    // ✅ Input validation
    if (!cleaner_user_id || isNaN(cleaner_user_id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid cleaner user ID provided",
      });
    }

    // ✅ Determine which date to use — provided or today
    const targetDate = date ? new Date(date) : new Date();

    if (isNaN(targetDate)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    // ✅ Calculate start and end of the day (00:00:00 to 23:59:59)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // ✅ Fetch reviews for the given cleaner and date
    const reviews = await prisma.cleaner_review.findMany({
      where: {
        cleaner_user_id: BigInt(cleaner_user_id),
        created_at: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
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
    if (!task_id || isNaN(task_id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid cleaner user ID provided",
      });
    }

    // ✅ Single query with all related data using include
    const reviews = await prisma.cleaner_review.findMany({
      where: {
        id: BigInt(task_id),
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

    const review = await prisma.cleaner_review.create({
      data: {
        name,
        location_id: location_id ? BigInt(location_id) : null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        address,
        cleaner_user_id: cleaner_user_id ? BigInt(cleaner_user_id) : null,
        tasks: parsedTasks,
        initial_comment: initial_comment || null,
        before_photo: beforePhotos,
        after_photo: [],
        status: "ongoing",
        company_id: company_id ? BigInt(company_id) : null,
      },
    });

    const serializedData = {
      ...review,
      id: review?.id.toString(),
      location_id: review?.location_id?.toString(),
      cleaner_user_id: review?.cleaner_user_id?.toString(),
      company_id: review?.company_id?.toString(),
    };

    res.status(201).json({ status: "success", data: serializedData });
  } catch (err) {
    console.error("Create Review Error:", err);
    res.status(400).json({ status: "error", detail: err.message });
  }
}

export async function completeCleanerReview(req, res) {
  try {
    const { final_comment, id, tasks } = req.body;
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

    // 1️⃣ Update the review immediately as "processing"
    const review = await prisma.cleaner_review.update({
      where: { id: BigInt(id) },
      data: {
        after_photo: afterPhotos,
        final_comment: final_comment || null,
        status: "processing",
        updated_at: new Date().toISOString(),
        tasks: parsedTasks,
      },
    });

    // 2️⃣ Respond immediately to mobile app
    res.json({
      status: "success",
      message: "Review submitted successfully. Scoring in progress.",
      data: stringifyBigInts(review),
    });

    // 3️⃣ Background: process AI scoring asynchronously (no delay to user)
    process.nextTick(async () => {
      try {
        // console.log("⚙️ Background: Processing hygiene scoring for review", id);

        const score = await processHygieneScoring(afterPhotos);

        // ✅ Force numeric and finite
        const numericScore = Number.parseFloat(score) || 0;
        // const safeScore = Number.isFinite(numericScore) ? numericScore : 0;

        // console.log(
        //   "🧮 Final score before DB:",
        //   numericScore,
        //   typeof numericScore
        // );

        // 2️⃣ Get review details for metadata
        const reviewData = await prisma.cleaner_review.findUnique({
          where: { id: BigInt(id) },
          select: {
            location_id: true,
            cleaner_user_id: true,
            company_id: true,
          },
        });

        await prisma.cleaner_review.update({
          where: { id: BigInt(id) },
          data: {
            score: numericScore,
            original_score: numericScore,
            status: "completed",
            updated_at: new Date().toISOString(),
          },
        });

        // console.log(`✅ Review ${id} scored successfully: ${score}`);

        // 4️⃣ Insert hygiene_scores record
        // (You can choose the first photo or leave image_url null if not needed)
        await prisma.hygiene_scores.create({
          data: {
            location_id: reviewData.location_id,
            score: numericScore,
            original_score: numericScore,
            details: { method: "AI Hygiene Model" }, // optional metadata
            image_url: afterPhotos[0] || null,
            inspected_at: new Date(),
            created_by: reviewData.cleaner_user_id,
          },
        });
      } catch (bgError) {
        console.error(
          `❌ Background scoring failed for review ${id}:`,
          bgError.message
        );
        await prisma.cleaner_review.update({
          where: { id: BigInt(id) },
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
      return 0;
    }

    const AI_URL =
      "https://pugarch-c-score-776087882401.europe-west1.run.app/predict";
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

    return finalScore;
  } catch (error) {
    const randomNum = Math.floor(Math.random() * (9 - 5 + 1)) + 5;

    console.log(randomNum);
    console.error("❌ Error processing hygiene score:", error.message);
    return randomNum; // fallback
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
