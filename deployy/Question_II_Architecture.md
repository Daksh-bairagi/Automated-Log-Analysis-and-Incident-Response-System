# Question II: User Access & System Architecture

## How Users Access the System

### Access Flow

1. **Step 1:** User navigates to `https://log-analysis.example.com`
2. **Step 2:** CloudFront serves React frontend from S3
3. **Step 3:** User logs in (credentials sent to API via HTTPS)
4. **Step 4:** API validates credentials, returns JWT token
5. **Step 5:** Frontend stores JWT in memory (not localStorage for security)
6. **Step 6:** All subsequent API calls include JWT in Authorization header
7. **Step 7:** Real-time updates via WebSocket connection for alerts

---

## Component Interaction Details

| User Action | Frontend | Backend Flow | Response |
|-------------|----------|--------------|----------|
| **View Dashboard** | GET /api/dashboard | API → Redis (cache check) → PostgreSQL → Redis (cache set) | Dashboard metrics JSON |
| **Search Logs** | POST /api/logs/search | API → Elasticsearch → Return results | Paginated log entries |
| **Analyze Incident** | GET /api/incidents/:id | API → PostgreSQL → Return incident data | Incident details + related logs |
| **Configure Rules** | PUT /api/rules/:id | API → PostgreSQL → Kafka (rule-update topic) → ML Service | Updated rule confirmation |
| **Real-time Alerts** | WebSocket connection | Alert Generator → Kafka → API → WebSocket → Frontend | Push notification to UI |

---

## System Architecture Overview

The system follows a **microservices architecture** deployed on **AWS Cloud** with the following layers:

### 1. User Layer (Internet)
- **Security Analyst**: Views and analyzes incidents
- **System Administrator**: Configures rules and manages users
- **DevOps Engineer**: Monitors system status and performance

### 2. Frontend Layer (AWS CloudFront + S3)
- **React Dashboard**: Single-page application for user interface
- **CloudFront CDN**: Content delivery network for fast global access
- **S3 Static Hosting**: Hosts built React application files

### 3. API Gateway Layer
- **AWS API Gateway**: Handles rate limiting, CORS, and initial authentication
- **Application Load Balancer**: SSL/TLS termination and traffic distribution

### 4. Backend Services (AWS ECS Fargate - Private Subnet)

#### Node.js API Service
- Express + TypeScript
- Auto-scaling: 2-10 containers
- Handles REST API requests and WebSocket connections

#### Python ML Service
- FastAPI framework
- Anomaly detection using Scikit-learn
- Isolated compute for ML workloads

#### Log Processing Services
- **LogCollector**: Gathers logs from external sources
- **LogPreprocessor**: Cleans, normalizes, and enriches log data

#### Alert & Response
- **Alert Generator**: Creates alerts based on incidents
- **Auto Response Engine**: Executes automated responses
- **WebSocket Server**: Real-time push notifications

### 5. Data & Messaging Layer (AWS Managed Services)

#### Databases
- **PostgreSQL (AWS RDS)**: Stores incidents, users, configuration
- **Elasticsearch (OpenSearch)**: Log storage with full-text search
- **Redis (ElastiCache)**: Caching and session management

#### Message Queue
- **Apache Kafka (AWS MSK)**: Real-time log streaming
  - Topics: `raw-logs`, `processed-logs`, `anomalies`, `alerts`

#### Monitoring
- **Prometheus + Grafana**: Custom metrics and dashboards
- **CloudWatch**: AWS service logs and alarms

---

## Data Flow Explanation

### Complete Flow:

1. **User Request**: Browser → CloudFront CDN → React App
2. **API Call**: React → API Gateway (auth check) → ALB → Node.js API
3. **Log Collection**: External Sources → LogCollector → Kafka → LogPreprocessor → Elasticsearch
4. **Anomaly Detection**: LogPreprocessor → ML Service → Alert Generator
5. **Alert Delivery**: Alert Generator → Kafka → Node.js API → WebSocket → React Dashboard
6. **Data Persistence**: All services → PostgreSQL (incidents, users) + Elasticsearch (logs)
7. **Caching**: API → Redis (session data, frequent queries)

