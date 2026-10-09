FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
ARG BUILD_VERSION=development
ARG BUILD_ARCH="amd64|aarch64"
LABEL io.hass.name="Glow" io.hass.description="Room-first lighting for Home Assistant" io.hass.type="addon" io.hass.version="${BUILD_VERSION}" io.hass.arch="${BUILD_ARCH}"
LABEL org.opencontainers.image.source="https://github.com/schachfeld/easy-mode-lighting"
WORKDIR /app
ENV NODE_ENV=production PORT=8099 DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY packages ./packages
EXPOSE 8099
CMD ["node", "server/index.mjs"]
