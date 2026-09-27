import { Router } from 'express';
import MLService from '../services/mlClient';
import {
  getDashboard,
  simulate,
  getSafeEnvelope,
  getDecisionCouncil,
  generateActionCard,
  approvePlan,
  parseReview,
  handleGuestConcierge,
  getGuestConversations,
  handleGuestRequest,
  getGuestRequests,
  getWorkerTasks,
  acceptWorkerTask,
  rejectWorkerTask,
  startWorkerTask,
  blockWorkerTask,
  completeWorkerTask,
  feedbackGuestRequest,
  clusterComplaints,
  reallocateRoom,
  getTickets,
  updateTicket,
  resetDemo,
  getActionCards,
  getAuditLogs,
  getStaff,
  acknowledgeTicket,
  getSimulations, 
  getSimulationById, 
  applySimulation, 
  rejectSimulation, 
  createTwinSnapshot, 
  getTwinHistory
} from '../controllers/api.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { ROLES } from '../config/constants';
import { getWorldIntel, askGemini } from '../services/worldIntelService';
import { listNotifications, markNotificationsRead } from '../controllers/notification.controller';
import { createIncident, listIncidents, updateIncident } from '../controllers/incident.controller';

const router = Router();

// Live external intelligence: weather + public social/news signals + Gemini reasoning.
router.get('/world-intel', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), async (_req, res) => {
  try { res.json({ success: true, data: await getWorldIntel() }); }
  catch (error: any) { res.status(502).json({ success: false, error: error.message }); }
});
router.post('/world-intel/ask', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), async (req, res) => {
  try { const context = await getWorldIntel(); res.json({ success: true, data: await askGemini(req.body.prompt || 'Assess operational risk and recommend safe actions.', context) }); }
  catch (error: any) { res.status(502).json({ success: false, error: error.message }); }
});

// ==========================================
// AUTHENTICATED CROSS-ROLE OPERATIONS
// ==========================================
router.get('/notifications', authenticate, listNotifications);
router.post('/notifications/read', authenticate, markNotificationsRead);
router.get('/incidents', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN, ROLES.SECURITY), listIncidents);
router.post('/incidents', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN, ROLES.SECURITY, ROLES.STAFF, ROLES.WORKER), createIncident);
router.patch('/incidents/:id', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN, ROLES.SECURITY), updateIncident);

// ==========================================
// MANAGER / SUPERVISOR / ADMIN ROUTES
// ==========================================
router.get('/dashboard', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), getDashboard);
router.post('/simulate', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), simulate);
router.post('/safe-envelope', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), getSafeEnvelope);
router.post('/decision-council', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), getDecisionCouncil);
router.post('/generate-plan', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), generateActionCard);
router.post('/approve-plan', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), approvePlan);
router.post('/parse-review', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), parseReview);
router.post('/cluster-complaints', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), clusterComplaints);
router.post('/reallocate-room', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), reallocateRoom);

router.get('/tickets', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), getTickets);
router.patch('/tickets/:id', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), updateTicket);
router.post('/tickets/:id/acknowledge', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), acknowledgeTicket);

router.get('/action-cards', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), getActionCards);
router.get('/audit-logs', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), getAuditLogs);
router.get('/staff', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), getStaff);

router.get('/guest-requests', authenticate, authorize(ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN, ROLES.GUEST), getGuestRequests);

// ==========================================
// SIMULATION & DIGITAL TWIN ROUTES
// ==========================================
router.get('/simulations', authenticate, authorize(ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), getSimulations);
router.get('/simulations/:id', authenticate, authorize(ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), getSimulationById);
router.post('/recommendations/:id/apply', authenticate, authorize(ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), applySimulation);
router.post('/recommendations/:id/reject', authenticate, authorize(ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), rejectSimulation);
router.post('/twin/snapshot', authenticate, authorize(ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), createTwinSnapshot);
router.get('/twin/history', authenticate, authorize(ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), getTwinHistory);

// ==========================================
// GUEST ROUTES
// ==========================================
router.post('/guest/concierge', authenticate, authorize(ROLES.GUEST), handleGuestConcierge);
router.get('/guest/conversations/:guestId', authenticate, authorize(ROLES.GUEST), getGuestConversations);
router.post('/guest-request', authenticate, authorize(ROLES.GUEST), handleGuestRequest);
router.patch('/guest-requests/:requestId/feedback', authenticate, authorize(ROLES.GUEST), feedbackGuestRequest);

// ==========================================
// WORKER ROUTES
// ==========================================
router.get('/worker-tasks/:staffName', authenticate, authorize(ROLES.WORKER, ROLES.SUPERVISOR, ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), getWorkerTasks);
router.patch('/worker-tasks/:id/accept', authenticate, authorize(ROLES.WORKER, ROLES.SUPERVISOR, ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), acceptWorkerTask);
router.patch('/worker-tasks/:id/reject', authenticate, authorize(ROLES.WORKER, ROLES.SUPERVISOR, ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), rejectWorkerTask);
router.patch('/worker-tasks/:id/block', authenticate, authorize(ROLES.WORKER, ROLES.SUPERVISOR, ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), blockWorkerTask);
router.patch('/worker-tasks/:id/start', authenticate, authorize(ROLES.WORKER, ROLES.SUPERVISOR, ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), startWorkerTask);
router.patch('/worker-tasks/:taskId/complete', authenticate, authorize(ROLES.WORKER, ROLES.SUPERVISOR, ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), completeWorkerTask);

// ==========================================
// PUBLIC / DEMO / DEV ROUTES
// ==========================================
router.post('/reset-demo', authenticate, authorize(ROLES.MANAGER, ROLES.GENERAL_MANAGER, ROLES.SUPER_ADMIN), resetDemo);

// ==========================================
// ML ENGINE ROUTES (FastAPI Integration)
// ==========================================
router.post('/forecast/predict', async (req, res) => {
  try {
    const result = await MLService.predictDemand(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/forecast/weekly', async (req, res) => {
  try {
    const result = await MLService.getWeeklyForecast();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/simulation/run', async (req, res) => {
  try {
    const result = await MLService.runSimulation(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/simulation/compare', async (req, res) => {
  try {
    const { scenario_a, scenario_b } = req.body;
    const result = await MLService.compareScenarios(scenario_a, scenario_b);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/simulation/presets', async (req, res) => {
  try {
    const result = await MLService.getSimulationPresets();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/nlp/analyze-review', async (req, res) => {
  try {
    const result = await MLService.analyzeReview(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/nlp/analyze-bulk', async (req, res) => {
  try {
    const result = await MLService.analyzeBulkReviews(req.body.reviews);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/nlp/sample-reviews', async (req, res) => {
  try {
    const result = await MLService.getSampleReviews();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/staff/generate-roster', async (req, res) => {
  try {
    const result = await MLService.generateRoster(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/staff/dashboard', async (req, res) => {
  try {
    const result = await MLService.getStaffDashboard();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ml/health', async (req, res) => {
  try {
    const result = await MLService.checkHealth();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.json({ 
      success: false, 
      data: { status: 'ML server offline', error: error.message }
    });
  }
});

export default router;
