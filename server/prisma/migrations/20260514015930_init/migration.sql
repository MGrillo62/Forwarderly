-- CreateEnum
CREATE TYPE "EmpresaEstado" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "UsuarioEstado" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VENDEDOR');

-- CreateEnum
CREATE TYPE "CotizacionEstado" AS ENUM ('BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "OrdenEstado" AS ENUM ('COORDINACION_EMBARQUE', 'EN_TRANSITO', 'EN_PUERTO', 'NUMERADA', 'ENTREGADA', 'DESPACHO_CULMINADO');

-- CreateEnum
CREATE TYPE "CanalImportacion" AS ENUM ('VERDE', 'NARANJA', 'ROJO');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "contacto" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "estado" "EmpresaEstado" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "celular" TEXT,
    "correo" TEXT NOT NULL,
    "estado" "UsuarioEstado" NOT NULL DEFAULT 'ACTIVO',
    "rol" "Rol" NOT NULL,
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "contacto" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "correos" TEXT[],
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concepto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "incluirPorDefecto" BOOLEAN NOT NULL DEFAULT false,
    "categoriaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Concepto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "estado" "CotizacionEstado" NOT NULL DEFAULT 'BORRADOR',
    "clienteId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "totalVenta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "utilidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "porcentajeUtilidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionLinea" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "conceptoId" TEXT NOT NULL,
    "proveedorId" TEXT,
    "costo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioVenta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorVenta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "utilidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margen" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CotizacionLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Orden" (
    "id" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "nroBL" TEXT,
    "nroDAM" TEXT,
    "canal" "CanalImportacion",
    "fechaETD" TIMESTAMP(3),
    "fechaETA" TIMESTAMP(3),
    "fechaRealEntrega" TIMESTAMP(3),
    "referencia" TEXT,
    "email" TEXT,
    "estado" "OrdenEstado" NOT NULL DEFAULT 'COORDINACION_EMBARQUE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenEstadoHistorial" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "estado" "OrdenEstado" NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenEstadoHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenPago" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "modo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetodoPago" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "MetodoPago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_ruc_key" ON "Empresa"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_ruc_empresaId_key" ON "Cliente"("ruc", "empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_ruc_empresaId_key" ON "Proveedor"("ruc", "empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Orden_cotizacionId_key" ON "Orden"("cotizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "MetodoPago_nombre_key" ON "MetodoPago"("nombre");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concepto" ADD CONSTRAINT "Concepto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionLinea" ADD CONSTRAINT "CotizacionLinea_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionLinea" ADD CONSTRAINT "CotizacionLinea_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "Concepto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionLinea" ADD CONSTRAINT "CotizacionLinea_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenEstadoHistorial" ADD CONSTRAINT "OrdenEstadoHistorial_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenPago" ADD CONSTRAINT "OrdenPago_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
