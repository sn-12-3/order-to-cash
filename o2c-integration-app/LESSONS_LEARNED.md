# Lessons Learned - O2C Integration Setup

## Overview
This document captures critical pain points, challenges, and solutions encountered during the setup of the Order-to-Cash (O2C) integration system connecting IBM MQ, SAP (mock), and Kafka.

---

## 1. IBM MQ C Library Dependencies ⚠️ CRITICAL

### Problem
The `ibmmq` Node.js package requires native IBM MQ C libraries that are **not available on macOS**. Attempting to run the integration app directly with `node index.js` on macOS results in:
```
Error: Cannot find MQ C library
```

### Root Cause
- The `ibmmq` package is a native Node.js addon that wraps IBM MQ C client libraries
- These libraries are only available in Linux environments or through IBM MQ installation
- macOS does not have these libraries available via package managers

### Solution
Implemented multi-stage Docker build:
```dockerfile
FROM ibmcom/mq:latest as mq-builder
FROM node:18-alpine
COPY --from=mq-builder /opt/mqm /opt/mqm
ENV LD_LIBRARY_PATH=/opt/mqm/lib64:/opt/mqm/lib
```

### Key Takeaways
✅ **Always check native dependencies** before choosing libraries  
✅ **Docker is mandatory** for apps with platform-specific native dependencies  
✅ **Multi-stage builds** efficiently copy only required libraries  
✅ **Document architecture clearly** - users must understand app runs in Docker, not locally

---

## 2. IBM MQ Authorization (MQRC 2035) 🔐

### Problem
Persistent "NOT_AUTHORIZED" errors (MQRC 2035) even after setting queue permissions:
```
MQRC_NOT_AUTHORIZED (2035)
```

### Root Causes
1. **Empty password in docker-compose.yml**: `MQ_PASSWORD=` (no value)
2. **Missing channel-level authentication**: Channel MCAUSER not configured
3. **Permissions not refreshed**: Changes not applied without security refresh

### Solution
Three-part fix required:

**1. Set password in docker-compose.yml:**
```yaml
environment:
  - MQ_PASSWORD=passw0rd  # Must not be empty
```

**2. Configure channel authentication:**
```bash
ALTER CHANNEL(DEV.APP.SVRCONN) CHLTYPE(SVRCONN) MCAUSER('app')
```

**3. Refresh security:**
```bash
REFRESH SECURITY TYPE(CONNAUTH)
```

### Key Takeaways
✅ **MQ requires BOTH** queue permissions AND channel authentication  
✅ **Never leave passwords empty** - MQ treats empty as no authentication  
✅ **Always refresh security** after permission changes  
✅ **Test with runmqsc commands** before coding

---

## 3. Kafka Health Check Misconfiguration 🏥

### Problem
Kafka container perpetually marked as "unhealthy", blocking dependent containers from starting:
```
Health: starting → unhealthy (timeout)
```

### Root Cause
Health check tested port 9092, but Kafka was listening on port 9093:
```yaml
healthcheck:
  test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "kafka:9092"]
environment:
  KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9093  # Wrong port!
```

### Solution
Simplified to single listener on port 9092:
```yaml
environment:
  KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
  KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092
ports:
  - "9092:9092"
healthcheck:
  test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "kafka:9092"]
```

### Key Takeaways
✅ **Match health check ports** with actual listener configuration  
✅ **Start simple** - single listener before adding complexity  
✅ **Test health checks independently** before full stack deployment  
✅ **Use `docker-compose ps`** to verify health status

---

## 4. Docker Network DNS Resolution 🌐

### Problem
Kafka couldn't resolve `zookeeper:2181` hostname:
```
Unable to resolve address: zookeeper:2181
```

### Root Cause
After `docker-compose restart`, Kafka container was not properly attached to the Docker network, causing DNS resolution to fail.

### Solution
Complete stack restart with volume cleanup:
```bash
docker-compose down -v
docker-compose up -d
```

### Key Takeaways
✅ **Network issues require full stack restart**, not just container restart  
✅ **Use `docker-compose down -v`** to clean up networks and volumes  
✅ **Verify network attachment** with `docker network inspect`  
✅ **Check DNS resolution** with `docker exec <container> ping <hostname>`

