# MCP Server — Fuel Stations Spain API

> Base URL: `http://localhost:3000/mcp`

---

## 1. Initial call (no sessionId)

First `POST` to initialize the session. The server generates a `sessionId` and returns it in the response headers.

### Request

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": {
        "name": "my-client",
        "version": "1.0.0"
      }
    }
  }'
```

### Response headers

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
mcp-session-id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Response body (SSE)

```text
event: message
data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-11-25","capabilities":{"tools":{},"resources":{}},"serverInfo":{"name":"fuel-stations-spain-mcp","version":"1.11.0"},"instructions":"MCP server for Fuel Stations Spain API. Query real-time fuel prices, historical data, and municipality information for gas stations across Spain."}}
```

---

## 2. Tools list (with sessionId)

Second `POST` including the `mcp-session-id` returned in the previous step.

### Request

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

### Response headers

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
mcp-session-id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Response body (SSE)

```text
event: message
data: {"jsonrpc":"2.0","id":2,"result":{"tools":[
  {"name":"query_fuel_stations","description":"Search for fuel stations in Spain by ID, municipality, province, or region..."},
  {"name":"search_by_location","description":"Search for fuel stations near given coordinates..."},
  {"name":"get_station_info","description":"Get detailed information about a specific fuel station..."},
  {"name":"query_historic_prices","description":"Query historical fuel prices for a station..."},
  {"name":"list_municipalities","description":"List Spanish municipalities..."},
  {"name":"compare_fuel_prices","description":"Compare fuel prices between stations..."},
  {"name":"find_cheapest_fuel","description":"Find the cheapest fuel in an area..."},
  {"name":"get_database_status","description":"Check the status of both databases (SQLite realtime and PostgreSQL historic)..."}
]}}
```
