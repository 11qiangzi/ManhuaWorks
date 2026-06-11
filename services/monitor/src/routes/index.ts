import { Router } from 'express';
import { healthOverview, healthDeep } from '../controllers/healthController';
import { metricsEndpoint } from '../controllers/metricsController';
import { alertsController } from '../controllers/alertsController';
import { dashboardOverview } from '../controllers/dashboardController';
import type { AlertManager } from '../alerts/alertManager';

export function buildRoutes(am: AlertManager): Router {
  const r = Router();
  const ac = alertsController(am);

  r.get('/health', healthOverview);
  r.get('/health/deep', healthDeep);
  r.get('/metrics', metricsEndpoint);
  r.get('/dashboard', dashboardOverview);

  r.get('/alerts', ac.listActive);
  r.get('/alerts/resolved', ac.listResolved);
  r.post('/alerts/acknowledge', ac.acknowledge);
  r.post('/alerts/resolve', ac.resolve);
  r.post('/alerts/silence', ac.silence);
  r.delete('/alerts/silence', ac.unsilence);
  r.get('/alerts/silenced', ac.listSilenced);

  return r;
}
