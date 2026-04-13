import { join } from 'node:path';

import { buildOperationalArtifactBundle, writeStarterPackArtifacts } from './lib/operational-assets.js';

async function main(): Promise<void> {
  const bundle = await buildOperationalArtifactBundle(join(process.cwd(), 'infra', 'exports'));
  await writeStarterPackArtifacts(bundle);

  console.log(
    JSON.stringify(
      {
        mode: 'starter_pack_export',
        starter_pack_json: bundle.starter_pack.export_paths.find((entry) => entry.format === 'json')?.path ?? null,
        starter_pack_csv: bundle.starter_pack.export_paths.find((entry) => entry.format === 'csv')?.path ?? null,
        recurring_report_cycle_json: bundle.paths.recurring_report_cycle_json,
        recurring_report_cycle_status: bundle.recurring_report_cycle.status,
        issue_report_json: bundle.issue_report.export_paths.find((entry) => entry.format === 'json')?.path ?? null,
        daily_briefing_json: bundle.daily_briefing.export_paths[0]?.path ?? null,
        briefing_items: bundle.daily_briefing.items.length
      },
      null,
      2
    )
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Starter pack export failed: ${message}`);
  process.exitCode = 1;
});
