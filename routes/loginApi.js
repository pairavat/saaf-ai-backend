import express from "express";
import {
  loginUser,
  //   registerUser,
  googleLogin,
  refreshTokenController,
  logoutUser,
  forgotPassword,
  resetPassword,
} from "../controller/authController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
const loginRoute = express.Router();

// Register API - POST /api/auth/register
// loginRoute.post("/register", registerUser);

// Login API - POST /api/auth/login
loginRoute.post("/login", loginUser);

// Google Login API - POST /api/auth/google-login
loginRoute.post("/google-login", googleLogin);

loginRoute.post("/auth/refresh", refreshTokenController);

// Protected route
loginRoute.post("/logout", authenticateToken, logoutUser);

loginRoute.post("/forgot-password", forgotPassword);

loginRoute.post("/reset-password", resetPassword);

export default loginRoute;
