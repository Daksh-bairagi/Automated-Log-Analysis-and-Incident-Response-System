const path = require('path');
const AnalysisEngine = require('./src/services/analysis/AnalysisEngine');

async function testLogs() {
  const engine = new AnalysisEngine();
  
  const filesToTest = [
    path.join(__dirname, '../OpenSSH_2k.log'),
    path.join(__dirname, '../Apache_2k.log')
  ];

  console.log("Analyzing logs...");
  
  try {
    const result = await engine.analyzeLogs(filesToTest);
    
    console.log("\n=== ANALYSIS RESULT ===");
    console.log("Total Entries Processed:", result.entries.length);
    console.log("Total Parse Errors:", result.parseErrors.length);
    console.log("Total Incidents Detected:", result.incidents.length);
    
    console.log("\n=== SEVERITY BREAKDOWN ===");
    // Count severities manually if the report doesn't have it built-in immediately
    const breakdown = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const entry of result.entries) {
      breakdown[entry.severity] = (breakdown[entry.severity] || 0) + 1;
    }
    console.table(breakdown);

    console.log("\n=== TOP 5 INCIDENTS ===");
    result.incidents.slice(0, 5).forEach((inc, idx) => {
        console.log(`[${idx+1}] [${inc.severity}] ${inc.type} - ${inc.reason}`);
    });

    console.log("\nDone!");
  } catch (error) {
    console.error("Analysis Failed:", error);
  }
}

testLogs();
