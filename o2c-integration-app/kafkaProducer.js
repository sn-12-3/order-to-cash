const { Kafka } = require('kafkajs');
const config = require('./config');
const logger = require('./logger');

class KafkaProducer {
  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 300,
        retries: 8
      }
    });
    
    this.producer = this.kafka.producer();
    this.connected = false;
  }

  async connect() {
    try {
      logger.info('Connecting to Kafka...', { 
        brokers: config.kafka.brokers 
      });
      
      await this.producer.connect();
      this.connected = true;
      
      logger.info('Connected to Kafka successfully');
    } catch (error) {
      logger.error('Failed to connect to Kafka', { error: error.message });
      throw error;
    }
  }

  /**
   * Publish success event to Kafka
   * @param {object} data - Event data containing order and SAP information
   */
  async publishSuccessEvent(data) {
    if (!this.connected) {
      throw new Error('Kafka producer not connected');
    }

    const event = {
      eventType: 'ORDER_SUBMITTED_TO_SAP',
      timestamp: new Date().toISOString(),
      orderNumber: data.orderNumber,
      sapOrderNumber: data.sapOrderNumber,
      customerNumber: data.customerNumber,
      totalAmount: data.totalAmount,
      status: 'SUCCESS',
      sapStatus: data.sapStatus,
      deliveryDate: data.deliveryDate,
      items: data.items
    };

    try {
      logger.info('Publishing success event to Kafka', {
        topic: config.kafka.successTopic,
        orderNumber: event.orderNumber,
        sapOrderNumber: event.sapOrderNumber
      });

      const result = await this.producer.send({
        topic: config.kafka.successTopic,
        messages: [
          {
            key: event.orderNumber,
            value: JSON.stringify(event),
            headers: {
              'event-type': 'ORDER_SUBMITTED_TO_SAP',
              'timestamp': event.timestamp
            }
          }
        ]
      });

      logger.info('Success event published to Kafka', {
        topic: config.kafka.successTopic,
        partition: result[0].partition,
        offset: result[0].offset,
        orderNumber: event.orderNumber
      });

      return result;
    } catch (error) {
      logger.error('Failed to publish event to Kafka', {
        error: error.message,
        orderNumber: event.orderNumber
      });
      throw error;
    }
  }

  /**
   * Publish failure event to Kafka failed_orders topic
   * @param {object} data - Failure data with SAP error details
   */
  async publishFailureEvent(data) {
    if (!this.connected) {
      throw new Error('Kafka producer not connected');
    }

    const event = {
      eventType: 'ORDER_SUBMISSION_FAILED',
      timestamp: new Date().toISOString(),
      orderNumber: data.orderNumber,
      customerNumber: data.customerNumber,
      totalAmount: data.totalAmount,
      status: 'FAILED',
      errorType: data.errorType,
      errorMessage: data.errorMessage,
      errorDetails: data.errorDetails,
      sapErrorCode: data.sapErrorCode || null
    };

    try {
      logger.info('Publishing failure event to Kafka', {
        topic: config.kafka.failedTopic,
        orderNumber: event.orderNumber,
        sapErrorCode: event.sapErrorCode
      });

      const result = await this.producer.send({
        topic: config.kafka.failedTopic,
        messages: [
          {
            key: event.orderNumber,
            value: JSON.stringify(event),
            headers: {
              'event-type': 'ORDER_SUBMISSION_FAILED',
              'timestamp': event.timestamp,
              'sap-error-code': event.sapErrorCode || 'UNKNOWN'
            }
          }
        ]
      });

      logger.info('Failure event published to Kafka', {
        topic: config.kafka.failedTopic,
        partition: result[0].partition,
        offset: result[0].offset,
        orderNumber: event.orderNumber
      });

      return result;
    } catch (error) {
      logger.error('Failed to publish failure event to Kafka', {
        error: error.message,
        orderNumber: event.orderNumber
      });
      // Don't throw - failure to log shouldn't stop processing
    }
  }

  async disconnect() {
    if (this.connected) {
      try {
        await this.producer.disconnect();
        this.connected = false;
        logger.info('Disconnected from Kafka');
      } catch (error) {
        logger.error('Error disconnecting from Kafka', { error: error.message });
      }
    }
  }
}

module.exports = KafkaProducer;

// Made with Bob
