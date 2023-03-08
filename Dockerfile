FROM node:14-alpine

WORKDIR /usr/src/cli

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY src ./src
COPY tsconfig.json ./tsconfig.json
COPY bin ./bin


RUN yarn build

WORKDIR /usr/src/app

ENTRYPOINT ["../cli/bin/run"]
