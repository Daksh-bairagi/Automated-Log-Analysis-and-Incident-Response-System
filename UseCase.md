<img width="1316" height="888" alt="use case diagram" src="https://github.com/user-attachments/assets/efe71459-1a87-400e-932d-434ae2c0b377" />

## 2. Actors

### 2.1 Human Actors

- **Security Analyst**  
  Responsible for analyzing incidents, viewing reports, classifying incidents, and configuring detection rules.

- **System Administrator**  
  Manages system configuration, user access, detection rules, and monitors system status.

- **DevOps Engineer**  
  Monitors system performance, responds to alerts, and oversees automated incident responses.

---

### 2.2 External System Actors

- **Application Servers**  
  Provide application-level logs to the system.

- **System Servers**  
  Provide operating system and infrastructure logs.

- **Machine Learning Engine**  
  Assists in anomaly detection and incident classification.

- **Alert Notification System**  
  Sends alerts through email, SMS, or messaging platforms.


# AI Automation and Incident Response System  
## Use Case Description

---
## 3. Use Cases

### 3.1 Collect Logs
The system collects logs from application servers and system servers for further analysis.

**Actors:** Application Servers, System Servers  
**Includes:** Preprocess Logs

---

### 3.2 Preprocess Logs
The system cleans, normalizes, and formats raw logs to make them suitable for analysis.

**Actors:** System  
**Included by:** Collect Logs

---

### 3.3 Analyze Logs
The system analyzes preprocessed logs to identify suspicious patterns or abnormal behavior.

**Actors:** Security Analyst  
**Includes:** Detect Anomalies

---

### 3.4 Detect Anomalies
The system detects anomalies using predefined rules and machine learning models.

**Actors:** Machine Learning Engine  
**Included by:** Analyze Logs

---

### 3.5 Classify Incidents
Detected anomalies are classified into different incident types based on severity and impact.

**Actors:** Security Analyst  
**Includes:** Generate Alerts

---

### 3.6 Generate Alerts
The system generates alerts and notifies concerned users about detected incidents.

**Actors:** Alert Notification System  
**Included by:** Classify Incidents  
**Extended by:** Execute Auto Response

---

### 3.7 Execute Auto Response
The system automatically executes predefined actions such as blocking IPs or restarting services when critical incidents are detected.

**Actors:** System  
**Extends:** Generate Alerts  
**Condition:** Auto-response enabled

---

### 3.8 View Incident Reports
Users can view detailed incident reports and historical data for analysis and auditing.

**Actors:** Security Analyst, System Administrator

---

### 3.9 Configure Detection Rules
Allows administrators to configure detection rules, thresholds, and machine learning parameters.

**Actors:** Security Analyst, System Administrator

---

### 3.10 Monitor System Status
Users can monitor system health, performance, and operational status.

**Actors:** System Administrator, DevOps Engineer

---

### 3.11 Manage User Access
Allows administrators to manage user roles, permissions, and access control.

**Actors:** System Administrator

---

## 4. Use Case Relationships

- **Include Relationships:**
  - Collect Logs → Preprocess Logs  
  - Analyze Logs → Detect Anomalies  
  - Classify Incidents → Generate Alerts  

- **Extend Relationship:**
  - Generate Alerts → Execute Auto Response (only when auto-response is enabled)

---

## 5. Conclusion

This use case model represents the functional behavior of the AI Automation and Incident Response System. It clearly defines system interactions, responsibilities of actors, and relationships between use cases using UML standards.