---

## 5. Kafka Dual-Listener Complexity 🎛️

### Problem
Complex PLAINTEXT + INTERNAL listener setup caused connection issues and confusion:
```yaml
KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,INTERNAL://localhost:9093
KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,INTERNAL:PLAINTEXT
```

### Root Cause
- Unnecessary complexity for single-network Docker setup
- Multiple listeners increased configuration surface area for errors
- Harder to debug connection issues

### Solution
Simplified to single PLAINTEXT listener:
```yaml
KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092
```

### Key Takeaways
✅ **Start simple, add complexity only when needed**  
✅ **Single listener sufficient** for Docker internal communication  
✅ **Multiple listeners needed only** for external access scenarios  
✅ **Simpler configs = easier debugging**

---

## 6. Environment Variable Propagation 🔄

### Problem
Changed `MQ_PASSWORD` in docker-compose.yml, but container still used old (empty) value:
```yaml
# Changed this
- MQ_PASSWORD=passw0rd
# But container still had MQ_PASSWORD=
```

### Root Cause
`docker-compose restart` does **not** reload environment variables from docker-compose.yml. It only restarts the existing container with its original configuration.

### Solution
Force container recreation:
```bash
docker-compose up -d --force-recreate o2c-integration-app
```

Or full stack recreation:
```bash
docker-compose down
docker-compose up -d
```

### Key Takeaways
✅ **Env var changes require container recreation**, not just restart  
✅ **Use `--force-recreate`** to rebuild specific containers  
✅ **`docker-compose restart` preserves original config**  
✅ **Verify env vars** with `docker exec <container> env`

---

## 7. Queue Name Case Sensitivity 🔤

### Problem
Queue operations failed with "Queue not found" despite queue existing in MQ.

### Root Cause
IBM MQ queue names are **case-sensitive**:
- Created: `CUSTOMER_PURCHASE_ORDERS`
- Used in code: `customer_purchase_orders`

### Solution
Standardize on uppercase queue names throughout:
```javascript
const queueName = 'CUSTOMER_PURCHASE_ORDERS';  // Always uppercase
```

### Key Takeaways
✅ **IBM MQ queue names are case-sensitive**  
✅ **Standardize on uppercase** for consistency  
✅ **Verify queue names** with `DISPLAY QLOCAL(*)`  
✅ **Use constants** to avoid typos

---

## 8. MQ Web Console Authentication 🔐

### Problem
Web console login failed with correct credentials (admin/passw0rd).

### Root Cause
Password contained special characters that needed URL encoding in basicRegistry.xml:
```xml
<user name="admin" password="passw0rd"/>  <!-- '0' looks like 'O' -->
```

### Solution
Use container's default authentication:
- Remove custom basicRegistry.xml
- Use default credentials: admin/passw0rd
- Access: https://localhost:9443/ibmmq/console/

### Key Takeaways
✅ **Use container defaults** when possible  
✅ **Special characters in passwords** may need encoding  
✅ **Test web console access** early in setup  
✅ **Document actual credentials** clearly

---

## 9. Docker Compose Service Dependencies ⏱️

### Problem
Integration app started before Kafka was ready, causing connection failures.

### Root Cause
`depends_on` only waits for container to start, not for service to be ready:
```yaml
depends_on:
  - kafka  # Container started, but Kafka not ready
```

### Solution
Add health checks and condition:
```yaml
depends_on:
  kafka:
    condition: service_healthy
  ibmmq:
    condition: service_healthy
```

### Key Takeaways
✅ **Use health checks** for service readiness  
✅ **`depends_on` with `condition: service_healthy`** ensures proper startup order  
✅ **Test startup sequence** with `docker-compose up -d --force-recreate`  
✅ **Add retry logic** in application code as backup

## 10. IBM MQ REST API JAR File Issues 📦

### Problem
When attempting to use IBM MQ REST API, encountered issues with missing or incompatible JAR files for the REST API client.

