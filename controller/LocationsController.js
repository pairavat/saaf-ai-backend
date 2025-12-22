import prisma from "../config/prismaClient.mjs";
import db from "../db.js";

export const getAllToilets = async (req, res) => {
  console.log("get all toilets");
  try {
    const { company_id, type_id } = req.query;
    console.log(company_id, type_id, "ids");
    const whereClause = {};
    if (company_id) whereClause.company_id = BigInt(company_id);
    if (type_id) whereClause.type_id = BigInt(type_id);

    const allLocations = await prisma.locations.findMany({
      where: Object.keys(whereClause).length ? whereClause : undefined,
      include: {
        hygiene_scores: {
          select: { score: true },
        },
      },
    });

    const result = allLocations.map((loc) => {
      const hygieneScores = loc.hygiene_scores.map((hs) => Number(hs.score));
      const ratingCount = hygieneScores.length;

      let averageRating = null;
      if (ratingCount > 0) {
        const sumOfScores = hygieneScores.reduce(
          (sum, score) => sum + score,
          0
        );
        averageRating = sumOfScores / ratingCount;
      }

      return {
        ...loc,

        // Convert all BigInts to strings
        id: loc.id?.toString(),
        parent_id: loc.parent_id ? loc.parent_id.toString() : null,
        company_id: loc.company_id ? loc.company_id.toString() : null,
        type_id: loc.type_id ? loc.type_id.toString() : null,

        images: loc.images || [],

        averageRating:
          averageRating !== null ? parseFloat(averageRating.toFixed(2)) : null,

        ratingCount,

        // Remove original BigInt-containing array
        hygiene_scores: undefined,
      };
    });

    res.json(sanitizeBigInt(result));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching toilet locations");
  }
};

