import express from "express";
// import { getUser } from '../controller/getDataController.js';
import {
  createUser,
  deleteUser,
  getUser,
  getAllUsers,
  updateUser,
  getUserById,
} from "../controller/userController.js";
import { verifyToken } from "../utils/jwt.js";

const userRouter = express.Router();

// userRouter.get('/', getUser);
userRouter.get("/", getAllUsers);
userRouter.get("/:id", getUserById);
userRouter.post("/", createUser);
userRouter.post("/:id", verifyToken, updateUser);
userRouter.delete("/:id", deleteUser);

export default userRouter;
