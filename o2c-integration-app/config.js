require('dotenv').config();

module.exports = {
  mq: {
    host: process.env.MQ_HOST || 'localhost',
    port: parseInt(process.env.MQ_PORT) || 1414,
    channel: process.env.MQ_CHANNEL || 'DEV.APP.SVRCONN',
    queueManager: process.env.MQ_QUEUE_MANAGER || 'QM1',
    queueName: process.env.MQ_QUEUE_NAME || 'CUSTOMER_PURCHASE_ORDERS',
    user: process.env.MQ_USER || 'app',
    password: process.env.MQ_PASSWORD || ''
  },
  
  sap: {
    baseUrl: process.env.SAP_BASE_URL || 'http://localhost:3001',
    salesOrderEndpoint: process.env.SAP_SALES_ORDER_ENDPOINT || '/sap/api/sales-order'
  },
  
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'o2c-integration',
    successTopic: process.env.KAFKA_SUCCESS_TOPIC || 'submitted_orders',
    failedTopic: process.env.KAFKA_FAILED_TOPIC || 'failed_orders'
  },
  
  app: {
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS) || 5000,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS) || 2000,
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};

// Made with Bob
