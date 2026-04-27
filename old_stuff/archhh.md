# Layered Architecture

## I-A. Justification Based on Component Granularity

Our project follows a **Layered Architecture** because it is structured into clearly separated layers with well-defined responsibilities.

---

## 1. Presentation Layer
- Dashboard / User Interface  
- Displays logs, alerts, incident reports  
- Allows users/admins to view system output  

---

## 2. Application / Service Layer
- Log Analyzer  
- Incident Detector  
- Severity Classifier  
- Incident Response Handler  
- Controls overall system workflow  

---

## 3. Business Logic Layer
- Rule Engine (detect anomalies)  
- Pattern Matching  
- Classification Logic  
- Decision-making for automated response  

---

## 4. Data Layer
- Log Storage (sample logs)  
- Incident Database  
- Report Storage  
- File Handling Modules  

---

# Architectural Justification

- Each layer has specific responsibilities  
- Higher layers depend only on lower layers  
- No direct interaction between Presentation and Data layers  
- Components are grouped logically by abstraction level  
- Small modules (Log Parser, Detector, Responder)  
- Proper separation of concerns is maintained  

---

# I-B. Why Layered Architecture is Best for This Project

## 1. Scalability
- New detection algorithms can be added in the Business Layer  
- Database can be upgraded independently  
- UI can be enhanced without modifying core logic  

---

## 2. Maintainability
- Each layer is independent  
- Bugs in log analysis won’t affect the UI layer  
- Easy to debug and update individual modules  

---

## 3. Performance
- Log processing optimized at the Business Layer  
- Efficient data access at the Data Layer  
- Clear separation avoids unnecessary overhead  

---

## 4. Modularity
- Log Parser, Incident Detector, and Response Engine are independent modules  
- Easy to add new detection modules in the future  

---

## 5. Reusability
- Log Analyzer module can be reused in other monitoring systems  
- Response Engine can be integrated into other security systems  
