# Data Flow Diagram (DFD) – Automated Log Analysis and Incident Response System

## Level 0 DFD (Context Diagram)

The Level 0 DFD, also known as the Context Diagram, represents the Automated Log
Analysis and Incident Response System as a single process. It shows the
interaction between the system and external entities without revealing internal
processing details.

### External Entities
- **Application Servers**: Provide raw application logs to the system.
- **System Servers**: Provide system-level logs.
- **Security Analyst**: Sends analysis requests and receives reports and alerts.
- **System Administrator**: Manages configurations and receives system status.
- **DevOps Engineer**: Monitors system status and performance metrics.
- **Alert Notification System**: Receives alert notifications from the system.
- **Machine Learning Engine**: Provides detection rules and insights to improve
  anomaly detection.

### Data Flow
- Raw logs are sent from application and system servers to the system.
- The system sends alerts and reports to security analysts and administrators.
- Configuration updates and monitoring requests are exchanged with administrators
  and DevOps engineers.
- Detection rules and insights are exchanged with the machine learning engine.

---

## Level 1 DFD

The Level 1 DFD decomposes the main system into detailed processes and data
stores, showing how log data flows internally.

### Processes
1. **Collect Logs (1.0)**  
   Collects raw application and system logs from external servers.

2. **Preprocess Logs (2.0)**  
   Cleans and formats raw logs before further analysis.

3. **Analyze Logs (3.0)**  
   Performs analysis on processed logs to identify patterns and issues.

4. **Detect Anomalies (4.0)**  
   Detects abnormal behavior using predefined detection rules.

5. **Classify Incidents (5.0)**  
   Classifies detected anomalies into incidents based on severity.

6. **Generate Alerts (6.0)**  
   Generates alerts for classified incidents and forwards them to the alert
   notification system.

7. **View Reports (7.0)**  
   Allows security analysts to view analysis results and incident reports.

8. **Configure Rules (8.0)**  
   Enables system administrators to update detection rules.

9. **Manage Users (9.0)**  
   Manages user access and permissions.

10. **Monitor System Status (10.0)**  
    Provides system health and performance metrics to DevOps engineers.

11. **Execute Auto Response (11.0)**  
    Executes automated response actions for critical incidents.

---

### Data Stores
- **D1: Raw Logs DB** – Stores collected raw logs.
- **D2: Processed Logs DB** – Stores cleaned and processed logs.
- **D3: Incidents DB** – Stores classified incident data.
- **D4: Detection Rules DB** – Stores detection and analysis rules.
- **D5: User Access DB** – Stores user credentials and access information.
- **D6: System Status Metrics DB** – Stores system performance metrics.

---

## Conclusion
The Level DFD provides a detailed view of internal processes and data stores
involved in log analysis and incident response. Together, the Level 0 and Level 1
DFDs clearly explain how data flows from log sources to analysis, incident
detection, alert generation, and automated response, ensuring a structured and
scalable system design.
