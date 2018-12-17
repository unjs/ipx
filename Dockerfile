
FROM node

WORKDIR /app
EXPOSE 3000
ENV NODE_ENV=production
VOLUME ["/app/storage", "/app/cache"]
CMD ipx

ADD . /app/

RUN yarn --frozen-lockfile && \
    yarn build && \
    yarn cache clean && \
    mkdir -p /app/storage /app/cache
