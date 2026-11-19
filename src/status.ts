import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { countNight, type NightCounts } from './digest/counts.js';
import { lastBeat, type Beat } from './heartbeat.js';

// One night on disk, with its valid-line counts by status (see src/digest/counts.ts).
export type NightEntry = { night: string } & NightCounts;

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightEntry[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({ night, ...countNight(config.runsDir, night) })),
  };
}
