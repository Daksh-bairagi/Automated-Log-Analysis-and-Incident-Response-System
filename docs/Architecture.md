# "Layered Architecture"

## I-A. Justification Based on Component Granularity:
### -> our project follows a 'Layered Architecture' because it is structured into clearly separated layers with well-defined responsibilities.
## Presentation Layer
### -> Dashboard / User Interface
### -> Displays logs, alerts, incident reports
### -> Allows users/admins to view system output
## Application / Service Layer
### -> Log Analyzer
### -> Incident Detector
### -> Severity Classifier
### -> Incident Response Handler
### -> Controls system workflow
## Business Logic Layer
### -> Rule Engine (detect anomalies)
### -> Pattern Matching
### -> Classification logic
### -> Decision-making for automated response
## Data Layer
### -> Log storage (sample logs)
### -> Incident database
### -> Report storage
### -> File handling modules

## Justification
### -> each layer has specific responsibilities
### -> Higher layers depend only on lower layers
### -> No direct interaction between Presentation and Data Layers
### -> Components are grouped logically by abstraction level

### -> Small modules (Log Parser, Detector, Responder)
### -> Grouped into logical layers
### -> Separation of concerns maintained

## I-B. Why Layered Architecture is Best

### 1. Scalability
#### -> New detection algorithms can be added in Business Layer
#### -> Database can be upgraded independently
#### -> UI can be enhanced without changing core logic

### 2. Maintainability
#### -> Each layer is independent
#### -> Bugs in log analysis won’t affect UI layer
#### -> Easy to debug and update individual modules

### 3. Performance
#### -> Log processing optimized at business layer
#### -> Efficient data access at data layer
#### -> Clear separation avoids unnecessary overhead

### 4. Modularity
#### -> Log Parser, Incident Detector, Response Engine are independent modules
#### -> Easy to add any other detection module later 

### 5. Reusability
#### -> Log Analyzer module can be reused in other monitoring systems
#### -> Response Engine can be integrated into other security systems

## II. Components Present in the Project (Application Components):

### 1. Log Collector Module
#### -> Reads logs from files/system
#### -> Supports structured log input

### 2. Log Preprocessing Module
#### -> Cleans logs
#### -> Extracts important fields
#### -> Formats data

### 3. Log Analyzer Module
#### -> Analyzes patterns
#### -> Applies predefined rules

### 4. Incident Detection Module
#### -> Detects suspicious activity
#### -> Identifies anomalies

### 5. Severity Classification Module
#### -> Classifies incidents as:
#### Low
#### Medium
#### High

### 6. Incident Response Module
#### -> Triggers automated responses:
#### Alerts
#### Notifications
#### Possible system action

### 7. Database / Storage Module
#### -> Stores logs
#### -> Stores incident history
#### -> Maintains reports

### 8. Dashboard / Reporting Component
#### -> Displays incidents
#### -> Shows system summary
#### -> Provides monitoring interface

### 9. Configuration Module
#### -> Manages rules
#### -> Manages system parameters

### 10. Sample Log Data Module
#### -> Contains testing logs
#### -> Used for simulation and validation




