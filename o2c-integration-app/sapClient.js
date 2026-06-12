const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

class SAPClient {
  constructor() {
    this.baseUrl = config.sap.baseUrl;
    this.salesOrderEndpoint = config.sap.salesOrderEndpoint;
    this.maxRetries = config.app.maxRetries;
    this.retryDelay = config.app.retryDelayMs;
  }

  /**
   * Create sales order in SAP with retry logic
   * @param {object} payload - SAP sales order payload
   * @returns {object} - SAP response
   */
  async createSalesOrder(payload) {
    const url = `${this.baseUrl}${this.salesOrderEndpoint}`;
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`Calling SAP API (attempt ${attempt}/${this.maxRetries})`, {
          orderNumber: payload.orderNumber,
          url
        });

        const response = await axios.post(url, payload, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 seconds
        });

        logger.info('SAP API call successful', {
          orderNumber: payload.orderNumber,
          sapOrderNumber: response.data.sapOrderNumber,
          status: response.data.status
        });

        return {
          success: true,
          data: response.data
        };

      } catch (error) {
        lastError = error;
        
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        logger.error(`SAP API call failed (attempt ${attempt}/${this.maxRetries})`, {
          orderNumber: payload.orderNumber,
          statusCode,
          error: errorData || error.message
        });

        // Don't retry on validation errors (400) or business errors (422)
        if (statusCode === 400 || statusCode === 422) {
          return {
            success: false,
            error: {
              type: statusCode === 400 ? 'VALIDATION_ERROR' : 'BUSINESS_ERROR',
              statusCode,
              message: errorData?.message || error.message,
              details: errorData?.details || [],
              sapErrorCode: errorData?.sapErrorCode
            }
          };
        }

        // Retry on network errors or 5xx errors
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt; // Exponential backoff
          logger.info(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: {
        type: 'NETWORK_ERROR',
        message: `Failed after ${this.maxRetries} attempts: ${lastError.message}`,
        details: [lastError.message]
      }
    };
  }

  /**
   * Health check for SAP server
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      return response.data.status === 'UP';
    } catch (error) {
      logger.warn('SAP health check failed', { error: error.message });
      return false;
    }
  }
}

module.exports = SAPClient;

// Made with Bob
