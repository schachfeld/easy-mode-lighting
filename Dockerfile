FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
ARG BUILD_VERSION=1.0.0
ARG BUILD_ARCH
LABEL io.hass.name="Glow" io.hass.description="Room-first lighting for Home Assistant" io.hass.type="addon" io.hass.version="${BUILD_VERSION}" io.hass.arch="${BUILD_ARCH}"
WORKDIR /app
ENV NODE_ENV=production PORT=8099 DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
EXPOSE 8099
CMD ["node", "server/index.mjs"]
