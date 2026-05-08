import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  createResultEnvelope,
  envelopeToJson,
  isDelegatedMode,
  PERMISSION_DETAILS,
  type CapabilitySet,
  type PreflightResult,
} from '@brunsforge/azure-app-registration-monitor';
import { buildContext, handleError, type GlobalOptions } from '../shared/context.js';
import { ConfigStore } from '../config/ConfigStore.js';
import { HistoryStore } from '../config/HistoryStore.js';

function tick(value: boolean): string {
  return value ? chalk.green('[✓]') : chalk.red('[ ]');
}

function printPreflightTable(result: PreflightResult): void {
  process.stdout.write(`\nPreflight — ${chalk.bold(result.tenantId)}\n`);
  process.stdout.write(`Checked at  : ${result.checkedAt}\n\n`);

  const statusTable = new Table({ style: { compact: true } });
  statusTable.push(
    ['Authentication', result.authValid ? chalk.green('OK') : chalk.red('FAILED')],
    ['Graph reachable', result.graphReachable ? chalk.green('OK') : chalk.red('FAILED')],
  );
  process.stdout.write(statusTable.toString() + '\n\n');

  process.stdout.write(chalk.bold('Capabilities\n'));
  const capTable = new Table({
    head: ['Capability', 'Status'],
    style: { head: ['cyan'] },
  });
  for (const [key, value] of Object.entries(result.capabilities) as [
    keyof CapabilitySet,
    boolean,
  ][]) {
    capTable.push([
      key,
      `${tick(value)} ${value ? 'Available' : chalk.dim('Unavailable')}`,
    ]);
  }
  process.stdout.write(capTable.toString() + '\n');

  if (result.missingPermissions.length > 0) {
    process.stdout.write(chalk.bold('\nMissing permissions\n'));
    for (const p of result.missingPermissions) {
      process.stdout.write(`  ${chalk.red('✗')} ${p}\n`);
    }
  }

  if (result.warnings.length > 0) {
    process.stdout.write(chalk.bold('\nWarnings\n'));
    for (const w of result.warnings) {
      process.stdout.write(`  ${chalk.yellow('!')} ${w}\n`);
    }
  }

  if (result.errors.length > 0) {
    process.stdout.write(chalk.bold('\nErrors\n'));
    for (const e of result.errors) {
      process.stdout.write(`  ${chalk.red('✗')} ${e}\n`);
    }
  }
}

export function registerPreflightCommand(program: Command): void {
  const preflight = program
    .command('preflight')
    .description('Run and display tenant capability preflight checks')
    .action(() => preflight.help());

  preflight
    .command('run')
    .description('Run a full preflight capability check against the tenant')
    .action(async () => {
      try {
        const ctx = await buildContext(program.opts());

        // Progress goes to stderr so stdout stays clean JSON when --output json
        if (!ctx.isJson) {
          process.stderr.write(chalk.dim(`Running preflight for ${ctx.tenantId}...\n`));
        }

        const result = await ctx.preflightService.run({
          tenantId: ctx.tenantId,
          environmentName: ctx.environmentName,
          authMode: ctx.authMode,
          logAnalyticsWorkspaceId: ctx.logAnalyticsWorkspaceId,
        });

        // Auto-save preflight result to history
        const history = new HistoryStore(ctx.configStore.getConfigDir());
        void history.save('preflight', ctx.tenantId, result);

        // Update lastPreflightAt on the tenant profile
        void ctx.configStore.upsertTenant({
          ...ctx.tenant,
          lastPreflightAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (ctx.isJson) {
          process.stdout.write(
            envelopeToJson(
              createResultEnvelope(result, ctx.tenantId, ctx.environmentName, {
                warnings: result.warnings,
                errors: result.errors,
              }),
            ) + '\n',
          );
        } else {
          printPreflightTable(result);
        }
      } catch (err) {
        handleError(err);
      }
    });

  preflight
    .command('show')
    .description('Show the last cached preflight result (no network call)')
    .action(async () => {
      const opts = program.opts<GlobalOptions>();
      if (!opts.tenant) {
        process.stderr.write('Error: --tenant is required.\n');
        process.exit(1);
      }
      const store = new ConfigStore(opts.configDir);
      const tenant = await store.getTenant(opts.tenant);
      if (!tenant) {
        process.stderr.write(`Error: Tenant "${opts.tenant}" not found.\n`);
        process.exit(1);
      }
      const history = new HistoryStore(store.getConfigDir());
      const cached = await history.loadLatest<PreflightResult>('preflight', tenant.tenantId);
      if (!cached) {
        process.stderr.write(
          chalk.dim('No cached preflight result. Run "aarm preflight run --tenant <name>" first.\n'),
        );
        process.exit(1);
      }
      if (opts.output === 'json') {
        process.stdout.write(
          envelopeToJson(createResultEnvelope(cached, tenant.tenantId, tenant.defaultEnvironmentName ?? 'default')) + '\n',
        );
      } else {
        process.stderr.write(chalk.dim(`Showing cached result from ${cached.checkedAt}\n\n`));
        printPreflightTable(cached);
      }
    });

  preflight
    .command('explain')
    .description('List all permissions required and how to grant them')
    .action(async () => {
      const globalOpts = program.opts<{ tenant?: string; configDir?: string }>();

      // Resolve auth mode from stored tenant profile if --tenant is given
      let delegated = false;
      if (globalOpts.tenant) {
        const { ConfigStore } = await import('../config/ConfigStore.js');
        const store = new ConfigStore(globalOpts.configDir);
        const tenant = await store.getTenant(globalOpts.tenant);
        if (tenant) delegated = isDelegatedMode(tenant.authMode as never);
      }

      const showSection = (sectionDelegated: boolean) => {
        const label = sectionDelegated
          ? 'Delegated modes  (device-code · username-password · interactive-browser · azure-cli)'
          : 'Application modes  (client-secret · certificate)';
        process.stdout.write(chalk.bold(`\n${label}\n`));
        process.stdout.write(chalk.dim('─'.repeat(72) + '\n\n'));

        for (const d of PERMISSION_DETAILS) {
          const hint = sectionDelegated ? d.delegatedHint : d.applicationHint;
          const phase = d.mvp ? '' : chalk.dim(' [post-MVP]');
          const consent = d.requiresAdminConsent ? chalk.yellow(' [admin consent]') : '';
          const role = d.requiresUserRole && sectionDelegated ? chalk.magenta(' [user role]') : '';
          process.stdout.write(`  ${chalk.cyan(d.capability)}${phase}${consent}${role}\n`);
          process.stdout.write(`    ${hint}\n\n`);
        }
      };

      if (globalOpts.tenant) {
        // Show only the relevant mode for the configured tenant
        showSection(delegated);
      } else {
        process.stdout.write(chalk.dim('Tip: pass --tenant <name> to see only the hints relevant to your auth mode.\n'));
        showSection(false);
        showSection(true);
      }
    });
}
