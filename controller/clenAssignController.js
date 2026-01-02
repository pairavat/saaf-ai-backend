import prisma from "../config/prismaClient.mjs";
import { serializeBigInt } from "../utils/serializer.js";

/**
 * GET all cleaner assignments
//  */
// export const getAllAssignments = async (req, res) => {
//   try {
//     const assignments = await prisma.cleaner_assignments.findMany({
//       include: { locations: true },
//       orderBy: { id: "asc" },
//     });
//     res.status(200).json({
//       status: "success",
//       message: "Assignments retrieved successfully.",
//       data: serializeBigInt(assignments),
//     });
//   } catch (error) {
//     console.error("Error fetching assignments:", error);
//     res.status(500).json({ status: "error", message: "Internal Server Error" });
//   }
// };

export const getAllAssignments = async (req, res) => {
  try {
    // Fetch assignments with locations

    const { company_id } = req.query;
    let whereClause = {};

    if (company_id) {
      // this approch  replace the entire where calsue object
      // if more than one fiter use  whereClause.company_id = company_id
      whereClause = {
        company_id: company_id,
      };
    }

    const assignments = await prisma.cleaner_assignments.findMany({
      where: whereClause,
      include: { locations: true },
      orderBy: { id: "asc" },
    });

    console.log(company_id, "company_id");
    console.log(assignments, "in ass");
    // Collect user IDs
    const userIds = assignments.map((a) => a.cleaner_user_id);

    // Fetch users
    const users = await prisma.users.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true }, // pick only what you need
    });

    // Map userId → user object
    const userMap = Object.fromEntries(users.map((u) => [u.id.toString(), u]));

    // Attach user to each assignment
    const assignmentsWithUsers = assignments.map((a) => ({
      ...a,
      user: userMap[a.cleaner_user_id.toString()] || null,
    }));

    res.status(200).json({
      status: "success",
      message: "Assignments retrieved successfully.",
      data: serializeBigInt(assignmentsWithUsers),
    });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
};

/**
 * GET single assignment by id
 */
// export const getAssignmentById = async (req, res) => {

//   try {
//     const id = parseInt(req.params.id);
//     if (isNaN(id)) {
//       return res.status(400).json({ status: "error", message: "Invalid ID provided." });
//     }

//     console.log(id , "id")

//     const assignment = await prisma.cleaner_assignments.findMany({
//       where: { cleaner_user_id : id},
//       include: { locations: true },
//     });

//     if (!assignment) {
//       return res.status(404).json({ status: "error", message: "Assignment not found." });
//     }

//     res.status(200).json({
//       status: "success",
//       message: "Assignment retrieved successfully.",
//       data: serializeBigInt(assignment), // Corrected from 'assignments' to 'assignment'
//     });
//   } catch (error) {
//     console.error("Error fetching assignment:", error);
//     res.status(500).json({ status: "error", message: "Internal Server Error" });
//   }
// };

/**
 * GET assignments by cleaner_user_id
 */
