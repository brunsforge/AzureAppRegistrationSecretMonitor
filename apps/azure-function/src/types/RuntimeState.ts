export type JobRunStatus = 'success' | 'partial' | 'failed';

export interface JobRuntimeState {
  jobId: string;
  lastRunAt: string | null;
  lastRunStatus: JobRunStatus | null;
  lastRunSecretsFound: number | null;
}
