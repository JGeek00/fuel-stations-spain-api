# Fuel Stations Spain API
This project is a backend service that offers a REST API and a MCP server. It fetches the realtime prices from the government's public API, and offers them with more filtering options.

Data source: [Spanish government public API](https://datos.gob.es/es/catalogo/e05068001-precio-de-carburantes-en-las-gasolineras-espanolas) | [Endpoints list](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help)

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