export const getAssignmentByCleanerUserId = async (req, res) => {
  try {
    // const cleanerUserId = parseInt(req.params.id);
    const { cleaner_user_id } = req.params;
    const cleanerUserId = parseInt(cleaner_user_id);

    if (isNaN(cleanerUserId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid cleaner_user_id provided.",
      });
    }

    console.log(cleanerUserId, "cleaner_user_id");

    const assignments = await prisma.cleaner_assignments.findMany({
      where: {
        cleaner_user_id: cleanerUserId,
        status: "assigned",
        deleted_at: null,
      },
      include: {
        locations: {
          where: {
            deleted_at: null,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    console.log(assignments.length, assignments.length === 0);
    if (assignments.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "Query ran successfully but no assignments found.",
        data: [],
      });
    }

    res.status(200).json({
      status: "success",
      message: "Assignments retrieved successfully.",
      data: serializeBigInt(assignments),
    });
  } catch (error) {
    console.error("Error fetching assignments by cleaner_user_id:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
};

// controller/assignmentController.js (or wherever your assignment controllers are)

export const getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id } = req.query;

    // Input validation
    if (!id || isNaN(id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid assignment ID provided",
      });
    }

    // Build where clause
    let whereClause = {
      id: BigInt(id),
    };

    // Add company filter if provided
    if (company_id) {
      whereClause.company_id = BigInt(company_id);
    }

    const assignment = await prisma.cleaner_assignments.findUnique({
      where: whereClause,
      include: {
        // Include user details
        cleaner_user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        // Include location details
        locations: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            location_types: {
              select: {
                name: true,
              },
            },
          },
        },
        // Include supervisor details
        supervisor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        status: "error",
        message: "Assignment not found",
      });
    }

    // Serialize BigInt values
    const serializedAssignment = JSON.parse(
      JSON.stringify(assignment, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    res.json({
      status: "success",
      data: serializedAssignment,
      message: "Assignment retrieved successfully",
    });
  } catch (error) {
    console.error("Get assignment by ID error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch assignment",
      detail:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

/**
 * CREATE new assignment
 */
// export const createAssignment = async (req, res) => {
//   try {
//     const { name, cleaner_user_id, company_id, type_id, location_id, status } =
//       req.body;

//     // Basic validation
//     if (!name || !cleaner_user_id || !company_id) {
//         return res.status(400).json({ status: "error", message: "Missing required fields: name, cleaner_user_id, company_id." });
//     }

//     const newAssignment = await prisma.cleaner_assignments.create({
//       data: {
//         name,
//         cleaner_user_id: parseInt(cleaner_user_id),
//         company_id: parseInt(company_id),
//         type_id: type_id ? parseInt(type_id) : null,
//         location_id: location_id ? parseInt(location_id) : null,
//         status: status || "unassigned",
//       },
//     });

//     res.status(201).json({
//         status: "success",
//         message: "Assignment created successfully.",
//         data: serializeBigInt(newAssignment),
//     });
//   } catch (error) {
//     console.error("Error creating assignment:", error);
//     res.status(500).json({ status: "error", message: "Internal Server Error" });
//   }
// };

export const createAssignment = async (req, res) => {
  console.log("in create assignmets");
  try {
    // Expect 'location_ids' to be an array of strings/numbers
    const { cleaner_user_id, company_id, location_ids, status } = req.body;

    // --- Validation ---
    if (
      !cleaner_user_id ||
      !company_id ||
      !location_ids ||
      !Array.isArray(location_ids) ||
      location_ids.length === 0
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Missing required fields: cleaner_user_id, company_id, and a non-empty array of location_ids.",
      });
    }

    // --- Data Preparation ---
    // Fetch the locations to get their actual names and type_ids
    const locations = await prisma.locations.findMany({
      where: {
        id: { in: location_ids.map((id) => BigInt(id)) },
      },
      select: { id: true, name: true, type_id: true },
    });

    // Ensure all requested locations were found
    if (locations.length !== location_ids.length) {
      return res.status(404).json({
        status: "error",
        message: "One or more selected locations could not be found.",
      });
    }

    // Prepare the data for a bulk-creation database query
    const assignmentsToCreate = locations.map((location) => ({
      name: location.name, // Use the location's name as the assignment name
      cleaner_user_id: BigInt(cleaner_user_id),
      company_id: BigInt(company_id),
      type_id: location.type_id, // Use the type_id from the location
      location_id: location.id,
      status: status || "unassigned",
    }));

    // --- Database Operation ---
    // Use `createMany` for an efficient bulk insert
    const result = await prisma.cleaner_assignments.createMany({
      data: assignmentsToCreate,
    });

    res.status(201).json({
      status: "success",
      message: `${result.count} assignments created successfully.`,
      data: result,
    });
  } catch (error) {
    console.error("Error creating assignments:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
};

export const updateAssignment = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid ID provided." });
    }

    const { name, cleaner_user_id, company_id, type_id, location_id, status } =
      req.body;

    const updatedAssignment = await prisma.cleaner_assignments.update({
      where: { id },
      data: {
        name,
        cleaner_user_id: cleaner_user_id
          ? parseInt(cleaner_user_id)
          : undefined,
        company_id: company_id ? parseInt(company_id) : undefined,
        type_id: type_id ? parseInt(type_id) : undefined,
        location_id: location_id ? parseInt(location_id) : undefined,
        status,
        updated_at: new Date(),
      },
    });

    res.status(200).json({
      status: "success",
      message: "Assignment updated successfully.",
      data: serializeBigInt(updatedAssignment),
    });
  } catch (error) {
    // Handle cases where the record to update doesn't exist
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ status: "error", message: "Assignment not found." });
    }
    console.error("Error updating assignment:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid ID provided." });
    }

    await prisma.cleaner_assignments.delete({
      where: { id },
    });

    res
      .status(200)
      .json({ status: "success", message: "Assignment deleted successfully." });
  } catch (error) {
    // Handle cases where the record to delete doesn't exist
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ status: "error", message: "Assignment not found." });
    }
    console.error("Error deleting assignment:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
};
