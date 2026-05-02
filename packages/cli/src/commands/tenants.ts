import readline from 'node:readline';
import { Command } from 'commander';
import chalk from 'chalk';
import type { TenantProfile, AuthMode } from '@brunsforge/azure-app-registration-monitor';
import { createResultEnvelope, envelopeToJson } from '@brunsforge/azure-app-registration-monitor';
import { ConfigStore } from '../config/ConfigStore.js';
import { CredentialStore } from '../config/CredentialStore.js';
import { printTenantsTable } from '../output/formatters.js';
import { buildContext, handleError, type GlobalOptions } from '../shared/context.js';
import { EXIT } from '../exitCodes.js';

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function readSecret(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    let input = '';

    const onData = (chunk: Buffer) => {
      const char = chunk.toString('utf8');
      // Enter or Ctrl-D (EOF)
      if (char === '\r' || char === '\n' || char === '') {
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
      // Ctrl-C
      } else if (char === '') {
        process.stdout.write('\n');
        process.exit(130);
      // DEL or Backspace
      } else if (char === '' || char === '\b') {
        input = input.slice(0, -1);
      // Ignore ANSI escape sequences
      } else if (!char.startsWith('')) {
        input += char;
      }
    };

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

const VALID_AUTH_MODES: AuthMode[] = [
  'client-secret',
  'device-code',
  'interactive-browser',
  'certificate',
  'azure-cli',
  'username-password',
];

export function registerTenantsCommand(program: Command): void {
  const tenants = program
    .command('tenants')
    .description('Manage configured tenants')
    .action(() => tenants.help());

  tenants
    .command('list')
    .description('List configured tenants')
    .action(async () => {
      const parent = tenants.parent!;
      const opts = parent.opts<{ configDir?: string; output: string }>();
      const store = new ConfigStore(opts.configDir);
      const list = await store.listTenants();

      if (opts.output === 'json') {
        process.stdout.write(envelopeToJson(createResultEnvelope(list, 'local', 'config')) + '\n');
      } else {
        printTenantsTable(list);
      }
    });

  tenants
    .command('add')
    .description('Add or update a tenant configuration')
    .option('--tenant-id <id>', 'Entra tenant ID (GUID)')
    .option('--display-name <name>', 'Friendly name for this tenant')
    .option(
      '--auth-mode <mode>',
      `Authentication mode: ${VALID_AUTH_MODES.join(', ')}`,
    )
    .option('--client-id <id>', 'App Registration client ID used for auth')
    .option('--username <email>', 'UPN / email address (username-password mode only)')
    .option('--workspace-id <id>', 'Log Analytics workspace ID (optional)')
    .action(async (opts) => {
      const parent = tenants.parent!;
      const globalOpts = parent.opts<{ configDir?: string }>();
      const store = new ConfigStore(globalOpts.configDir);
      const credStore = new CredentialStore();

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      const tenantId: string =
        opts.tenantId ?? (await ask(rl, 'Tenant ID (GUID): ')).trim();
      const displayName: string =
        opts.displayName ?? (await ask(rl, 'Display name: ')).trim();
      const authModeRaw: string =
        opts.authMode ??
        (await ask(rl, `Auth mode (${VALID_AUTH_MODES.join('/')}): `)).trim();

      if (!VALID_AUTH_MODES.includes(authModeRaw as AuthMode)) {
        process.stderr.write(`Invalid auth mode: "${authModeRaw}"\n`);
        rl.close();
        process.exit(EXIT.CONFIG_INVALID);
      }
      const authMode = authModeRaw as AuthMode;

      let clientId: string | undefined;
      if (authMode !== 'azure-cli') {
        clientId =
          opts.clientId ?? (await ask(rl, 'Client ID (App Registration GUID): ')).trim();
      }

      const workspaceId: string | undefined =
        opts.workspaceId ??
        ((await ask(rl, 'Log Analytics Workspace ID (optional, press Enter to skip): ')).trim() ||
          undefined);

      rl.close();

      let username: string | undefined;

      const now = new Date().toISOString();
      const profile: TenantProfile = {
        tenantId,
        displayName,
        authMode,
        clientId,
        ...(workspaceId ? { defaultEnvironmentName: 'default' } : {}),
        createdAt: now,
        updatedAt: now,
      };

      if (authMode === 'client-secret' && clientId) {
        const secret = await readSecret('Client Secret (hidden): ');
        if (!secret) {
          process.stderr.write('Client secret cannot be empty.\n');
          process.exit(EXIT.CONFIG_INVALID);
        }
        await credStore.setClientSecret(tenantId, clientId, secret);
        process.stdout.write(
          chalk.green('✓') + ' Client secret saved to Windows Credential Manager.\n',
        );
      } else if (authMode === 'username-password' && clientId) {
        process.stdout.write(
          chalk.yellow('⚠') +
            ' username-password mode does not support MFA. Use device-code for accounts with MFA.\n',
        );
        username =
          opts.username ?? (await (async () => {
            const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
            const val = await ask(rl2, 'Username (email / UPN): ');
            rl2.close();
            return val.trim();
          })());
        if (!username) {
          process.stderr.write('Username cannot be empty.\n');
          process.exit(EXIT.CONFIG_INVALID);
        }
        const password = await readSecret('Password (hidden): ');
        if (!password) {
          process.stderr.write('Password cannot be empty.\n');
          process.exit(EXIT.CONFIG_INVALID);
        }
        profile.username = username;
        await credStore.setUserPassword(tenantId, clientId, username, password);
        process.stdout.write(
          chalk.green('✓') + ' Password saved to Windows Credential Manager.\n',
        );
      }

      await store.upsertTenant(profile);
      process.stdout.write(chalk.green('✓') + ` Tenant "${displayName}" saved.\n`);
    });

  tenants
    .command('remove')
    .description('Remove a tenant configuration')
    .argument('<name-or-id>', 'Tenant display name or ID')
    .action(async (nameOrId: string) => {
      const parent = tenants.parent!;
      const globalOpts = parent.opts<{ configDir?: string }>();
      const store = new ConfigStore(globalOpts.configDir);
      const tenant = await store.getTenant(nameOrId);
      if (!tenant) {
        process.stderr.write(`Tenant "${nameOrId}" not found.\n`);
        process.exit(EXIT.CONFIG_INVALID);
      }
      await store.removeTenant(tenant.tenantId);
      process.stdout.write(
        chalk.green('✓') + ` Tenant "${tenant.displayName}" removed.\n`,
      );
    });

  tenants
    .command('validate')
    .description('Validate that a tenant can authenticate and reach Microsoft Graph')
    .action(async () => {
      try {
        const globalOpts = tenants.parent!.opts<GlobalOptions>();
        const ctx = await buildContext(globalOpts);

        // Progress to stderr only — stdout must remain clean for JSON consumers
        process.stderr.write(chalk.dim(`Validating tenant ${ctx.tenantId}...\n`));

        const result = await ctx.preflightService.run({
          tenantId: ctx.tenantId,
          environmentName: ctx.environmentName,
          authMode: ctx.authMode,
        });

        if (result.authValid && result.graphReachable) {
          process.stdout.write(
            chalk.green('✓') +
              ` Tenant "${globalOpts.tenant}" is valid.\n` +
              `  Auth: OK  |  Graph: reachable\n`,
          );
          if (result.missingPermissions.length > 0) {
            process.stdout.write(
              chalk.yellow('  Warnings:\n') +
                result.missingPermissions.map((p) => `    • ${p}`).join('\n') +
                '\n',
            );
          }
        } else {
          process.stderr.write(chalk.red('✗') + ' Validation failed.\n');
          for (const e of result.errors) {
            process.stderr.write(`  ${e}\n`);
          }
          process.exit(EXIT.AUTH_FAILED);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