export const getToiletById = async (req, res) => {
  console.log("get single toilet");
  try {
    let locId = req.params.id;
    const companyId = req.query.companyId;

    console.log(req.params, companyId, "ids");
    // Build where clause for security
    const whereClause = { id: Number(locId) };

    // Add company_id filter if provided for additional security
    if (companyId) {
      whereClause.company_id = Number(companyId);
    }

    const location = await prisma.locations.findUnique({
      where: whereClause,
      include: {
        hygiene_scores: {
          orderBy: { inspected_at: "desc" },
          take: 1,
          select: {
            id: true,
            score: true,
            inspected_at: true,
            created_by: true,
          },
        },
        // ✅ Include cleaner assignments with user details
        cleaner_assignments: {
          where: {
            status: {
              in: ["assigned", "active", "ongoing"], // Active assignments only
            },
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

    console.log("single location", location);
    if (!location) {
      return res.status(404).json({ message: "Toilet not found" });
    }

    const reviews = await prisma.user_review.findMany({
      where: { toilet_id: Number(locId) },
    });

    const intReviews = reviews.map((item) => ({
      ...item,
      toilet_id: item.toilet_id?.toString() || null,
      id: item.id?.toString() || null,
      // Handle other BigInt fields in reviews if any
    }));

    console.log(intReviews, "int review");
    const userRatings = reviews.map((r) => r.rating).filter(Boolean);
    const hygieneScore = location.hygiene_scores[0]?.score ?? null;

    const hygieneRatingMapped =
      hygieneScore !== null
        ? hygieneScore >= 100
          ? 5
          : hygieneScore >= 80
          ? 4
          : hygieneScore >= 60
          ? 3
          : hygieneScore >= 40
          ? 2
          : 1
        : null;

    const allRatings = [
      ...userRatings,
      ...(hygieneRatingMapped !== null ? [hygieneRatingMapped] : []),
    ];
    const ratingCount = allRatings.length;
    const averageRating =
      ratingCount > 0
        ? allRatings.reduce((sum, r) => sum + r, 0) / ratingCount
        : null;

    // ✅ Serialize all BigInt fields to strings
    const result = {
      ...location,
      // Convert main location BigInt fields
      id: location.id?.toString() || null,
      parent_id: location.parent_id?.toString() || null,
      company_id: location.company_id?.toString() || null,
      type_id: location.type_id?.toString() || null,

      // Handle hygiene_scores BigInt fields
      hygiene_scores: location.hygiene_scores.map((score) => ({
        ...score,
        id: score.id?.toString() || null,
        created_by: score.created_by?.toString() || null,
      })),

      // Handle cleaner_assignments BigInt fields
      cleaner_assignments: location.cleaner_assignments.map((assignment) => ({
        ...assignment,
        id: assignment.id?.toString() || null,
        cleaner_user_id: assignment.cleaner_user_id?.toString() || null,
        company_id: assignment.company_id?.toString() || null,
        type_id: assignment.type_id?.toString() || null,
        location_id: assignment.location_id?.toString() || null,
        supervisor_id: assignment.supervisor_id?.toString() || null,

        // Handle nested cleaner_user BigInt fields
        cleaner_user: assignment.cleaner_user
          ? {
              ...assignment.cleaner_user,
              id: assignment.cleaner_user.id?.toString() || null,
            }
          : null,

        // Handle nested supervisor BigInt fields
        supervisor: assignment.supervisor
          ? {
              ...assignment.supervisor,
              id: assignment.supervisor.id?.toString() || null,
            }
          : null,
      })),

      // Include other fields
      images: location.images || [],
      averageRating,
      ratingCount,
      ReviewData: intReviews,

      // ✅ Create assignedCleaners with proper serialization
      assignedCleaners: location.cleaner_assignments.map((assignment) => ({
        id: assignment.id?.toString() || null,
        name: assignment.name,
        status: assignment.status,
        assignedOn: assignment.assigned_on,
        releasedOn: assignment.released_on,
        createdAt: assignment.created_at,
        updatedAt: assignment.updated_at,
        cleaner: assignment.cleaner_user
          ? {
              id: assignment.cleaner_user.id?.toString() || null,
              name: assignment.cleaner_user.name,
              phone: assignment.cleaner_user.phone,
              email: assignment.cleaner_user.email,
            }
          : null,
        supervisor: assignment.supervisor
          ? {
              id: assignment.supervisor.id?.toString() || null,
              name: assignment.supervisor.name,
              phone: assignment.supervisor.phone,
              email: assignment.supervisor.email,
            }
          : null,
      })),
    };

    res.json(sanitizeBigInt(result));
  } catch (err) {
    console.error("Error in getToiletById:", err);
    res.status(500).json({
      success: false,
      error: "Error fetching toilet by ID",
      details: err.message,
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

    // Build where clause for security and search
    const whereClause = {
      name: {
        contains: search,
        mode: "insensitive",
      },
    };

    // Add company filter if provided
    if (company_id) {
      whereClause.company_id = Number(company_id);
    }

    const locations = await prisma.locations.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        images: true, // ✅ Include images in search results
        created_at: true,
      },
      orderBy: {
        name: "asc",
      },
      take: 20, // Limit results for performance
    });

    // Convert BigInt to string
    const result = locations.map((location) => ({
      ...location,
      id: location.id.toString(),
      images: location.images || [], // ✅ Ensure images is always array
    }));

    res.json(result);
  } catch (err) {
    console.error("Error searching locations:", err);
    res.status(500).json({
      success: false,
      error: "Error searching locations",
    });
  }
};

export const createLocation = async (req, res) => {
  try {
    const { name, parent_id, type_id, latitude, longitude, options } = req.body;
    const { companyId } = req.query;

    if (typeof options === "string") {
      console.log("Options string value:", options);
      console.log("Is it [object Object]?", options === "[object Object]");
    }

    // Get uploaded image URLs from middleware
    const imageUrls = req.uploadedFiles?.images || [];
    console.log("Uploaded images:", imageUrls);

    // Basic validation
    if (!name || !type_id) {
      return res.status(400).json({ error: "Name and typeId are required." });
    }

    // ✅ Handle options parsing (only if it's a string)
    let finalOptions = options ?? {};

    if (typeof options === "string") {
      console.log("Options is string, attempting to parse...");

      if (options === "[object Object]") {
        console.warn("Received [object Object] string, using empty object");
        finalOptions = {};
      } else if (options === "{}" || options === "") {
        console.log("Options is empty string or {}, using empty object");
        finalOptions = {};
      } else {
        try {
          finalOptions = JSON.parse(options);
          console.log("Successfully parsed options:", finalOptions);
        } catch (e) {
          console.error("Failed to parse options string:", options, e);
          finalOptions = {};
        }
      }
    } else if (typeof options === "object" && options !== null) {
      console.log("Options is already an object:", options);
      finalOptions = options;
    } else {
      console.log("Options is neither string nor object, using empty object");
      finalOptions = {};
    }

    console.log("Final options to save:", finalOptions);
    console.log("Final options stringified:", JSON.stringify(finalOptions));

    // ✅ Fix latitude/longitude parsing
    const parsedLatitude =
      latitude && latitude !== "null" ? parseFloat(latitude) : null;
    const parsedLongitude =
      longitude && longitude !== "null" ? parseFloat(longitude) : null;

    console.log("Parsed coordinates:", { parsedLatitude, parsedLongitude });

    const locationData = {
      name,
      parent_id: parent_id ? BigInt(parent_id) : null,
      company_id: companyId ? BigInt(companyId) : null,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      metadata: {},
      type_id: BigInt(type_id),
      options: finalOptions, // ✅ Use processed options
      images: imageUrls,
    };

    console.log("=== FINAL DATA TO SAVE ===");
    console.log(
      JSON.stringify(
        {
          ...locationData,
          parent_id: locationData.parent_id?.toString(),
          company_id: locationData.company_id?.toString(),
          type_id: locationData.type_id?.toString(),
        },
        null,
        2
      )
    );

    // Insert into DB
    const newLocation = await prisma.locations.create({
      data: locationData,
    });

    console.log("=== LOCATION CREATED ===");
    console.log("Created location options:", newLocation.options);

    res.status(201).json({
      success: true,
      message: "Location added successfully.",
      data: {
        ...newLocation,
        id: newLocation.id.toString(),
        parent_id: newLocation.parent_id?.toString() || null,
        type_id: newLocation.type_id?.toString() || null,
        company_id: newLocation.company_id?.toString() || null,
        images: newLocation.images || [],
      },
    });
  } catch (err) {
    console.error("Error creating location:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ error: "Failed to create location." });
  }
};

export const updateLocationById = async (req, res) => {
  try {
    const locationId = req.params.id;
    const companyId = req.query.companyId;
    const updateData = req.body;

    console.log("Updating location:", locationId, "for company:", companyId);
    console.log("Update data received:", updateData);

    // Build where clause for security
    const whereClause = { id: Number(locationId) };

    // Add company_id filter if provided for additional security
    if (companyId) {
      whereClause.company_id = Number(companyId);
    }

    // Check if location exists and belongs to company
    const existingLocation = await prisma.locations.findUnique({
      where: whereClause,
    });

    if (!existingLocation) {
      return res.status(404).json({
        success: false,
        message: "Location not found or access denied",
      });
    }

    // ✅ Get uploaded image URLs from middleware
    const newImageUrls = req.uploadedFiles?.images || [];
    console.log("New images uploaded:", newImageUrls);

    // ✅ Handle image updates
    let finalImages = existingLocation.images || [];

    if (newImageUrls.length > 0) {
      // Add new images to existing ones
      finalImages = [...finalImages, ...newImageUrls];
    }

    // ✅ If replace_images is true, replace all images
    if (
      updateData.replace_images === "true" ||
      updateData.replace_images === true
    ) {
      finalImages = newImageUrls;
    }

    // ✅ Handle options properly (same as create)
    let finalOptions = existingLocation.options || {};

    if (updateData.options) {
      if (typeof updateData.options === "string") {
        console.log("Options is string, attempting to parse...");

        if (updateData.options === "[object Object]") {
          console.warn(
            "Received [object Object] string, keeping existing options"
          );
          finalOptions = existingLocation.options || {};
        } else if (updateData.options === "{}" || updateData.options === "") {
          console.log("Options is empty string or {}, using empty object");
          finalOptions = {};
        } else {
          try {
            finalOptions = JSON.parse(updateData.options);
            console.log("Successfully parsed options:", finalOptions);
          } catch (e) {
            console.error(
              "Failed to parse options string:",
              updateData.options,
              e
            );
            finalOptions = existingLocation.options || {};
          }
        }
      } else if (
        typeof updateData.options === "object" &&
        updateData.options !== null
      ) {
        console.log("Options is already an object:", updateData.options);
        finalOptions = updateData.options;
      }
    }

    console.log("Final options for update:", finalOptions);

    // ✅ Prepare update data with proper parsing
    const dataToUpdate = {
      name: updateData.name || existingLocation.name,
      latitude:
        updateData.latitude && updateData.latitude !== "null"
          ? parseFloat(updateData.latitude)
          : existingLocation.latitude,
      longitude:
        updateData.longitude && updateData.longitude !== "null"
          ? parseFloat(updateData.longitude)
          : existingLocation.longitude,
      options: finalOptions, // ✅ Use processed options
      metadata: updateData.metadata || existingLocation.metadata,
      images: finalImages, // ✅ Now properly defined
    };

    // Update parent_id and type_id if provided
    if (updateData.parent_id) {
      dataToUpdate.parent_id = BigInt(updateData.parent_id);
    }
    if (updateData.type_id) {
      dataToUpdate.type_id = BigInt(updateData.type_id);
    }

    console.log("Final data to update:", {
      ...dataToUpdate,
      options: JSON.stringify(dataToUpdate.options),
      imagesCount: finalImages.length,
    });

    // Update the location
    const updatedLocation = await prisma.locations.update({
      where: { id: Number(locationId) },
      data: dataToUpdate,
    });

    // Convert BigInts to strings for response
    const result = {
      ...updatedLocation,
      id: updatedLocation.id.toString(),
      parent_id: updatedLocation.parent_id?.toString() || null,
      company_id: updatedLocation.company_id?.toString() || null,
      type_id: updatedLocation.type_id?.toString() || null,
      images: updatedLocation.images || [], // ✅ Include images in response
    };

    res.json({
      success: true,
      message: "Location updated successfully",
      data: result,
    });
  } catch (err) {
    console.error("Error updating location:", err);
    res.status(500).json({
      success: false,
      error: "Failed to update location",
      details: err.message, // Add error details for debugging
    });
  }
};

// ✅ Add new endpoint to delete specific images
export const deleteLocationImage = async (req, res) => {
  try {
    const locationId = req.params.id;
    const { imageUrl } = req.body;
    const companyId = req.query.companyId;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Image URL is required",
      });
    }

    const whereClause = { id: Number(locationId) };
    if (companyId) {
      whereClause.company_id = Number(companyId);
    }

    const location = await prisma.locations.findUnique({
      where: whereClause,
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found or access denied",
      });
    }

    // Remove the specific image URL
    const updatedImages = (location.images || []).filter(
      (img) => img !== imageUrl
    );

    const updatedLocation = await prisma.locations.update({
      where: { id: Number(locationId) },
      data: { images: updatedImages },
    });

    res.json({
      success: true,
      message: "Image deleted successfully",
      data: {
        id: updatedLocation.id.toString(),
        images: updatedLocation.images || [],
      },
    });
  } catch (err) {
    console.error("Error deleting location image:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete image",
    });
  }
};

