import { loadConfig, findProjectRoot, logger, LogLevel } from '../../../index.js';
import { runDoctorChecks } from '../../../doctor/index.js';
import { formatDoctorReport } from '../../ui/format.js';

export async function doctorCommand(options: { verbose?: boolean; json?: boolean }): Promise<void> {
  if (options.verbose) {
    logger.setLevel(LogLevel.DEBUG);
  }

  // Try loading config (non-fatal — doctor should work without valid config)
  let config = null;
  try {
    config = await loadConfig();
  } catch {
    logger.debug('Could not load config — running doctor without config-dependent checks.');
  }

  const projectRoot = findProjectRoot();
  const report = await runDoctorChecks(projectRoot, config);

  if (options.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(formatDoctorReport(report));
  }

  // Exit with non-zero if there are errors
  if (report.errorCount > 0) {
    process.exit(1);
  }
}
