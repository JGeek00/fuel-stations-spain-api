# Fuel Stations Spain API
This project is a backend service that offers a REST API and a MCP server. It fetches the realtime prices from the government's public API, and offers them with more filtering options.

Data source: [Spanish government public API](https://datos.gob.es/es/catalogo/e05068001-precio-de-carburantes-en-las-gasolineras-espanolas) | [Endpoints list](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help)

## Environment variables

### Server

| Variable | Description | Required | Default |
|---|---|---|---|
| `PORT` | Port the server listens on | No | `3000` |
| `NODE_ENV` | Application environment (`development` or `production`) | No | `development` |
| `TZ` | IANA timezone (e.g. `Europe/Madrid`) | No | System default |
| `REALTIME_DATA_CRON` | Cron expression for fetching realtime fuel prices | No | `0,30 * * * *` |

### PostgreSQL Database

> These variables are optional. If `POSTGRES_HOST` is set (along with the other DB credentials), the application uses a persistent PostgreSQL database. Otherwise it runs with an in-memory database only.

| Variable | Description | Required | Default |
|---|---|---|---|
| `POSTGRES_HOST` | PostgreSQL host address | No | — |
| `POSTGRES_PORT` | PostgreSQL port | No | `5432` |
| `POSTGRES_USER` | PostgreSQL username | No | — |
| `POSTGRES_PASSWORD` | PostgreSQL password | No | — |
| `POSTGRES_DATABASE` | PostgreSQL database name | No | — |

### Monitoring

| Variable | Description | Required | Default |
|---|---|---|---|
| `SENTRY_DSN` | Sentry DSN for error tracking | No | — |
| `PRODUCTION` | Enable production mode (used to activate Sentry) | No | `false` |

### Endpoint Control

| Variable | Description | Required | Default |
|---|---|---|---|
| `DISABLE_SERVICE_STATIONS` | Disable the service stations (realtime prices) endpoint | No | `false` |
| `DISABLE_SERVICE_STATIONS_HISTORIC` | Disable the historic prices endpoint | No | `false` |
| `DISABLE_MUNICIPALITIES` | Disable the municipalities endpoint | No | `false` |

### Historic Data

| Variable | Description | Required | Default |
|---|---|---|---|
| `HISTORIC_DATA_MAX_RANGE` | Maximum date range for historic price queries. Format: `XyXm` (e.g. `4y6m` = 4 years and 6 months), `Xy`, or `Xm`. Minimum: `6m`. | No | No limit |

### MCP Server

| Variable | Description | Required | Default |
|---|---|---|---|
| `ENABLE_MCP` | Enable or disable the MCP server | No | `true` |
| `MCP_ALLOWED_ORIGINS` | Comma-separated list of allowed origins for DNS rebinding protection. Use `*` to allow all (development only). | No | All allowed |
| `MCP_ALLOWED_HOSTS` | Comma-separated list of allowed `Host` headers | No | All allowed |
| `MCP_SESSION_TIMEOUT_MS` | Maximum idle time before an MCP session is cleaned up (milliseconds) | No | `86400000` (24 h) |
| `MCP_MAX_SESSIONS` | Maximum number of concurrent MCP sessions | No | `100` |
| `MCP_SESSION_CLEANUP_INTERVAL_MS` | Interval between MCP session cleanup runs (milliseconds) | No | `300000` (5 min) |

## Import historic data
The API fetches the historic data between the last date on the database and the current date when the API is started, and every day at 01:00 AM, however, the database must have some preloaded data in order to fetch that remaining data.
I have created a [tool](https://github.com/JGeek00/historic-fuel-stations-fetcher) to fetch the historic data from the public API and then import it to the persistent database. Follow the instructions on that repository to fetch the data and import to the database.

## API documentation
There's an [OpenAPI file](https://github.com/JGeek00/fuel-stations-spain-api/blob/master/docs/openapi.yaml) with the API specification. You can paste the contents of that file on the [Swagger Editor](https://editor.swagger.io) to have a better look.

## Donations
If you like the project and you want to contribute with the development, you can [become a sponsor on GitHub](https://github.com/sponsors/JGeek00), or you can donate using PayPal.

<div align="center">
  <a href="https://www.paypal.com/donate/?hosted_button_id=T63UK6AVL3MG8">
    <img src="https://raw.githubusercontent.com/stefan-niedermann/paypal-donate-button/master/paypal-donate-button.png" alt="Donate with PayPal" height="100" />
  </a>
</div>

<br>
<br>
<br>
<br>

##### Created by JGeek00