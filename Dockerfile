FROM node

WORKDIR /app
EXPOSE 3000
ENV NODE_ENV=production
VOLUME ["/app/storage", "/app/cache"]
CMD ./node_modules/.bin/bak start

ADD package.json package-lock.json /app/
RUN npm i --save-prod && mkdir -p /app/storage /app/cache

ADD . /app/
