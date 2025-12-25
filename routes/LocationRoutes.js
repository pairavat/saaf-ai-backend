import express, { Router } from "express";
import {
  getAllToilets,
  getToiletById,
  // createLocation,
  getZonesWithToilets,
  getNearbyLocations,
  // deleteLocationImage,
  getSearchToilet,
  // updateLocationById,
  // deleteLocationById,
  getSavedToilets,
  isToiletSaved,
  saveToilet,
  unsaveToilet,
} from "../controller/LocationsController.js";
import { upload, processAndUploadImages } from "../middlewares/imageUpload.js";
import { verifyToken } from "../utils/jwt.js";

console.log("in get location rutes");
const getLocationRoutes = express.Router();

// getLocationRoutes.get("/getUsers", getUser);
// getLocationRoutes.get('/getLocations' , getLocation);
getLocationRoutes.get("/", getAllToilets);
// getLocationRoutes.post("/", createLocation);

// ✅ STATIC ROUTES FIRST
getLocationRoutes.get("/search", getSearchToilet);
getLocationRoutes.get("/zones", getZonesWithToilets);
getLocationRoutes.get("/nearby", getNearbyLocations);
getLocationRoutes.get("/saved", verifyToken, getSavedToilets);

// Saved status
getLocationRoutes.get("/:id/saved", verifyToken, isToiletSaved);
getLocationRoutes.post("/:id/save", verifyToken, saveToilet);
getLocationRoutes.delete("/:id/save", verifyToken, unsaveToilet);

// Image delete
// getLocationRoutes.delete("/:id/image", deleteLocationImage);

// ✅ DYNAMIC ROUTES LAST
getLocationRoutes.get("/:id", getToiletById);
// getLocationRoutes.delete("/:id", deleteLocationById);

// getLocationRoutes.post("/update/:id", updateLocationById);

// ✅ Routes with image upload support
// getLocationRoutes.post(
//   "/",
//   upload.fields([{ name: "images", maxCount: 10 }]), // Support up to 10 images
//   processAndUploadImages([
//     { fieldName: "images", folder: "locations", maxCount: 10 },
//   ]),
//   createLocation
// );

// getLocationRoutes.post(
//   "/update/:id",
//   upload.fields([{ name: "images", maxCount: 10 }]),
//   processAndUploadImages([
//     { fieldName: "images", folder: "locations", maxCount: 10 },
//   ]),
//   updateLocationById
// );

// -------------- old routes ---------------

// getLocationRoutes.get("/getUsers", getUser);
// // getLocationRoutes.get('/getLocations' , getLocation);
// getLocationRoutes.get("/locations", getAllToilets);
// getLocationRoutes.post("/locations", createLocation);
// getLocationRoutes.get("/locations/:id", getToiletById);
// getLocationRoutes.get("/zones", getZonesWithToilets);
// getLocationRoutes.get('/nearby', getNearbyLocations);

export default getLocationRoutes;
