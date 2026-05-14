import { Command } from 'commander';
import chalk from 'chalk';
import {
  createResultEnvelope,
  envelopeToJson,
  riskLevelOrder,
  type AppRegistrationSummary,
  type RiskLevel,
  type SecretSummary,
} from '@brunsforge/azure-app-registration-monitor';
import { buildContext, handleError } from '../shared/context.js';
import {
  printSecretsTable,
  secretsToMarkdown,
  secretsToCsv,
} from '../output/formatters.js';

const RISK_LEVELS: RiskLevel[] = ['Info', 'Low', 'Medium', 'High', 'Critical'];

function parseRiskLevel(raw: string): RiskLevel {
  const level = RISK_LEVELS.find((r) => r.toLowerCase() === raw.toLowerCase());
  if (!level) {
    process.stderr.write(
      `Invalid severity "${raw}". Valid values: ${RISK_LEVELS.map((r) => r.toLowerCase()).join(', ')}\n`,
    );
    process.exit(1);
  }
  return level;
}

function allSecrets(inventory: AppRegistrationSummary[]): SecretSummary[] {
  return inventory.flatMap((app) => app.secrets);
}

function outputSecrets(
  secrets: SecretSummary[],
  output: string,
  tenantId: string,
): void {
  if (secrets.length === 0) {
    process.stdout.write(chalk.dim('No matching secrets found.\n'));
    return;
  }
  switch (output) {
    case 'json':
      process.stdout.write(
        envelopeToJson(createResultEnvelope(secrets, tenantId)) + '\n',
      );
      break;
    case 'markdown':
      process.stdout.write(secretsToMarkdown(secrets, tenantId));
      break;
    case 'csv':
      process.stdout.write(secretsToCsv(secrets));
      break;
    default:
      printSecretsTable(secrets);
  }
}

