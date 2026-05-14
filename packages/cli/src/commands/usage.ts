import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  LogAnalyticsClient,
  createResultEnvelope,
  envelopeToJson,
  type AppUsageResult,
  type SecretUsageResult,
} from '@brunsforge/azure-app-registration-monitor';
import { buildContext, handleError, type CommandContext } from '../shared/context.js';
import { EXIT } from '../exitCodes.js';

async function resolveAppId(
  ctx: CommandContext,
  appId: string | undefined,
  appName: string | undefined,
): Promise<string> {
  if (appId) return appId;
  if (!appName) {
    process.stderr.write('Error: either --app-id or --app-name is required.\n');
    process.exit(EXIT.CONFIG_INVALID);
  }
  const app = await ctx.graphReader.findByDisplayName(appName);
  if (!app) {
    process.stderr.write(
      `Error: no app registration found with display name "${appName}".\n` +
        '  Check the exact name or use --app-id with the client ID.\n',
    );
    process.exit(EXIT.CONFIG_INVALID);
  }
  return app.appId;
}

function requireWorkspace(workspaceId: string | undefined, isJson: boolean): asserts workspaceId is string {
  if (!workspaceId) {
    if (!isJson) {
      process.stderr.write(
        chalk.red('✗') +
          ' No Log Analytics workspace configured for this tenant.\n' +
          '  Re-run "aarm tenants add --tenant <name>" and provide a Workspace ID,\n' +
          '  or verify that the tenant was configured with a workspace ID.\n',
      );
    } else {
      process.stdout.write(
        JSON.stringify({ success: false, errors: ['No Log Analytics workspace configured for this tenant.'] }) + '\n',
      );
    }
    process.exit(EXIT.NO_DATA_SOURCE);
  }
}

function printAppUsage(result: AppUsageResult): void {
  process.stdout.write(`\nUsage Analysis — App ID: ${chalk.bold(result.appId)}\n`);
  process.stdout.write(`Look-back: ${result.lookBackDays} days  |  Workspace: ${result.workspaceId}\n\n`);

  process.stdout.write(
    `Total: ${result.totalCount}  ` +
    `Success: ${chalk.green(String(result.successCount))}  ` +
    `Failures: ${result.failureCount > 0 ? chalk.red(String(result.failureCount)) : '0'}\n` +
    `First seen: ${result.firstSeen ?? chalk.dim('—')}  Last seen: ${result.lastSeen ?? chalk.dim('—')}\n` +
    `Active credential keys: ${result.distinctKeyIds.length > 0 ? result.distinctKeyIds.join(', ') : chalk.dim('none')}\n\n`,
  );

  if (result.rows.length === 0) {
    process.stdout.write(chalk.dim('No sign-in activity found in this window.\n'));
    return;
  }

  const table = new Table({
    head: ['Time', 'Key ID', 'Resource', 'IP', 'Result'],
    style: { head: ['cyan'] },
  });
  for (const row of result.rows.slice(0, 100)) {
    const ts = row.timeGenerated ? new Date(row.timeGenerated).toLocaleString() : '—';
    const keyShort = row.credentialKeyId ? row.credentialKeyId.slice(0, 8) + '…' : '—';
    const result_ = row.resultType === '0' ? chalk.green('OK') : chalk.red(row.resultType);
    table.push([ts, keyShort, row.resourceDisplayName || '—', row.ipAddress || '—', result_]);
  }
  process.stdout.write(table.toString() + '\n');
  if (result.rows.length > 100) {
    process.stdout.write(chalk.dim(`Showing 100 of ${result.rows.length} rows. Use --output json for full data.\n`));
  }
}

function printSecretUsage(result: SecretUsageResult, label: string): void {
  process.stdout.write(`\n${label}\n`);
  process.stdout.write(`Look-back: ${result.lookBackDays} days  |  Total sign-ins: ${result.totalCount}\n`);
  process.stdout.write(`Last seen: ${result.lastSeen ?? chalk.dim('never in this window')}\n\n`);

  if (result.rows.length === 0) {
    process.stdout.write(chalk.dim('No sign-in activity found for this key in this window.\n'));
    return;
  }

  const table = new Table({
    head: ['Last Seen', 'Count', 'Resource', 'IP', 'Result'],
    style: { head: ['cyan'] },
  });
  for (const row of result.rows) {
    const ts = row.lastSeen ? new Date(row.lastSeen).toLocaleString() : '—';
    const result_ = row.resultType === '0' ? chalk.green('OK') : chalk.red(row.resultType);
    table.push([ts, String(row.count), row.resourceDisplayName || '—', row.ipAddress || '—', result_]);
  }
  process.stdout.write(table.toString() + '\n');
}

