import prisma from "../config/prismaClient.mjs";
import db from "../db.js";





export const getAllToilets = async (req, res) => {
  console.log("get all toilets");
  try {
    const { company_id, type_id } = req.query; // get query params
    // console.log(company_id, type_id, "all types of ids");
    // Build where clause dynamically
    const whereClause = {};
    if (company_id) {
      whereClause.company_id = BigInt(company_id);
    }
    if (type_id) {
      whereClause.type_id = BigInt(type_id);
    }

    const allLocations = await prisma.locations.findMany({
      where: Object.keys(whereClause).length ? whereClause : undefined,
      include: {
        // Fetch ALL hygiene scores for each location
        hygiene_scores: {
          select: { score: true },
        },
      },
    });

    const result = allLocations.map((loc) => {
      // --- New Rating Calculation Logic ---
      const hygieneScores = loc.hygiene_scores.map(hs => Number(hs.score));
      const ratingCount = hygieneScores.length;

      let averageRating = null;
      if (ratingCount > 0) {
        const sumOfScores = hygieneScores.reduce((sum, score) => sum + score, 0);
        // Calculate the direct average of the scores.
        averageRating = sumOfScores / ratingCount;
      }

      return {
        ...loc,
        id: loc.id.toString(),
        parent_id: loc.parent_id?.toString() || null,
        company_id: loc.company_id?.toString() || null,
        type_id: loc.type_id?.toString() || null,
        images: loc.images || [], // ✅ Include images array
        averageRating: averageRating ? parseFloat(averageRating.toFixed(2)) : null, // Format to 2 decimal places
        ratingCount,
        hygiene_scores: undefined, // Remove the original hygiene_scores array from the final output
      };
    });

    // console.log(result.slice(0, 6), "result");
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching toilet locations");
  }
};


// export const getToiletById = async (req, res) => {
//   console.log('get single toilet')
//   try {
//     let locId = req.params.id;
//     const companyId = req.query.companyId;

//     console.log(req.params, companyId, "ids");
//     // Build where clause for security
//     const whereClause = { id: Number(locId) };

//     // Add company_id filter if provided for additional security
//     if (companyId) {
//       whereClause.company_id = Number(companyId);
//     }

//     const location = await prisma.locations.findUnique({
//       where: whereClause,
//       include: {
//         hygiene_scores: {
//           orderBy: { inspected_at: "desc" },
//           take: 1,
//           select: { score: true },
//         },
//       },
//     });

//     if (!location) {
//       return res.status(404).json({ message: "Toilet not found" });
//     }

//     const reviews = await prisma.user_review.findMany({
//       where: { toilet_id: Number(locId) },
//     });


//     const intReviews = reviews.map((item) => ({
//       ...item,
//       toilet_id: typeof item.toilet_id === 'string' ? item?.toilet_id : item?.toilet_id.toString(),
//       id: typeof item.id === 'string' ? item.id : item.id?.toString(),
//       user_id: typeof item.user_id === 'string' ? item.user_id : item.user_id?.toString(),
//     }));


//     console.log(intReviews, "int review")
//     const userRatings = reviews.map((r) => r.rating).filter(Boolean);
//     const hygieneScore = location.hygiene_scores[0]?.score ?? null;

//     const hygieneRatingMapped =
//       hygieneScore !== null
//         ? hygieneScore >= 100
//           ? 5
//           : hygieneScore >= 80
//             ? 4
//             : hygieneScore >= 60
//               ? 3
//               : hygieneScore >= 40
//                 ? 2
//                 : 1
//         : null;

//     const allRatings = [
//       ...userRatings,
//       ...(hygieneRatingMapped !== null ? [hygieneRatingMapped] : []),
//     ];
//     const ratingCount = allRatings.length;
//     const averageRating =
//       ratingCount > 0
//         ? allRatings.reduce((sum, r) => sum + r, 0) / ratingCount
//         : null;

//     const result = {
//       ...location,
//       id: location.id.toString(),
//       parent_id: location.parent_id?.toString() || null,
//       company_id: location.company_id?.toString() || null,
//       type_id: location.type_id?.toString() || null,
//       images: location.images || [], // ✅ Include images array
//       averageRating,
//       ratingCount,
//       ReviewData: intReviews,
//     };

//     res.json(result);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error fetching toilet by ID");
//   }
// };


