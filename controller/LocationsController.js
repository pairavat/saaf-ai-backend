import prisma from "../config/prismaClient.mjs";
import db from "../db.js";

const cleanerWeight = 0.6;
const userWeight = 0.4;

export const getAllToilets = async (req, res) => {
  console.log("get all toilets");

  try {
    const { company_id, type_id } = req.query;

    const whereClause = {};
    if (company_id) whereClause.company_id = BigInt(company_id);
    if (type_id) whereClause.type_id = BigInt(type_id);

    const allLocations = await prisma.locations.findMany({
      where: Object.keys(whereClause).length ? whereClause : undefined,
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        images: true,
        options: true,
        metadata: true,
        parent_id: true,
        company_id: true,
        type_id: true,

        // ✅ Rating sources
        average_cleaning_score: true,
        user_review_score: true,
      },
    });

    const result = allLocations.map((loc) => {
      const cleaningScore =
        loc.average_cleaning_score !== null
          ? Number(loc.average_cleaning_score)
          : null;

      const userScore =
        loc.user_review_score !== null ? Number(loc.user_review_score) : null;

      let overallAverageScore = null;

      if (cleaningScore !== null && userScore !== null) {
        overallAverageScore = Number(
          (cleaningScore * cleanerWeight + userScore * userWeight).toFixed(2)
        );
      } else {
        overallAverageScore = userScore ?? cleaningScore;
      }

      return {
        ...loc,

        // BigInt → string
        id: loc.id?.toString(),
        parent_id: loc.parent_id?.toString() || null,
        company_id: loc.company_id?.toString() || null,
        type_id: loc.type_id?.toString() || null,

        images: loc.images || [],

        average_cleaning_score: cleaningScore,
        user_review_score: userScore,
        overallAverageScore,
      };
    });

    return res.json(sanitizeBigInt(result));
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error fetching toilet locations",
    });
  }
};

export const getToiletById = async (req, res) => {
  try {
    const locId = Number(req.params.id);
    const companyId = req.query.companyId ? Number(req.query.companyId) : null;

    const whereClause = { id: locId };
    if (companyId) whereClause.company_id = companyId;

    const location = await prisma.locations.findUnique({
      where: whereClause,
      include: {
        cleaner_assignments: {
          where: {
            status: { in: ["assigned", "active", "ongoing"] },
          },
          include: {
            cleaner_user: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
            supervisor: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
          orderBy: { assigned_on: "desc" },
        },
      },
    });

    if (!location) {
      return res.status(404).json({ message: "Toilet not found" });
    }

    /* ----------------------------------
       REVIEWS (LIST ONLY – NO AGGREGATION)
    ----------------------------------- */
    const reviews = await prisma.user_review.findMany({
      where: { toilet_id: locId },
      orderBy: { created_at: "desc" },
      take: 10, // optional: limit for detail page
    });

    const ReviewData = reviews.map((r) => ({
      ...r,
      id: r.id?.toString() || null,
      toilet_id: r.toilet_id?.toString() || null,
    }));

    /* ----------------------------------
       STORED SCORES
    ----------------------------------- */
    const cleaningScore =
      location.average_cleaning_score !== null
        ? Number(location.average_cleaning_score)
        : null;

    const userScore =
      location.user_review_score !== null
        ? Number(location.user_review_score)
        : null;

    /* ----------------------------------
       OVERALL SCORE (SAME LOGIC EVERYWHERE)
    ----------------------------------- */
    let overallAverageScore = null;

    if (cleaningScore !== null && userScore !== null) {
      overallAverageScore = Number(
        (cleaningScore * cleanerWeight + userScore * userWeight).toFixed(2)
      );
    } else {
      overallAverageScore = userScore ?? cleaningScore;
    }

    /* ----------------------------------
       FINAL RESPONSE
    ----------------------------------- */
    const result = {
      ...location,

      id: location.id?.toString() || null,
      parent_id: location.parent_id?.toString() || null,
      company_id: location.company_id?.toString() || null,
      type_id: location.type_id?.toString() || null,

      average_cleaning_score: cleaningScore,
      user_review_score: userScore,
      overallAverageScore,

      reviews: ReviewData,

      cleaner_assignments: location.cleaner_assignments.map((a) => ({
        ...a,
        id: a.id?.toString() || null,
        cleaner_user_id: a.cleaner_user_id?.toString() || null,
        company_id: a.company_id?.toString() || null,
        type_id: a.type_id?.toString() || null,
        location_id: a.location_id?.toString() || null,
        supervisor_id: a.supervisor_id?.toString() || null,

        cleaner_user: a.cleaner_user
          ? { ...a.cleaner_user, id: a.cleaner_user.id?.toString() }
          : null,

        supervisor: a.supervisor
          ? { ...a.supervisor, id: a.supervisor.id?.toString() }
          : null,
      })),
    };

    res.json(sanitizeBigInt(result));
  } catch (error) {
    console.error("getToiletById error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch toilet",
    });
  }
};

