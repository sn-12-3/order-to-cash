const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Validation helpers
const validatePayload = (data) => {
  const errors = [];
  
  if (!data.orderNumber) errors.push('orderNumber is required');
  if (!data.customerNumber) errors.push('customerNumber is required');
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    errors.push('items array is required and must not be empty');
  }
  
  if (data.items) {
    data.items.forEach((item, idx) => {
      if (!item.materialNumber) errors.push(`items[${idx}].materialNumber is required`);
      if (!item.quantity || item.quantity <= 0) errors.push(`items[${idx}].quantity must be positive`);
      if (!item.plant) errors.push(`items[${idx}].plant is required`);
    });
  }
  
  return errors;
};

const validateBusinessRules = (data) => {
  const errors = [];
  
  // Simulate credit limit check
  if (data.totalAmount && data.totalAmount > 100000) {
    errors.push('Order amount exceeds customer credit limit');
  }
  
  // Simulate material availability check
  data.items?.forEach((item, idx) => {
    if (item.materialNumber === 'MAT-999') {
      errors.push(`Material ${item.materialNumber} is discontinued`);
    }
    if (item.quantity > 1000) {
      errors.push(`Insufficient stock for material ${item.materialNumber} at plant ${item.plant}`);
    }
  });
  
  // Simulate customer validation
  if (data.customerNumber === 'CUST-BLOCKED') {
    errors.push('Customer account is blocked for ordering');
  }
  
  return errors;
};

// SAP Sales Order Creation Endpoint
app.post('/sap/api/sales-order', (req, res) => {
  const payload = req.body;
  
  // Validation errors (400)
  const validationErrors = validatePayload(payload);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Payload validation failed',
      details: validationErrors
    });
  }
  
  // Business rule errors (422)
  const businessErrors = validateBusinessRules(payload);
  if (businessErrors.length > 0) {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'Business validation failed',
      details: businessErrors,
      sapErrorCode: 'V1234'
    });
  }
  
  // Success response (200)
  const sapOrderNumber = `SAP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  res.status(200).json({
    success: true,
    sapOrderNumber,
    orderNumber: payload.orderNumber,
    status: 'CREATED',
    message: 'Sales order created successfully in SAP',
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    items: payload.items.map((item, idx) => ({
      lineItem: (idx + 1) * 10,
      materialNumber: item.materialNumber,
      quantity: item.quantity,
      plant: item.plant,
      status: 'CONFIRMED'
    }))
  });
});

// SAP Delivery Creation Endpoint
app.post('/sap/api/delivery', (req, res) => {
  const payload = req.body;
  
  if (!payload.sapOrderNumber) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'sapOrderNumber is required'
    });
  }
  
  if (!payload.shippingPoint) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'shippingPoint is required'
    });
  }
  
  // Simulate order not found
  if (payload.sapOrderNumber === 'SAP-NOTFOUND') {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'Sales order not found in SAP',
      sapErrorCode: 'V2001'
    });
  }
  
  const deliveryNumber = `DEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  res.status(200).json({
    success: true,
    deliveryNumber,
    sapOrderNumber: payload.sapOrderNumber,
    status: 'CREATED',
    message: 'Delivery created successfully in SAP',
    shippingPoint: payload.shippingPoint,
    plannedGoodsIssueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
  });
});

// SAP Goods Issue Posting Endpoint
app.post('/sap/api/goods-issue', (req, res) => {
  const payload = req.body;
  
  if (!payload.deliveryNumber) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'deliveryNumber is required'
    });
  }
  
  // Simulate delivery not ready
  if (payload.deliveryNumber === 'DEL-NOTREADY') {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'Delivery is not ready for goods issue',
      details: ['Picking not completed', 'Packing not completed'],
      sapErrorCode: 'V3001'
    });
  }
  
  const materialDocument = `MAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  res.status(200).json({
    success: true,
    materialDocument,
    deliveryNumber: payload.deliveryNumber,
    status: 'POSTED',
    message: 'Goods issue posted successfully in SAP',
    postingDate: new Date().toISOString()
  });
});

// SAP Invoice Creation Endpoint
app.post('/sap/api/invoice', (req, res) => {
  const payload = req.body;
  
  if (!payload.deliveryNumber) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'deliveryNumber is required'
    });
  }
  
  // Simulate billing block
  if (payload.deliveryNumber === 'DEL-BLOCKED') {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'Delivery has billing block',
      details: ['Credit limit exceeded', 'Manual billing block active'],
      sapErrorCode: 'V4001'
    });
  }
  
  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const amount = payload.amount || (Math.random() * 50000 + 1000).toFixed(2);
  
  res.status(200).json({
    success: true,
    invoiceNumber,
    deliveryNumber: payload.deliveryNumber,
    status: 'CREATED',
    message: 'Invoice created successfully in SAP',
    invoiceDate: new Date().toISOString(),
    amount: parseFloat(amount),
    currency: 'USD',
    paymentTerms: 'Net 30'
  });
});

// SAP Payment Posting Endpoint
app.post('/sap/api/payment', (req, res) => {
  const payload = req.body;
  
  if (!payload.invoiceNumber) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'invoiceNumber is required'
    });
  }
  
  if (!payload.amount || payload.amount <= 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'amount must be positive'
    });
  }
  
  // Simulate payment amount mismatch
  if (payload.amount > 100000) {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'Payment amount exceeds invoice amount',
      sapErrorCode: 'V5001'
    });
  }
  
  const clearingDocument = `CLR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  res.status(200).json({
    success: true,
    clearingDocument,
    invoiceNumber: payload.invoiceNumber,
    status: 'CLEARED',
    message: 'Payment posted and invoice cleared in SAP',
    paymentDate: new Date().toISOString(),
    amount: payload.amount,
    currency: payload.currency || 'USD'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'Mock SAP Server',
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred in SAP system'
  });
});

app.listen(PORT, () => {
  console.log(`Mock SAP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('\nAvailable endpoints:');
  console.log('  POST /sap/api/sales-order');
  console.log('  POST /sap/api/delivery');
  console.log('  POST /sap/api/goods-issue');
  console.log('  POST /sap/api/invoice');
  console.log('  POST /sap/api/payment');
});

// Made with Bob
