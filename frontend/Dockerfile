# Multi-stage build для frontend
FROM node:18-alpine AS builder

WORKDIR /app

# Копіюємо package files
COPY package*.json ./

# Встановлюємо залежності
RUN npm ci

# Копіюємо весь код
COPY . .

# Білдимо додаток
RUN npm run build

# Production stage - використовуємо nginx для статики
FROM nginx:alpine

# Копіюємо зібрані файли з builder stage (vite використовує outDir: 'build')
COPY --from=builder /app/build /usr/share/nginx/html

# Копіюємо nginx конфігурацію (якщо потрібна кастомна)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

