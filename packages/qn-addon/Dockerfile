# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json yarn.lock ./
COPY packages/crypto/package.json packages/crypto/
COPY packages/orders/package.json packages/orders/
COPY packages/fairscore-middleware/package.json packages/fairscore-middleware/
COPY packages/qn-addon/package.json packages/qn-addon/

# Install all workspace dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY packages/crypto/ packages/crypto/
COPY packages/orders/ packages/orders/
COPY packages/fairscore-middleware/ packages/fairscore-middleware/
COPY packages/qn-addon/ packages/qn-addon/

# Build all packages
RUN yarn build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY package.json yarn.lock ./
COPY packages/crypto/package.json packages/crypto/
COPY packages/orders/package.json packages/orders/
COPY packages/fairscore-middleware/package.json packages/fairscore-middleware/
COPY packages/qn-addon/package.json packages/qn-addon/

RUN yarn install --frozen-lockfile --production

# Copy built output from all packages
COPY --from=builder /app/packages/crypto/dist packages/crypto/dist
COPY --from=builder /app/packages/orders/dist packages/orders/dist
COPY --from=builder /app/packages/fairscore-middleware/dist packages/fairscore-middleware/dist
COPY --from=builder /app/packages/qn-addon/dist packages/qn-addon/dist

ENV NODE_ENV=production
ENV PORT=3030
ENV DB_PATH=/app/data/qn-addon.db

EXPOSE 3030

CMD ["node", "packages/qn-addon/dist/index.js"]
