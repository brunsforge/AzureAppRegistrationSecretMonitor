import type { JobConfig } from '../types/JobConfig.js';
import type { JobRuntimeState } from '../types/RuntimeState.js';

export interface ScheduledJob {
  job: JobConfig;
  state: JobRuntimeState;
}

/**
 * Returns jobs that should run in the current timer tick.
 *
 * A job qualifies if:
 *   1. It is enabled.
 *   2. The most recent past scheduled run time (today at runAtUtc, or earlier
 *      by intervalDays increments) is after lastRunAt (or lastRunAt is null).
 */
export function selectQualifyingJobs(
  jobs: JobConfig[],
  states: Map<string, JobRuntimeState>,
  now = new Date(),
): ScheduledJob[] {
  return jobs
    .filter((job) => job.enabled)
    .filter((job) => {
      const state = states.get(job.id) ?? emptyState(job.id);
      return shouldJobRun(job, state, now);
    })
    .map((job) => ({ job, state: states.get(job.id) ?? emptyState(job.id) }));
}

export function shouldJobRun(
  job: JobConfig,
  state: JobRuntimeState,
  now = new Date(),
): boolean {
  const [hh, mm] = job.schedule.runAtUtc.split(':').map(Number);

  // Most recent scheduled run time that has already passed
  let scheduledRun = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm),
  );
  while (scheduledRun > now) {
    scheduledRun = new Date(
      scheduledRun.getTime() - job.schedule.intervalDays * 24 * 60 * 60 * 1000,
    );
  }

  if (state.lastRunAt === null) return true;
  return new Date(state.lastRunAt) < scheduledRun;
}

function emptyState(jobId: string): JobRuntimeState {
  return { jobId, lastRunAt: null, lastRunStatus: null, lastRunSecretsFound: null };
}
