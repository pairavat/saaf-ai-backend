import prisma from "../config/prismaClient.mjs";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  generateRefreshToken,
  validateRefreshToken,
} from "../utils/jwt.js";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ------------------------------------------------------------
   NORMAL SIGNUP (Phone / Email + Password)
------------------------------------------------------------ */
export const signupUser = async (req, res) => {
  try {
    const { name, email, phone, password, fcm_token } = req.body;

    if (!phone && !email) {
      return res.status(400).json({
        status: "error",
        message: "Phone or Email is required",
      });
    }
    if (!password) {
      return res.status(400).json({
        status: "error",
        message: "Password is required",
      });
    }

    // Check duplicates
    if (phone) {
      const phoneExists = await prisma.users.findUnique({ where: { phone } });
      if (phoneExists)
        return res
          .status(400)
          .json({ status: "error", message: "Phone already exists" });
    }

    if (email) {
      const emailExists = await prisma.users.findUnique({ where: { email } });
      if (emailExists)
        return res
          .status(400)
          .json({ status: "error", message: "Email already exists" });
    }

    // Create user
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        name,
        email,
        phone,
        password: hashed,
        fcm_token,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id.toString(),
      email: user.email,
      role_id: user.role_id,
      company_id: user.company_id?.toString(),
    });

    const refreshToken = await generateRefreshToken(user.id);

    // Save token to users table
    await prisma.users.update({
      where: { id: user.id },
      data: { token: accessToken },
    });

    return res.json({
      status: "success",
      message: "Signup successful",
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role_id: user.role_id,
        company_id: user.company_id?.toString(),
        token: accessToken,
        refresh_token: refreshToken,
      },
    });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ error: "Signup failed" });
  }
};

/* ------------------------------------------------------------
   LOGIN (Phone + Password)
------------------------------------------------------------ */
export const loginUser = async (req, res) => {
  try {
    const login = req.body.login || req.body.phone;
    const password = req.body.password;
    const fcm_token = req.body.fcm_token;
    console.log(login, password, fcm_token);
    if (!login || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email/Mobile and password are required.",
      });
    }

    // 🔍 Detect email or phone
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(login);
    const isPhone = /^[4-9]\d{9}$/.test(login);

    if (!isEmail && !isPhone) {
      return res.status(400).json({
        status: "error",
        message: "Invalid email or mobile number",
      });
    }

    // 🔎 Find user
    const user = await prisma.users.findFirst({
      where: isEmail ? { email: login } : { phone: login },
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // 🔐 Password check
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: "error",
        message: "Incorrect password",
      });
    }

    // 🔑 Generate tokens
    const accessToken = generateAccessToken({
      id: user.id.toString(),
      email: user.email,
      role_id: user.role_id,
      company_id: user.company_id?.toString(),
    });

    const refreshToken = await generateRefreshToken(user.id);

    // 🔄 Update token + FCM
    await prisma.users.update({
      where: { id: user.id },
      data: {
        token: accessToken,
        fcm_token,
      },
    });

    return res.json({
      status: "success",
      message: "Login successful",
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role_id: user.role_id,
        company_id: user.company_id?.toString(),
        token: accessToken,
        refresh_token: refreshToken,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({
      status: "error",
      message: "Login failed",
    });
  }
};

