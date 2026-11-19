// Plan morning-digest § 1. Section 2 (page, JSON, board link, route tests) builds on these
// types only, so keep them stable.

export type JobStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log.
// - runs: number of valid lines for the job.
// - retries: number of valid lines with status "retry".
// - lastStatus / lastError / owner: from the job's last valid line in file order.
//   lastError is that line's error, or null when it has none.
// - firstAt / lastAt: `at` of the job's first and last valid line in file order, kept
//   exactly as written in the log (offset kept, never converted to UTC).
// owner stays null in data; views render null (and lastError null) as "—" (styleguide).
// Display strings never go into this type.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// The result of reading one night.
// - found false: no runs/<night>.jsonl (or night is not YYYY-MM-DD). The page answers 404.
// - found true: rows sorted by job (ascending, code-unit order), so page and JSON agree.
//   badLines counts non-blank lines that are not valid JSON or do not fit the line shape.
//   rows empty means "nothing ran" (an empty file, or a file with only bad lines).
export type Night =
  | { night: string; found: false }
  | { night: string; found: true; rows: DigestRow[]; badLines: number };

export type ReadNight = (runsDir: string, night: string) => Night;
