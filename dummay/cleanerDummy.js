export async function createCleanerReview(req, res) {
  try {
    const {
      name,
      phone,
      site_id,
      remarks,
      latitude,
      longitude,
      address,
      cleaner_user_id,
      task_ids,
      initial_comment,
      final_comment,
      status,
    } = req.body;

    console.log(req.body, "request body");
    console.log(req.files, "request files");

    // Safe extraction from req.files object
    const beforePhotos = Array.isArray(req.files?.before_photos)
      ? req.files.before_photos.map((file) => file.filename)
      : [];

    const afterPhotos = Array.isArray(req.files?.after_photos)
      ? req.files.after_photos.map((file) => file.filename)
      : [];

    console.log(beforePhotos, "before phots");
    console.log(afterPhotos, "after photos");
    console.log(Array.isArray(req.files?.before_photos), "check");
    // const parsedTaskIds = Array.isArray(task_ids)
    //   ? task_ids.map(Number)
    //   : task_ids
    //   ? task_ids.split(",").map(id => Number(id.trim()))
    //   : [];

    const parsedTaskIds = Array.isArray(task_ids)
      ? task_ids.map((id) => String(id).trim())
      : task_ids
      ? task_ids.split(",").map((id) => String(id).trim())
      : [];

    // Create review
    const review = await prisma.cleaner_review.create({
      data: {
        name,
        phone,
        site_id: site_id ? BigInt(site_id) : null,
        remarks,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        address,
        cleaner_user_id: cleaner_user_id ? BigInt(cleaner_user_id) : null,
        task_id: parsedTaskIds,
        initial_comment,
        final_comment,
        before_photo: beforePhotos,
        after_photo: afterPhotos,
        status,
        status: status || "ongoing",
        initial_comment: initial_comment || null,
        final_comment: final_comment || null,
      },
    });

    // Convert BigInt fields to strings for JSON
    const serializedReview = {
      ...review,
      id: review.id?.toString(),
      site_id: review.site_id?.toString(),
      cleaner_user_id: review.cleaner_user_id?.toString(),
    };

    // Simulate AI scoring only for AFTER photos
    afterPhotos.forEach((filename, index) => {
      setTimeout(async () => {
        const simulatedScore = Math.floor(Math.random() * 41) + 60; // 60–100
        const modelResponse = {
          status: "success",
          score: simulatedScore,
          timestamp: new Date().toISOString(),
        };

        await prisma.hygiene_scores.create({
          data: {
            location_id: site_id ? BigInt(site_id) : null,
            score: simulatedScore,
            details: { ai_status: modelResponse.status },
            image_url: `http://your-image-host.com/uploads/${filename}`,
            inspected_at: new Date(modelResponse.timestamp),
            created_by: cleaner_user_id ? BigInt(cleaner_user_id) : null,
          },
        });

        console.log(`AI processed image ${filename}:`, modelResponse);
      }, 2000 * (index + 1));
    });

    console.log(review, "review ");
    res.status(201).json({
      status: "success",
      message: "Review created. AI processing after photos...",
      review: serializedReview,
    });
  } catch (err) {
    console.error("Create Review Error:", err);
    res.status(400).json({
      status: "error",
      message: "Review created. AI processing after photos...",
      detail: err.message,
    });
  }
}