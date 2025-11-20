import express from "express";
import cors from "cors";
import { verifyToken } from "./utils/jwt.js";

import getLocationRoutes from "./routes/LocationRoutes.js";
import location_types_router from "./routes/locationTypes.js";
import configRouter from "./routes/configRoutes.js";
import clean_review_Router from "./routes/CleanerReviewRoutes.js";
// import reviewRoutes from "./routes/reviewRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import loginRoute from "./routes/loginApi.js";
import clen_assign_router from "./routes/clen_assignRoutes.js";
import userRouter from "./routes/userRoutes.js";
import companyRouter from "./routes/companyApiRoutes.js";
import roleRouter from "./routes/roleRoutes.js";
import registered_users_router from "./routes/registerUserApi.js";
import notificationRouter from "./routes/notificationRoutes.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ✅ Correct CORS setup (put before routes)
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8100", // Ionic dev
  "http://localhost:8101", // Ionic dev
  "http://localhost:8102", // Ionic dev
  "capacitor://localhost", // Capacitor native
  "ionic://localhost", // Ionic native
  "https://localhost", // Ionic native
  "http://localhost", // Ionic native
  "https://safai-index-frontend.onrender.com", // your frontend (change if needed)
  "https://safai-index.vercel.app",
  "https://saaf-ai.vercel.app",
  "https://safaiindex.vercel.app",
  "*",
];

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error("Not allowed by CORS: " + origin));
//       }
//     },
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     credentials: true,
//   })
// );

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"], // Add this
    credentials: true,
  })
);

// ✅ Handle preflight for all routes
app.options("*", cors());

// Routes

app.use("/api", loginRoute);
app.use("/api", registered_users_router);
// app.use("/api", verifyToken);

app.use("/api/locations", getLocationRoutes);
// app.use("/api", getLocationRoutes);
app.use("/api", location_types_router);
app.use("/api", configRouter);
app.use("/api/reviews", reviewRoutes);
app.use("/api", clen_assign_router);
app.use("/api/cleaner-reviews", clean_review_Router);
app.use("/api/users", userRouter);
app.use("/api/companies", companyRouter);
app.use("/api/role", roleRouter);
app.use("/api/notifications", notificationRouter);

app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Hi there, Your server has successfully started");
});

// console.log(BigInt('123'));
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(process.env.DATABASE_URL);
});