---

## Component Interaction Sequence

### Detailed Interaction Flow:

**① User Request**
- Frontend sends authenticated request to Node.js API
- Request includes JWT token in Authorization header

**② Log Collection**
- API triggers LogCollector to fetch logs from external sources
- LogCollector validates and buffers incoming logs

**③ Message Queue**
- LogCollector publishes raw logs to Kafka topic: `raw-logs`
- Kafka ensures reliable message delivery

**④ Consumption**
- LogPreprocessor consumes messages from Kafka
- Processes logs: cleaning, normalization, enrichment

**⑤ ML Analysis**
- Processed logs sent to ML Service for anomaly detection
- ML model returns anomaly scores and predictions

**⑥ Alert Creation**
- ML Service identifies anomalies
- AlertGenerator creates incident records
- Alerts published to Kafka topic: `alerts`

**⑦ Real-time Push**
- Node.js API consumes alert messages from Kafka
- Alerts pushed to frontend via WebSocket connection
- User receives real-time notification in dashboard

---

## Security Architecture

### Network Security
- All backend services in **private subnets** (no direct internet access)
- **Security Groups** control traffic between components
- **NAT Gateway** for outbound internet access
- **VPC Isolation** for complete network segregation

### Data Security
- **TLS 1.3** for all HTTPS connections
- **Encryption at rest** for RDS, S3, OpenSearch
- **JWT authentication** with 1-hour expiration
- **OAuth 2.0** for SSO integration

### Access Control
- **Role-Based Access Control (RBAC)**
  - Security Analyst: View and analyze
  - System Admin: Configure and manage
  - DevOps Engineer: Monitor only
- **AWS IAM roles** for service-to-service authentication

---

## Communication Protocols

### External Communication
- **HTTPS**: Frontend ↔ API Gateway
- **WebSocket (WSS)**: Real-time alerts to frontend

### Internal Communication
- **HTTP/REST**: Between microservices
- **gRPC**: Node.js API ↔ Python ML Service (high performance)
- **Kafka Protocol**: Message queue communication

---

## Scalability & High Availability

### Auto-Scaling
- **Frontend**: CloudFront global CDN (automatic)
- **API Services**: ECS auto-scaling (2-10 containers based on CPU/memory)
- **Databases**: RDS read replicas, OpenSearch multi-node cluster

### Load Balancing
- **Application Load Balancer**: Distributes traffic across containers
- **Kafka Partitions**: Parallel message processing
- **Redis Cluster Mode**: Distributed caching

### Fault Tolerance
- **Multi-AZ Deployment**: Services across multiple availability zones
- **Health Checks**: Automatic container replacement on failure
- **Data Replication**: RDS automated backups, Kafka replication factor 3

---

## Monitoring & Observability

### Metrics Collection
- **CloudWatch**: Container metrics, API latency, error rates
- **Prometheus**: Custom application metrics
- **Grafana**: Visualization dashboards

### Logging
- **Centralized Logging**: All logs flow through Kafka to Elasticsearch
- **Log Retention**: 30 days in hot storage, 90 days in cold storage
- **Kibana**: Log search and analysis interface

### Alerting
- **CloudWatch Alarms**: CPU, memory, disk usage thresholds
- **PagerDuty Integration**: Critical alerts to on-call engineers
- **Slack Notifications**: Non-critical system events

---

## Performance Optimization

### Caching Strategy
- **Redis**: Session data, frequent database queries
- **CloudFront**: Static assets (images, JS, CSS)
- **API Response Caching**: 5-minute TTL for dashboard metrics

### Database Optimization
- **PostgreSQL**: Indexed on frequently queried columns
- **Elasticsearch**: Optimized index settings for log data
- **Read Replicas**: Offload read traffic from primary database

### Network Optimization
- **CDN**: Static content served from edge locations
- **Connection Pooling**: Reuse database connections
- **Compression**: GZIP for API responses

---

## Disaster Recovery