export function registerUsageCommand(program: Command): void {
  const usage = program
    .command('usage')
    .description('Analyze Service Principal Sign-in Logs via Log Analytics')
    .action(() => usage.help());

  usage
    .command('analyze')
    .description('Show sign-in history for an App Registration')
    .option('--app-id <client-id>', 'App Registration client ID (GUID)')
    .option('--app-name <name>', 'App Registration display name (resolved via Graph)')
    .option('--days <n>', 'Look-back window in days', '90')
    .action(async (cmdOpts: { appId?: string; appName?: string; days: string }) => {
      try {
        const ctx = await buildContext(program.opts());
        requireWorkspace(ctx.logAnalyticsWorkspaceId, ctx.isJson);

        const appId = await resolveAppId(ctx, cmdOpts.appId, cmdOpts.appName);
        const days = parseInt(cmdOpts.days, 10);
        const client = new LogAnalyticsClient(ctx.credential);
        const result = await client.queryAppUsage(ctx.logAnalyticsWorkspaceId, appId, days);

        if (ctx.isJson) {
          process.stdout.write(
            envelopeToJson(createResultEnvelope(result, ctx.tenantId)) + '\n',
          );
        } else {
          printAppUsage(result);
        }
      } catch (err) {
        handleError(err);
      }
    });

  usage
    .command('analyze-secret')
    .description('Show sign-in history for a specific credential key ID')
    .requiredOption('--key-id <secret-key-id>', 'Credential key ID (GUID from the secret)')
    .option('--days <n>', 'Look-back window in days', '90')
    .action(async (cmdOpts: { keyId: string; days: string }) => {
      try {
        const ctx = await buildContext(program.opts());
        requireWorkspace(ctx.logAnalyticsWorkspaceId, ctx.isJson);

        const days = parseInt(cmdOpts.days, 10);
        const client = new LogAnalyticsClient(ctx.credential);
        const result = await client.querySecretUsage(ctx.logAnalyticsWorkspaceId, cmdOpts.keyId, days);

        if (ctx.isJson) {
          process.stdout.write(
            envelopeToJson(createResultEnvelope(result, ctx.tenantId)) + '\n',
          );
        } else {
          printSecretUsage(result, `Usage — Key ID: ${chalk.bold(cmdOpts.keyId)}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  usage
    .command('last-seen')
    .description('Show when an App Registration was last used (summarized)')
    .option('--app-id <client-id>', 'App Registration client ID (GUID)')
    .option('--app-name <name>', 'App Registration display name (resolved via Graph)')
    .option('--days <n>', 'Look-back window in days', '90')
    .action(async (cmdOpts: { appId?: string; appName?: string; days: string }) => {
      try {
        const ctx = await buildContext(program.opts());
        requireWorkspace(ctx.logAnalyticsWorkspaceId, ctx.isJson);

        const appId = await resolveAppId(ctx, cmdOpts.appId, cmdOpts.appName);
        const days = parseInt(cmdOpts.days, 10);
        const client = new LogAnalyticsClient(ctx.credential);
        const result = await client.queryAppUsage(ctx.logAnalyticsWorkspaceId, appId, days);

        const summary = {
          appId: result.appId,
          lastSeen: result.lastSeen,
          totalSignIns: result.totalCount,
          activeKeyIds: result.distinctKeyIds,
          lookBackDays: days,
        };

        if (ctx.isJson) {
          process.stdout.write(
            envelopeToJson(createResultEnvelope(summary, ctx.tenantId)) + '\n',
          );
        } else {
          process.stdout.write(`App ID   : ${result.appId}\n`);
          process.stdout.write(`Last seen: ${result.lastSeen ?? chalk.dim('not seen in this window')}\n`);
          process.stdout.write(`Sign-ins : ${result.totalCount} (last ${days} days)\n`);
          process.stdout.write(`Keys used: ${result.distinctKeyIds.join(', ') || chalk.dim('none')}\n`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  usage
    .command('rotation-check')
    .description('Check whether an old key ID is still being used after rotation')
    .requiredOption('--app-id <client-id>', 'App Registration client ID')
    .requiredOption('--old-key-id <secret-key-id>', 'The old credential key ID to watch')
    .option('--days <n>', 'Look-back window in days', '14')
    .action(async (cmdOpts: { appId: string; oldKeyId: string; days: string }) => {
      try {
        const ctx = await buildContext(program.opts());
        requireWorkspace(ctx.logAnalyticsWorkspaceId, ctx.isJson);

        const days = parseInt(cmdOpts.days, 10);
        const client = new LogAnalyticsClient(ctx.credential);
        const result = await client.queryRotationCheck(
          ctx.logAnalyticsWorkspaceId,
          cmdOpts.appId,
          cmdOpts.oldKeyId,
          days,
        );

        if (ctx.isJson) {
          process.stdout.write(
            envelopeToJson(createResultEnvelope(result, ctx.tenantId)) + '\n',
          );
        } else {
          const label = `Rotation Check — App: ${chalk.bold(cmdOpts.appId)}  Old Key: ${chalk.bold(cmdOpts.oldKeyId)}`;
          if (result.totalCount === 0) {
            process.stdout.write(chalk.green('✓') + ` Old key not seen in the last ${days} days. Safe to delete.\n`);
          } else {
            process.stdout.write(
              chalk.yellow('⚠') +
                ` Old key still active: ${result.totalCount} sign-in(s) in the last ${days} days.\n` +
                `  Last seen: ${result.lastSeen}\n`,
            );
            printSecretUsage(result, label);
          }
        }
      } catch (err) {
        handleError(err);
      }
    });
}
