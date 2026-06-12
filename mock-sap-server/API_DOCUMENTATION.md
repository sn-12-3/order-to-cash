# Mock SAP Server - Complete API Documentation

## Base URL
```
http://localhost:3001
```

---

## 1. Sales Order Creation

### POST /sap/api/sales-order

Creates a sales order in SAP system.

#### Request Body
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
    },
    {
      "materialNumber": "MAT-002",
      "quantity": 5,
      "plant": "P001"
    }
  ]
}
```

#### Success Response (200)
```json
{
  "success": true,
  "sapOrderNumber": "SAP-1718163600000-456",
  "orderNumber": "ORD-12345",
  "status": "CREATED",
  "message": "Sales order created successfully in SAP",
  "deliveryDate": "2026-06-19T05:39:00.000Z",
  "items": [
    {
      "lineItem": 10,
      "materialNumber": "MAT-001",
      "quantity": 10,
      "plant": "P001",
      "status": "CONFIRMED"
    },
    {
      "lineItem": 20,
      "materialNumber": "MAT-002",
      "quantity": 5,
      "plant": "P001",
      "status": "CONFIRMED"
    }
  ]
}
```

#### Validation Error Response (400)
```json
{
  "error": "Bad Request",
  "message": "Payload validation failed",
  "details": [
    "orderNumber is required",
    "customerNumber is required",
    "items array is required and must not be empty"
  ]
}
```

#### Business Error Response (422)
```json
{
  "error": "Unprocessable Entity",
  "message": "Business validation failed",
  "details": [
    "Order amount exceeds customer credit limit"
  ],
  "sapErrorCode": "V1234"
}
```

#### Test Scenarios

**Trigger Credit Limit Error:**
```json
{
  "orderNumber": "ORD-12345",
  "customerNumber": "CUST-001",
  "totalAmount": 150000,
  "items": [{"materialNumber": "MAT-001", "quantity": 10, "plant": "P001"}]
}
```

**Trigger Blocked Customer Error:**
```json
{
  "orderNumber": "ORD-12345",
  "customerNumber": "CUST-BLOCKED",
  "totalAmount": 5000,
  "items": [{"materialNumber": "MAT-001", "quantity": 10, "plant": "P001"}]
}
```

**Trigger Discontinued Material Error:**
```json
{
  "orderNumber": "ORD-12345",
  "customerNumber": "CUST-001",
  "totalAmount": 5000,
  "items": [{"materialNumber": "MAT-999", "quantity": 10, "plant": "P001"}]
}
```

**Trigger Stock Shortage Error:**
```json
{
  "orderNumber": "ORD-12345",
  "customerNumber": "CUST-001",
  "totalAmount": 5000,
  "items": [{"materialNumber": "MAT-001", "quantity": 1500, "plant": "P001"}]
}
```

---

## 2. Delivery Creation

### POST /sap/api/delivery

Creates a delivery document for a sales order.

#### Request Body
```json
{
  "sapOrderNumber": "SAP-1718163600000-456",
  "shippingPoint": "SP01"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "deliveryNumber": "DEL-1718163700000-789",
  "sapOrderNumber": "SAP-1718163600000-456",
  "status": "CREATED",
  "message": "Delivery created successfully in SAP",
  "shippingPoint": "SP01",
  "plannedGoodsIssueDate": "2026-06-14T05:39:00.000Z"
}
```

#### Validation Error Response (400)
```json
{
  "error": "Bad Request",
  "message": "sapOrderNumber is required"
}
```

```json
{
  "error": "Bad Request",
  "message": "shippingPoint is required"
}
```

#### Business Error Response (422)
```json
{
  "error": "Unprocessable Entity",
  "message": "Sales order not found in SAP",
  "sapErrorCode": "V2001"
}
```

#### Test Scenarios

**Trigger Order Not Found Error:**
```json
{
  "sapOrderNumber": "SAP-NOTFOUND",
  "shippingPoint": "SP01"
}
```

**Valid Request:**
```json
{
  "sapOrderNumber": "SAP-1718163600000-456",
  "shippingPoint": "SP01"
}
```

---

## 3. Goods Issue Posting

### POST /sap/api/goods-issue

Posts goods issue for a delivery document.

#### Request Body
```json
{
  "deliveryNumber": "DEL-1718163700000-789"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "materialDocument": "MAT-1718163800000-321",
  "deliveryNumber": "DEL-1718163700000-789",
  "status": "POSTED",
  "message": "Goods issue posted successfully in SAP",
  "postingDate": "2026-06-12T05:39:00.000Z"
}
```

#### Validation Error Response (400)
```json
{
  "error": "Bad Request",
  "message": "deliveryNumber is required"
}
```

#### Business Error Response (422)
```json
{
  "error": "Unprocessable Entity",
  "message": "Delivery is not ready for goods issue",
  "details": [
    "Picking not completed",
    "Packing not completed"
  ],
  "sapErrorCode": "V3001"
}
```

#### Test Scenarios

**Trigger Delivery Not Ready Error:**
```json
{
  "deliveryNumber": "DEL-NOTREADY"
}
```

**Valid Request:**
```json
{
  "deliveryNumber": "DEL-1718163700000-789"
}
```

---

## 4. Invoice Creation

### POST /sap/api/invoice

Creates an invoice for a delivery.

#### Request Body
```json
{
  "deliveryNumber": "DEL-1718163700000-789",
  "amount": 5000
}
```

#### Success Response (200)
```json
{
  "success": true,
  "invoiceNumber": "INV-1718163900000-654",
  "deliveryNumber": "DEL-1718163700000-789",
  "status": "CREATED",
  "message": "Invoice created successfully in SAP",
  "invoiceDate": "2026-06-12T05:39:00.000Z",
  "amount": 5000,
  "currency": "USD",
  "paymentTerms": "Net 30"
}
```

#### Validation Error Response (400)
```json
{
  "error": "Bad Request",
  "message": "deliveryNumber is required"
}
```

#### Business Error Response (422)
```json
{
  "error": "Unprocessable Entity",
  "message": "Delivery has billing block",
  "details": [
    "Credit limit exceeded",
    "Manual billing block active"
  ],
  "sapErrorCode": "V4001"
}
```

#### Test Scenarios

**Trigger Billing Block Error:**
```json
{
  "deliveryNumber": "DEL-BLOCKED",
  "amount": 5000
}
```

**Valid Request (with amount):**
```json
{
  "deliveryNumber": "DEL-1718163700000-789",
  "amount": 5000
}
```

**Valid Request (auto-calculated amount):**
```json
{
  "deliveryNumber": "DEL-1718163700000-789"
}
```

---

## 5. Payment Posting

### POST /sap/api/payment

Posts payment and clears invoice.

#### Request Body
```json
{
  "invoiceNumber": "INV-1718163900000-654",
  "amount": 5000,
  "currency": "USD"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "clearingDocument": "CLR-1718164000000-987",
  "invoiceNumber": "INV-1718163900000-654",
  "status": "CLEARED",
  "message": "Payment posted and invoice cleared in SAP",
  "paymentDate": "2026-06-12T05:39:00.000Z",
  "amount": 5000,
  "currency": "USD"
}
```

#### Validation Error Response (400)
```json
{
  "error": "Bad Request",
  "message": "invoiceNumber is required"
}
```

```json
{
  "error": "Bad Request",
  "message": "amount must be positive"
}
```

#### Business Error Response (422)
```json
{
  "error": "Unprocessable Entity",
  "message": "Payment amount exceeds invoice amount",
  "sapErrorCode": "V5001"
}
```

#### Test Scenarios

**Trigger Amount Mismatch Error:**
```json
{
  "invoiceNumber": "INV-1718163900000-654",
  "amount": 150000,
  "currency": "USD"
}
```

**Valid Request:**
```json
{
  "invoiceNumber": "INV-1718163900000-654",
  "amount": 5000,
  "currency": "USD"
}
```

**Valid Request (default currency):**
```json
{
  "invoiceNumber": "INV-1718163900000-654",
  "amount": 5000
}
```

---

## Complete Order-to-Cash Flow Example

### Step 1: Create Sales Order
```bash
curl -X POST http://localhost:3001/sap/api/sales-order \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "ORD-12345",
    "customerNumber": "CUST-001",
    "totalAmount": 5000,
    "items": [
      {"materialNumber": "MAT-001", "quantity": 10, "plant": "P001"}
    ]
  }'
