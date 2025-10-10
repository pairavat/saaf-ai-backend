import express from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prismaClient.mjs";
import { loginUser, registerUser } from "../controller/authController.js";
const loginRoute = express.Router();

// Register API - POST /api/auth/register
loginRoute.post("/register", registerUser);

// Login API - POST /api/auth/login
loginRoute.post("/login", loginUser);

export default loginRoute;