// Add this search endpoint to your locations controller

export const getSearchToilet = async (req, res) => {
  try {
    const { search, company_id } = req.query;

    if (!search) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    /* ----------------------------
       WHERE CLAUSE
    ----------------------------- */
    const whereClause = {
      name: {
        contains: search,
        mode: "insensitive",
      },
      status: true,
    };

    if (company_id) {
      whereClause.company_id = BigInt(company_id);
    }

    /* ----------------------------
       QUERY (NO HEAVY JOINS)
    ----------------------------- */
    const locations = await prisma.locations.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        images: true,

        average_cleaning_score: true,
        user_review_score: true,
        rating_count: true,

        created_at: true,
      },
      orderBy: {
        name: "asc",
      },
      take: 20,
    });

    /* ----------------------------
       FORMAT + SCORE
    ----------------------------- */
    const result = locations.map((loc) => {
      const cleaningScore =
        loc.average_cleaning_score !== null
          ? Number(loc.average_cleaning_score)
          : null;

      const userScore =
        loc.user_review_score !== null ? Number(loc.user_review_score) : null;

      let overallAverageScore = null;

      if (cleaningScore !== null && userScore !== null) {
        overallAverageScore = Number(
          (cleaningScore * 0.6 + userScore * 0.4).toFixed(2)
        );
      } else {
        overallAverageScore = userScore ?? cleaningScore;
      }

      return {
        id: loc.id.toString(),
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        images: loc.images || [],

        average_cleaning_score: cleaningScore,
        user_review_score: userScore,
        overallAverageScore,
        ratingCount: loc.rating_count ?? 0,
      };
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Error searching locations:", err);
    res.status(500).json({
      success: false,
      message: "Error searching locations",
    });
  }
};

////////////////////// new get locations with zone apis /////////////////////

