FROM node:16.17.0-alpine

WORKDIR /flatss/

COPY package.json .
COPY package-lock.json .

RUN npm install -g

COPY . .

CMD ["node","index.js"]