export function registerReportCommand(program: Command): void {
  const report = program
    .command('report')
    .description('Generate formatted reports from the secret inventory')
    .action(() => report.help());

  report
    .command('expiring')
    .description('Report secrets expiring within a given window')
    .option('--days <n>', 'Look-ahead window in days')
    .option('--months <n>', 'Look-ahead window in months (converted to days × 30)')
    .action(async (cmdOpts: { days?: string; months?: string }) => {
      try {
        const ctx = await buildContext(program.opts());
        const days = cmdOpts.months
          ? parseInt(cmdOpts.months, 10) * 30
          : parseInt(cmdOpts.days ?? '30', 10);

        const inventory = await ctx.inventoryService.getInventory({
          thresholds: { expiringWithinDays: days },
        });
        const expiring = allSecrets(inventory).filter(
          (s) => s.status === 'ExpiringSoon' || s.status === 'Expired',
        );

        outputSecrets(expiring, program.opts().output, ctx.tenantId);
      } catch (err) {
        handleError(err);
      }
    });

  report
    .command('tenant-summary')
    .description('Summary of App Registrations and secrets for the tenant')
    .action(async () => {
      try {
        const ctx = await buildContext(program.opts());
        const inventory = await ctx.inventoryService.getInventory();
        const allSec = allSecrets(inventory);

        const summary = {
          tenantId: ctx.tenantId,
          generatedAt: new Date().toISOString(),
          appCount: inventory.length,
          secretCount: allSec.length,
          expiredCount: allSec.filter((s) => s.status === 'Expired').length,
          expiringIn30Days: allSec.filter(
            (s) => s.daysUntilExpiry !== null && s.daysUntilExpiry >= 0 && s.daysUntilExpiry <= 30,
          ).length,
          expiringIn90Days: allSec.filter(
            (s) => s.daysUntilExpiry !== null && s.daysUntilExpiry >= 0 && s.daysUntilExpiry <= 90,
          ).length,
          byRisk: Object.fromEntries(
            RISK_LEVELS.map((r) => [r, allSec.filter((s) => s.riskLevel === r).length]),
          ),
        };

        if (ctx.isJson) {
          process.stdout.write(
            envelopeToJson(createResultEnvelope(summary, ctx.tenantId)) + '\n',
          );
        } else {
          process.stdout.write(`\nTenant Summary — ${chalk.bold(ctx.tenantId)}\n`);
          process.stdout.write(`Generated at : ${summary.generatedAt}\n\n`);
          process.stdout.write(`App Registrations : ${summary.appCount}\n`);
          process.stdout.write(`Total secrets     : ${summary.secretCount}\n`);
          process.stdout.write(`Expired           : ${summary.expiredCount > 0 ? chalk.red(String(summary.expiredCount)) : '0'}\n`);
          process.stdout.write(`Expiring ≤30 days : ${summary.expiringIn30Days > 0 ? chalk.red(String(summary.expiringIn30Days)) : '0'}\n`);
          process.stdout.write(`Expiring ≤90 days : ${summary.expiringIn90Days > 0 ? chalk.yellow(String(summary.expiringIn90Days)) : '0'}\n\n`);
          process.stdout.write('By risk level:\n');
          for (const r of [...RISK_LEVELS].reverse()) {
            const count = (summary.byRisk as Record<string, number>)[r];
            if (count > 0) process.stdout.write(`  ${r.padEnd(8)} ${count}\n`);
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  report
    .command('findings')
    .description('List secrets at or above a given risk level')
    .option('--severity <level>', 'Minimum risk level: info, low, medium, high, critical', 'medium')
    .action(async (cmdOpts: { severity: string }) => {
      try {
        const ctx = await buildContext(program.opts());
        const threshold = parseRiskLevel(cmdOpts.severity);
        const thresholdOrder = riskLevelOrder(threshold);

        const inventory = await ctx.inventoryService.getInventory();
        const findings = allSecrets(inventory).filter(
          (s) => riskLevelOrder(s.riskLevel) >= thresholdOrder,
        );

        outputSecrets(findings, program.opts().output, ctx.tenantId);
      } catch (err) {
        handleError(err);
      }
    });

  report
    .command('rotation-guide')
    .description('Print a guided rotation checklist for a specific secret')
    .requiredOption('--app-id <client-id>', 'App Registration client ID')
    .requiredOption('--key-id <secret-key-id>', 'Key ID of the secret to rotate')
    .action(async (cmdOpts: { appId: string; keyId: string }) => {
      try {
        const ctx = await buildContext(program.opts());

        const now = new Date().toISOString().slice(0, 10);
        const guide = [
          `# Secret Rotation Guide`,
          ``,
          `**Tenant:** ${ctx.tenantId}`,
          `**App ID:** ${cmdOpts.appId}`,
          `**Old Key ID:** ${cmdOpts.keyId}`,
          `**Generated:** ${now}`,
          ``,
          `## Checklist`,
          ``,
          `- [ ] 1. Create a new client secret in the Entra portal for this App Registration.`,
          `- [ ] 2. Store the new secret value securely (OS Credential Manager, Key Vault, or secret manager).`,
          `- [ ] 3. Identify all consumers of this secret (use \`aarm usage analyze --app-id ${cmdOpts.appId}\`).`,
          `- [ ] 4. Update each consumer with the new secret value.`,
          `- [ ] 5. Trigger smoke tests or verify each consumer is working.`,
          `- [ ] 6. Monitor the old key ID for residual usage:`,
          `         \`aarm usage rotation-check --app-id ${cmdOpts.appId} --old-key-id ${cmdOpts.keyId} --days 14\``,
          `- [ ] 7. After 7–14 days with zero usage, delete the old secret in Entra.`,
          ``,
          `## Notes`,
          ``,
          `- Do NOT delete the old secret before step 7 — doing so may break consumers that have not yet been updated.`,
          `- Use \`aarm usage rotation-check\` repeatedly to confirm zero residual usage.`,
        ].join('\n');

        if (ctx.isJson) {
          process.stdout.write(
            envelopeToJson(
              createResultEnvelope(
                { appId: cmdOpts.appId, keyId: cmdOpts.keyId, guide },
                ctx.tenantId,
              ),
            ) + '\n',
          );
        } else {
          process.stdout.write(guide + '\n');
        }
      } catch (err) {
        handleError(err);
      }
    });
}
