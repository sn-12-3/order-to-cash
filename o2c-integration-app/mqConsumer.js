const axios = require('axios');
const https = require('https');
const config = require('./config');
const logger = require('./logger');

class MQConsumer {
  constructor() {
    this.baseUrl = `https://localhost:${config.mq.restPort}`;
    this.queueUrl = `${this.baseUrl}/ibmmq/rest/v2/messaging/qmgr/${config.mq.queueManager}/queue/${config.mq.queueName}/message`;
    this.connected = false;
    this.auth = Buffer.from(`${config.mq.user}:${config.mq.password}`).toString('base64');
    
    // Configure axios to accept self-signed certificates
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true
    });
    
    this.axiosInstance = axios.create({
      httpsAgent: httpsAgent,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'ibm-mq-rest-csrf-token': 'value',
        'Content-Type': 'text/plain'
      },
      timeout: 10000
    });
  }

  async connect() {
    try {
      logger.info('Connecting to IBM MQ REST API...', {
        baseUrl: this.baseUrl,
        queueManager: config.mq.queueManager,
        queue: config.mq.queueName
      });

      // Test connection by checking queue manager status
      const response = await this.axiosInstance.get(
        `${this.baseUrl}/ibmmq/rest/v2/admin/qmgr/${config.mq.queueManager}`
      );

      if (response.status === 200) {
        this.connected = true;
        logger.info('Connected to IBM MQ REST API successfully');
        return true;
      }
    } catch (error) {
      logger.error('Failed to connect to MQ REST API', { 
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  async getMessage() {
    if (!this.connected) {
      throw new Error('Not connected to MQ');
    }

    try {
      const response = await this.axiosInstance.delete(this.queueUrl, {
        headers: {
          'ibm-mq-md-wait': '3000' // Wait 3 seconds for message
        }
      });

      if (response.status === 200 && response.data) {
        const message = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        
        logger.info('Message received from MQ', { 
          messageId: response.headers['ibm-mq-md-messageid'],
          length: message.length 
        });
        
        return message;
      }
      
      return null; // No message available
    } catch (error) {
      if (error.response?.status === 404) {
        // No message available (queue empty)
        return null;
      }
      
      logger.error('Error getting message from queue', { 
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      throw error;
    }
  }

  async disconnect() {
    this.connected = false;
    logger.info('Disconnected from IBM MQ REST API');
  }

  async reconnect() {
    logger.info('Attempting to reconnect to MQ REST API...');
    await this.disconnect();
    await new Promise(resolve => setTimeout(resolve, config.app.retryDelayMs));
    await this.connect();
  }
}

module.exports = MQConsumer;

// Made with Bob
