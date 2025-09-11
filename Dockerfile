# Multi-stage build para optimizar el tamaño de la imagen
FROM node:18-alpine AS builder

# Instalar dependencias del sistema necesarias para Prisma
RUN apk add --no-cache openssl

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm ci && npm cache clean --force

# Generar cliente de Prisma
RUN npx prisma generate

# Copiar código fuente
COPY . .

# Compilar la aplicación
RUN npm run build

# Imagen de producción
FROM node:18-alpine AS production

# Instalar dependencias del sistema
RUN apk add --no-cache openssl

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos necesarios desde el builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# CRÍTICO: Crear todos los directorios que la aplicación pueda necesitar
RUN mkdir -p /app/uploads /app/uploads/current /app/uploads/historic && \
    chown -R nestjs:nodejs /app/uploads

# CRÍTICO: Crear directorio temporal para cualquier escritura de archivos
RUN mkdir -p /tmp/app && chown -R nestjs:nodejs /tmp/app

# Cambiar al usuario no-root
USER nestjs

# Exponer puerto
EXPOSE 4000

# Comando de inicio
CMD ["npm", "run", "start:prod"]
