# Fuel Stations Spain API
This project is a REST API that fetches the realtime prices from the government's public API, and offers them with more filtering options.

Data source: [Spanish government public API](https://datos.gob.es/es/catalogo/e05068001-precio-de-carburantes-en-las-gasolineras-espanolas) | [Endpoints list](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help)

## Import historic data
The API fetches the historic data between the last date on the database and the current date when the API is started, and every day at 01:00 AM, however, the database must have some preloaded data in order to fetch that remaining data.
I have created a [tool](https://github.com/JGeek00/historic-fuel-stations-fetcher) to fetch the historic data from the public API and then import it to the persistent database. Follow the instructions on that repository to fetch the data and import to the database.

## Endpoints
#### `GET /service-stations`
This endpoint returns all the information about the service stations. This endpoint has different operation modes:
- **Normal operation:** It returns the list of service stations as they come from the government API. It offers the parameters ``limit`` and ``offset``. With ``limit`` you define how many items you want to get, and with ``offset`` you choose the index of the first item you want to get. For example, if you want to retrieve items from 100 to 199 you will have to set ``limit`` to 200 and ``offset`` to 100. The API won't give you more than 200 items for each batch.
- **Stations in a municipality:** Use the parameter ``municipalityId`` to get the stations that correspond to that municipality. If you use the ``municipalityId`` parameter, you will get all the stations in that municipality, ignoring the ``limit`` and ``offset`` parameters.
- **Coordinates:** It will return the stations that are in a radius from the given coordinates. With the ``coordinates`` parameter you define the center of the circle (format example: ``coordinates=40.416826,-3.703675``), and with the ``distance`` parameter you define the radius of the circle. The API will return all the service stations that are inside that circle. The distance has to be inputted in Km and cannot be greater than 50.
- **Defined list of service stations:** You can use the parameter ``id``, and pass one or multiple ids of service stations to get the information of them. Example: ``id=1234&id=2345&id=3456``.

#### `GET /historic-prices`
Required parameters:
- **id:** The station id
- **startDate:** The date where you want to start getting results, in format ``yyyy-mm-dd``
- **endDate:** The date where you want to stop getting results, in format ``yyyy-mm-dd``

The maximum difference between ``startDate`` and ``endDate`` cannot be greater than 1 year, and ``startDate`` must be an earlier date than ``endDate``.
That will return a list of prices sorted ASC including also the station id and the date of that values.

Optional parameters:
- **includeCurrentPrices**: This is a boolean flag to add the current prices to the result.

#### `GET /municipalities`
Returns the complete list of municipalities in Spain.

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