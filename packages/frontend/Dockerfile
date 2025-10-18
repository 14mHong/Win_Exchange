FROM node:18-alpine AS build-stage

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies  
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS production-stage

# Install wget for health checks
RUN apk add --no-cache wget

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S appuser
RUN adduser -S appuser -u 1001 -G appuser

# Change ownership and create required directories
RUN chown -R appuser:appuser /usr/share/nginx/html
RUN chown -R appuser:appuser /var/cache/nginx
RUN chown -R appuser:appuser /var/log/nginx
RUN chown -R appuser:appuser /etc/nginx/conf.d
RUN chown -R appuser:appuser /var/run
RUN mkdir -p /var/run && chown -R appuser:appuser /var/run

# Don't switch to non-root user for nginx (it needs root to bind to port 80)
# USER appuser

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]