import type { Alert, AlertChannel } from '../../types';

export interface FeishuChannelOptions {
  webhookUrl: string;
  defaultAtMobiles?: string[];
  /**
   * Override the HTTP fetcher (for tests).
   */
  fetcher?: typeof fetch;
}

const SEVERITY_COLOR: Record<string, string> = {
  info: 'grey',
  warning: 'orange',
  critical: 'red',
};

/**
 * Feishu incoming webhook channel.
 * See https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN
 */
export function feishuChannel(opts: FeishuChannelOptions): AlertChannel {
  if (!opts.webhookUrl) {
    return {
      name: 'feishu',
      async send() {
        // disabled: no webhook configured
      },
    };
  }

  const fetchFn = opts.fetcher ?? fetch;

  return {
    name: 'feishu',
    async send(alert: Alert) {
      const mentions = (opts.defaultAtMobiles ?? [])
        .map((m) => ({ tag: 'at', user_id: m }))
        .flatMap((m) => [m]);
      const body = {
        msg_type: 'interactive',
        card: {
          config: { wide_screen_mode: true },
          header: {
            template: SEVERITY_COLOR[alert.severity] ?? 'blue',
            title: { content: `[${alert.severity.toUpperCase()}] ${alert.service}`, tag: 'plain_text' },
          },
          elements: [
            {
              tag: 'div',
              fields: [
                { is_short: true, text: { tag: 'lark_md', content: `**Rule:**\n${alert.rule}` } },
                { is_short: true, text: { tag: 'lark_md', content: `**Service:**\n${alert.service}` } },
                { is_short: true, text: { tag: 'lark_md', content: `**Value:**\n${alert.value.toFixed(3)}` } },
                { is_short: true, text: { tag: 'lark_md', content: `**Threshold:**\n${alert.threshold}` } },
              ],
            },
            {
              tag: 'div',
              text: { tag: 'lark_md', content: `**Message**\n${alert.message}` },
            },
            ...(mentions.length > 0 ? [{ tag: 'div', text: { tag: 'lark_md', content: '' } }] : []),
            ...mentions,
          ],
        },
      };

      const res = await fetchFn(opts.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`feishu webhook returned ${res.status}: ${text}`);
      }
    },
  };
}