```

Response: `sapOrderNumber: "SAP-1718163600000-456"`

### Step 2: Create Delivery
```bash
curl -X POST http://localhost:3001/sap/api/delivery \
  -H "Content-Type: application/json" \
  -d '{
    "sapOrderNumber": "SAP-1718163600000-456",
    "shippingPoint": "SP01"
  }'
```

Response: `deliveryNumber: "DEL-1718163700000-789"`

### Step 3: Post Goods Issue
```bash
curl -X POST http://localhost:3001/sap/api/goods-issue \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryNumber": "DEL-1718163700000-789"
  }'
```

Response: `materialDocument: "MAT-1718163800000-321"`

### Step 4: Create Invoice
```bash
curl -X POST http://localhost:3001/sap/api/invoice \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryNumber": "DEL-1718163700000-789",
    "amount": 5000
  }'
```

Response: `invoiceNumber: "INV-1718163900000-654"`

### Step 5: Post Payment
```bash
curl -X POST http://localhost:3001/sap/api/payment \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceNumber": "INV-1718163900000-654",
    "amount": 5000,
    "currency": "USD"
  }'
```

Response: `clearingDocument: "CLR-1718164000000-987"`

---

## Error Code Reference

| Code | Description | Trigger |
|------|-------------|---------|
| V1234 | Business validation failed (Sales Order) | Credit limit, blocked customer, stock issues |
| V2001 | Sales order not found | Invalid sapOrderNumber |
| V3001 | Delivery not ready for goods issue | Picking/packing incomplete |
| V4001 | Delivery has billing block | Credit issues, manual block |
| V5001 | Payment amount exceeds invoice | Amount > 100000 |

---

## Health Check

### GET /health

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "UP",
  "service": "Mock SAP Server",
  "timestamp": "2026-06-12T05:39:00.000Z"
}