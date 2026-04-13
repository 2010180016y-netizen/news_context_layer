import { join } from 'node:path';

import { buildOperationalArtifactBundle, writeIssueReportArtifacts } from './lib/operational-assets.js';

async function main(): Promise<void> {
  const bundle = await buildOperationalArtifactBundle(join(process.cwd(), 'infra', 'exports'));
  await writeIssueReportArtifacts(bundle);

  console.log(
    JSON.stringify(
      {
        mode: 'sample_issue_report',
        issue_report_json: bundle.issue_report.export_paths.find((entry) => entry.format === 'json')?.path ?? null,
        issue_report_csv: bundle.issue_report.export_paths.find((entry) => entry.format === 'csv')?.path ?? null,
        daily_briefing_json: bundle.daily_briefing.export_paths[0]?.path ?? null,
        cluster_label: bundle.issue_report.cluster.label,
        article_count: bundle.issue_report.cluster.article_count
      },
      null,
      2
    )
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Sample issue report generation failed: ${message}`);
  process.exitCode = 1;
});
