# Sistema de Cotizaciones y Órdenes de Importación (Perú)

Este sistema permite gestionar todo el flujo de importación, desde la cotización hasta la entrega final y cobro.

## Tecnologías
- **Backend**: Node.js, Express, Prisma, PostgreSQL (Neon).
- **Frontend**: React (Vite), Lucide Icons, CSS Nativo.

## Configuración Inicial

### Backend
1. Entrar a la carpeta `server`.
2. Instalar dependencias: `npm install`.
3. Configurar el archivo `.env`:
   ```env
   DATABASE_URL="tu_url_de_neon_postgresql"
   JWT_SECRET="una_clave_secreta_segura"
   PORT=5000
   ```
4. Ejecutar migraciones: `npx prisma migrate dev --name init`.
5. Ejecutar la semilla (para crear el Super Admin): `npm run seed`.
   - Usuario por defecto: `superadmin`
   - Contraseña: `admin123`
6. Iniciar en desarrollo: `npm run dev`.

### Frontend
1. Entrar a la carpeta `client`.
2. Instalar dependencias: `npm install`.
3. Iniciar en desarrollo: `npm run dev`.

## Despliegue en Railway

### Backend
1. Conectar el repositorio a Railway.
2. Configurar las variables de entorno en el dashboard de Railway.
3. El archivo `railway.json` ya está configurado.

### Frontend
1. El frontend se puede desplegar en Railway (usando un static builder) o en Vercel/Netlify.
2. Asegurarse de actualizar la URL del API en el frontend si es necesario.

## Funcionalidades Core
- **Cotizador Dinámico**: Cálculos automáticos de IGV (18%), Utilidad y Margen.
- **Flujo de Órdenes**: Conversión automática al aprobar cotizaciones.
- **Seguimiento de Importación**: Gestión de BL, DAM, Canal (Verde/Naranja/Rojo) y fechas ETD/ETA.
- **Control de Pagos**: Registro de pagos múltiples (Yape, Plin, Transferencia).
- **Roles**: Super Admin, Administrador de Empresa y Vendedor.