/* ------------------------------------------------------------
   GOOGLE LOGIN (Signup + Login + Linking)
------------------------------------------------------------ */
export const googleLogin = async (req, res) => {
  try {
    const { idToken, fcm_token } = req.body;

    if (!idToken)
      return res
        .status(400)
        .json({ status: "error", message: "Google ID Token missing" });

    // Verify Google Token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    if (!email)
      return res.status(400).json({
        status: "error",
        message: "Google account does not have email permission.",
      });

    // Try to find existing user
    let user = await prisma.users.findFirst({
      where: {
        OR: [{ google_id: googleId }, { email }],
      },
    });

    // Create new user
    if (!user) {
      user = await prisma.users.create({
        data: {
          name,
          email,
          google_id: googleId,
          avatar_url: picture,
          password: null,
        },
      });
    }

    // Link Google ID to existing user
    if (!user.google_id) {
      await prisma.users.update({
        where: { id: user.id },
        data: { google_id: googleId },
      });
    }

    // Update avatar + FCM
    await prisma.users.update({
      where: { id: user.id },
      data: {
        fcm_token,
        avatar_url: picture,
      },
    });

    // Generate tokens
    const userId = user.id.toString();
    const companyId = user.company_id?.toString() || null;

    const accessToken = generateAccessToken({
      id: userId,
      email: user.email,
      role_id: user.role_id,
      company_id: companyId,
    });

    const refreshToken = await generateRefreshToken(user.id);

    // Save token to DB
    await prisma.users.update({
      where: { id: user.id },
      data: { token: accessToken },
    });

    return res.json({
      status: "success",
      message: "Google Login successful",
      user: {
        id: userId,
        name,
        email,
        phone: user.phone,
        role_id: user.role_id,
        company_id: companyId,
        token: accessToken,
        refresh_token: refreshToken,
        avatar_url: picture,
      },
    });
  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(500).json({ status: "error", message: "Google login failed" });
  }
};

/* ------------------------------------------------------------
   REFRESH TOKEN (Generate New Access + Refresh Tokens)
------------------------------------------------------------ */
export const refreshTokenController = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token)
      return res
        .status(400)
        .json({ status: "error", message: "Refresh Token required" });

    const userId = await validateRefreshToken(refresh_token);
    if (!userId)
      return res
        .status(403)
        .json({ status: "error", message: "Invalid or expired refresh token" });

    const user = await prisma.users.findUnique({
      where: { id: BigInt(userId) },
    });

    const newAccess = generateAccessToken({
      id: user.id.toString(),
      email: user.email,
      role_id: user.role_id,
      company_id: user.company_id?.toString(),
    });

    const newRefresh = await generateRefreshToken(user.id);

    return res.json({
      status: "success",
      access_token: newAccess,
      refresh_token: newRefresh,
    });
  } catch (err) {
    console.error("Refresh Token Error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Failed to refresh token" });
  }
};

/* ------------------------------------------------------------
   LOGOUT (Invalidates Tokens)
------------------------------------------------------------ */
export const logoutUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ status: "error", message: "Unauthorized" });

    await prisma.users.update({
      where: { id: BigInt(userId) },
      data: { token: null, fcm_token: null },
    });

    await prisma.refresh_tokens.deleteMany({
      where: { user_id: BigInt(userId) },
    });

    return res.json({ status: "success", message: "Logout successful" });
  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({ status: "error", message: "Logout failed" });
  }
};

/* ------------------------------------------------------------
   FORGOT PASSWORD - Send Reset Email
------------------------------------------------------------ */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Email is required" });
    }

    const user = await prisma.users.findUnique({ where: { email } });

    if (!user) {
      // For security, don't reveal if user exists. Just send success.
      return res.json({
        status: "success",
        message: "If account exists, reset link sent.",
      });
    }

    // Generate a temporary reset token (valid for 15 mins)
    const resetToken = jwt.sign(
      { userId: user.id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // Send Email
    await transporter.sendMail({
      from: `"SaafAI Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #3b82f6;">SaafAI Password Reset</h2>
          <p>Hi ${user.name || "User"},</p>
          <p>You requested to reset your password. Click the button below to proceed. This link expires in 15 minutes.</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
          <p style="margin-top: 20px; color: #64748b; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    return res.json({
      status: "success",
      message: "Reset link sent successfully",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Failed to send email" });
  }
};

/* ------------------------------------------------------------
   RESET PASSWORD - Verify Token and Update Password
------------------------------------------------------------ */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        status: "error",
        message: "Token and new password are required",
      });
    }

    // 1. Verify Token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ status: "error", message: "Token expired or invalid" });
    }

    const userId = BigInt(decoded.userId);

    // 2. Hash New Password
    const hashed = await bcrypt.hash(newPassword, 10);

    // 3. Update User
    await prisma.users.update({
      where: { id: userId },
      data: {
        password: hashed,
        token: null, // Optional: logout from current session
      },
    });

    return res.json({
      status: "success",
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ status: "error", message: "Reset failed" });
  }
};
