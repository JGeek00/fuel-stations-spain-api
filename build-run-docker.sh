#!/bin/bash
docker build . -t fuel-stations-spain-api
docker run -d --restart always -p 5600:3000 --name fssa fuel-stations-spain-api