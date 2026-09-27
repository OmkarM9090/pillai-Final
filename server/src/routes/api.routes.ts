import { Router } from 'express';
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

const router = Router();

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

export default router;
