cd "c:\Users\jadon\OneDrive\Desktop\sem_6\Automated-Log-Analysis-and-Incident-Response-System-main\incident-response-app"
npm.cmd install
npm.cmd start

# Optional: run with generated logs folder
# npm.cmd start -- --log-dir="./generated_logs"

# Optional: auto demo (no manual menu typing)
# npm.cmd start -- --script=1,2,3,4,INC-2,5,6

# Optional: batch mode + report view
# npm.cmd start -- --batch --log-dir="./generated_logs"
# Get-Content output/latest-report.json

# Optional: tests
# npm.cmd test -- --runInBand