export const getToiletById = async (req, res) => {
  console.log('get single toilet')
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
            created_by: true
          },
        },
        // ✅ Include cleaner assignments with user details
        cleaner_assignments: {
          where: {
            status: {
              in: ["assigned", "active", "ongoing"] // Active assignments only
            }
          },
          include: {
            cleaner_user: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true
              }
            },
            supervisor: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true
              }
            }
          },
          orderBy: { assigned_on: "desc" }
        }
      },
    });

    console.log('single location', location)
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

    console.log(intReviews, "int review")
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
      hygiene_scores: location.hygiene_scores.map(score => ({
        ...score,
        id: score.id?.toString() || null,
        created_by: score.created_by?.toString() || null,
      })),

      // Handle cleaner_assignments BigInt fields
      cleaner_assignments: location.cleaner_assignments.map(assignment => ({
        ...assignment,
        id: assignment.id?.toString() || null,
        cleaner_user_id: assignment.cleaner_user_id?.toString() || null,
        company_id: assignment.company_id?.toString() || null,
        type_id: assignment.type_id?.toString() || null,
        location_id: assignment.location_id?.toString() || null,
        supervisor_id: assignment.supervisor_id?.toString() || null,

        // Handle nested cleaner_user BigInt fields
        cleaner_user: assignment.cleaner_user ? {
          ...assignment.cleaner_user,
          id: assignment.cleaner_user.id?.toString() || null,
        } : null,

        // Handle nested supervisor BigInt fields
        supervisor: assignment.supervisor ? {
          ...assignment.supervisor,
          id: assignment.supervisor.id?.toString() || null,
        } : null,
      })),

      // Include other fields
      images: location.images || [],
      averageRating,
      ratingCount,
      ReviewData: intReviews,

      // ✅ Create assignedCleaners with proper serialization
      assignedCleaners: location.cleaner_assignments.map(assignment => ({
        id: assignment.id?.toString() || null,
        name: assignment.name,
        status: assignment.status,
        assignedOn: assignment.assigned_on,
        releasedOn: assignment.released_on,
        createdAt: assignment.created_at,
        updatedAt: assignment.updated_at,
        cleaner: assignment.cleaner_user ? {
          id: assignment.cleaner_user.id?.toString() || null,
          name: assignment.cleaner_user.name,
          phone: assignment.cleaner_user.phone,
          email: assignment.cleaner_user.email,
        } : null,
        supervisor: assignment.supervisor ? {
          id: assignment.supervisor.id?.toString() || null,
          name: assignment.supervisor.name,
          phone: assignment.supervisor.phone,
          email: assignment.supervisor.email,
        } : null,
      }))
    };

    res.json(result);
  } catch (err) {
    console.error('Error in getToiletById:', err);
    res.status(500).json({
      success: false,
      error: "Error fetching toilet by ID",
      details: err.message
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
        message: "Search query is required"
      });
    }

    // Build where clause for security and search
    const whereClause = {
      name: {
        contains: search,
        mode: 'insensitive'
      }
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
        created_at: true
      },
      orderBy: {
        name: 'asc'
      },
      take: 20 // Limit results for performance
    });

    // Convert BigInt to string
    const result = locations.map(location => ({
      ...location,
      id: location.id.toString(),
      images: location.images || [] // ✅ Ensure images is always array

    }));

    res.json(result);
  } catch (err) {
    console.error("Error searching locations:", err);
    res.status(500).json({
      success: false,
      error: "Error searching locations"
    });
  }
};



// export const createLocation = async (req, res) => {

//   console.log("in create location -----------------------------////------------")
//   try {
//     const { name, parent_id, type_id, latitude, longitude, options } = req.body;

//     const { companyId } = req.query;
//     console.log(companyId, "company id create location")
//     console.log(
//       name,
//       parent_id,
//       type_id,
//       latitude,
//       longitude,
//       options,
//       "all data"
//     );

//     // Get uploaded image URLs from middleware
//     const imageUrls = req.uploadedFiles?.images || [];
//     console.log("Uploaded images:", imageUrls);
//     // Basic validation
//     if (!name || !type_id) {
//       return res.status(400).json({ error: "Name and typeId are required." });
//     }

