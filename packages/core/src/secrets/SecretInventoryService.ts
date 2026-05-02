import type { GraphApplicationReader, GraphOwner } from '../graph/GraphApplicationReader.js';
import {
  calculateExpiryStatus,
  type ExpiryThresholds,
} from './SecretStatusCalculator.js';
import {
  classifySecretRisk,
  maxRiskLevel,
  type RiskLevel,
} from './SecretRiskClassifier.js';

export interface SecretSummary {
  applicationObjectId: string;
  appId: string;
  appDisplayName: string;
  keyId: string;
  displayName: string | null;
  hint: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  daysUntilExpiry: number | null;
  status: string;
  riskLevel: RiskLevel;
}

export interface AppRegistrationSummary {
  applicationObjectId: string;
  appId: string;
  displayName: string;
  createdDateTime: string;
  owners: GraphOwner[];
  secretCount: number;
  expiredSecretCount: number;
  expiringSecretCount: number;
  riskLevel: RiskLevel;
  secrets: SecretSummary[];
}

export interface SecretInventoryOptions {
  includeOwners?: boolean;
  thresholds?: ExpiryThresholds;
}

export class SecretInventoryService {
  constructor(private readonly graphReader: GraphApplicationReader) {}

  async getInventory(
    options: SecretInventoryOptions = {},
  ): Promise<AppRegistrationSummary[]> {
    const applications = await this.graphReader.listApplications();
    const { thresholds, includeOwners = false } = options;

    return Promise.all(
      applications.map(async (app) => {
        const owners = includeOwners
          ? await this.graphReader.getApplicationOwners(app.id)
          : [];

        const secrets: SecretSummary[] = (app.passwordCredentials ?? []).map(
          (cred) => {
            const expiry = calculateExpiryStatus(cred.endDateTime, thresholds);
            return {
              applicationObjectId: app.id,
              appId: app.appId,
              appDisplayName: app.displayName,
              keyId: cred.keyId,
              displayName: cred.displayName,
              hint: cred.hint,
              startDateTime: cred.startDateTime,
              endDateTime: cred.endDateTime,
              daysUntilExpiry: expiry.daysUntilExpiry,
              status: expiry.status,
              riskLevel: classifySecretRisk(
                expiry.daysUntilExpiry,
                expiry.status,
              ),
            };
          },
        );

        return {
          applicationObjectId: app.id,
          appId: app.appId,
          displayName: app.displayName,
          createdDateTime: app.createdDateTime,
          owners,
          secretCount: secrets.length,
          expiredSecretCount: secrets.filter((s) => s.status === 'Expired')
            .length,
          expiringSecretCount: secrets.filter(
            (s) => s.status === 'ExpiringSoon',
          ).length,
          riskLevel: maxRiskLevel(secrets.map((s) => s.riskLevel)),
          secrets,
        };
      }),
    );
  }
}
