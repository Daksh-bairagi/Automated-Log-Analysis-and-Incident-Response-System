public class LogParser {

    public static LogEntry parseLogLine(String logLine) {

        // Split log line by space
        String[] parts = logLine.split(" ", 5);

        // Extract fields
        String timestamp = parts[0] + " " + parts[1];
        String level = parts[2];
        String source = parts[3];
        String message = parts[4];

        return new LogEntry(timestamp, level, source, message);
    }
}
