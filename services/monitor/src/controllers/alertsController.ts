import type { Request, Response } from 'express';
import type { AlertManager } from '../alerts/alertManager';

export function alertsController(am: AlertManager) {
  return {
    listActive(_req: Request, res: Response): void {
      res.json({ alerts: am.listActive() });
    },
    listResolved(req: Request, res: Response): void {
      const limit = Number(req.query.limit ?? 100);
      res.json({ alerts: am.listResolved(limit) });
    },
    acknowledge(req: Request, res: Response): void {
      const { service, rule, by } = req.body as { service?: string; rule?: string; by?: string };
      if (!service || !rule) {
        res.status(400).json({ error: { message: 'service and rule required' } });
        return;
      }
      const a = am.acknowledge(rule, service, by ?? 'unknown');
      if (!a) {
        res.status(404).json({ error: { message: 'alert not active' } });
        return;
      }
      res.json({ alert: a });
    },
    silence(req: Request, res: Response): void {
      const { service, rule } = req.body as { service?: string; rule?: string };
      if (!service || !rule) {
        res.status(400).json({ error: { message: 'service and rule required' } });
        return;
      }
      am.silence(service, rule);
      res.json({ ok: true, silenced: am.listSilenced() });
    },
    unsilence(req: Request, res: Response): void {
      const { service, rule } = req.body as { service?: string; rule?: string };
      if (!service || !rule) {
        res.status(400).json({ error: { message: 'service and rule required' } });
        return;
      }
      am.unsilence(service, rule);
      res.json({ ok: true, silenced: am.listSilenced() });
    },
    listSilenced(_req: Request, res: Response): void {
      res.json({ silenced: am.listSilenced() });
    },
    resolve(req: Request, res: Response): void {
      const { service, rule } = req.body as { service?: string; rule?: string };
      if (!service || !rule) {
        res.status(400).json({ error: { message: 'service and rule required' } });
        return;
      }
      void am.resolve(rule, service).then((ok) => {
        if (ok) res.json({ ok: true });
        else res.status(404).json({ error: { message: 'alert not active' } });
      });
    },
  };
}
