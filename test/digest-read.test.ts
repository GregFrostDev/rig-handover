import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';
import type { DigestRow } from '../src/digest/types.js';

function rowsOf(runsDir: string, night: string): { rows: DigestRow[]; badLines: number } {
  const n = readNight(runsDir, night);
  if (!n.found) throw new Error(`night ${night} not found`);
  return n;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const { rows, badLines } = rowsOf('runs', '2026-10-28');
  const row = (job: string) => rows.find((r) => r.job === job);

  it('has 5 jobs, sorted by job, and 1 bad line', () => {
    expect(rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(badLines).toBe(1);
  });

  it('keeps a row with owner null', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });

  it('counts fixtures/refresh: 4 runs, 3 retries, last ok', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('notes/backup last status fail with "quota exceeded"', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
  });

  it('keeps times exactly as written, offset included', () => {
    expect(row('lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });
});

describe('readNight edge cases (temp dir)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('a missing file is found: false', () => {
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', found: false });
  });

  it('an empty file is found with no rows and no bad lines', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', found: true, rows: [], badLines: 0 });
  });

  it('counts lines that parse but do not fit the shape, skips blank lines', () => {
    writeFileSync(
      join(dir, '2026-01-03.jsonl'),
      [
        '{"at":"2026-01-03T01:00:00+02:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-01-03T01:00:00+02:00","job":"a","status":"maybe","owner":"x"}',
        '[1,2]',
        '{"job":"a","status":"ok","owner":"x"}',
        '',
        'not json',
      ].join('\n') + '\n',
    );
    const n = rowsOf(dir, '2026-01-03');
    expect(n.badLines).toBe(4);
    expect(n.rows).toHaveLength(1);
    expect(n.rows[0]?.firstAt).toBe('2026-01-03T01:00:00+02:00');
  });

  it('a night that is not YYYY-MM-DD is found: false (no path escape)', () => {
    expect(readNight(dir, '../etc/passwd').found).toBe(false);
  });
});
