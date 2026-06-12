const logger = require('./logger');

class MessageTransformer {
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

      // Map MQ message structure to SAP format
      const sapPayload = {
        orderNumber: mqData.orderNumber || mqData.order_id || mqData.orderId,
        customerNumber: mqData.customerNumber || mqData.customer_id || mqData.customerId,
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

    return items.map(item => ({
      materialNumber: item.materialNumber || item.material_id || item.sku || item.productId,
      quantity: parseInt(item.quantity || item.qty) || 0,
      plant: item.plant || item.warehouse || item.location || 'P001'
    }));
  }

  /**
   * Calculate total amount from items or use provided value
   */
  calculateTotalAmount(mqData) {
    // Use provided total if available
    if (mqData.totalAmount || mqData.total_amount || mqData.amount) {
      return parseFloat(mqData.totalAmount || mqData.total_amount || mqData.amount);
    }

    // Calculate from items
    const items = mqData.items || mqData.line_items || [];
    let total = 0;

    items.forEach(item => {
      const price = parseFloat(item.price || item.unit_price || 0);
      const quantity = parseInt(item.quantity || item.qty || 0);
      total += price * quantity;
    });

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
