# Variables de Entorno para Render

## Variables Requeridas

### Base de Datos
- `DATABASE_URL`: URL de conexión a PostgreSQL
  ```
  postgresql://username:password@host:port/database?sslmode=require
  ```

### JWT
- `JWT_SECRET`: Clave secreta para firmar tokens JWT
- `JWT_EXPIRES_IN`: Tiempo de expiración de tokens (ej: "7d")

### CORS
- `ALLOWED_ORIGINS`: URLs permitidas para CORS (separadas por coma)
  ```
  https://frontsanpedro.vercel.app,https://tudominio.com,https://www.tudominio.com
  ```
  
  **Nota**: Si no se especifica esta variable, se usará por defecto:
  - `https://frontsanpedro.vercel.app` (frontend en Vercel)
  - `http://localhost:3000` (desarrollo local)
  - `http://localhost:5173` (otros dev servers)

### Google OAuth (si usas autenticación con Google)
- `GOOGLE_CLIENT_ID`: ID del cliente de Google OAuth
- `GOOGLE_CLIENT_SECRET`: Secreto del cliente de Google OAuth
- `GOOGLE_CALLBACK_URL`: URL de callback para Google OAuth

## Configuración en Render

1. Ve a tu servicio en Render Dashboard
2. Navega a Environment > Environment Variables
3. Agrega cada variable con su valor correspondiente
4. Haz click en "Save Changes"

## Configuración en GitHub Secrets

Para el deploy automático con GitHub Actions, necesitas configurar estos secrets:

1. `RENDER_API_KEY`: Tu API key de Render
2. `RENDER_SERVICE_ID`: El ID de tu servicio en Render

### Cómo obtener estos valores:

1. **RENDER_API_KEY**: 
   - Ve a tu perfil en Render > Account Settings > API Keys
   - Crea una nueva API key

2. **RENDER_SERVICE_ID**: 
   - Ve a tu servicio en Render
   - En Settings > General, encontrarás el Service ID

## ⚠️ IMPORTANTE - Seguridad

- **NUNCA** pongas credenciales reales en archivos de código
- **NUNCA** subas archivos .env con credenciales
- **SIEMPRE** usa variables de entorno en Render
- **SIEMPRE** usa GitHub Secrets para tokens de API