// ✅ Delete location by ID
export const deleteLocationById = async (req, res) => {
  try {
    const locationId = req.params.id;
    const companyId = req.query.companyId;

    console.log("Deleting location:", locationId, "for company:", companyId);

    // Build where clause for security
    const whereClause = { id: Number(locationId) };

    // Add company_id filter if provided for additional security
    if (companyId) {
      whereClause.company_id = Number(companyId);
    }

    // Check if location exists and belongs to company
    const existingLocation = await prisma.locations.findUnique({
      where: whereClause,
      include: {
        // Check for dependencies
        hygiene_scores: { select: { id: true } },
        cleaner_assignments: { select: { id: true } },
        other_locations: { select: { id: true } }, // Check for child locations
      },
    });

    if (!existingLocation) {
      return res.status(404).json({
        success: false,
        message: "Location not found or access denied",
      });
    }

    // Check for dependencies that might prevent deletion
    const dependencies = [];
    if (existingLocation.hygiene_scores.length > 0) {
      dependencies.push(
        `${existingLocation.hygiene_scores.length} hygiene score(s)`
      );
    }
    if (existingLocation.cleaner_assignments.length > 0) {
      dependencies.push(
        `${existingLocation.cleaner_assignments.length} cleaner assignment(s)`
      );
    }
    if (existingLocation.other_locations.length > 0) {
      dependencies.push(
        `${existingLocation.other_locations.length} child location(s)`
      );
    }

    // Option 1: Soft delete (recommended) - just mark as deleted
    const softDelete = req.query.soft === "true";

    if (softDelete || dependencies.length > 0) {
      // For locations with dependencies, do soft delete by updating metadata
      const updatedLocation = await prisma.locations.update({
        where: { id: Number(locationId) },
        data: {
          metadata: {
            ...existingLocation.metadata,
            deleted_at: new Date().toISOString(),
            deleted_by: req.user?.id || null, // If you have user context
            delete_reason:
              dependencies.length > 0
                ? `Has dependencies: ${dependencies.join(", ")}`
                : "Soft delete requested",
          },
        },
      });

      return res.json({
        success: true,
        message:
          dependencies.length > 0
            ? `Location marked as deleted (has dependencies: ${dependencies.join(
                ", "
              )})`
            : "Location deleted successfully",
        data: {
          id: updatedLocation.id.toString(),
          deleted: true,
          soft_delete: true,
          dependencies: dependencies,
        },
      });
    }

    // Option 2: Hard delete (cascade delete dependencies)
    // Delete in order: hygiene_scores -> cleaner_assignments -> location

    // Delete hygiene scores
    if (existingLocation.hygiene_scores.length > 0) {
      await prisma.hygiene_scores.deleteMany({
        where: { location_id: Number(locationId) },
      });
    }

    // Delete cleaner assignments
    if (existingLocation.cleaner_assignments.length > 0) {
      await prisma.cleaner_assignments.deleteMany({
        where: { location_id: Number(locationId) },
      });
    }

    // Update child locations to remove parent reference
    if (existingLocation.other_locations.length > 0) {
      await prisma.locations.updateMany({
        where: { parent_id: Number(locationId) },
        data: { parent_id: null },
      });
    }

    // Finally delete the location
    await prisma.locations.delete({
      where: { id: Number(locationId) },
    });

    res.json({
      success: true,
      message: "Location and all related data deleted successfully",
      data: {
        id: locationId,
        deleted: true,
        hard_delete: true,
        cleaned_dependencies: dependencies,
      },
    });
  } catch (err) {
    console.error("Error deleting location:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete location",
      details: err.message,
    });
  }
};

