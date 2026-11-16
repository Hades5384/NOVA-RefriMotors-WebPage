-- ==============================================================================
-- NOVA REFRIMOTORS ERP - ESQUEMA DE BASE DE DATOS SUPABASE (PostgreSQL)
-- Copia y pega todo este código en el SQL Editor de tu proyecto Supabase y presiona RUN.
-- ==============================================================================

-- 1. TABLA: PRODUCTOS Y EXISTENCIAS
CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    nombre TEXT NOT NULL,
    categoria TEXT DEFAULT 'General',
    modelo TEXT,
    descripcion TEXT,
    costo_compra NUMERIC(12,2) DEFAULT 0.00,
    precio_novacliente NUMERIC(12,2) DEFAULT 0.00,
    imagenes JSONB DEFAULT '[]'::jsonb,
    specs JSONB DEFAULT '{}'::jsonb,
    stock INTEGER DEFAULT 0,
    stock_minimo INTEGER DEFAULT 3,
    ubicacion TEXT DEFAULT 'Almacén Central',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: CLIENTES Y TALLERES (CRM)
CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    rif TEXT NOT NULL,
    telefono TEXT,
    direccion TEXT,
    tipo TEXT DEFAULT 'publico', -- 'publico' | 'novacliente'
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: PEDIDOS DE MOSTRADOR EN ESPERA (Comunicación VENTAS01/02/03 -> MASTER)
CREATE TABLE IF NOT EXISTS pedidos_mostrador (
    id TEXT PRIMARY KEY,
    estacion TEXT NOT NULL,      -- 'VENTAS01' | 'VENTAS02' | 'VENTAS03'
    vendedor TEXT NOT NULL,
    cliente JSONB NOT NULL,
    items JSONB NOT NULL,
    tipo_precio TEXT DEFAULT 'publico',
    total_usd NUMERIC(12,2) DEFAULT 0.00,
    total_bs NUMERIC(12,2) DEFAULT 0.00,
    estado TEXT DEFAULT 'pendiente', -- 'pendiente' | 'atendido' | 'descartado'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: VENTAS Y COMPROBANTES FISCALES/DESPACHO
CREATE TABLE IF NOT EXISTS ventas (
    id TEXT PRIMARY KEY,
    timestamp BIGINT,
    fecha_str TEXT,
    hora_str TEXT,
    cliente JSONB,
    items JSONB,
    tipo_precio TEXT,
    tipo_documento TEXT,         -- 'factura' | 'nota_entrega' | 'presupuesto'
    tasa_bcv NUMERIC(12,2),
    total_usd NUMERIC(12,2),
    total_bs NUMERIC(12,2),
    metodos_pago JSONB,
    monto_pagado_usd NUMERIC(12,2),
    monto_pagado_bs NUMERIC(12,2),
    vuelto_usd NUMERIC(12,2),
    vuelto_bs NUMERIC(12,2),
    vendedor TEXT,               -- Estación que originó el pedido (VENTAS01, etc.)
    cajero TEXT DEFAULT 'MASTER', -- Usuario que cobró y emitió
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA: TURNOS Y CIERRES DE CAJA (ARQUEO X / Z)
CREATE TABLE IF NOT EXISTS turnos_caja (
    id TEXT PRIMARY KEY,
    fecha_apertura TEXT,
    fecha_cierre TEXT,
    monto_inicial_usd NUMERIC(12,2) DEFAULT 0.00,
    monto_inicial_bs NUMERIC(12,2) DEFAULT 0.00,
    estado TEXT DEFAULT 'abierto',
    ventas_ids JSONB DEFAULT '[]'::jsonb,
    egresos_ids JSONB DEFAULT '[]'::jsonb,
    arqueo_fisico JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA: GASTOS Y EGRESOS DE CAJA
CREATE TABLE IF NOT EXISTS egresos (
    id TEXT PRIMARY KEY,
    timestamp BIGINT,
    fecha_str TEXT,
    concepto TEXT NOT NULL,
    categoria TEXT,
    monto_usd NUMERIC(12,2) DEFAULT 0.00,
    monto_bs NUMERIC(12,2) DEFAULT 0.00,
    metodo_pago TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA: PROVEEDORES
CREATE TABLE IF NOT EXISTS proveedores (
    id TEXT PRIMARY KEY,
    razon_social TEXT NOT NULL,
    rif TEXT NOT NULL,
    telefono TEXT,
    contacto TEXT,
    rubro TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLA: COMPRAS A PROVEEDORES
CREATE TABLE IF NOT EXISTS compras (
    id TEXT PRIMARY KEY,
    timestamp BIGINT,
    fecha_str TEXT,
    proveedor_id TEXT,
    proveedor_nombre TEXT,
    factura_numero TEXT,
    items JSONB,
    total_usd NUMERIC(12,2) DEFAULT 0.00,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABLA: AUDITORÍA DE MOVIMIENTOS DE STOCK (Kardex)
CREATE TABLE IF NOT EXISTS movimientos_stock (
    id BIGSERIAL PRIMARY KEY,
    producto_id TEXT NOT NULL,
    new_stock INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- HABILITAR POLÍTICAS DE ACCESO PÚBLICO / ANON PARA LAS TABLAS (REST API)
-- Permite que la clave anónima/publishable del navegador pueda leer y escribir.
-- ==============================================================================
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_mostrador ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE egresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- Crear políticas universales de lectura y escritura para el frontend SPA
CREATE POLICY "Permitir todo en productos" ON productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en clientes" ON clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en pedidos_mostrador" ON pedidos_mostrador FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en ventas" ON ventas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en turnos_caja" ON turnos_caja FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en egresos" ON egresos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en proveedores" ON proveedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en compras" ON compras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo en movimientos_stock" ON movimientos_stock FOR ALL USING (true) WITH CHECK (true);
