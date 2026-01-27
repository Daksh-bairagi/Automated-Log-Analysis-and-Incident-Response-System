public class SeverityClassifier {

    public static String classify(LogEntry entry) {

        String level = entry.getLevel();

        if (level.equalsIgnoreCase("ERROR")) {
            return "HIGH";
        } 
        else if (level.equalsIgnoreCase("WARNING")) {
            return "MEDIUM";
        } 
        else {
            return "LOW";
        }
    }
}
