# MCP Server Documentation

> **Auto-generated** on 2026-05-15T00:26:44.667Z by `generate-mcp-docs.js`
> **Do not edit manually** — run `pnpm generate:mcp-docs` to regenerate.

## Server

| Property | Value |
|---|---|
| **Name** | `fuel-stations-spain-mcp` |
| **Version** | 1.12.4 |
| **Spec** | OpenMCP 1.0.0 |

### Instructions

MCP server for Fuel Stations Spain API. Query real-time fuel prices, historical data, and municipality information for gas stations across Spain.

## Tools

8 tools available:

| Name | Title | Description |
|---|---|---|
| `compare_fuel_prices` | Compare Fuel Prices | Compare a specific fuel type price across multiple stations. Filter by station I… |
| `find_cheapest_fuel` | Find Cheapest Fuel | Find the N cheapest stations for a specific fuel type. Can search globally or wi… |
| `get_database_status` | Get Database Status | Check the status of both databases (SQLite realtime and PostgreSQL historic). Re… |
| `get_station_info` | Get Station Info | Get complete details of a specific fuel station by its ID. Returns all available… |
| `list_municipalities` | List Municipalities | List Spanish municipalities with optional filters for province, region, or text … |
| `query_fuel_stations` | Query Fuel Stations | Search for fuel stations in Spain by ID, municipality, province, or region. Retu… |
| `query_historic_prices` | Query Historic Prices | Query historical fuel prices for a specific station over a date range. Returns a… |
| `search_stations_by_location` | Search Stations by Location | Find fuel stations within a geographic radius. Provides the center coordinates (… |

### `compare_fuel_prices`

**Compare Fuel Prices**

Compare a specific fuel type price across multiple stations. Filter by station IDs, municipality, or get the cheapest options. Returns stations sorted by the selected fuel price (ascending).

*Source: `src/mcp/tools/compare-fuel-prices.ts`*

<details>
<summary>Parameters</summary>

| Parameter | Type | Required | Description |
|---|---|---|---|
| `fuelType` | enum | yes | The fuel price field to compare |
| `ids` | string[] | no | Array of station IDs to compare |
| `municipalityId` | number | no | Filter by municipality ID |
| `limit` | number | no | Maximum number of results. Default: 50 — min: `1`, max: `200` |

</details>

### `find_cheapest_fuel`

**Find Cheapest Fuel**

Find the N cheapest stations for a specific fuel type. Can search globally or within a geographic radius. Results sorted from cheapest to most expensive.

*Source: `src/mcp/tools/find-cheapest-fuel.ts`*

<details>
<summary>Parameters</summary>

| Parameter | Type | Required | Description |
|---|---|---|---|
| `fuelType` | enum | yes | The fuel price field to search |
| `latitude` | number | no | Center latitude for geographic search — max: `90` |
| `longitude` | number | no | Center longitude for geographic search — max: `180` |
| `distanceKm` | number | no | Search radius in km (10-50). Required when coordinates are provided — min: `10`, max: `50` |
| `limit` | number | no | Number of cheapest stations to return. Default: 10 — min: `1`, max: `200` |

</details>

### `get_database_status`

**Get Database Status**

Check the status of both databases (SQLite realtime and PostgreSQL historic). Returns the last update timestamp, total station count, and PostgreSQL connectivity status.

*Source: `src/mcp/tools/get-database-status.ts`*

### `get_station_info`

**Get Station Info**

Get complete details of a specific fuel station by its ID. Returns all available information including address, coordinates, opening hours, and all current fuel prices.

*Source: `src/mcp/tools/get-station-info.ts`*

<details>
<summary>Parameters</summary>

| Parameter | Type | Required | Description |
|---|---|---|---|
| `stationId` | string | yes | The unique ID of the fuel station |

</details>

### `list_municipalities`

**List Municipalities**

List Spanish municipalities with optional filters for province, region, or text search. Returns municipality IDs, names, province, and autonomous community (region).

*Source: `src/mcp/tools/list-municipalities.ts`*

<details>
<summary>Parameters</summary>

| Parameter | Type | Required | Description |
|---|---|---|---|
| `province` | string | no | Filter by province name |
| `region` | string | no | Filter by autonomous community (region) name |
| `search` | string | no | Search by municipality name (partial match) |

</details>

### `query_fuel_stations`

**Query Fuel Stations**

Search for fuel stations in Spain by ID, municipality, province, or region. Returns current fuel prices and station information. Use limit and offset for pagination.

*Source: `src/mcp/tools/query-fuel-stations.ts`*

<details>
<summary>Parameters</summary>

| Parameter | Type | Required | Description |
|---|---|---|---|
| `ids` | string[] | no | Array of station IDs to lookup |
| `municipalityId` | number | no | Filter by municipality ID |
| `provinceId` | number | no | Filter by province ID |
| `regionId` | number | no | Filter by autonomous community region ID |
| `limit` | number | no | `Maximum number of results (1-${MAX_LIMIT}). Default: 30` — min: `1` |
| `offset` | number | no | Pagination offset. Default: 0 — min: `0` |

</details>

### `query_historic_prices`

**Query Historic Prices**

Query historical fuel prices for a specific station over a date range. Returns a time series of prices sorted chronologically. Maximum date range is 1 year. Optionally includes current prices.

*Source: `src/mcp/tools/query-historic-prices.ts`*

<details>
<summary>Parameters</summary>

| Parameter | Type | Required | Description |
|---|---|---|---|
| `stationId` | string | yes | The unique ID of the fuel station |
| `startDate` | string | yes | Start date in yyyy-mm-dd format |
| `endDate` | string | yes | End date in yyyy-mm-dd format |
| `includeCurrentPrices` | boolean | no | Include current day prices in results. Default: false |

</details>

### `search_stations_by_location`

**Search Stations by Location**

Find fuel stations within a geographic radius. Provides the center coordinates (latitude, longitude) and a distance in kilometers (10-50 km). Returns all stations inside the search area with their current fuel prices.

*Source: `src/mcp/tools/search-by-location.ts`*

<details>
<summary>Parameters</summary>

| Parameter | Type | Required | Description |
|---|---|---|---|
| `latitude` | number | yes | Center latitude (-90 to 90) — max: `90` |
| `longitude` | number | yes | Center longitude (-180 to 180) — max: `180` |
| `distanceKm` | number | no | `Search radius in km (${MIN_DISTANCE}-${MAX_DISTANCE}). Default: 30` |

</details>

## Resources

5 resources available:

| Name | URI | MIME Type | Description |
|---|---|---|---|
| `database-info` | `fuelstations://info/status` | application/json | Current status of the databases: connection state, total station count, and last update timestamp. |
| `fuel-types` | `fuelstations://info/fuel-types` | application/json | List of all available fuel types with their field names, Spanish names, and units. Use the field names when querying prices via tools. |
| `historic-schema` | `fuelstations://schema/historic` | application/json | Schema definition of the HistoricFuelStation table (persistent historic data). Shows all available fields with their types and descriptions. |
| `municipalities-list` | `fuelstations://municipalities/all` | application/json | Complete list of all Spanish municipalities with their IDs, province, and autonomous community (region). |
| `stations-schema` | `fuelstations://schema/stations` | application/json | Schema definition of the FuelStation table (realtime data). Shows all available fields with their types and descriptions. |

---

*Generated on 2026-05-15T00:26:44.667Z from source files in `src/mcp/`*