const fs = require('fs');
const path = require('path');

// Target the log file that your application is already watching
const LOG_FILE = path.join(__dirname, '../logs/application.log');

// Realistic components and messages to simulate a live production application
const COMPONENTS = ['auth_service', 'payment_gateway', 'database_cluster', 'api_edge', 'nginx'];
const INFO_MESSAGES = [
  'User login successful', 'Payment processed', 'API request handled in 45ms', 
  'Cache refreshed', 'Database heartbeat OK', 'Session token validated'
];
const WARNING_MESSAGES = [
  'High latency detected routing request', 'Memory usage nearing 85%', 
  'API rate limit warning for user', 'Slow query execution detected'
];
const ERROR_MESSAGES = [
  'CRITICAL: Database connection lost', 'Unauthorized access attempt detected', 
  'Payment gateway timeout connecting to upstream', 'Out of memory exception'
];

// Helper to generate a random IP
const randomIP = () => `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.1.${Math.floor(Math.random() * 255)}`;

function generateLogLine() {
  const timestamp = new Date().toISOString();
  const component = COMPONENTS[Math.floor(Math.random() * COMPONENTS.length)];
  const ip = randomIP();
  
  // Weights: 70% INFO, 20% WARNING, 10% ERROR
  const roll = Math.random();
  let level, msg;

  if (roll < 0.7) {
    level = 'INFO';
    msg = INFO_MESSAGES[Math.floor(Math.random() * INFO_MESSAGES.length)];
  } else if (roll < 0.9) {
    level = 'WARN';
    msg = WARNING_MESSAGES[Math.floor(Math.random() * WARNING_MESSAGES.length)];
  } else {
    level = 'ERROR';
    msg = ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)];
  }

  // Format matches your analyzer's expected pattern
  return `${timestamp} ${level} ${component} ${msg} (IP: ${ip})\n`;
}

console.log('🚀 Starting continuous Live Traffic Simulator...');
console.log(`📂 Appending data to: ${LOG_FILE}\n`);
console.log('Press Ctrl+C to stop.\n');

// Stream data continuously every 300ms to 1200ms
function runStream() {
  const logLine = generateLogLine();
  
  // Append to the file (this triggers your fs.watch immediately!)
  fs.appendFile(LOG_FILE, logLine, (err) => {
    if (err) console.error('Failed to write log:', err);
  });

  // Print to console just so you can see what it's generating
  process.stdout.write(logLine);

  // Randomize the delay to make the traffic feel realistic
  const delay = Math.floor(Math.random() * 900) + 300; 
  setTimeout(runStream, delay);
}

// Start the stream
runStream();
