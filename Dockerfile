FROM node:20-alpine

WORKDIR /app

COPY src/ src/
COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .

RUN npm install

RUN npm run build

CMD [ "npm", "start" ]