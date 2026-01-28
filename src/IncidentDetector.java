public class IncidentDetector {

    public static boolean isIncident(LogEntry entry, String severity) {

        // High severity logs are always incidents
        if (severity.equalsIgnoreCase("HIGH")) {
            return true;
        }

        // Medium severity logs may be incidents based on keywords
        if (severity.equalsIgnoreCase("MEDIUM")) {
            String message = entry.getMessage().toLowerCase();

            if (message.contains("failed")
                    || message.contains("unauthorized")
                    || message.contains("suspicious")
                    || message.contains("multiple")) {
                return true;
            }
        }

        // Low severity logs are not incidents
        return false;
    }
}
