FROM node:20-alpine
LABEL org.opencontainers.image.source="https://github.com/jgeek00/fuel-stations-spain-api"

WORKDIR /app

COPY src/ src/
COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .

RUN npm install

RUN npm run build

CMD [ "npm", "start" ]