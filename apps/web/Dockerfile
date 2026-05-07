FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm install

# Copy frontend source — overridden at runtime by the docker-compose volume mount
COPY apps/web/ .

# Copy shared types so tsc can resolve the @shared/* path alias.
COPY libs/shared-types/ /app/shared/

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
