import type { Alert, AlertChannel } from '../../types';

export interface WebhookChannelOptions {
  url: string;
  /**
   * Optional shared secret to include as `X-ManhuaWorks-Signature`.
   */
  secret?: string;
  fetcher?: typeof fetch;
}

export function webhookChannel(opts: WebhookChannelOptions): AlertChannel {
  if (!opts.url) {
    return {
      name: 'webhook',
      async send() {
        // disabled: no URL configured
      },
    };
  }
  const fetchFn = opts.fetcher ?? fetch;
  return {
    name: 'webhook',
    async send(alert: Alert) {
      const res = await fetchFn(opts.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(opts.secret ? { 'X-ManhuaWorks-Signature': opts.secret } : {}),
        },
        body: JSON.stringify(alert),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`webhook returned ${res.status}: ${text}`);
      }
    },
  };
}
