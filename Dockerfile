FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install dependencies
RUN npm ci

# Copy source code
COPY server/ ./server/
COPY client/ ./client/
COPY scripts/ ./scripts/
COPY database/ ./database/

# Build client
RUN npm run build --workspace=client

# Build server
RUN npm run build --workspace=server

# Create data directory
RUN mkdir -p /data

EXPOSE 3000

CMD ["npm", "start"]
