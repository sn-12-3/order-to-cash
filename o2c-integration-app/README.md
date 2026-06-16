# Order-to-Cash Integration System

Complete integration system connecting IBM MQ, Kafka, and SAP for order processing.

## Quick Start

```bash
cd /Users/moyjom/my-repos/order-to-cash/o2c-integration-app
./start.sh
```

Wait 60-90 seconds for all services to initialize.

## Access Points

### IBM MQ Web Console
- **URL:** https://localhost:9443/ibmmq/console/
- **Username:** `admin`
- **Password:** `passw0rd`
- **Note:** Accept the security warning (self-signed certificate)

### Mock SAP Server
- **Health Check:** http://localhost:3001/health
- **Endpoints:** See `/Users/moyjom/my-repos/order-to-cash/mock-sap-server/README.md`

## Architecture

```
Purchase Order → IBM MQ Queue → Integration App → Mock SAP → Kafka Topics
```

1. **IBM MQ Queue:** `CUSTOMER_PURCHASE_ORDERS`
2. **Integration App:** Consumes from MQ, transforms, calls SAP
3. **Mock SAP Server:** Simulates SAP responses (success/failure)
4. **Kafka Topics:** Publishes success/failure events

## Services

- **IBM MQ:** Port 1414 (messaging), 9443 (web console)
- **Kafka:** Port 9093
- **Zookeeper:** Port 2181
- **Mock SAP:** Port 3001
- **Integration App:** Background process

## Logs

```bash
# Integration App
tail -f /tmp/o2c-integration.log

# Mock SAP Server
tail -f /tmp/mock-sap-server.log

# IBM MQ
docker logs -f o2c-ibmmq

# Kafka
docker logs -f o2c-kafka
```

## Stop All Services

```bash
./stop-all.sh
```

## Troubleshooting

### Web Console Login Issues
See [`WEB_CONSOLE_LOGIN.md`](./WEB_CONSOLE_LOGIN.md) for detailed login instructions.

### Services Not Starting
1. Check Docker is running: `docker ps`
2. Check logs: `docker logs o2c-ibmmq`
3. Restart: `./stop-all.sh && ./start.sh`

### Connection Refused Errors
- Wait longer - IBM MQ takes 60-90 seconds to fully start
- Check health: `docker ps` (should show "healthy" status)

## Configuration

- **Environment:** `.env` file
- **Docker:** `docker-compose.yml`
- **Integration App:** `config.js`

## Documentation

- [`WEB_CONSOLE_LOGIN.md`](./WEB_CONSOLE_LOGIN.md) - Web console access guide
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - System architecture (if exists)