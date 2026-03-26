import express from 'express';
import { submitReport, getAllReports, getPollutionSources, getWeeklyReports, updateReportStatus, assignReport, addReportNote } from '../controllers/reports.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Require authentication for submitting reports so we can credit user activity and points
router.post('/submit', authMiddleware, submitReport);
router.get('/all', getAllReports);
// Municipality actions (protected)
router.post('/:id/status', authMiddleware, updateReportStatus);
router.post('/:id/assign', authMiddleware, assignReport);
router.post('/:id/notes', authMiddleware, addReportNote);
router.get('/summary/pollution-sources', getPollutionSources);
router.get('/summary/weekly-reports', getWeeklyReports);

export default router;
