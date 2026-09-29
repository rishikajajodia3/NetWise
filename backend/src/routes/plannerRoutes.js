import { Router } from 'express';
import { buildNetworkPlan } from '../planner/planBuilder.js';
import { validatePlanRequest } from '../validation.js';

const router = Router();

// A plan that does not fit is still a valid answer, so it is returned with
// 200 and "success": false rather than as an error.
router.post('/', (req, res) => {
  const requirements = validatePlanRequest(req.body);
  res.json(buildNetworkPlan(requirements));
});

export default router;
