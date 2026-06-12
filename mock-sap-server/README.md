# Mock SAP Server

Simulates SAP system behaviors for order-to-cash processes without heavy infrastructure.

## Features

- **Sales Order Creation** - Validates and creates sales orders
- **Delivery Management** - Creates delivery documents
- **Goods Issue Posting** - Posts goods movements
- **Invoice Creation** - Generates billing documents
- **Payment Processing** - Posts and clears payments

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

Server runs on port 3001 (configurable via PORT env variable).

## Endpoints

### POST /sap/api/sales-order
Creates a sales order in SAP.

**Request:**
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

**Success (200):**
```json
{
  "success": true,
  "sapOrderNumber": "SAP-1234567890-123",
  "status": "CREATED",
  "deliveryDate": "2026-06-19T05:39:00.000Z",
  "items": [...]
}
```

**Validation Error (400):**
```json
{
  "error": "Bad Request",
  "message": "Payload validation failed",
  "details": ["orderNumber is required"]
}
```

**Business Error (422):**
```json
{
  "error": "Unprocessable Entity",
  "message": "Business validation failed",
  "details": ["Order amount exceeds customer credit limit"],
  "sapErrorCode": "V1234"
}
```

### POST /sap/api/delivery
Creates a delivery document.

**Request:**
```json
{
  "sapOrderNumber": "SAP-1234567890-123",
  "shippingPoint": "SP01"
}
```

### POST /sap/api/goods-issue
Posts goods issue for delivery.

**Request:**
```json
{
  "deliveryNumber": "DEL-1234567890-123"
}
```

### POST /sap/api/invoice
Creates an invoice.

**Request:**
```json
{
  "deliveryNumber": "DEL-1234567890-123",
  "amount": 5000
}
```

### POST /sap/api/payment
Posts payment and clears invoice.

**Request:**
```json
{
  "invoiceNumber": "INV-1234567890-123",
  "amount": 5000,
  "currency": "USD"
}
```

### GET /health
Health check endpoint.

## Test Scenarios

### Trigger Validation Errors (400)
- Omit required fields (orderNumber, customerNumber, items)
- Send empty items array
- Send invalid quantity (≤0)

### Trigger Business Errors (422)

**Sales Order:**
- `totalAmount > 100000` - Credit limit exceeded
- `materialNumber: "MAT-999"` - Discontinued material
- `quantity > 1000` - Insufficient stock
- `customerNumber: "CUST-BLOCKED"` - Blocked customer

**Delivery:**
- `sapOrderNumber: "SAP-NOTFOUND"` - Order not found

**Goods Issue:**
- `deliveryNumber: "DEL-NOTREADY"` - Delivery not ready

**Invoice:**
- `deliveryNumber: "DEL-BLOCKED"` - Billing block

**Payment:**
- `amount > 100000` - Amount exceeds invoice

## Response Codes

- **200** - Success
- **400** - Bad Request (validation errors)
- **422** - Unprocessable Entity (business rule violations)
- **500** - Internal Server Error

## Development

```bash
npm run dev
```

Uses nodemon for auto-reload during development.