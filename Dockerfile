# Build context is the workspace root (both `core/` and `webclient/` as siblings), NOT
# `webclient/` alone - `core` is still consumed as a `file:` dependency (ADR-0009's "GitHub
# Packages npm registry" step hasn't landed), mirroring the `SQUADDLE_CORE_DIR` sibling-checkout
# convention already used everywhere else in this org. See `.github/workflows/release.yml`,
# which checks out `core`, builds its js library, then runs `docker build -f webclient/Dockerfile .`
# from the workspace root.
FROM node:22-alpine AS build
WORKDIR /workspace
COPY core/build/dist/js/productionLibrary /workspace/core/build/dist/js/productionLibrary
COPY webclient /workspace/webclient
WORKDIR /workspace/webclient
RUN npm install
RUN npm run build

# nginx-unprivileged already runs as non-root on port 8080 by default - same reasoning as
# website/Dockerfile.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY webclient/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/webclient/dist /usr/share/nginx/html
EXPOSE 8080
