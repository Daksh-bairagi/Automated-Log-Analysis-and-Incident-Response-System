public class LogEntry {

    private String timestamp;
    private String level;
    private String source;
    private String message;

    public LogEntry(String timestamp, String level, String source, String message) {
        this.timestamp = timestamp;
        this.level = level;
        this.source = source;
        this.message = message;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public String getLevel() {
        return level;
    }

    public String getSource() {
        return source;
    }

    public String getMessage() {
        return message;
    }

    @Override
    public String toString() {
        return "[" + timestamp + "] [" + level + "] [" + source + "] " + message;
    }
}
