FROM node:23-alpine3.20

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY . /usr/src/app/

RUN apk update && apk upgrade && npm i

EXPOSE 8080

CMD [ "node", "index.js" ]
