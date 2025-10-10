import express from 'express';
// import { getUser } from '../controller/getDataController.js';
import { createUser, deleteUser, getUser, updateUser, getUserById } from '../controller/userController.js';

const userRouter = express.Router();


userRouter.get('/', getUser);
userRouter.get('/:id', getUserById);
userRouter.post('/', createUser);
userRouter.post('/:id', updateUser)
userRouter.delete('/:id', deleteUser)

export default userRouter;