### Root Causes
- IBM MQ REST API requires specific JAR files that aren't included in standard Node.js packages
- JAR file versions must match the MQ server version
- Complex classpath configuration needed
- Additional dependencies on Java runtime

### Initial Approach (Failed)
Attempted to use REST API with downloaded JAR files:
```bash
# Download MQ JAR files
curl -O https://repo1.maven.org/maven2/com/ibm/mq/com.ibm.mq.allclient/9.x.x/com.ibm.mq.allclient-9.x.x.jar
```

Issues encountered:
- Version mismatch between JAR and MQ server
- Complex authentication setup (mqwebuser.xml)
- HTTP/HTTPS configuration problems
- Authorization errors (MQRC 2035)

### Solution
Switched to native MQ protocol using `ibmmq` Node.js package:
- No JAR files needed
- Direct protocol communication (port 1414)
- Simpler authentication
- Better performance

### Why Native Protocol vs REST API?

| Aspect | REST API | Native Protocol |
|--------|----------|-----------------|
| JAR Dependencies | ❌ Requires specific JAR files | ✅ No JAR files needed |
| Authorization | ❌ Complex, requires mqwebuser.xml | ✅ Simple, uses MQ authentication |
| Performance | Slower (HTTP overhead) | Faster (direct protocol) |
| Reliability | Less reliable | More reliable |
| Setup | Easier locally (if JARs work) | Requires Docker |
| Features | Limited | Full MQ capabilities |
| Version Compatibility | ❌ JAR version must match server | ✅ Protocol is stable |

### Key Takeaways
✅ **Avoid REST API for production** - too many dependencies and configuration issues  
✅ **Native protocol is more reliable** - direct communication, fewer moving parts  
✅ **Docker simplifies native setup** - MQ C libraries included in container  
✅ **JAR file management is complex** - version matching, classpath, Java runtime

The native protocol eliminates the REST API authorization issues and JAR file complexity, providing better performance and reliability.

---

---

## Summary: Critical Success Factors

### Must-Have Configurations
1. ✅ **IBM MQ**: Password set, channel MCAUSER configured, permissions granted
2. ✅ **Kafka**: Single listener, matching health check port
3. ✅ **Docker**: Health checks, proper dependencies, network configuration
4. ✅ **Environment**: All variables set, containers recreated after changes

### Debugging Checklist
```bash
# 1. Check container health
docker-compose ps

# 2. Verify network connectivity
docker exec o2c-integration-app ping kafka
docker exec o2c-integration-app ping ibmmq

# 3. Check environment variables
docker exec o2c-integration-app env | grep MQ

# 4. View logs
docker-compose logs -f o2c-integration-app

# 5. Test MQ connection
docker exec o2c-ibmmq runmqsc QM1 <<< "DISPLAY QLOCAL(CUSTOMER_PURCHASE_ORDERS)"

# 6. Test Kafka topics
docker exec o2c-kafka kafka-topics --list --bootstrap-server localhost:9092
```

### Best Practices Established
1. **Start simple** - minimal configuration first, add complexity incrementally
2. **Document architecture** - clear diagrams and execution model
3. **Use health checks** - ensure service readiness before dependencies start
4. **Standardize naming** - uppercase for MQ, lowercase for Kafka
5. **Test incrementally** - verify each component before integration
6. **Keep credentials clear** - document actual values, avoid confusion
7. **Provide troubleshooting** - common issues and solutions upfront

---

## Future Improvements

### Potential Enhancements
- [ ] Add monitoring with Prometheus/Grafana
- [ ] Implement circuit breaker for SAP calls
- [ ] Add message replay capability
- [ ] Create automated integration tests
- [ ] Add message schema validation
- [ ] Implement dead letter queue handling
- [ ] Add performance metrics collection

### Documentation Needs
- [ ] Architecture decision records (ADRs)
- [ ] API documentation for SAP endpoints
- [ ] Message format specifications
- [ ] Runbook for production operations
- [ ] Disaster recovery procedures

---

**Document Version**: 1.0  
**Last Updated**: 2026-06-16  
**Author**: Development Team  
**Status**: Active