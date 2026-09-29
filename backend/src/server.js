import { fileURLToPath, pathToFileURL } from 'node:url';
import cors from 'cors';
import express from 'express';
import { PlanValidationError } from './planner/planBuilder.js';
import plannerRoutes from './routes/plannerRoutes.js';
import troubleshootingRoutes from './routes/troubleshootingRoutes.js';
import { SymptomValidationError } from './troubleshooting/engine.js';
import { RequestValidationError } from './validation.js';

// Any port on localhost / 127.0.0.1, e.g. the Vite dev server on :5173.
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const USER_INPUT_ERRORS = [RequestValidationError, PlanValidationError, SymptomValidationError];

export const app = express();

app.disable('x-powered-by');
app.use(
  cors({
    // Requests without an Origin header (curl, same-origin) are allowed too.
    origin: (origin, callback) => callback(null, !origin || LOCAL_ORIGIN.test(origin)),
  }),
);
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'NetWise API' });
});
app.use('/api/plan', plannerRoutes);
app.use('/api/troubleshooting', troubleshootingRoutes);

// In production the built React app (frontend/dist) is served from the same
// origin as the API. The frontend uses hash routing, so no fallback is needed.
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(fileURLToPath(new URL('../../frontend/dist', import.meta.url))));
}

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Express recognises error handlers by their four parameters.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (USER_INPUT_ERRORS.some((ErrorType) => err instanceof ErrorType)) {
    return res.status(400).json({ error: err.message });
  }
  // Errors raised by express.json(), e.g. malformed JSON (400) or a body that is too large (413).
  if (err.type && err.status >= 400 && err.status < 500) {
    const message = err.type === 'entity.parse.failed' ? 'Malformed JSON in request body' : err.message;
    return res.status(err.status).json({ error: message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

// Only listen when run directly (npm start), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`NetWise API listening on http://localhost:${port}`);
  });
}
