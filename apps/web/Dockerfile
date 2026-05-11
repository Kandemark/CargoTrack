FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm install

# Copy frontend source — overridden at runtime by the docker-compose volume mount
COPY . .

# Copy shared types from additional context so tsc can resolve @shared/*.
COPY --from=shared-types . /app/shared/

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
