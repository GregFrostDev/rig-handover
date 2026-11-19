import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest JSON', () => {
  it('returns the same rows, in the same order, as readNight', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = await res.json();
    const expected = readNight('runs', '2026-10-28');
    if (!expected.found) throw new Error('2026-10-28 should exist');
    expect(body).toEqual({ night: '2026-10-28', rows: expected.rows, badLines: expected.badLines });
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(expected.rows.map((r) => r.job));
  });

  it('answers 404 with an error for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2000-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: '2000-01-01' });
  });
});
