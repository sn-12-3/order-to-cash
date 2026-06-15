# O2C Integration Application

Order-to-Cash integration application that bridges IBM MQ, SAP, and Kafka for seamless order processing.

## Architecture

```
IBM MQ Queue                    SAP Mock Server              Kafka Topics
(customer_purchase_orders) --> (Sales Order API) --> (submitted_orders / failed_orders)
```

**Flow:**
1. Poll messages from IBM MQ queue `customer_purchase_orders`
2. Transform raw message to SAP sales order format
3. Call SAP `/sap/api/sales-order` endpoint
4. On success, extract `sapOrderNumber` and publish to Kafka topic `submitted_orders`
5. Handle errors with retry logic and failure events

## Features

- ✅ Continuous polling from IBM MQ
- ✅ Message transformation with validation
- ✅ SAP API integration with retry logic
- ✅ Kafka event publishing for success/failure
- ✅ Comprehensive error handling
- ✅ Connection retry mechanisms
- ✅ Structured logging
- ✅ Graceful shutdown

## Prerequisites

- Node.js 14+
- Docker & Docker Compose
- IBM MQ client libraries
- Running Mock SAP Server (port 3001)

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key configurations:
- **MQ_QUEUE_NAME**: IBM MQ queue name (default: `customer_purchase_orders`)
- **SAP_BASE_URL**: Mock SAP server URL (default: `http://localhost:3001`)
- **KAFKA_BROKERS**: Kafka broker address (default: `localhost:9093`)
- **KAFKA_SUCCESS_TOPIC**: Success events topic (default: `submitted_orders`)
- **KAFKA_FAILED_TOPIC**: Failed events topic (default: `failed_orders`)
- **POLL_INTERVAL_MS**: Polling interval (default: 5000ms)
- **MAX_RETRIES**: SAP API retry attempts (default: 3)

## Setup Infrastructure

### Start IBM MQ and Kafka

```bash
docker-compose up -d
```

This starts:
- IBM MQ on port 1414 (Web Console: 9443)
- Kafka on port 9093
- Zookeeper on port 2181

**Note:** Port 9093 is used to avoid conflicts with other Kafka instances.

### Create MQ Queue

Access IBM MQ Web Console at `https://localhost:9443`:
- Username: `admin`
- Password: `passw0rd`

Create queue named `customer_purchase_orders` or use the default DEV queues.

### Verify Kafka Topics

Topics `submitted_orders` and `failed_orders` will be auto-created on first message.

## Usage

### Start the Application

```bash
npm start
```

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Stop the Application

Press `Ctrl+C` for graceful shutdown.

## Message Format

### Input (IBM MQ)

The application accepts flexible JSON formats:

**Format 1:**
```json
{
  "orderNumber": "ORD-12345",
  "customerNumber": "CUST-001",
  "totalAmount": 5000,
  "items": [
    {
      "materialNumber": "MAT-001",
      "quantity": 10,
      "plant": "P001"
    }
  ]
}
```

**Format 2 (alternative field names):**
```json
{
  "order_id": "ORD-12345",
  "customer_id": "CUST-001",
  "total_amount": 5000,
  "line_items": [
    {
      "material_id": "MAT-001",
      "qty": 10,
      "warehouse": "P001"
    }
  ]
}
```

### Output (Kafka)

**Success Event:**
```json
{
  "eventType": "ORDER_SUBMITTED_TO_SAP",
  "timestamp": "2026-06-12T06:40:00.000Z",
  "orderNumber": "ORD-12345",
  "sapOrderNumber": "SAP-1718163600000-456",
  "customerNumber": "CUST-001",
  "totalAmount": 5000,
  "status": "SUCCESS",
  "sapStatus": "CREATED",
  "deliveryDate": "2026-06-19T06:40:00.000Z",
  "items": [...]
}
```

**Failure Event:**
```json
{
  "eventType": "ORDER_SUBMISSION_FAILED",
  "timestamp": "2026-06-12T06:40:00.000Z",
  "orderNumber": "ORD-12345",
  "customerNumber": "CUST-001",
  "status": "FAILED",
  "errorType": "BUSINESS_ERROR",
  "errorMessage": "Business validation failed",
  "errorDetails": ["Order amount exceeds customer credit limit"]
}
```

## Error Handling

### Validation Errors (400)
- Missing required fields
- Invalid data types
- No retry - publishes failure event

### Business Errors (422)
- Credit limit exceeded
- Blocked customer
- Stock shortage
- No retry - publishes failure event

### Network Errors (5xx, timeouts)
- Automatic retry with exponential backoff
- Max 3 attempts (configurable)
- Publishes failure event after exhausting retries

### Connection Errors
- MQ: Automatic reconnection with delay
- Kafka: Built-in retry mechanism
- Logs all connection issues

## Testing

### Send Test Message to MQ

Use IBM MQ Explorer or command line:

```bash
# Using amqsput (if IBM MQ client installed)
echo '{"orderNumber":"ORD-TEST-001","customerNumber":"CUST-001","totalAmount":1000,"items":[{"materialNumber":"MAT-001","quantity":5,"plant":"P001"}]}' | /opt/mqm/samp/bin/amqsput customer_purchase_orders QM1
```

Or use the MQ Web Console to put messages manually.

### Consume Kafka Events

```bash
# Using kafka-console-consumer
docker exec -it o2c-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic submitted_orders \
  --from-beginning
```

## Monitoring

### Application Logs

Logs are written to:
- Console (colored output)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

### Statistics

The application tracks:
- Total messages processed
- Total errors
- Running status

Access via application logs on startup/shutdown.

## Architecture Components

### MQConsumer (`mqConsumer.js`)
- Connects to IBM MQ
- Polls messages with configurable interval
- Handles reconnection on failure

### MessageTransformer (`messageTransformer.js`)
- Transforms MQ message to SAP format
- Validates required fields
- Supports multiple input formats

### SAPClient (`sapClient.js`)
- Calls SAP sales order API
- Implements retry logic with exponential backoff
- Distinguishes between retryable and non-retryable errors

### KafkaProducer (`kafkaProducer.js`)
- Publishes success events to Kafka
- Optionally publishes failure events
- Handles connection management

## Troubleshooting

### MQ Connection Issues
```
Error: MQRC_NOT_AUTHORIZED
```
- Check MQ credentials in `.env`
- Verify user has queue permissions

### SAP Connection Issues
```
Error: connect ECONNREFUSED
```
- Ensure Mock SAP Server is running on port 3001
- Check `SAP_BASE_URL` in `.env`

### Kafka Connection Issues
```
Error: KafkaJSConnectionError
```
- Verify Kafka is running: `docker ps`
- Check broker address in `.env`

### No Messages Processing
- Verify messages exist in MQ queue
- Check queue name matches configuration
- Review application logs for errors

## Production Considerations

1. **Security**
   - Use secure MQ channels (TLS)
   - Implement SAP authentication
   - Secure Kafka with SASL/SSL

2. **Scalability**
   - Run multiple instances for parallel processing
   - Use Kafka consumer groups
   - Implement message deduplication

3. **Monitoring**
   - Integrate with monitoring tools (Prometheus, Grafana)
   - Set up alerts for error rates
   - Track processing metrics

4. **Reliability**
   - Implement dead letter queue for failed messages
   - Add message persistence
   - Configure proper retry policies

## License

MIT