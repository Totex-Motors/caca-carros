import { Router } from 'express';
import { asyncHandler } from '../../../infra/http/async-handler';
import { LoginController } from '../controllers/login.controller';

export const authRoutes = Router();

const loginController = new LoginController();

authRoutes.post('/login', asyncHandler((req, res) => loginController.handle(req, res)));
