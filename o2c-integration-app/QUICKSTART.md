# Quick Start Guide

Get the O2C Integration Application running in 5 minutes.

## Prerequisites

- Node.js 14+ installed
- Docker and Docker Compose installed
- Mock SAP Server running on port 3001

## Step 1: Start Mock SAP Server

In a separate terminal:

```bash
cd /Users/moyjom/my-repos/order-to-cash/mock-sap-server
npm install
npm start
```

Verify it's running:
```bash
curl http://localhost:3001/health
```

## Step 2: Start Infrastructure

```bash
cd /Users/moyjom/my-repos/order-to-cash/o2c-integration-app

# Start IBM MQ and Kafka
docker-compose up -d

# Wait for services to be ready (30 seconds)
sleep 30

# Create MQ queue
chmod +x setup-mq-queue.sh
./setup-mq-queue.sh
```

## Step 3: Configure Application

```bash
# Copy environment file
cp .env.example .env

# Install dependencies
npm install
```

## Step 4: Start Integration Application

```bash
npm start
```

You should see:
```
============================================================
O2C Integration Application Started
============================================================
Configuration: {
  mqQueue: 'customer_purchase_orders',
  sapUrl: 'http://localhost:3001',
  kafkaTopic: 'submitted_orders',
  pollInterval: 5000
}
============================================================
```

## Step 5: Test the Flow

### Send Test Message to IBM MQ

**Option A: Using MQ Web Console**
1. Open https://localhost:9443
2. Login: admin / passw0rd
3. Navigate to queue `customer_purchase_orders`
4. Put message from `test-message.json`

**Option B: Using Docker Exec**
```bash
docker exec o2c-ibmmq bash -c "
  echo '{\"orderNumber\":\"ORD-TEST-001\",\"customerNumber\":\"CUST-001\",\"totalAmount\":2500,\"items\":[{\"materialNumber\":\"MAT-001\",\"quantity\":5,\"plant\":\"P001\"}]}' | \
  /opt/mqm/samp/bin/amqsput customer_purchase_orders QM1
"
```

### Watch the Logs

In the integration app terminal, you'll see:
```
Message received from MQ
Transforming message
Calling SAP API
SAP API call successful
Publishing success event to Kafka
Order processed successfully
```

### Verify Kafka Event

```bash
docker exec -it o2c-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic submitted_orders \
  --from-beginning
```

You should see the success event with `sapOrderNumber`.

## Troubleshooting

### MQ Connection Failed
```bash
# Check MQ is running
docker ps | grep ibmmq

# Check MQ logs
docker logs o2c-ibmmq
```

### SAP Connection Failed
```bash
# Verify SAP server
curl http://localhost:3001/health

# Check if port 3001 is in use
lsof -i :3001
```

### Kafka Connection Failed
```bash
# Check Kafka is running
docker ps | grep kafka

# Restart Kafka
docker-compose restart kafka
```

## Stop Everything

```bash
# Stop integration app
Ctrl+C

# Stop infrastructure
docker-compose down

# Stop SAP server
# (In SAP server terminal) Ctrl+C
```

## Next Steps

- Review [README.md](README.md) for detailed documentation
- Check [API_DOCUMENTATION.md](../mock-sap-server/API_DOCUMENTATION.md) for SAP endpoints
- Explore error scenarios by sending invalid messages
- Monitor logs in `logs/` directory

## Common Test Scenarios

### Test Credit Limit Error
```json
{
  "orderNumber": "ORD-CREDIT-001",
  "customerNumber": "CUST-001",
  "totalAmount": 150000,
  "items": [{"materialNumber": "MAT-001", "quantity": 10, "plant": "P001"}]
}
```

### Test Blocked Customer
```json
{
  "orderNumber": "ORD-BLOCKED-001",
  "customerNumber": "CUST-BLOCKED",
  "totalAmount": 5000,
  "items": [{"materialNumber": "MAT-001", "quantity": 10, "plant": "P001"}]
}
```

### Test Stock Shortage
```json
{
  "orderNumber": "ORD-STOCK-001",
  "customerNumber": "CUST-001",
  "totalAmount": 5000,
  "items": [{"materialNumber": "MAT-001", "quantity": 1500, "plant": "P001"}]
}
```

All error scenarios will publish failure events to Kafka.