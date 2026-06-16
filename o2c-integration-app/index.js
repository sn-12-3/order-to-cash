const MQConsumer = require('./mqConsumer');
const MessageTransformer = require('./messageTransformer');
const SAPClient = require('./sapClient');
const KafkaProducer = require('./kafkaProducer');
const config = require('./config');
const logger = require('./logger');

class O2CIntegrationApp {
  constructor() {
    this.mqConsumer = new MQConsumer();
    this.transformer = new MessageTransformer();
    this.sapClient = new SAPClient();
    this.kafkaProducer = new KafkaProducer();
    this.running = false;
    this.processedCount = 0;
    this.errorCount = 0;
    this.processingCount = 0;
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_MESSAGES) || 10;
  }

  async initialize() {
    logger.info('Initializing O2C Integration Application...');

    try {
      // Connect to IBM MQ
      await this.mqConsumer.connect();

      // Connect to Kafka
      await this.kafkaProducer.connect();

      // Check SAP availability
      const sapHealthy = await this.sapClient.healthCheck();
      if (!sapHealthy) {
        logger.warn('SAP server health check failed - will retry on message processing');
      }

      logger.info('O2C Integration Application initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize application', { error: error.message });
      throw error;
    }
  }

  async processMessage(rawMessage) {
    let orderNumber = 'UNKNOWN';
    
    try {
      // Step 1: Transform message
      const sapPayload = this.transformer.transform(rawMessage);
      orderNumber = sapPayload.orderNumber;

      logger.info('Processing order', { orderNumber });

      // Step 2: Send to SAP
      const sapResult = await this.sapClient.createSalesOrder(sapPayload);

      // Step 3: Handle SAP response
      if (sapResult.success) {
        // Success - publish to Kafka
        await this.kafkaProducer.publishSuccessEvent({
          orderNumber: sapPayload.orderNumber,
          sapOrderNumber: sapResult.data.sapOrderNumber,
          customerNumber: sapPayload.customerNumber,
          totalAmount: sapPayload.totalAmount,
          sapStatus: sapResult.data.status,
          deliveryDate: sapResult.data.deliveryDate,
          items: sapResult.data.items
        });

        this.processedCount++;
        logger.info('Order processed successfully', {
          orderNumber,
          sapOrderNumber: sapResult.data.sapOrderNumber,
          totalProcessed: this.processedCount
        });

        return { success: true, orderNumber, sapOrderNumber: sapResult.data.sapOrderNumber };
      } else {
        // SAP returned error - publish to failed_orders topic
        this.errorCount++;
        
        logger.error('SAP rejected order', {
          orderNumber,
          errorType: sapResult.error.type,
          message: sapResult.error.message,
          details: sapResult.error.details,
          sapErrorCode: sapResult.error.sapErrorCode
        });

        // Publish failure event to failed_orders topic
        await this.kafkaProducer.publishFailureEvent({
          orderNumber,
          customerNumber: sapPayload.customerNumber,
          totalAmount: sapPayload.totalAmount,
          errorType: sapResult.error.type,
          errorMessage: sapResult.error.message,
          errorDetails: sapResult.error.details,
          sapErrorCode: sapResult.error.sapErrorCode
        });

        return { 
          success: false, 
          orderNumber, 
          error: sapResult.error 
        };
      }
    } catch (error) {
      this.errorCount++;
      
      logger.error('Error processing message', {
        orderNumber,
        error: error.message,
        stack: error.stack
      });

      // Publish failure event to failed_orders topic
      try {
        await this.kafkaProducer.publishFailureEvent({
          orderNumber,
          customerNumber: 'UNKNOWN',
          totalAmount: 0,
          errorType: 'PROCESSING_ERROR',
          errorMessage: error.message,
          errorDetails: [error.stack],
          sapErrorCode: null
        });
      } catch (kafkaError) {
        logger.error('Failed to publish failure event', { error: kafkaError.message });
      }

      return { success: false, orderNumber, error: error.message };
    }
  }

  async start() {
    this.running = true;
    logger.info('Starting message polling loop', {
      pollInterval: config.app.pollIntervalMs,
      queue: config.mq.queueName,
      maxConcurrent: this.maxConcurrent
    });

    while (this.running) {
      try {
        // Check if we've reached max concurrent processing limit
        if (this.processingCount >= this.maxConcurrent) {
          logger.debug('Max concurrent limit reached, waiting...', {
            processing: this.processingCount,
            max: this.maxConcurrent
          });
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        // Get message from MQ
        const message = await this.mqConsumer.getMessage();

        if (message) {
          // Process the message asynchronously without blocking
          this.processingCount++;
          this.processMessage(message)
            .finally(() => {
              this.processingCount--;
            });
        } else {
          // No message available, wait before next poll
          await new Promise(resolve => setTimeout(resolve, config.app.pollIntervalMs));
        }
      } catch (error) {
        logger.error('Error in polling loop', { error: error.message });

        // Try to reconnect to MQ if connection lost
        if (error.message.includes('Not connected')) {
          try {
            await this.mqConsumer.reconnect();
          } catch (reconnectError) {
            logger.error('Failed to reconnect to MQ', { error: reconnectError.message });
            await new Promise(resolve => setTimeout(resolve, config.app.retryDelayMs));
          }
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, config.app.retryDelayMs));
        }
      }
    }

    // Wait for all in-flight messages to complete
    logger.info('Waiting for in-flight messages to complete...', {
      processing: this.processingCount
    });
    while (this.processingCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Polling loop stopped');
  }

  async stop() {
    logger.info('Stopping O2C Integration Application...');
    this.running = false;

    try {
      await this.mqConsumer.disconnect();
      await this.kafkaProducer.disconnect();
      
      logger.info('Application stopped gracefully', {
        totalProcessed: this.processedCount,
        totalErrors: this.errorCount
      });
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
    }
  }

  getStats() {
    return {
      processed: this.processedCount,
      errors: this.errorCount,
      running: this.running
    };
  }
}

// Main execution
async function main() {
  const app = new O2CIntegrationApp();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    try {
      await app.stop();
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
    } finally {
      process.exit(0);
    }
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    try {
      await app.stop();
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
    } finally {
      process.exit(0);
    }
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
  });

  try {
    // Initialize and start
    await app.initialize();
    
    logger.info('='.repeat(60));
    logger.info('O2C Integration Application Started');
    logger.info('='.repeat(60));
    // Sanitize configuration to avoid logging sensitive data
    const sanitizedSapUrl = config.sap.baseUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    
    logger.info('Configuration:', {
      mqQueue: config.mq.queueName,
      sapUrl: sanitizedSapUrl,
      kafkaSuccessTopic: config.kafka.successTopic,
      kafkaFailedTopic: config.kafka.failedTopic,
      pollInterval: config.app.pollIntervalMs
    });
    logger.info('='.repeat(60));

    // Start polling
    await app.start();
  } catch (error) {
    logger.error('Fatal error', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run the application
if (require.main === module) {
  main();
}

module.exports = O2CIntegrationApp;

// Made with Bob
