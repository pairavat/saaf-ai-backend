import express from "express";

import {
  getConfigurationById,
  getConfigurationByName,
} from "../controller/configController.js";

const configRouter = express.Router();

configRouter.get("/configurations/:name", getConfigurationByName);
configRouter.get("/configurations/id/:id", getConfigurationById);

export default configRouter;
