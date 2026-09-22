import { Router } from 'express';
import { reportingController } from './reporting.controller';

const analyticsReportingRoutes = Router();

analyticsReportingRoutes.get('/overview', (req, res, next) => {
  void reportingController.overview(req, res, next);
});
analyticsReportingRoutes.get('/timeseries', (req, res, next) => {
  void reportingController.timeseries(req, res, next);
});
analyticsReportingRoutes.get('/geo', (req, res, next) => {
  void reportingController.geo(req, res, next);
});
analyticsReportingRoutes.get('/pages', (req, res, next) => {
  void reportingController.pages(req, res, next);
});
analyticsReportingRoutes.get('/sections', (req, res, next) => {
  void reportingController.sections(req, res, next);
});
analyticsReportingRoutes.get('/clicks', (req, res, next) => {
  void reportingController.clicks(req, res, next);
});
analyticsReportingRoutes.get('/outbounds', (req, res, next) => {
  void reportingController.outbounds(req, res, next);
});
analyticsReportingRoutes.get('/referrers', (req, res, next) => {
  void reportingController.referrers(req, res, next);
});
analyticsReportingRoutes.get('/sessions', (req, res, next) => {
  void reportingController.sessions(req, res, next);
});
analyticsReportingRoutes.get('/sessions/:id', (req, res, next) => {
  void reportingController.sessionById(req, res, next);
});

export default analyticsReportingRoutes;
