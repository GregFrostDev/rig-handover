import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, ReadNight } from './types.js';

// One parsed log line. Parsed at the edge; everything after trusts this shape.
type RunLine = { at: string; job: string; status: JobStatus; owner: string | null; error: string | null };

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

function isStatus(v: unknown): v is JobStatus {
  return typeof v === 'string' && STATUSES.includes(v);
}

// Returns null for any line that is not JSON or does not fit the shape.
export function parseLine(text: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || o.at === '') return null;
  if (typeof o.job !== 'string' || o.job === '') return null;
  if (!isStatus(o.status)) return null;
  if (o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && o.error !== null && typeof o.error !== 'string') return null;
  return { at: o.at, job: o.job, status: o.status, owner: o.owner, error: typeof o.error === 'string' ? o.error : null };
}

// Definitions (see DigestRow): runs = valid lines for the job; retries = valid lines with
// status "retry"; last status / last error / owner = from the job's last valid line in file
// order; firstAt / lastAt = `at` of its first / last valid line in file order, as written.
// Blank lines are skipped and not counted as bad.
export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return { night, found: false };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { night, found: false };
    throw e;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    const row = byJob.get(line.job);
    const retry = line.status === 'retry' ? 1 : 0;
    if (!row) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: retry,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
      });
    } else {
      row.owner = line.owner;
      row.runs++;
      row.retries += retry;
      row.lastStatus = line.status;
      row.lastError = line.error;
      row.lastAt = line.at;
    }
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, found: true, rows, badLines };
};
