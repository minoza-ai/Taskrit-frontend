# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time API base for Vite (optional)
ARG VITE_API_BASE=/api
ARG VITE_CHAT_API_BASE=/chat-api
ARG VITE_CHAT_WS_BASE=ws://localhost:3001/ws
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_CHAT_API_BASE=$VITE_CHAT_API_BASE
ENV VITE_CHAT_WS_BASE=$VITE_CHAT_WS_BASE

RUN npm run build

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

COPY --from=builder /app/dist ./
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