### Backup Strategy
- **RDS**: Automated daily backups (7-day retention)
- **PostgreSQL**: Point-in-time recovery up to 5 minutes
- **Elasticsearch**: Automated snapshots to S3

### Recovery Procedures
- **RTO (Recovery Time Objective)**: < 1 hour
- **RPO (Recovery Point Objective)**: < 15 minutes
- **Failover**: Automatic for RDS, manual for application services

---

## Deployment Regions

### Primary Region
- **US-East-1 (N. Virginia)**: All production services

### Future Expansion
- **EU-West-1 (Ireland)**: European users (Phase 2)
- **AP-Southeast-1 (Singapore)**: Asian users (Phase 3)

---

## Cost Optimization

### Cost Management
- **Reserved Instances**: RDS and ElastiCache (40% savings)
- **Fargate Spot**: Non-critical background jobs (70% savings)
- **S3 Lifecycle Policies**: Move old logs to Glacier after 90 days
- **Auto-scaling**: Scale down during off-peak hours

### Estimated Monthly Cost (Production)
- **Compute (ECS)**: $300
- **Databases (RDS, OpenSearch, Redis)**: $500
- **Kafka (MSK)**: $250
- **Data Transfer**: $100
- **Monitoring & Logging**: $50
- **Total**: ~$1,200/month

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React + TypeScript | User interface |
| **CDN** | AWS CloudFront | Content delivery |
| **API Gateway** | AWS API Gateway | Rate limiting, CORS |
| **Load Balancer** | AWS ALB | Traffic distribution |
| **Backend API** | Node.js + Express | REST API server |
| **ML Service** | Python + FastAPI | Anomaly detection |
| **Message Queue** | Apache Kafka (MSK) | Event streaming |
| **Log Storage** | Elasticsearch | Full-text search |
| **Database** | PostgreSQL (RDS) | Structured data |
| **Cache** | Redis (ElastiCache) | Session & query cache |
| **Monitoring** | Prometheus + Grafana | Metrics & dashboards |
| **Container** | Docker + ECS Fargate | Containerization |
| **CI/CD** | GitHub Actions | Automated deployment |

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token

### Dashboard
- `GET /api/dashboard` - Dashboard metrics
- `GET /api/dashboard/stats` - System statistics

### Logs
- `POST /api/logs/search` - Search logs
- `GET /api/logs/:id` - Get log details
- `POST /api/logs/export` - Export logs to CSV

### Incidents
- `GET /api/incidents` - List incidents
- `GET /api/incidents/:id` - Get incident details
- `PUT /api/incidents/:id` - Update incident
- `POST /api/incidents/:id/resolve` - Resolve incident

### Rules
- `GET /api/rules` - List detection rules
- `POST /api/rules` - Create new rule
- `PUT /api/rules/:id` - Update rule
- `DELETE /api/rules/:id` - Delete rule

### Users
- `GET /api/users` - List users (admin only)
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin only)

### System
- `GET /api/system/health` - Health check
- `GET /api/system/metrics` - System metrics
- `GET /api/system/status` - Component status

---

## WebSocket Events

### Client → Server
- `subscribe:alerts` - Subscribe to real-time alerts
- `subscribe:logs` - Subscribe to log stream
- `unsubscribe:alerts` - Unsubscribe from alerts

### Server → Client
- `alert:new` - New alert created
- `alert:updated` - Alert status changed
- `log:new` - New log entry
- `system:status` - System status update

---

## Conclusion

The system architecture provides:

✅ **Scalability**: Auto-scaling across all layers
✅ **High Availability**: Multi-AZ deployment with automatic failover
✅ **Security**: End-to-end encryption, network isolation, RBAC
✅ **Performance**: Caching, CDN, optimized databases
✅ **Observability**: Comprehensive monitoring and logging
✅ **Cost-Effective**: Managed services reduce operational overhead
✅ **Production-Ready**: Industry-standard tools and best practices

The architecture supports **thousands of logs per second**, **real-time anomaly detection**, and **sub-second alert delivery** while maintaining **99.9% uptime**.
