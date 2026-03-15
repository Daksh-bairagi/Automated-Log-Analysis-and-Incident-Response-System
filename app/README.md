# Incident Response App

This folder contains a separate MVP implementation for the Automated Log Analysis and Incident Response System.

## Features

- Reads log files from the existing sample log set
- Parses log lines into structured entries
- Classifies severity and detects incidents using simple rules
- Generates suggested response actions
- Saves a JSON report for later dashboard or API work
- Provides a menu-based command-line UI for user interactions

## Run Interactive UI

```bash
npm start
```

The app uses `../lab_5/javascript/data/sample_logs` by default and opens a menu interface:

- `1` Run log analysis
- `2` View summary
- `3` List incidents
- `4` View incident details by ID
- `5` Save latest report
- `6` Exit

## Dynamic Log Source Options

Use a custom directory (auto-loads all `.log` files from that folder):

```bash
npm start -- --log-dir=./generated_logs
```

Use specific files (relative to `--log-dir` if provided, otherwise absolute paths are also allowed):

```bash
npm start -- --log-dir=./generated_logs --log-files=application.log,security.log
```

## Run Non-interactive (Batch)

```bash
npm start -- --batch
```

This mode runs analysis once, saves `output/latest-report.json`, and prints a concise summary.

## Reproducible Interaction Demo

```bash
npm start -- --script=1,2,3,4,INC-2,5,6
```

This runs the menu interactions automatically in the listed order.

## Next development steps

- Add a REST API for incidents and reports
- Replace in-memory rules with configurable policies
- Store incidents in a real database
- Add tests for parser and detector behavior
