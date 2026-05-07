export type { AuthMode } from './auth/AuthMode.js';
export type {
  AuthConfig,
  AzureCliAuthConfig,
  CertificateAuthConfig,
  ClientSecretAuthConfig,
  DeviceCodeAuthConfig,
  InteractiveBrowserAuthConfig,
  UsernamePasswordAuthConfig,
  WorkloadIdentityFederationAuthConfig,
} from './auth/AuthProviderFactory.js';
export { createCredential } from './auth/AuthProviderFactory.js';

export type { TenantProfile } from './config/TenantProfile.js';
export type { EnvironmentProfile } from './config/EnvironmentProfile.js';

export type {
  GraphApplication,
  GraphOwner,
  GraphPasswordCredential,
} from './graph/GraphApplicationReader.js';
export {
  GraphApplicationReader,
  createGraphClient,
} from './graph/GraphApplicationReader.js';

export type {
  AppRegistrationSummary,
  SecretInventoryOptions,
  SecretSummary,
} from './secrets/SecretInventoryService.js';
export { SecretInventoryService } from './secrets/SecretInventoryService.js';

export type {
  ExpiryResult,
  ExpiryThresholds,
  SecretStatus,
} from './secrets/SecretStatusCalculator.js';
export { calculateExpiryStatus } from './secrets/SecretStatusCalculator.js';

export type { RiskLevel } from './secrets/SecretRiskClassifier.js';
export {
  classifySecretRisk,
  maxRiskLevel,
  riskLevelOrder,
} from './secrets/SecretRiskClassifier.js';

export type { ResultEnvelope } from './reporting/JsonReporter.js';
export { createResultEnvelope, envelopeToJson } from './reporting/JsonReporter.js';

export type {
  CapabilitySet,
  PreflightParams,
  PreflightResult,
} from './preflight/PreflightService.js';
export { PreflightService } from './preflight/PreflightService.js';

export { CapabilityEvaluator } from './preflight/CapabilityEvaluator.js';

export type { PermissionDetail } from './preflight/PermissionHintMapper.js';
export {
  APPLICATION_PERMISSION_HINTS,
  DELEGATED_PERMISSION_HINTS,
  PERMISSION_DETAILS,
  PERMISSION_HINTS,
  getPermissionHints,
  isDelegatedMode,
} from './preflight/PermissionHintMapper.js';

export type {
  AppUsageResult,
  LogAnalyticsCapabilityResult,
  SecretUsageResult,
  UsageObservation,
  UsageSummary,
} from './usage/LogAnalyticsClient.js';
export { LogAnalyticsClient } from './usage/LogAnalyticsClient.js';

export {
  AarmError,
  AuthError,
  ConfigError,
  GraphError,
  PermissionError,
} from './errors/index.js';
