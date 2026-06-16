const logger = require('./logger');
const config = require('./config');

class MessageTransformer {
  /**
   * Sanitize string input to prevent injection attacks
   * @param {string} value - Input value
   * @param {number} maxLength - Maximum allowed length
   * @returns {string} - Sanitized value
   */
  sanitizeString(value, maxLength = 255) {
    if (!value) return value;
    
    // Convert to string and trim
    let sanitized = String(value).trim();
    
    // Remove control characters and limit length
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
  }

  /**
   * Validate alphanumeric format
   * @param {string} value - Value to validate
   * @param {string} fieldName - Field name for error message
   */
  validateAlphanumeric(value, fieldName) {
    if (!/^[A-Z0-9_-]+$/i.test(value)) {
      throw new Error(`${fieldName} must be alphanumeric (letters, numbers, underscore, hyphen only)`);
    }
  }

  /**
   * Transform raw MQ message to SAP sales order format
   * @param {string} rawMessage - JSON string from MQ
   * @returns {object} - Transformed SAP payload
   */
  transform(rawMessage) {
    try {
      const mqData = JSON.parse(rawMessage);
      
      logger.debug('Transforming message', {
        orderNumber: mqData.orderNumber || mqData.order_id
      });

      // Extract and sanitize fields
      const orderNumber = this.sanitizeString(
        mqData.orderNumber || mqData.order_id || mqData.orderId,
        50
      );
      const customerNumber = this.sanitizeString(
        mqData.customerNumber || mqData.customer_id || mqData.customerId,
        50
      );

      // Validate format
      if (orderNumber) this.validateAlphanumeric(orderNumber, 'orderNumber');
      if (customerNumber) this.validateAlphanumeric(customerNumber, 'customerNumber');

      // Map MQ message structure to SAP format
      const sapPayload = {
        orderNumber,
        customerNumber,
        totalAmount: this.calculateTotalAmount(mqData),
        items: this.transformItems(mqData.items || mqData.line_items || [])
      };

      // Validate transformed payload
      this.validate(sapPayload);

      logger.info('Message transformed successfully', {
        orderNumber: sapPayload.orderNumber,
        itemCount: sapPayload.items.length,
        totalAmount: sapPayload.totalAmount
      });

      return sapPayload;
    } catch (error) {
      logger.error('Message transformation failed', {
        error: error.message,
        rawMessage: rawMessage.substring(0, 200)
      });
      throw new Error(`Transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform items array to SAP format
   */
  transformItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and must not be empty');
    }

    return items.map((item, idx) => {
      const materialNumber = this.sanitizeString(
        item.materialNumber || item.material_id || item.sku || item.productId,
        50
      );
      const quantity = parseInt(item.quantity || item.qty) || 0;
      const plant = this.sanitizeString(
        item.plant || item.warehouse || item.location,
        10
      );

      // Validate material number format
      if (materialNumber) {
        this.validateAlphanumeric(materialNumber, `items[${idx}].materialNumber`);
      }

      // Validate quantity range
      if (quantity < 0 || quantity > 999999) {
        throw new Error(`items[${idx}].quantity must be between 0 and 999999`);
      }

      // Plant is required - no default value
      if (!plant) {
        throw new Error(`items[${idx}].plant is required (no default available)`);
      }

      return {
        materialNumber,
        quantity,
        plant
      };
    });
  }

  /**
   * Calculate total amount from items or use provided value
   */
  calculateTotalAmount(mqData) {
    // Use provided total if available
    if (mqData.totalAmount || mqData.total_amount || mqData.amount) {
      const amount = parseFloat(mqData.totalAmount || mqData.total_amount || mqData.amount);
      
      // Validate amount range
      if (isNaN(amount) || amount < 0 || amount > 99999999.99) {
        throw new Error('totalAmount must be between 0 and 99999999.99');
      }
      
      return amount;
    }

    // Calculate from items
    const items = mqData.items || mqData.line_items || [];
    let total = 0;

    items.forEach(item => {
      const price = parseFloat(item.price || item.unit_price || 0);
      const quantity = parseInt(item.quantity || item.qty || 0);
      
      if (isNaN(price) || price < 0) {
        throw new Error('Item price must be a positive number');
      }
      
      total += price * quantity;
    });

    // Validate calculated total
    if (total > 99999999.99) {
      throw new Error('Calculated total amount exceeds maximum (99999999.99)');
    }

    return total;
  }

  /**
   * Validate transformed payload
   */
  validate(payload) {
    const errors = [];

    if (!payload.orderNumber) {
      errors.push('orderNumber is required');
    }

    if (!payload.customerNumber) {
      errors.push('customerNumber is required');
    }

    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      errors.push('items array is required and must not be empty');
    }

    if (payload.items) {
      payload.items.forEach((item, idx) => {
        if (!item.materialNumber) {
          errors.push(`items[${idx}].materialNumber is required`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`items[${idx}].quantity must be positive`);
        }
        if (!item.plant) {
          errors.push(`items[${idx}].plant is required`);
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }
}

module.exports = MessageTransformer;

// Made with Bob
