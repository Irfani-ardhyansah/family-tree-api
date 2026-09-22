import { Router } from 'express';
import { collectRateLimitMiddleware } from './collect-rate-limit.middleware';
import { collectController } from './collect.controller';
import {
  collectBodyLimit,
  optionalAnalyticsWriteKey,
  requireAnalyticsOrigin,
} from './collect.middleware';

const portfolioAnalyticsRoutes = Router();

portfolioAnalyticsRoutes.post(
  '/collect',
  requireAnalyticsOrigin,
  optionalAnalyticsWriteKey,
  collectBodyLimit,
  collectRateLimitMiddleware,
  (req, res, next) => {
    void collectController.collect(req, res, next);
  },
);

export default portfolioAnalyticsRoutes;