export const getNearbyLocations = async (req, res) => {
  console.log("Nearby Locations API called");

  const { lat, lng, radius } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing lat or lng" });
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const maxDistance = parseFloat(radius || 1000);

  // weights (keep same everywhere)
  const cleanerWeight = 0.6;
  const userWeight = 0.4;

  try {
    const result = await prisma.$queryRaw`
      SELECT *
      FROM (
        SELECT
          l.id,
          l.name,
          l.latitude,
          l.longitude,
          l.address,
          l.city,
          l.state,
          l.pincode,
          l.images,
          l.options,
          l.metadata,

          l.average_cleaning_score,
          l.user_review_score,

          COUNT(ur.id) AS review_count,

          l.company_id,
          c.name AS company_name,

          l.type_id,
          ft.name AS type_name,

          l.parent_id,
          p.name AS parent_name,

          (
            6371000 * ACOS(
              LEAST(
                1,
                COS(RADIANS(${userLat})) * COS(RADIANS(l.latitude)) *
                COS(RADIANS(l.longitude) - RADIANS(${userLng})) +
                SIN(RADIANS(${userLat})) * SIN(RADIANS(l.latitude))
              )
            )
          ) AS distance

        FROM locations l
        LEFT JOIN companies c ON l.company_id = c.id
        LEFT JOIN location_types ft ON l.type_id = ft.id
        LEFT JOIN locations p ON l.parent_id = p.id
        LEFT JOIN user_review ur ON ur.location_id = l.id

        WHERE l.latitude IS NOT NULL
          AND l.longitude IS NOT NULL
          AND l.status = true

        GROUP BY
          l.id,
          c.name,
          ft.name,
          p.name
      ) calculated
      WHERE distance <= ${maxDistance}
      ORDER BY distance ASC
      LIMIT 50;
    `;

    const formatted = result.map((loc) => {
      const cleaningScore =
        loc.average_cleaning_score !== null
          ? Number(loc.average_cleaning_score)
          : null;

      const userScore =
        loc.user_review_score !== null ? Number(loc.user_review_score) : null;

      let overallAverageScore = null;

      if (cleaningScore !== null && userScore !== null) {
        overallAverageScore = Number(
          (cleaningScore * cleanerWeight + userScore * userWeight).toFixed(2)
        );
      } else {
        overallAverageScore = userScore ?? cleaningScore;
      }

      return {
        id: loc.id.toString(),
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address,
        city: loc.city,
        state: loc.state,
        pincode: loc.pincode,
        images: loc.images || [],
        options: loc.options,
        metadata: loc.metadata,

        distance: Number(loc.distance).toFixed(1),

        average_cleaning_score: cleaningScore,
        user_review_score: userScore,
        overallAverageScore,

        reviewCount: Number(loc.review_count),

        company: loc.company_id
          ? { id: loc.company_id.toString(), name: loc.company_name }
          : null,

        type: loc.type_id
          ? { id: loc.type_id.toString(), name: loc.type_name }
          : null,

        parent: loc.parent_id
          ? { id: loc.parent_id.toString(), name: loc.parent_name }
          : null,
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error("Nearby Prisma Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getZonesWithToilets = async (req, res) => {
  console.log("old zones");
  try {
    // Fetch all zones (platforms or floors)
    const ZONE_TYPE_IDS = [
      BigInt(5),
      BigInt(7),
      BigInt(2),
      BigInt(3),
      BigInt(6),
      BigInt(11),
    ]; // Platform & Floor

    const zones = await prisma.locations.findMany({
      where: {
        type_id: { in: ZONE_TYPE_IDS },
      },
      select: {
        id: true,
        name: true,
        type_id: true,
      },
    });

    console.log(zones, "zones");

    if (!zones.length) return res.json([]);

    // Get toilets whose parent is in those zones
    const zoneIds = zones.map((z) => z.id);
    console.log(zoneIds, "zones ids");

    const toilets = await prisma.locations.findMany({
      where: {
        type_id: BigInt(4), // Toilet
        parent_id: { in: zoneIds },
      },
      select: {
        id: true,
        name: true,
        parent_id: true,
        latitude: true,
        longitude: true,
        hygiene_scores: {
          orderBy: { inspected_at: "desc" },
          take: 1,
          select: { image_url: true },
        },
      },
    });

    console.log(toilets, "toilest ++ loc");
    // Group toilets by their zone (parent_id)
    const toiletsByZone = {};
    toilets.forEach((toilet) => {
      const zoneId = toilet.parent_id.toString();
      if (!toiletsByZone[zoneId]) toiletsByZone[zoneId] = [];

      // toiletsByZone[zoneId].push({
      //   id: toilet.id.toString(),
      //   name: toilet.name,
      //   image_url: toilet.hygiene_scores[0]?.image_url || null,
      // });

      toiletsByZone[zoneId].push({
        id: toilet.id.toString(),
        name: toilet.name,
        image_url: toilet.hygiene_scores[0]?.image_url || null,
        latitude: toilet.latitude,
        longitude: toilet.longitude,
      });
    });

    // Attach toilets to zones
    const result = zones.map((zone) => ({
      id: zone.id.toString(),
      name: zone.name,
      type_id: zone.type_id.toString(),
      children: toiletsByZone[zone.id.toString()] || [],
    }));

    return res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching zones and toilets" });
  }
};

export const saveToilet = async (req, res) => {
  try {
    const { id } = req.params; // location_id
    const user_id = req.user.id; // Assuming user_id comes from auth middleware

    const saved = await prisma.saved_locations.upsert({
      where: {
        user_id_location_id: {
          user_id: BigInt(user_id),
          location_id: BigInt(id),
        },
      },
      update: {}, // If exists, do nothing
      create: {
        user_id: BigInt(user_id),
        location_id: BigInt(id),
      },
    });

    res.status(201).json({ message: "Toilet saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error saving toilet" });
  }
};

// 2. Unsave a toilet (DELETE)
export const unsaveToilet = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    await prisma.saved_locations.deleteMany({
      where: {
        user_id: BigInt(user_id),
        location_id: BigInt(id),
      },
    });

    res.json({ message: "Toilet removed from saved" });
  } catch (err) {
    res.status(500).json({ error: "Error removing toilet" });
  }
};

// 3. Get all saved toilets for a user (GET)
export const getSavedToilets = async (req, res) => {
  try {
    const user_id = req.user.id; // From verifyToken middleware

    const savedRecords = await prisma.saved_locations.findMany({
      where: {
        user_id: BigInt(user_id),
      },
      include: {
        location: {
          include: {
            location_types: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // Extract the location object and sanitize BigInts
    const results = savedRecords.map((record) => ({
      ...record.location,
      id: record.location.id.toString(),
      company_id: record.location.company_id?.toString(),
      type_id: record.location.type_id?.toString(),
      // Ensure images is always an array for the frontend
      images: record.location.images || [],
    }));

    res.json(sanitizeBigInt(results));
  } catch (err) {
    console.error("Error in getSavedToilets:", err);
    res.status(500).json({
      success: false,
      error: "Error fetching saved toilets",
    });
  }
};

// 4. Check if a specific toilet is saved (GET)
export const isToiletSaved = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const count = await prisma.saved_locations.count({
      where: {
        user_id: BigInt(user_id),
        location_id: BigInt(id),
      },
    });

    res.json({ isSaved: count > 0 });
  } catch (err) {
    res.status(500).json({ error: "Error checking status" });
  }
};

const sanitizeBigInt = (obj) =>
  JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
