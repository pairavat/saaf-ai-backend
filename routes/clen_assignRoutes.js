import express from "express";


import { getAllAssignments, getAssignmentByCleanerUserId, createAssignment, updateAssignment, deleteAssignment, getAssignmentById } from "../controller/clenAssignController.js";

const clen_assign_router = express.Router();

// CRUD routes
// ✅ Fixed routing structure
clen_assign_router.get("/assignments", getAllAssignments);                    // Get all assignments
clen_assign_router.get("/assignments/cleaner/:id", getAssignmentById);                // Get single assignment by ID
clen_assign_router.get("/assignments/:cleaner_user_id", getAssignmentByCleanerUserId); // Get by cleaner
clen_assign_router.post("/assignments", createAssignment);                    // Create new assignment
clen_assign_router.post("/assignments/:id", updateAssignment);                 // Update assignment (use PUT)
clen_assign_router.delete("/assignments/:id", deleteAssignment);              // Delete assignment

// Delete

export default clen_assign_router;
