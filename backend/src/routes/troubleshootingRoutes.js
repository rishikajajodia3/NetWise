import { Router } from 'express';
import { diagnose } from '../troubleshooting/engine.js';
import { symptoms } from '../troubleshooting/troubleshootingData.js';
import { validateDiagnoseRequest } from '../validation.js';

const router = Router();

router.get('/symptoms', (req, res) => {
  res.json({ symptoms });
});

router.post('/diagnose', (req, res) => {
  res.json(diagnose(validateDiagnoseRequest(req.body)));
});

export default router;