//     // Insert into DB
//     const newLocation = await prisma.locations.create({
//       data: {
//         name,
//         parent_id: parent_id ? BigInt(parent_id) : null,
//         company_id: (companyId) ? BigInt(companyId) : null,
//         latitude: latitude ?? null,
//         longitude: longitude ?? null,
//         metadata: {},
//         // Legacy, you mentioned backend should handle it
//         type_id: BigInt(type_id),
//         options: options ?? {},
//         images: imageUrls, // ✅ Store Cloudinary URLs
//       },
//     });

//     res.status(201).json({
//       success: true,
//       message: "Location added successfully.",
//       data: {
//         ...newLocation,
//         id: newLocation.id.toString(), // convert BigInt to string
//         parent_id: newLocation.parent_id?.toString() || null,
//         type_id: newLocation.type_id?.toString() || null,
//         company_id: newLocation.company_id?.toString() || null,
//         images: newLocation.images || [], // ✅ Include images in response
//       },
//     });
//   } catch (err) {
//     console.error("Error creating location:", err);
//     res.status(500).json({ error: "Failed to create location." });
//   }
// };


// Add this method to handle updating location with company security


export const createLocation = async (req, res) => {
  console.log("in create location -----------------------------////------------");

  try {
    const { name, parent_id, type_id, latitude, longitude, options } = req.body;
    const { companyId } = req.query;

    // ✅ Enhanced debug logging
    console.log("=== CREATE LOCATION DEBUG ===");
    console.log("Company ID:", companyId);
    console.log("Raw body data:", req.body);
    console.log("Name:", name);
    console.log("Type ID:", type_id);
    console.log("Coordinates:", { latitude, longitude });
    console.log("Options raw:", options);
    console.log("Options type:", typeof options);

    if (typeof options === 'string') {
      console.log("Options string value:", options);
      console.log("Is it [object Object]?", options === '[object Object]');
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

    if (typeof options === 'string') {
      console.log("Options is string, attempting to parse...");

      if (options === '[object Object]') {
        console.warn("Received [object Object] string, using empty object");
        finalOptions = {};
      } else if (options === '{}' || options === '') {
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
    } else if (typeof options === 'object' && options !== null) {
      console.log("Options is already an object:", options);
      finalOptions = options;
    } else {
      console.log("Options is neither string nor object, using empty object");
      finalOptions = {};
    }

    console.log("Final options to save:", finalOptions);
    console.log("Final options stringified:", JSON.stringify(finalOptions));

    // ✅ Fix latitude/longitude parsing
    const parsedLatitude = latitude && latitude !== 'null' ? parseFloat(latitude) : null;
    const parsedLongitude = longitude && longitude !== 'null' ? parseFloat(longitude) : null;

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
    console.log(JSON.stringify({
      ...locationData,
      parent_id: locationData.parent_id?.toString(),
      company_id: locationData.company_id?.toString(),
      type_id: locationData.type_id?.toString(),
    }, null, 2));

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

    console.log('Updating location:', locationId, 'for company:', companyId);
    console.log('Update data received:', updateData);

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
        message: "Location not found or access denied"
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
    if (updateData.replace_images === 'true' || updateData.replace_images === true) {
      finalImages = newImageUrls;
    }

    // ✅ Handle options properly (same as create)
    let finalOptions = existingLocation.options || {};

    if (updateData.options) {
      if (typeof updateData.options === 'string') {
        console.log("Options is string, attempting to parse...");

        if (updateData.options === '[object Object]') {
          console.warn("Received [object Object] string, keeping existing options");
          finalOptions = existingLocation.options || {};
        } else if (updateData.options === '{}' || updateData.options === '') {
          console.log("Options is empty string or {}, using empty object");
          finalOptions = {};
        } else {
          try {
            finalOptions = JSON.parse(updateData.options);
            console.log("Successfully parsed options:", finalOptions);
          } catch (e) {
            console.error("Failed to parse options string:", updateData.options, e);
            finalOptions = existingLocation.options || {};
          }
        }
      } else if (typeof updateData.options === 'object' && updateData.options !== null) {
        console.log("Options is already an object:", updateData.options);
        finalOptions = updateData.options;
      }
    }

    console.log("Final options for update:", finalOptions);

    // ✅ Prepare update data with proper parsing
    const dataToUpdate = {
      name: updateData.name || existingLocation.name,
      latitude: updateData.latitude && updateData.latitude !== 'null' ? parseFloat(updateData.latitude) : existingLocation.latitude,
      longitude: updateData.longitude && updateData.longitude !== 'null' ? parseFloat(updateData.longitude) : existingLocation.longitude,
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
      imagesCount: finalImages.length
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
      details: err.message // Add error details for debugging
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
        message: "Image URL is required"
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
        message: "Location not found or access denied"
      });
    }

    // Remove the specific image URL
    const updatedImages = (location.images || []).filter(img => img !== imageUrl);

    const updatedLocation = await prisma.locations.update({
      where: { id: Number(locationId) },
      data: { images: updatedImages },
    });

    res.json({
      success: true,
      message: "Image deleted successfully",
      data: {
        id: updatedLocation.id.toString(),
        images: updatedLocation.images || []
      }
    });
  } catch (err) {
    console.error("Error deleting location image:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete image"
    });
  }
};


