# Stage 1 – Build the React PWA
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

# VITE_AUTH_BASE_URL is injected at build time so the PWA knows where to call auth-service
ARG VITE_AUTH_BASE_URL=http://localhost/api/auth
ENV VITE_AUTH_BASE_URL=$VITE_AUTH_BASE_URL

RUN npm run build

# Stage 2 – Serve with Nginx
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our SPA nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built PWA files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

