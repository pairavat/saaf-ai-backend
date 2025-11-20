import express from "express";
import { sendNotification } from "../controller/notificationController.js";

const notificationRouter = express.Router();

notificationRouter.post("/", sendNotification);

export default notificationRouter;
