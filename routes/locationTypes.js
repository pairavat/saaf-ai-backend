import express, { Router } from "express";

// import {
//   getAllLocationTypes,
//   createLocationType,
//   updateLocationTypeParent,
//   markAsToilet,
//   getLocationTypeTree,
// } from "../controller/locationTypesController.js";

import {
  getAllLocationTypes,
  createLocationType,
  updateLocationType,
  markAsToilet,
  getLocationTypeTree,
} from "../controller/locationTypesController.js";

const location_types_router = express.Router();

location_types_router.get("/location-types/tree", getLocationTypeTree);
location_types_router.get("/location-types", getAllLocationTypes);
location_types_router.post("/location-types", createLocationType);
location_types_router.patch("/location-types/:id", updateLocationType);
location_types_router.patch("/location-types/:id/mark-toilet", markAsToilet);

export default location_types_router;
