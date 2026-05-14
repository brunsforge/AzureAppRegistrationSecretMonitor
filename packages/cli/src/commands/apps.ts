import { Command } from 'commander';
import {
  createResultEnvelope,
  envelopeToJson,
} from '@brunsforge/azure-app-registration-monitor';
import { buildContext, handleError } from '../shared/context.js';
import { printAppsTable, printJson } from '../output/formatters.js';

export function registerAppsCommand(program: Command): void {
  const apps = program
    .command('apps')
    .description('Query App Registrations')
    .action(() => apps.help()); // show help when no subcommand given

  apps
    .command('list')
    .description('List all App Registrations and their secret risk summary')
    .option('--include-owners', 'Resolve application owners (requires Directory.Read.All)')
    .action(async (cmdOpts: { includeOwners?: boolean }) => {
      try {
        const ctx = await buildContext(program.opts());
        const inventory = await ctx.inventoryService.getInventory({
          includeOwners: cmdOpts.includeOwners,
        });

        if (ctx.isJson) {
          const envelope = createResultEnvelope(inventory, ctx.tenantId);
          process.stdout.write(envelopeToJson(envelope) + '\n');
        } else {
          printAppsTable(inventory);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