////////////////////// new get locations with zone apis /////////////////////

export const getNearbyLocations = async (req, res) => {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing lat or lng" });
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const maxDistance = parseFloat(radius || 1000); // meters

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
                l.current_cleaning_score,
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
              WHERE l.latitude IS NOT NULL
                AND l.longitude IS NOT NULL
                AND l.status = true
            ) AS calculated
            WHERE distance <= ${maxDistance}
            ORDER BY distance ASC
            LIMIT 50;
          `;

    const formatted = result.map((loc) => ({
      id: loc.id.toString(),
      name: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      pincode: loc.pincode,
      images: loc.images,
      options: loc.options,
      metadata: loc.metadata,
      average_cleaning_score: loc.average_cleaning_score,
      current_cleaning_score: loc.current_cleaning_score,
      distance: parseFloat(loc.distance).toFixed(1),

      company: loc.company_id
        ? { id: loc.company_id.toString(), name: loc.company_name }
        : null,

      type: loc.type_id
        ? { id: loc.type_id.toString(), name: loc.type_name }
        : null,

      facilityCompany: loc.facility_companiesId
        ? {
            id: loc.facility_companiesId.toString(),
            name: loc.facility_company_name,
          }
        : null,

      parent: loc.parent_id
        ? { id: loc.parent_id.toString(), name: loc.parent_name }
        : null,
    }));

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
