import express from 'express';
import { getRole } from '../controller/roleController.js';

const roleRouter = express.Router();

roleRouter.get('/', getRole);

export default roleRouter;
