#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { registerAppsCommand } from './commands/apps.js';
import { registerPreflightCommand } from './commands/preflight.js';
import { registerSecretsCommand } from './commands/secrets.js';
import { registerTenantsCommand } from './commands/tenants.js';
import { registerUsageCommand } from './commands/usage.js';
import { registerReportCommand } from './commands/report.js';

const program = new Command();

program
  .name('aarm')
  .description('Azure App Registration Monitor — inspect and track Entra client secrets')
  .version('0.1.0', '-V, --version', 'Print version')
  .option('--tenant <name-or-id>', 'Tenant display name or ID from local config')
  .option('--environment <name>', 'Environment name (for future use)')
  .option('--config-dir <path>', 'Override default config directory (~/.aarm)')
  .option('--output <format>', 'Output format: table, json', 'table')
  .option('--verbose', 'Enable verbose output', false)
  .option('--no-color', 'Disable color output')
  // Show help when aarm is called with no arguments
  .action(() => program.help());

// Enable `aarm help [command]` in addition to `aarm [command] --help`
program.addHelpCommand('help [command]', 'Display help for a command');

program.hook('preAction', (_thisCommand, actionCommand) => {
  const { color } = program.opts<{ color: boolean }>();
  if (!color) chalk.level = 0;
  if (actionCommand === program) return; // avoid recursion from the .action above
});

registerTenantsCommand(program);
registerAppsCommand(program);
registerSecretsCommand(program);
registerPreflightCommand(program);
registerUsageCommand(program);
registerReportCommand(program);

program.parse(process.argv);
