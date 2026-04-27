/**
 * ============================================================================
 * COMMAND LINE UI — Interactive CLI Interface
 * ============================================================================
 * Provides a menu-driven terminal interface for the log analysis system.
 * Users can run analysis, view results, inspect individual incidents,
 * and save reports — all without needing a web browser.
 *
 * MENU OPTIONS:
 *   1. Run Analysis      — Execute the full analysis pipeline on resolved files
 *   2. View Summary      — Display high-level report summary
 *   3. List Incidents    — Show tabular list of all detected incidents
 *   4. Incident Details  — Deep-dive into a specific incident by ID
 *   5. Save Report       — Persist the report to disk/database
 *   6. Exit              — Close the session
 *
 * FLOW (see roadmap §4.3):
 *   runCli.js → new CommandLineUI({ orchestrator, filePaths })
 *            → showMenu() loop → user selections → orchestrator calls
 *
 * USAGE:
 *   const cli = new CommandLineUI({ orchestrator, filePaths, config });
 *   await cli.start();
 * ============================================================================
 */

const readline = require('readline');

class CommandLineUI {
  /**
   * @param {Object} options
   * @param {import('../services/IncidentOrchestrator')} options.orchestrator - Orchestrator instance
   * @param {string[]} options.filePaths - Resolved log file paths
   * @param {Object} [options.config] - Application configuration
   */
  constructor({ orchestrator, filePaths, config = {} }) {
    this.orchestrator = orchestrator;
    this.filePaths = filePaths;
    this.config = config;
    this.lastRun = null; // Stores the most recent analysis result

    // Create readline interface for user input
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Starts the interactive CLI session. Displays the welcome banner
   * and enters the menu loop.
   */
  async start() {
    this._printBanner();
    console.log(`\n  📂 ${this.filePaths.length} log file(s) resolved for analysis.\n`);
    await this._menuLoop();
  }

  /**
   * Prints the application welcome banner to the terminal.
   * @private
   */
  _printBanner() {
    console.log('\n' + '='.repeat(65));
    console.log('  🔍  AUTOMATED LOG ANALYSIS & INCIDENT RESPONSE SYSTEM');
    console.log('  ─────────────────────────────────────────────────────');
    console.log('  Interactive Command-Line Interface');
    console.log('='.repeat(65));
  }

  /**
   * Main menu loop. Displays options and processes user selections
   * until the user chooses to exit.
   * @private
   */
  async _menuLoop() {
    let running = true;

    while (running) {
      this._printMenu();
      const choice = await this._prompt('  Select option (1-6): ');

      switch (choice.trim()) {
        case '1':
          await this._runAnalysis();
          break;
        case '2':
          this._viewSummary();
          break;
        case '3':
          this._listIncidents();
          break;
        case '4':
          await this._incidentDetails();
          break;
        case '5':
          await this._saveReport();
          break;
        case '6':
          running = false;
          console.log('\n  👋 Session closed. Goodbye!\n');
          break;
        default:
          console.log('\n  ⚠️  Invalid option. Please select 1-6.\n');
      }
    }

    this.rl.close();
  }

  /**
   * Prints the menu options to the terminal.
   * @private
   */
  _printMenu() {
    console.log('\n  ┌─────────────────────────────────┐');
    console.log('  │         MAIN MENU                │');
    console.log('  ├─────────────────────────────────┤');
    console.log('  │  1. Run Analysis                 │');
    console.log('  │  2. View Summary                 │');
    console.log('  │  3. List Incidents               │');
    console.log('  │  4. Incident Details              │');
    console.log('  │  5. Save Report                  │');
    console.log('  │  6. Exit                         │');
    console.log('  └─────────────────────────────────┘');
  }

  /**
   * Option 1: Runs the full analysis pipeline on resolved log files.
   * @private
   */
  async _runAnalysis() {
    console.log('\n  ⏳ Running analysis on', this.filePaths.length, 'file(s)...\n');

    try {
      this.lastRun = await this.orchestrator.analyze(this.filePaths, { persistReport: false });
      const { report } = this.lastRun;

      console.log('  ✅ Analysis Complete!');
      console.log(`     📊 Entries Processed:  ${report.processedEntries}`);
      console.log(`     🚨 Incidents Detected: ${report.detectedIncidents}`);
      console.log(`     ⚠️  Parse Errors:       ${report.parseErrors}`);
      console.log(`     🔴 HIGH:   ${report.severityBreakdown.HIGH}`);
      console.log(`     🟡 MEDIUM: ${report.severityBreakdown.MEDIUM}`);
      console.log(`     🟢 LOW:    ${report.severityBreakdown.LOW}`);
    } catch (error) {
      console.error(`\n  ❌ Analysis failed: ${error.message}\n`);
    }
  }

  /**
   * Option 2: Displays the summary of the last analysis run.
   * @private
   */
  _viewSummary() {
    if (!this.lastRun) {
      console.log('\n  ⚠️  No analysis run yet. Select option 1 first.\n');
      return;
    }

    const { report } = this.lastRun;
    console.log('\n  ╔═══════════════════════════════════════╗');
    console.log('  ║        ANALYSIS SUMMARY                ║');
    console.log('  ╠═══════════════════════════════════════╣');
    console.log(`  ║  Generated:    ${report.generatedAt}`);
    console.log(`  ║  Entries:      ${report.processedEntries}`);
    console.log(`  ║  Incidents:    ${report.detectedIncidents}`);
    console.log(`  ║  Parse Errors: ${report.parseErrors}`);
    console.log('  ║  Severity Breakdown:');
    console.log(`  ║    🔴 HIGH:   ${report.severityBreakdown.HIGH}`);
    console.log(`  ║    🟡 MEDIUM: ${report.severityBreakdown.MEDIUM}`);
    console.log(`  ║    🟢 LOW:    ${report.severityBreakdown.LOW}`);
    console.log('  ║  Files Analyzed:');
    for (const file of report.logFiles) {
      console.log(`  ║    📄 ${file}`);
    }
    console.log('  ╚═══════════════════════════════════════╝\n');
  }

  /**
   * Option 3: Lists all detected incidents in a table format.
   * @private
   */
  _listIncidents() {
    if (!this.lastRun || this.lastRun.incidents.length === 0) {
      console.log('\n  ⚠️  No incidents to display. Run analysis first.\n');
      return;
    }

    const { incidents } = this.lastRun;
    console.log('\n  ┌────────────┬──────────┬────────────────┬───────────────────────────────────┐');
    console.log('  │ ID         │ Severity │ Source         │ Message (truncated)               │');
    console.log('  ├────────────┼──────────┼────────────────┼───────────────────────────────────┤');

    for (const inc of incidents) {
      const id = inc.id.padEnd(10);
      const sev = inc.severity.padEnd(8);
      const src = (inc.source || '').substring(0, 14).padEnd(14);
      const msg = (inc.message || '').substring(0, 33).padEnd(33);
      console.log(`  │ ${id} │ ${sev} │ ${src} │ ${msg} │`);
    }

    console.log('  └────────────┴──────────┴────────────────┴───────────────────────────────────┘');
    console.log(`\n  Total: ${incidents.length} incident(s)\n`);
  }

  /**
   * Option 4: Shows detailed information about a specific incident.
   * @private
   */
  async _incidentDetails() {
    if (!this.lastRun || this.lastRun.incidents.length === 0) {
      console.log('\n  ⚠️  No incidents available. Run analysis first.\n');
      return;
    }

    const id = await this._prompt('  Enter Incident ID (e.g., INC-001): ');
    const incident = this.lastRun.incidents.find(
      (inc) => inc.id.toLowerCase() === id.trim().toLowerCase()
    );

    if (!incident) {
      console.log(`\n  ❌ Incident "${id.trim()}" not found.\n`);
      return;
    }

    console.log('\n  ╔═══════════════════════════════════════════════════╗');
    console.log(`  ║  INCIDENT: ${incident.id}`);
    console.log('  ╠═══════════════════════════════════════════════════╣');
    console.log(`  ║  Severity:  ${incident.severity}`);
    console.log(`  ║  Source:    ${incident.source}`);
    console.log(`  ║  Timestamp: ${incident.timestamp}`);
    console.log(`  ║  Status:    ${incident.status}`);
    console.log(`  ║  Message:   ${incident.message}`);
    console.log(`  ║  Playbook:  ${incident.playbook}`);
    console.log('  ║  Actions:');
    for (const action of incident.actions) {
      console.log(`  ║    → ${action}`);
    }
    console.log('  ╚═══════════════════════════════════════════════════╝\n');
  }

  /**
   * Option 5: Saves the current report to disk or database.
   * @private
   */
  async _saveReport() {
    if (!this.lastRun) {
      console.log('\n  ⚠️  No report to save. Run analysis first.\n');
      return;
    }

    try {
      const result = await this.orchestrator.saveReport(this.lastRun.report, {
        entries: this.lastRun.entries,
        incidents: this.lastRun.incidents,
      });
      console.log(`\n  ✅ Report saved successfully!`);
      if (result.reportPath) {
        console.log(`     📁 Path: ${result.reportPath}`);
      }
      if (result.reportId) {
        console.log(`     🔑 ID:   ${result.reportId}`);
      }
    } catch (error) {
      console.error(`\n  ❌ Failed to save report: ${error.message}\n`);
    }
  }

  /**
   * Prompts the user for input and returns the response.
   *
   * @param {string} question - The prompt text to display
   * @returns {Promise<string>} User's input
   * @private
   */
  _prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }
}

module.exports = CommandLineUI;
