import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.mjs";
import crypto from "crypto";

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

const ACCESS_TOKEN_EXPIRES = "15m"; // recommended
const REFRESH_TOKEN_EXPIRES = "30d"; // recommended

// ------------------------------------------------------------
// GENERATE ACCESS TOKEN (SHORT-LIVED)
// ------------------------------------------------------------
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
};

// ------------------------------------------------------------
// GENERATE REFRESH TOKEN (LONG-LIVED, STORED IN DATABASE)
// ------------------------------------------------------------
export const generateRefreshToken = async (userId) => {
  const refreshToken = crypto.randomBytes(64).toString("hex");

  // remove existing refresh tokens for this user (optional: single-device login)
  await prisma.refresh_tokens.deleteMany({
    where: { user_id: BigInt(userId) },
  });

  await prisma.refresh_tokens.create({
    data: {
      user_id: BigInt(userId),
      token: refreshToken,
      expires_at: new Date(Date.now() + msToMs(REFRESH_TOKEN_EXPIRES)),
    },
  });

  return refreshToken;
};

// helper to convert "30d" → ms integer
function msToMs(str) {
  const days = parseInt(str.replace("d", ""));
  return days * 24 * 60 * 60 * 1000;
}

// ------------------------------------------------------------
// VERIFY ACCESS TOKEN (Middleware)
// ------------------------------------------------------------
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token)
    return res.status(401).json({ message: "Malformed token" });

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Access token expired",
        code: "ACCESS_TOKEN_EXPIRED",
      });
    }

    return res.status(403).json({
      message: "Invalid token",
      code: "INVALID_TOKEN",
    });
  }
};

// ------------------------------------------------------------
// VERIFY REFRESH TOKEN
// ------------------------------------------------------------
export const validateRefreshToken = async (refreshToken) => {
  if (!refreshToken) return null;

  const stored = await prisma.refresh_tokens.findUnique({
    where: { token: refreshToken },
  });

  if (!stored) return null;
  if (stored.expires_at < new Date()) return null;

  return stored.user_id.toString();
};
