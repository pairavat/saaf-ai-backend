import express, { Router } from "express";
// import { registeredUsersController } from "../controller/registerUserController.js";
// import { getAllAssignments, createAssignment, setPassword } from "../controller/clenAssignController";
import { getAllRegisteredUsers, createRegisteredUser, verifyPhone, setPassword } from "../controller/registerUserController.js"
const registered_users_router = express.Router();

// Admin routes for managing registered users
registered_users_router.get("/registered-users", getAllRegisteredUsers);
registered_users_router.post("/registered-users", createRegisteredUser);

// Auth routes for user registration flow
registered_users_router.post("/auth/verify-phone", verifyPhone);
registered_users_router.post("/auth/set-password", setPassword);

export default registered_users_router;
