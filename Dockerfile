FROM node:20-alpine

ENV TZ=Europe/Madrid \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

COPY src/ src/
COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .

RUN npm install

RUN npm run build

CMD [ "npm", "start" ]