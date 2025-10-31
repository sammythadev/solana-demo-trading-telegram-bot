# --- Dockerfile for the Solana Demo Trading Bot ---
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN pnpm install --production

# Copy source files
COPY . .

# Expose a port (optional — for metrics or web)
EXPOSE 3000

# Default start command
CMD ["pnpm", "run", "dev"]
