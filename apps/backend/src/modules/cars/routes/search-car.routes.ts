import { Router } from 'express';
import { asyncHandler } from '../../../infra/http/async-handler';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { SearchCarController } from '../controllers/search-car.controller';

export const carsRoutes = Router();

const controller = new SearchCarController();

carsRoutes.use(authMiddleware);

carsRoutes.post('/wanted', asyncHandler((req, res) => controller.createWanted(req, res)));
carsRoutes.patch('/wanted/:id', asyncHandler((req, res) => controller.updateWanted(req, res)));
carsRoutes.post('/search-external', asyncHandler((req, res) => controller.manualSearch(req, res)));
carsRoutes.post('/search-olx', asyncHandler((req, res) => controller.manualSearchOlx(req, res)));
carsRoutes.patch('/wanted/:id/status', asyncHandler((req, res) => controller.updateWantedStatus(req, res)));
carsRoutes.get('/wanted', asyncHandler((req, res) => controller.listWanted(req, res)));
carsRoutes.get('/wanted/:id/cars', asyncHandler((req, res) => controller.listWantedCars(req, res)));
