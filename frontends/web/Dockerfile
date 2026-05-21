FROM node:22-alpine

WORKDIR /app

# Copy workspace metadata first for layer caching — npm needs all workspace
# package.json files present to resolve the monorepo dependency tree.
COPY package.json package-lock.json ./
COPY frontends/web/package.json frontends/web/
COPY frontends/mobile/package.json frontends/mobile/
COPY libs/shared-types/package.json libs/shared-types/
COPY libs/api-client/package.json libs/api-client/
COPY libs/design-tokens/package.json libs/design-tokens/

RUN npm install

# Copy all source (overridden by docker-compose volume mounts in dev).
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "-w", "frontends/web", "--", "--host", "0.0.0.0"]
