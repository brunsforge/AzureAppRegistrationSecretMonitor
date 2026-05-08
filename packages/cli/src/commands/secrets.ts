import { Command } from 'commander';
import {
  createResultEnvelope,
  envelopeToJson,
  type AppRegistrationSummary,
  type SecretSummary,
} from '@brunsforge/azure-app-registration-monitor';
import { buildContext, handleError } from '../shared/context.js';
import { printSecretsTable } from '../output/formatters.js';
import { HistoryStore } from '../config/HistoryStore.js';

function allSecrets(inventory: AppRegistrationSummary[]): SecretSummary[] {
  return inventory.flatMap((app) => app.secrets);
}

export function registerSecretsCommand(program: Command): void {
  const secrets = program
    .command('secrets')
    .description('Query client secrets across App Registrations')
    .action(() => secrets.help());

  secrets
    .command('list')
    .description('List all secrets')
    .action(async () => {
      try {
        const ctx = await buildContext(program.opts());
        const inventory = await ctx.inventoryService.getInventory();
        const flat = allSecrets(inventory);
        const envelope = createResultEnvelope(flat, ctx.tenantId, ctx.environmentName);

        // Auto-save history — side effect, failures are swallowed inside HistoryStore
        const history = new HistoryStore(ctx.configStore.getConfigDir());
        void history.save('secrets', ctx.tenantId, envelope);

        // Update lastSuccessfulScanAt on the tenant profile
        void ctx.configStore.upsertTenant({
          ...ctx.tenant,
          lastSuccessfulScanAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (ctx.isJson) {
          process.stdout.write(envelopeToJson(envelope) + '\n');
        } else {
          printSecretsTable(flat);
        }
      } catch (err) {
        handleError(err);
      }
    });

  secrets
    .command('expiring')
    .description('List secrets expiring within a given window')
    .option('--days <n>', 'Window in days', '30')
    .option('--months <n>', 'Window in months (converted to days × 30)')
    .action(async (cmdOpts: { days: string; months?: string }) => {
      try {
        const ctx = await buildContext(program.opts());
        const days = cmdOpts.months
          ? parseInt(cmdOpts.months, 10) * 30
          : parseInt(cmdOpts.days, 10);

        const inventory = await ctx.inventoryService.getInventory({
          thresholds: { expiringWithinDays: days },
        });
        const flat = allSecrets(inventory).filter(
          (s) => s.status === 'ExpiringSoon',
        );

        if (ctx.isJson) {
          process.stdout.write(
            envelopeToJson(createResultEnvelope(flat, ctx.tenantId, ctx.environmentName)) + '\n',
          );
        } else {
          printSecretsTable(flat);
        }
      } catch (err) {
        handleError(err);
      }
    });

  secrets
    .command('expired')
    .description('List all expired secrets')
    .action(async () => {
      try {
        const ctx = await buildContext(program.opts());
        const inventory = await ctx.inventoryService.getInventory();
        const flat = allSecrets(inventory).filter((s) => s.status === 'Expired');

        if (ctx.isJson) {
          process.stdout.write(
            envelopeToJson(createResultEnvelope(flat, ctx.tenantId, ctx.environmentName)) + '\n',
          );
        } else {
          printSecretsTable(flat);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
