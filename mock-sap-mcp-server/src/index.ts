#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SAP_BASE_URL = process.env.SAP_BASE_URL ?? "http://localhost:3001";

async function sapPost(path: string, body: unknown): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${SAP_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function sapGet(path: string, params?: Record<string, string>): Promise<{ status: number; data: unknown }> {
  const url = new URL(`${SAP_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  const data = await res.json();
  return { status: res.status, data };
}

const server = new McpServer({ name: "mock-sap-mcp-server", version: "0.1.0" });

// ── Tool 1: Health Check ──────────────────────────────────────────────────────
server.registerTool(
  "sap_health_check",
  {
    description: "Check if the Mock SAP server is up and running.",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const res = await fetch(`${SAP_BASE_URL}/health`);
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Failed to reach SAP server: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 2: Get Sales Orders ──────────────────────────────────────────────────
server.registerTool(
  "sap_get_sales_orders",
  {
    description:
      "Retrieve all sales orders created in the SAP system. " +
      "Optionally filter by customerNumber, status, or sapOrderNumber.",
    inputSchema: z.object({
      customerNumber: z.string().optional().describe("Filter by customer account number, e.g. CUST-001"),
      status: z.string().optional().describe("Filter by order status, e.g. CREATED"),
      sapOrderNumber: z.string().optional().describe("Filter by SAP order number, e.g. SAP-1234567890-42"),
    }),
  },
  async (input) => {
    try {
      const params: Record<string, string> = {};
      if (input.customerNumber) params.customerNumber = input.customerNumber;
      if (input.status) params.status = input.status;
      if (input.sapOrderNumber) params.sapOrderNumber = input.sapOrderNumber;
      const { status, data } = await sapGet("/sap/api/sales-orders", params);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        isError: status >= 400,
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Request failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 3: Create Sales Order ────────────────────────────────────────────────
server.registerTool(
  "sap_create_sales_order",
  {
    description:
      "Create a sales order in the SAP system. Returns a sapOrderNumber on success. " +
      "Triggers credit-limit error when totalAmount > 100000, blocked-customer error for customerNumber='CUST-BLOCKED', " +
      "discontinued-material error for materialNumber='MAT-999', and stock-shortage error when item quantity > 1000.",
    inputSchema: z.object({
      orderNumber: z.string().describe("Business order number, e.g. ORD-12345"),
      customerNumber: z.string().describe("Customer account number, e.g. CUST-001"),
      totalAmount: z.number().optional().describe("Total order amount in USD"),
      items: z
        .array(
          z.object({
            materialNumber: z.string().describe("Material number, e.g. MAT-001"),
            quantity: z.number().positive().describe("Quantity to order"),
            plant: z.string().describe("Plant code, e.g. P001"),
          })
        )
        .min(1)
        .describe("Line items"),
    }),
  },
  async (input) => {
    try {
      const { status, data } = await sapPost("/sap/api/sales-order", input);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        isError: status >= 400,
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Request failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 4: Create Delivery ───────────────────────────────────────────────────
server.registerTool(
  "sap_create_delivery",
  {
    description:
      "Create a delivery document for an existing SAP sales order. Returns a deliveryNumber on success. " +
      "Use sapOrderNumber='SAP-NOTFOUND' to simulate order-not-found error.",
    inputSchema: z.object({
      sapOrderNumber: z.string().describe("SAP order number returned by sap_create_sales_order"),
      shippingPoint: z.string().describe("Shipping point code, e.g. SP01"),
    }),
  },
  async (input) => {
    try {
      const { status, data } = await sapPost("/sap/api/delivery", input);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        isError: status >= 400,
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Request failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 5: Post Goods Issue ──────────────────────────────────────────────────
server.registerTool(
  "sap_post_goods_issue",
  {
    description:
      "Post goods issue for a delivery document. Returns a materialDocument on success. " +
      "Use deliveryNumber='DEL-NOTREADY' to simulate a delivery-not-ready error.",
    inputSchema: z.object({
      deliveryNumber: z.string().describe("Delivery number returned by sap_create_delivery"),
    }),
  },
  async (input) => {
    try {
      const { status, data } = await sapPost("/sap/api/goods-issue", input);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        isError: status >= 400,
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Request failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 6: Create Invoice ────────────────────────────────────────────────────
server.registerTool(
  "sap_create_invoice",
  {
    description:
      "Create an invoice for a delivery. Returns an invoiceNumber on success. " +
      "Use deliveryNumber='DEL-BLOCKED' to simulate a billing-block error. " +
      "amount is optional; if omitted, SAP auto-calculates it.",
    inputSchema: z.object({
      deliveryNumber: z.string().describe("Delivery number returned by sap_create_delivery"),
      amount: z.number().positive().optional().describe("Invoice amount in USD (auto-calculated if omitted)"),
    }),
  },
  async (input) => {
    try {
      const { status, data } = await sapPost("/sap/api/invoice", input);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        isError: status >= 400,
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Request failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 7: Post Payment ──────────────────────────────────────────────────────
server.registerTool(
  "sap_post_payment",
  {
    description:
      "Post payment and clear an invoice in SAP. Returns a clearingDocument on success. " +
      "Triggers payment-amount-exceeded error when amount > 100000. currency defaults to USD.",
    inputSchema: z.object({
      invoiceNumber: z.string().describe("Invoice number returned by sap_create_invoice"),
      amount: z.number().positive().describe("Payment amount"),
      currency: z.string().default("USD").describe("ISO currency code, e.g. USD"),
    }),
  },
  async (input) => {
    try {
      const { status, data } = await sapPost("/sap/api/payment", input);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        isError: status >= 400,
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Request failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`mock-sap-mcp-server running (SAP_BASE_URL=${SAP_BASE_URL})`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
