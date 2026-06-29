# mock-sap-mcp-server

MCP server wrapping the Mock SAP order-to-cash REST API. Supports two transport modes:

- **stdio** (default) — spawned as a child process by an MCP host
- **http** — listens as a Streamable HTTP server, suitable for remote/aggregator clients

## Tools

| Tool | Description |
|---|---|
| `sap_health_check` | Check if the Mock SAP server is up |
| `sap_get_sales_orders` | List sales orders (filterable) |
| `sap_create_sales_order` | Create a sales order |
| `sap_create_delivery` | Create a delivery document |
| `sap_post_goods_issue` | Post goods issue for a delivery |
| `sap_create_invoice` | Create an invoice for a delivery |
| `sap_post_payment` | Post payment and clear an invoice |

## Prerequisites

- Node.js 18+
- Mock SAP REST server running (see `../mock-sap-server`)

## Build

```bash
npm install
npm run build
```

## Running

### HTTP mode (recommended for aggregator/remote clients)

```bash
MCP_TRANSPORT=http \
MCP_PORT=3002 \
SAP_BASE_URL=http://localhost:3001 \
node build/index.js
```

The server will listen at `http://localhost:3002/mcp`.

### stdio mode (for direct MCP host integration)

```bash
SAP_BASE_URL=http://localhost:3001 node build/index.js
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` |
| `MCP_PORT` | `3002` | HTTP port (only used when `MCP_TRANSPORT=http`) |
| `SAP_BASE_URL` | `http://localhost:3001` | Base URL of the Mock SAP REST API |

## Bob MCP config (stdio mode)

If you want Bob to connect directly via stdio, add to `~/.bob/settings/mcp.json`:

```json
{
  "mcpServers": {
    "mock-sap": {
      "command": "node",
      "args": ["/Users/moyjom/my-repos/order-to-cash/mock-sap-mcp-server/build/index.js"],
      "env": {
        "SAP_BASE_URL": "http://localhost:3001"
      }
    }
  }
}
```

> **Note:** If you are using the `polaris-backend/mcp-server` aggregator, start this server in
> HTTP mode instead and do **not** register it in Bob — the aggregator proxies all SAP tools.
