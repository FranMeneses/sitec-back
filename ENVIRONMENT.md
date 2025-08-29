# Variables de Entorno para Vercel

## Variables Requeridas

### Base de Datos
- `DATABASE_URL`: URL de conexión a PostgreSQL (ej: postgresql://user:pass@host:port/db)

### JWT
- `JWT_SECRET`: Clave secreta para firmar tokens JWT
- `JWT_EXPIRES_IN`: Tiempo de expiración de tokens (ej: "7d")

### Google OAuth
- `GOOGLE_CLIENT_ID`: ID del cliente de Google OAuth
- `GOOGLE_CLIENT_SECRET`: Secreto del cliente de Google OAuth
- `GOOGLE_CALLBACK_URL`: URL de callback para Google OAuth

## Configuración en Vercel

1. Ve a tu proyecto en Vercel Dashboard
2. Navega a Settings > Environment Variables
3. Agrega cada variable con su valor correspondiente
4. Asegúrate de que estén marcadas para "Production" y "Preview"

## Configuración en GitHub Secrets

Para el deploy automático, necesitas configurar estos secrets en tu repositorio:

1. `VERCEL_TOKEN`: Token de acceso de Vercel
2. `ORG_ID`: ID de tu organización en Vercel
3. `PROJECT_ID`: ID de tu proyecto en Vercel

### Cómo obtener estos valores:

1. **VERCEL_TOKEN**: 
   - Ve a Vercel Dashboard > Settings > Tokens
   - Crea un nuevo token

2. **ORG_ID y PROJECT_ID**:
   - Ve a tu proyecto en Vercel
   - En Settings > General, encontrarás estos IDs
