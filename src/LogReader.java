import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;

public class LogReader {

    public static void readLogFile(String filePath) {
        System.out.println("\nReading logs from: " + filePath);

        try (BufferedReader reader = new BufferedReader(new FileReader(filePath))) {
            String line;

            while ((line = reader.readLine()) != null) {
                System.out.println(line);
            }

        } catch (IOException e) {
            System.out.println("Error reading log file: " + filePath);
        }
    }

    public static void main(String[] args) {

        readLogFile("data/sample_logs/application.log");
        readLogFile("data/sample_logs/system.log");
        readLogFile("data/sample_logs/security.log");
    }
}
