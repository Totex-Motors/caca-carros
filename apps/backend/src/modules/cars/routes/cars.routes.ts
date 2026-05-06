import { Router } from 'express';
import { asyncHandler } from '../../../infra/http/async-handler';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { SearchCarController } from '../controllers/searchcar.controller';

export const carsRoutes = Router();

const controller = new SearchCarController();

carsRoutes.use(authMiddleware);

carsRoutes.post('/wanted', asyncHandler((req, res) => controller.createWanted(req, res)));
carsRoutes.post('/search-external', asyncHandler((req, res) => controller.manualSearch(req, res)));
carsRoutes.get('/wanted', asyncHandler((req, res) => controller.listWanted(req, res)));
