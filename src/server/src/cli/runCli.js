/**
 * ============================================================================
 * CLI RUNNER — Entry Point for Command-Line Interface
 * ============================================================================
 * Bootstraps the CLI application by:
 *   1. Loading configuration from env.js
 *   2. Resolving log file paths via LogSourceResolver
 *   3. Instantiating the IncidentOrchestrator
 *   4. Launching either interactive mode (CommandLineUI) or batch mode
 *
 * MODES:
 *   Interactive: npm run start:cli
 *     → Launches the menu-driven CommandLineUI
 *
 *   Batch:       npm run start:batch   (or node runCli.js --batch)
 *     → Auto-runs analysis, prints results, and exits
 *
 * FLOW (see roadmap §4.3):
 *   runCli.js → resolveConfig → resolveFiles → createOrchestrator
 *            → interactive? → CommandLineUI.start()
 *            → batch?       → orchestrator.analyze() → print → exit
 * ============================================================================
 */

const config = require('../config/env');
const LogSourceResolver = require('../services/ingestion/LogSourceResolver');
const IncidentOrchestrator = require('../services/IncidentOrchestrator');
const FileIncidentRepository = require('../models/FileIncidentRepository');
const CommandLineUI = require('../utils/CommandLineUI');

/**
 * Main CLI entry point. Parses command-line arguments and launches
 * the appropriate mode.
 */
async function main() {
  try {
    // ---- Step 1: Parse CLI arguments ----
    const args = process.argv.slice(2);
    const isBatchMode = args.includes('--batch');
    const scriptFileIndex = args.findIndex((a) => a.startsWith('--script='));
    const scriptFile = scriptFileIndex >= 0
      ? args[scriptFileIndex].split('=')[1]
      : null;

    // ---- Step 2: Resolve log file paths ----
    const resolver = new LogSourceResolver(config);
    const resolveOptions = {};

    if (scriptFile) {
      resolveOptions.logFiles = [scriptFile];
    }

    const filePaths = resolver.resolve(resolveOptions);

    // ---- Step 3: Create the orchestrator with file-based repository ----
    const repository = new FileIncidentRepository(config);
    const orchestrator = new IncidentOrchestrator({ repository });

    // ---- Step 4: Launch appropriate mode ----
    if (isBatchMode) {
      await runBatchMode(orchestrator, filePaths);
    } else {
      await runInteractiveMode(orchestrator, filePaths, config);
    }
  } catch (error) {
    console.error(`\n  ❌ CLI Error: ${error.message}\n`);
    process.exit(1);
  }
}

/**
 * Batch mode: runs analysis, prints results, and exits immediately.
 *
 * @param {IncidentOrchestrator} orchestrator
 * @param {string[]} filePaths
 */
async function runBatchMode(orchestrator, filePaths) {
  console.log('\n  🔄 Running batch analysis...\n');

  const result = await orchestrator.analyze(filePaths, { persistReport: true });
  const { report } = result;

  console.log('  ═══════════════════════════════════════');
  console.log('  BATCH ANALYSIS RESULTS');
  console.log('  ═══════════════════════════════════════');
  console.log(`  Generated:    ${report.generatedAt}`);
  console.log(`  Entries:      ${report.processedEntries}`);
  console.log(`  Incidents:    ${report.detectedIncidents}`);
  console.log(`  Parse Errors: ${report.parseErrors}`);
  console.log(`  HIGH:   ${report.severityBreakdown.HIGH}`);
  console.log(`  MEDIUM: ${report.severityBreakdown.MEDIUM}`);
  console.log(`  LOW:    ${report.severityBreakdown.LOW}`);
  console.log('  ═══════════════════════════════════════\n');

  // Print each incident
  if (result.incidents.length > 0) {
    console.log('  DETECTED INCIDENTS:');
    for (const inc of result.incidents) {
      console.log(`    [${inc.id}] ${inc.severity} — ${inc.source}: ${inc.message}`);
      console.log(`           Playbook: ${inc.playbook}`);
    }
  }

  if (result.reportPath) {
    console.log(`\n  📁 Report saved to: ${result.reportPath}`);
  }

  console.log('\n  ✅ Batch analysis complete.\n');
}

/**
 * Interactive mode: launches the menu-driven CommandLineUI.
 *
 * @param {IncidentOrchestrator} orchestrator
 * @param {string[]} filePaths
 * @param {Object} config
 */
async function runInteractiveMode(orchestrator, filePaths, config) {
  const cli = new CommandLineUI({ orchestrator, filePaths, config });
  await cli.start();
}

// Execute the CLI
main();
