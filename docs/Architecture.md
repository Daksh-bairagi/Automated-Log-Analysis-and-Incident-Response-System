# "Layered Architecture"

## I-A. Justification Based on Component Granularity:
-> our project follows a 'Layered Architecture' because it is structured into clearly separated layers with well-defined responsibilities.
## Presentation Layer
-> Dashboard / User Interface
-> Displays logs, alerts, incident reports
-> Allows users/admins to view system output
## Application / Service Layer
-> Log Analyzer
-> Incident Detector
-> Severity Classifier
-> Incident Response Handler
-> Controls system workflow
## Business Logic Layer
-> Rule Engine (detect anomalies)
-> Pattern Matching
-> Classification logic
-> Decision-making for automated response
## Data Layer
-> Log storage (sample logs)
-> Incident database
-> Report storage
-> File handling modules

## Justification
-> each layer has specific responsibilities
-> Higher layers depend only on lower layers
-> No direct interaction between Presentation and Data Layers
-> Components are grouped logically by abstraction level

-> Small modules (Log Parser, Detector, Responder)
-> Grouped into logical layers
-> Separation of concerns maintained

## I-B. Why Layered Architecture is Best

1. Scalability
-> New detection algorithms can be added in Business Layer
-> Database can be upgraded independently
-> UI can be enhanced without changing core logic

2. Maintainability
-> Each layer is independent
-> Bugs in log analysis won’t affect UI layer
-> Easy to debug and update individual modules

3. Performance
-> Log processing optimized at business layer
-> Efficient data access at data layer
-> Clear separation avoids unnecessary overhead

4. Modularity
-> Log Parser, Incident Detector, Response Engine are independent modules
-> Easy to add any other detection module later 

5. Reusability
-> Log Analyzer module can be reused in other monitoring systems
-> Response Engine can be integrated into other security systems
