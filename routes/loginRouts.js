import express from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prismaClient.mjs";
import { loginUser } from "../controller/authController.js";
const loginRoute11 = express.Router();

loginRoute11.post("/login", loginUser);


export default loginRoute11;