// ✅ Delete location by ID
export const deleteLocationById = async (req, res) => {
  try {
    const locationId = req.params.id;
    const companyId = req.query.companyId;

    console.log('Deleting location:', locationId, 'for company:', companyId);

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
        other_locations: { select: { id: true } } // Check for child locations
      }
    });

    if (!existingLocation) {
      return res.status(404).json({
        success: false,
        message: "Location not found or access denied"
      });
    }

    // Check for dependencies that might prevent deletion
    const dependencies = [];
    if (existingLocation.hygiene_scores.length > 0) {
      dependencies.push(`${existingLocation.hygiene_scores.length} hygiene score(s)`);
    }
    if (existingLocation.cleaner_assignments.length > 0) {
      dependencies.push(`${existingLocation.cleaner_assignments.length} cleaner assignment(s)`);
    }
    if (existingLocation.other_locations.length > 0) {
      dependencies.push(`${existingLocation.other_locations.length} child location(s)`);
    }

    // Option 1: Soft delete (recommended) - just mark as deleted
    const softDelete = req.query.soft === 'true';

    if (softDelete || dependencies.length > 0) {
      // For locations with dependencies, do soft delete by updating metadata
      const updatedLocation = await prisma.locations.update({
        where: { id: Number(locationId) },
        data: {
          metadata: {
            ...existingLocation.metadata,
            deleted_at: new Date().toISOString(),
            deleted_by: req.user?.id || null, // If you have user context
            delete_reason: dependencies.length > 0 ?
              `Has dependencies: ${dependencies.join(', ')}` :
              'Soft delete requested'
          }
        }
      });

      return res.json({
        success: true,
        message: dependencies.length > 0 ?
          `Location marked as deleted (has dependencies: ${dependencies.join(', ')})` :
          "Location deleted successfully",
        data: {
          id: updatedLocation.id.toString(),
          deleted: true,
          soft_delete: true,
          dependencies: dependencies
        }
      });
    }

    // Option 2: Hard delete (cascade delete dependencies)
    // Delete in order: hygiene_scores -> cleaner_assignments -> location

    // Delete hygiene scores
    if (existingLocation.hygiene_scores.length > 0) {
      await prisma.hygiene_scores.deleteMany({
        where: { location_id: Number(locationId) }
      });
    }

    // Delete cleaner assignments
    if (existingLocation.cleaner_assignments.length > 0) {
      await prisma.cleaner_assignments.deleteMany({
        where: { location_id: Number(locationId) }
      });
    }

    // Update child locations to remove parent reference
    if (existingLocation.other_locations.length > 0) {
      await prisma.locations.updateMany({
        where: { parent_id: Number(locationId) },
        data: { parent_id: null }
      });
    }

    // Finally delete the location
    await prisma.locations.delete({
      where: { id: Number(locationId) }
    });

    res.json({
      success: true,
      message: "Location and all related data deleted successfully",
      data: {
        id: locationId,
        deleted: true,
        hard_delete: true,
        cleaned_dependencies: dependencies
      }
    });

  } catch (err) {
    console.error("Error deleting location:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete location",
      details: err.message
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
  const distance = parseFloat(radius || 1000); // default 1000 meters

  try {
    const result = await db.query(
      `
    SELECT 
      id,
      name,
      ST_AsText(geom) AS geo_location,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance
    FROM locations
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    ORDER BY distance ASC
    LIMIT 50
  `, [parseFloat(lng), parseFloat(lat), parseInt(radius)]);

    // const updatedResults = result.map((item) => ({
    //   ...item,
    //   id:item.id.toString()
    // }));
    // console.log(result , "results");
    // res.json(updatedResults);
    console.log(result, "data");
    res.json(result)
  } catch (error) {
    console.error("Error fetching nearby locations:", error);
    res.status(500).json({ error: "Internal Server Error" });
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


// console.log('from getLocation controller')


// export async function getUser(req, res) {

//   // console.log('in get user');
//   try {
//     const companyId = req.query;

//     // console.log(companyId, "company_id");
//     const users = await prisma.users.findMany({
//       where: {
//         company_id: companyId
//       }
//     });
//     // console.log(users, "users");

//     // Convert BigInt to string
//     const usersWithStringIds = users.map((user) => ({
//       ...user,
//       id: user.id.toString(),
//       company_id: user.company_id?.toString() || null,
//     }));

//     res.json(usersWithStringIds);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error fetching users");
//   }
// }

// Group by zones (original functionality with company option)
// const getLocationsByZone = async (req, res, showCompanyZones) => {
//   const ZONE_TYPE_IDS = [BigInt(5), BigInt(7), BigInt(2), BigInt(3), BigInt(6)];
//   const TOILET_TYPE_ID = BigInt(4);

//   const zones = await prisma.locations.findMany({
//     where: {
//       type_id: { in: ZONE_TYPE_IDS },
//     },
//     select: {
//       id: true,
//       name: true,
//       type_id: true,
//       company_id: true,
//       companies: {
//         select: {
//           id: true,
//           name: true,
//         },
//       },
//     },
//   });

//   if (!zones.length) return res.json([]);

//   const zoneIds = zones.map((z) => z.id);

//   const toilets = await prisma.locations.findMany({
//     where: {
//       type_id: TOILET_TYPE_ID,
//       parent_id: { in: zoneIds },
//     },
//     select: {
//       id: true,
//       name: true,
//       parent_id: true,
//       company_id: true,
//       latitude: true,
//       longitude: true,
//       hygiene_scores: {
//         orderBy: { inspected_at: "desc" },
//         take: 1,
//         select: { image_url: true },
//       },
//     },
//   });

//   if (showCompanyZones === "true") {
//     // Group by company, then by zone
//     const companiesMap = {};

//     zones.forEach((zone) => {
//       const companyId = zone.company_id?.toString() || "no-company";
//       const companyName = zone.companies?.name || "No Company";

//       if (!companiesMap[companyId]) {
//         companiesMap[companyId] = {
//           id: companyId,
//           name: companyName,
//           zones: [],
//           totalToilets: 0,
//         };
//       }
//     });

//     // Group toilets by zone
//     const toiletsByZone = {};
//     toilets.forEach((toilet) => {
//       const zoneId = toilet.parent_id.toString();
//       if (!toiletsByZone[zoneId]) toiletsByZone[zoneId] = [];

//       toiletsByZone[zoneId].push({
//         id: toilet.id.toString(),
//         name: toilet.name,
//         image_url: toilet.hygiene_scores[0]?.image_url || null,
//         latitude: toilet.latitude,
//         longitude: toilet.longitude,
//       });
//     });

//     // Attach toilets to zones and zones to companies
//     zones.forEach((zone) => {
//       const companyId = zone.company_id?.toString() || "no-company";
//       const zoneToilets = toiletsByZone[zone.id.toString()] || [];

//       companiesMap[companyId].zones.push({
//         id: zone.id.toString(),
//         name: zone.name,
//         type_id: zone.type_id.toString(),
//         children: zoneToilets,
//       });

//       companiesMap[companyId].totalToilets += zoneToilets.length;
//     });

//     return res.json(Object.values(companiesMap));
//   } else {
//     // Original zone grouping without company grouping
//     const toiletsByZone = {};
//     toilets.forEach((toilet) => {
//       const zoneId = toilet.parent_id.toString();
//       if (!toiletsByZone[zoneId]) toiletsByZone[zoneId] = [];

//       toiletsByZone[zoneId].push({
//         id: toilet.id.toString(),
//         name: toilet.name,
//         image_url: toilet.hygiene_scores[0]?.image_url || null,
//         latitude: toilet.latitude,
//         longitude: toilet.longitude,
//       });
//     });

//     const result = zones.map((zone) => ({
//       id: zone.id.toString(),
//       name: zone.name,
//       type_id: zone.type_id.toString(),
//       company_name: zone.companies?.name || "No Company",
//       children: toiletsByZone[zone.id.toString()] || [],
//     }));

//     return res.json(result);
//   }
// };

// Group by company
// const getLocationsByCompany = async (req, res) => {
//   // const TOILET_TYPE_ID = BigInt(4);

//   // Get all toilets with their company information
//   const toilets = await prisma.locations.findMany({
//     where: {
//       // type_id: TOILET_TYPE_ID,
//       latitude: { not: null },
//       longitude: { not: null },
//     },
//     select: {
//       id: true,
//       name: true,
//       company_id: true,
//       latitude: true,
//       longitude: true,
//       companies: {
//         select: {
//           id: true,
//           name: true,
//         },
//       },
//       hygiene_scores: {
//         orderBy: { inspected_at: "desc" },
//         take: 1,
//         select: { image_url: true },
//       },
//     },
//   });

//   // Group toilets by company
//   const companiesMap = {};
//   toilets.forEach((toilet) => {
//     const companyId = toilet.company_id?.toString() || "no-company";
//     const companyName = toilet.companies?.name || "No Company";

//     if (!companiesMap[companyId]) {
//       companiesMap[companyId] = {
//         id: companyId,
//         name: companyName,
//         type_id: "company",
//         children: [],
//       };
//     }

//     companiesMap[companyId].children.push({
//       id: toilet.id.toString(),
//       name: toilet.name,
//       image_url: toilet.hygiene_scores[0]?.image_url || null,
//       latitude: toilet.latitude,
//       longitude: toilet.longitude,
//     });
//   });

//   return res.json(Object.values(companiesMap));
// };

// Group by hierarchical type structure
// const getLocationsByType = async (req, res) => {
//   const TOILET_TYPE_ID = BigInt(4);

//   // Start from Nagpur (assuming it has parent_id: null and is the root)
//   const rootLocation = await prisma.locations.findFirst({
//     where: {
//       name: { contains: "Nagpur", mode: "insensitive" },
//       parent_id: null,
//     },
//     select: {
//       id: true,
//       name: true,
//       type_id: true,
//     },
//   });

//   if (!rootLocation) {
//     return res.status(404).json({ message: "Nagpur root location not found" });
//   }

//   // Build hierarchical structure
//   const buildHierarchy = async (parentId, level = 0) => {
//     // Get direct children of this parent
//     const children = await prisma.locations.findMany({
//       where: {
//         parent_id: parentId,
//       },
//       select: {
//         id: true,
//         name: true,
//         type_id: true,
//         latitude: true,
//         longitude: true,
//         hygiene_scores: {
//           orderBy: { inspected_at: "desc" },
//           take: 1,
//           select: { image_url: true },
//         },
//       },
//     });

//     const result = [];

//     for (const child of children) {
//       if (child.type_id === TOILET_TYPE_ID) {
//         // This is a toilet - leaf node
//         result.push({
//           id: child.id.toString(),
//           name: child.name,
//           type_id: child.type_id.toString(),
//           latitude: child.latitude,
//           longitude: child.longitude,
//           image_url: child.hygiene_scores[0]?.image_url || null,
//           isToilet: true,
//         });
//       } else {
//         // This is a zone/area - recursive call to get its children
//         const grandChildren = await buildHierarchy(child.id, level + 1);
//         result.push({
//           id: child.id.toString(),
//           name: child.name,
//           type_id: child.type_id.toString(),
//           children: grandChildren,
//           isToilet: false,
//         });
//       }
//     }

//     return result;
//   };

//   const hierarchy = await buildHierarchy(rootLocation.id);

//   return res.json([
//     {
//       id: rootLocation.id.toString(),
//       name: rootLocation.name,
//       type_id: rootLocation.type_id.toString(),
//       children: hierarchy,
//       isToilet: false,
//     },
//   ]);
// };





// app.get('/api/nearby', async (req, res) => {
//   const { lat, lng, radius } = req.query;

//   if (!lat || !lng || !radius) {
//     return res.status(400).json({ error: 'Missing parameters' });
//   }

//   const result = await db.query(`
//     SELECT
//       id,
//       name,
//       ST_AsText(geom) AS geo_location,
//       ST_Distance(
//         geom::geography,
//         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
//       ) AS distance
//     FROM locations
//     WHERE ST_DWithin(
//       geom::geography,
//       ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
//       $3
//     )
//     ORDER BY distance ASC
//     LIMIT 50
//   `, [parseFloat(lng), parseFloat(lat), parseInt(radius)]);

//   res.json(result.rows);
// });


