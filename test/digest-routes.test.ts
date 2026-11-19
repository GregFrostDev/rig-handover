import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

// Plan morning-digest § 2d. Routes are built by other workers; these tests fix their contract.
// Temp runs dir only: runs/ is read-only.

const NORMAL = '2026-10-28';
const BAD_LINE = '2026-10-27';
const EMPTY = '2026-10-26';
const MISSING = '2026-10-01';

const NORMAL_LOG = [
  '{"at":"2026-10-28T01:00:00+01:00","job":"backup","status":"ok","owner":"ops"}',
  '{"at":"2026-10-28T02:00:00+01:00","job":"report","status":"retry","owner":"finance","error":"timeout"}',
  '{"at":"2026-10-28T02:05:00+01:00","job":"report","status":"fail","owner":"finance","error":"db down"}',
].join('\n');

const BAD_LINE_LOG = [
  '{"at":"2026-10-27T01:00:00+01:00","job":"backup","status":"ok","owner":"ops"}',
  'this is not json',
  '{"at":"2026-10-27T03:00:00+01:00","job":"sync","status":"ok","owner":null}',
].join('\n');

let runsDir: string;

function app() {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'digest-routes-'));
  writeFileSync(join(runsDir, `${NORMAL}.jsonl`), NORMAL_LOG + '\n');
  writeFileSync(join(runsDir, `${BAD_LINE}.jsonl`), BAD_LINE_LOG + '\n');
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night (HTML)', () => {
  it('returns 404 for a night with no file', async () => {
    const res = await app().request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for an empty file', async () => {
    const res = await app().request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders every job name for a normal night', async () => {
    const res = await app().request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('backup');
    expect(html).toContain('report');
  });

  it('still renders the valid jobs when a line is bad', async () => {
    const res = await app().request(`/digest/${BAD_LINE}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('backup');
    expect(html).toContain('sync');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('returns 404 with the error body for a night with no file', async () => {
    const res = await app().request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: MISSING });
  });

  it('returns night, rows and badLines for a normal night', async () => {
    const res = await app().request(`/api/digest/${NORMAL}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: DigestRow[]; badLines: number };
    expect(body.night).toBe(NORMAL);
    expect(body.badLines).toBe(0);
    expect(body.rows).toEqual([
      {
        job: 'backup',
        owner: 'ops',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T01:00:00+01:00',
        lastAt: '2026-10-28T01:00:00+01:00',
      },
      {
        job: 'report',
        owner: 'finance',
        runs: 2,
        retries: 1,
        lastStatus: 'fail',
        lastError: 'db down',
        firstAt: '2026-10-28T02:00:00+01:00',
        lastAt: '2026-10-28T02:05:00+01:00',
      },
    ]);
  });

  it('returns empty rows and badLines 0 for an empty file', async () => {
    const res = await app().request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: EMPTY, rows: [], badLines: 0 });
  });

  it('counts the bad line and keeps the valid rows', async () => {
    const res = await app().request(`/api/digest/${BAD_LINE}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: DigestRow[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['backup', 'sync']);
  });
});
