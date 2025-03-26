FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/jgeek00/fuel-stations-spain-api"

WORKDIR /app

# Copy the source code
COPY src/ src/
COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .

# Install Python required by sqlite3
RUN apk add python3 && ln -sf python3 /usr/bin/python
RUN apk add py3-pip
RUN apk add build-base

# Install dependencies
RUN npm install

# Build the app
RUN npm run build

CMD [ "npm", "start" ]