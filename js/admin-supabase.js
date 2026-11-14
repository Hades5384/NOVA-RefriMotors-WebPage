/**
 * ==============================================================================
 * NOVA REFRIMOTORS - CONECTOR Y SINCRONIZADOR SUPABASE (admin-supabase.js)
 * ==============================================================================
 * Capa de integración Híbrida:
 * - Local-First garantizado (Persistencia instantánea en localStorage)
 * - Sincronización en la nube con Supabase (PostgreSQL)
 * - Cola de contingencia para trabajar sin internet y sincronizar al reconectar
 * - Carga masiva inicial del catálogo de 460 productos y variantes
 * - Widget visual de estado en tiempo real (Nube Conectada / Modo Local)
 * ==============================================================================
 */

const NovaSupabase = (function () {
    const DEFAULT_CONFIG = {
        url: "https://krsahhdkxfeehyernwmf.supabase.co",
        key: "sb_publishable_4dLnKHj89ri1Z9qV0JE3mw_nRGLhxbE",
        autoSync: true,
        syncIntervalSeconds: 30
    };

    let _client = null;
    let _syncTimer = null;
    let _isSyncing = false;
    let _isOnline = navigator.onLine;

    // Claves de almacenamiento local para estado de sincronización
    const STORAGE_KEY_CONFIG = 'nova_supabase_config';
    const STORAGE_KEY_QUEUE = 'nova_supabase_offline_queue';

    function _getConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
            return raw ? Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw)) : DEFAULT_CONFIG;
        } catch (e) {
            return DEFAULT_CONFIG;
        }
    }

    function _saveConfig(cfg) {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
    }

    function _getQueue() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_QUEUE);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function _saveQueue(q) {
        localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(q));
        _updateUIStatus();
    }

    function _enqueue(action, table, data) {
        const queue = _getQueue();
        queue.push({
            id: 'Q-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            action, // 'insert' | 'update' | 'upsert'
            table,
            data,
            timestamp: Date.now()
        });
        _saveQueue(queue);
        // Intentar procesar de inmediato si hay conexión
        if (_isOnline && !_isSyncing) {
            processQueue();
        }
    }

    // ==========================================
    // 1. INICIALIZACIÓN DEL CLIENTE
    // ==========================================
    function init() {
        const cfg = _getConfig();

        if (typeof window.supabase !== 'undefined' && cfg.url && cfg.key) {
            try {
                _client = window.supabase.createClient(cfg.url, cfg.key, {
                    auth: { persistSession: false }
                });
                console.log("🟢 NovaSupabase: Cliente inicializado correctamente.");
            } catch (err) {
                console.warn("⚠️ NovaSupabase: Error al inicializar cliente:", err);
                _client = null;
            }
        } else {
            console.warn("⚠️ NovaSupabase: Librería supabase-js no disponible o faltan credenciales.");
        }

        // Monitorear conectividad de red
        window.addEventListener('online', () => {
            _isOnline = true;
            console.log("🌐 Conexión a internet restaurada. Procesando sincronización...");
            _updateUIStatus();
            processQueue();
            checkAndSeedCatalog();
        });

        window.addEventListener('offline', () => {
            _isOnline = false;
            console.warn("📡 Sin conexión a internet. Activando Modo Local de contingencia.");
            _updateUIStatus();
        });

        // Intervalo periódico de sincronización de cola
        if (cfg.autoSync) {
            if (_syncTimer) clearInterval(_syncTimer);
            _syncTimer = setInterval(() => {
                if (_isOnline && !_isSyncing) {
                    processQueue();
                }
            }, (cfg.syncIntervalSeconds || 30) * 1000);
        }

        // Interceptar métodos de NovaDB para sincronización transparente
        _hookNovaDB();

        // Actualizar interfaz inicial
        _updateUIStatus();

        // Verificar si la base de datos necesita carga inicial de los 460 productos
        setTimeout(() => {
            checkAndSeedCatalog();
        }, 1500);
    }

    // ==========================================
    // 2. INTERCEPTOR TRANSPARENTE DE NovaDB
    // ==========================================
    function _hookNovaDB() {
        if (typeof window.NovaDB === 'undefined') return;

        // Hook de Ventas
        const origRegisterSale = window.NovaDB.registerSale;
        window.NovaDB.registerSale = function (saleData) {
            const record = origRegisterSale.apply(this, arguments);
            if (record) {
                _enqueue('insert', 'ventas', {
                    id: record.id,
                    timestamp: record.timestamp,
                    fecha_str: record.fechaStr,
                    hora_str: record.horaStr,
                    cliente: record.cliente,
                    items: record.items,
                    tipo_precio: record.tipoPrecio,
                    tipo_documento: record.tipoDocumento,
                    tasa_bcv: record.tasaBCV,
                    total_usd: record.totalUSD,
                    total_bs: record.totalBs,
                    metodos_pago: record.metodosPago,
                    monto_pagado_usd: record.montoPagadoUSD,
                    monto_pagado_bs: record.montoPagadoBs,
                    vuelto_usd: record.vueltoUSD,
                    vuelto_bs: record.vueltoBs,
                    vendedor: record.vendedor
                });

                // Si se descontó stock de ítems, sincronizar existencias
                if (record.tipoDocumento !== 'presupuesto' && Array.isArray(record.items)) {
                    record.items.forEach(it => {
                        const newStock = window.NovaDB.getStock(it.id);
                        _enqueue('update_stock', 'productos', {
                            id: it.id,
                            stock: newStock,
                            reason: `Venta ${record.id}`
                        });
                    });
                }
            }
            return record;
        };

        // Hook de Ajuste de Stock
        const origSetStock = window.NovaDB.setStock;
        window.NovaDB.setStock = function (productId, newQty, reason) {
            const res = origSetStock.apply(this, arguments);
            if (res) {
                _enqueue('update_stock', 'productos', {
                    id: productId,
                    stock: parseInt(newQty) || 0,
                    reason: reason || 'Ajuste manual de almacén'
                });
            }
            return res;
        };

        // Hook de Egresos
        const origAddExpense = window.NovaDB.addExpense;
        window.NovaDB.addExpense = function (expenseData) {
            const record = origAddExpense.apply(this, arguments);
            if (record) {
                _enqueue('insert', 'egresos', {
                    id: record.id,
                    timestamp: record.timestamp,
                    fecha_str: record.fechaStr,
                    concepto: record.concepto,
                    categoria: record.categoria,
                    monto_usd: record.montoUSD,
                    monto_bs: record.montoBs,
                    metodo_pago: record.metodoPago
                });
            }
            return record;
        };

        // Hook de Clientes (CRM)
        const origSaveCustomer = window.NovaDB.saveCustomer;
        window.NovaDB.saveCustomer = function (customer) {
            const res = origSaveCustomer.apply(this, arguments);
            if (res) {
                _enqueue('upsert', 'clientes', {
                    id: res.id,
                    nombre: res.nombre,
                    rif: res.rif,
                    telefono: res.telefono,
                    tipo: res.tipo,
                    notas: res.notas
                });
            }
            return res;
        };

        // Hook de Proveedores
        const origSaveSupplier = window.NovaDB.saveSupplier;
        window.NovaDB.saveSupplier = function (supplier) {
            const res = origSaveSupplier.apply(this, arguments);
            if (res) {
                _enqueue('upsert', 'proveedores', {
                    id: res.id,
                    razon_social: res.razonSocial,
                    rif: res.rif,
                    telefono: res.telefono,
                    contacto: res.contacto,
                    rubro: res.rubro
                });
            }
            return res;
        };

        // Hook de Compras
        const origRegisterPurchase = window.NovaDB.registerPurchase;
        window.NovaDB.registerPurchase = function (purchaseData) {
            const record = origRegisterPurchase.apply(this, arguments);
            if (record) {
                _enqueue('insert', 'compras', {
                    id: record.id,
                    timestamp: record.timestamp,
                    fecha_str: record.fechaStr,
                    proveedor_id: record.proveedorId,
                    proveedor_nombre: record.proveedorNombre,
                    factura_numero: record.facturaNumero,
                    items: record.items,
                    total_usd: record.totalUSD,
                    notas: record.notas
                });

                // Sincronizar nuevo stock de ítems comprados
                if (Array.isArray(record.items)) {
                    record.items.forEach(it => {
                        const newStock = window.NovaDB.getStock(it.id);
                        _enqueue('update_stock', 'productos', {
                            id: it.id,
                            stock: newStock,
                            costo_compra: it.costoCompra || 0,
                            reason: `Compra ${record.id}`
                        });
                    });
                }
            }
            return record;
        };

        // Hook de Cierre de Caja
        const origCloseShift = window.NovaDB.closeActiveShift;
        window.NovaDB.closeActiveShift = function (reconciliation) {
            const closedShift = origCloseShift.apply(this, arguments);
            if (closedShift) {
                _enqueue('upsert', 'turnos_caja', {
                    id: closedShift.id,
                    fecha_apertura: closedShift.fechaApertura,
                    fecha_cierre: closedShift.fechaCierre,
                    monto_inicial_usd: closedShift.montoInicialUSD,
                    monto_inicial_bs: closedShift.montoInicialBs,
                    estado: closedShift.estado,
                    ventas_ids: closedShift.ventasIds,
                    egresos_ids: closedShift.egresosIds,
                    arqueo_fisico: closedShift.arqueoFisico
                });
            }
            return closedShift;
        };
    }

    // ==========================================
    // 3. PROCESAMIENTO DE COLA DE SINCRONIZACIÓN
    // ==========================================
    async function processQueue() {
        if (!_client || !_isOnline || _isSyncing) return;
        const queue = _getQueue();
        if (queue.length === 0) {
            _updateUIStatus();
            return;
        }

        _isSyncing = true;
        _updateUIStatus(true); // Sincronizando...

        const remaining = [];
        let successCount = 0;

        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            try {
                let err = null;
                if (item.action === 'insert') {
                    const { error } = await _client.from(item.table).insert([item.data]);
                    err = error;
                } else if (item.action === 'upsert') {
                    const { error } = await _client.from(item.table).upsert([item.data], { onConflict: 'id' });
                    err = error;
                } else if (item.action === 'update_stock') {
                    const updatePayload = { stock: item.data.stock, updated_at: new Date().toISOString() };
                    if (item.data.costo_compra) updatePayload.costo_compra = item.data.costo_compra;
                    
                    const { error } = await _client.from('productos').update(updatePayload).eq('id', item.data.id);
                    err = error;

                    // Registrar en log de auditoría kardex si fue exitoso
                    if (!err) {
                        await _client.from('movimientos_stock').insert([{
                            producto_id: item.data.id,
                            new_stock: item.data.stock,
                            reason: item.data.reason || 'Sincronización'
                        }]);
                    }
                }

                if (err) {
                    console.warn(`Error sincronizando item ${item.id} en ${item.table}:`, err);
                    remaining.push(item);
                } else {
                    successCount++;
                }
            } catch (e) {
                console.error(`Fallo en conexión al procesar ${item.id}:`, e);
                remaining.push(item);
            }
        }

        _saveQueue(remaining);
        _isSyncing = false;
        _updateUIStatus();

        if (successCount > 0) {
            console.log(`☁️ NovaSupabase: ${successCount} registros sincronizados con la nube.`);
        }
    }

    // ==========================================
    // 4. MIGRACIÓN Y CARGA INICIAL DE 460 PRODUCTOS
    // ==========================================
    async function checkAndSeedCatalog(force = false) {
        if (!_client || !_isOnline) return;

        try {
            // Verificar si la tabla de productos ya tiene registros
            if (!force) {
                const { count, error } = await _client.from('productos').select('*', { count: 'exact', head: true });
                if (!error && count && count > 0) {
                    console.log(`☁️ NovaSupabase: Base de datos ya cuenta con ${count} repuestos cargados.`);
                    return;
                }
            }

            console.log("🚀 NovaSupabase: Iniciando carga masiva de los 460 repuestos y variantes a Supabase...");
            await seedFullCatalog();
        } catch (e) {
            console.warn("No se pudo verificar catálogo en Supabase:", e);
        }
    }

    async function seedFullCatalog(onProgress) {
        if (!_client) return { success: false, message: "Cliente Supabase no configurado" };

        const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
        if (prods.length === 0) {
            return { success: false, message: "No se encontró el arreglo 'products' de productos.js" };
        }

        const inv = (typeof NovaDB !== 'undefined') ? NovaDB.getInventory() : {};
        const rowsToInsert = [];

        // Desglosar productos y variantes
        prods.forEach(p => {
            const specsJson = p.specs || {};
            const imagesJson = p.images || [];

            if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                p.variants.forEach(v => {
                    const vStock = inv[v.id] ? inv[v.id].stock : 12;
                    const vMin = inv[v.id] ? inv[v.id].stockMinimo : 3;
                    const vUbic = inv[v.id] ? inv[v.id].ubicacion : "Almacén Central";
                    const costo = v.costoCompra || 0;
                    const precioNova = +(costo * 1.30 * 1.16).toFixed(2);

                    rowsToInsert.push({
                        id: v.id,
                        parent_id: p.id,
                        nombre: `${p.name} (${v.name})`,
                        categoria: p.category || "General",
                        modelo: p.model || null,
                        descripcion: p.desc || null,
                        costo_compra: costo,
                        precio_novacliente: precioNova,
                        imagenes: imagesJson,
                        specs: specsJson,
                        stock: vStock,
                        stock_minimo: vMin,
                        ubicacion: vUbic,
                        activo: true
                    });
                });
            } else {
                const pStock = inv[p.id] ? inv[p.id].stock : 15;
                const pMin = inv[p.id] ? inv[p.id].stockMinimo : 4;
                const pUbic = inv[p.id] ? inv[p.id].ubicacion : "Almacén Central";
                const costo = p.costoCompra || 0;
                const precioNova = +(costo * 1.30 * 1.16).toFixed(2);

                rowsToInsert.push({
                    id: p.id,
                    parent_id: null,
                    nombre: p.name,
                    categoria: p.category || "General",
                    modelo: p.model || null,
                    descripcion: p.desc || null,
                    costo_compra: costo,
                    precio_novacliente: precioNova,
                    imagenes: imagesJson,
                    specs: specsJson,
                    stock: pStock,
                    stock_minimo: pMin,
                    ubicacion: pUbic,
                    activo: true
                });
            }
        });

        console.log(`📦 Preparados ${rowsToInsert.length} repuestos para subir en lotes...`);

        // Subir en lotes de 50 para evitar exceder límites de request
        const batchSize = 50;
        let inserted = 0;

        for (let i = 0; i < rowsToInsert.length; i += batchSize) {
            const batch = rowsToInsert.slice(i, i + batchSize);
            const { error } = await _client.from('productos').upsert(batch, { onConflict: 'id' });
            if (error) {
                console.error(`Error subiendo lote ${i} - ${i + batchSize}:`, error);
                throw error;
            }
            inserted += batch.length;
            if (typeof onProgress === 'function') {
                onProgress(inserted, rowsToInsert.length);
            }
        }

        // Subir también clientes por defecto
        if (typeof NovaDB !== 'undefined') {
            const customers = NovaDB.getCustomers();
            if (customers && customers.length > 0) {
                await _client.from('clientes').upsert(customers.map(c => ({
                    id: c.id,
                    nombre: c.nombre,
                    rif: c.rif,
                    telefono: c.telefono,
                    tipo: c.tipo,
                    notas: c.notas
                })), { onConflict: 'id' });
            }

            const suppliers = NovaDB.getSuppliers();
            if (suppliers && suppliers.length > 0) {
                await _client.from('proveedores').upsert(suppliers.map(s => ({
                    id: s.id,
                    razon_social: s.razonSocial,
                    rif: s.rif,
                    telefono: s.telefono,
                    contacto: s.contacto,
                    rubro: s.rubro
                })), { onConflict: 'id' });
            }
        }

        console.log(`✅ ¡Catálogo cargado con éxito en Supabase! (${inserted} productos).`);
        return { success: true, count: inserted };
    }

    // ==========================================
    // 5. ACTUALIZAR INTERFAZ Y ESTADO VISUAL
    // ==========================================
    function _updateUIStatus(isSyncing = false) {
        const dot = document.getElementById('cloudSyncDot');
        const label = document.getElementById('cloudSyncLabel');
        const pill = document.getElementById('cloudSyncPill');
        const queue = _getQueue();

        if (!dot || !label) return;

        if (isSyncing || _isSyncing) {
            dot.className = 'cloud-sync-dot syncing';
            label.innerText = 'Sincronizando...';
            if (pill) pill.title = 'Subiendo datos a la nube...';
        } else if (!_isOnline) {
            dot.className = 'cloud-sync-dot offline';
            label.innerText = queue.length > 0 ? `Modo Local (${queue.length} pend.)` : 'Modo Local (Sin red)';
            if (pill) pill.title = 'Operando 100% en local. Los datos se sincronizarán al volver internet.';
        } else if (queue.length > 0) {
            dot.className = 'cloud-sync-dot pending';
            label.innerText = `${queue.length} pendientes`;
            if (pill) pill.title = `${queue.length} registros en cola por enviar a la nube.`;
        } else {
            dot.className = 'cloud-sync-dot online';
            label.innerText = 'Nube Conectada';
            if (pill) pill.title = 'Conectado a Supabase en la nube. Todo al día.';
        }
    }

    // ==========================================
    // 6. MÉTODOS PÚBLICOS
    // ==========================================
    return {
        init,
        getClient: () => _client,
        getConfig: _getConfig,
        saveConfig: _saveConfig,
        getQueue: _getQueue,
        processQueue,
        seedFullCatalog,
        checkAndSeedCatalog,
        isOnline: () => _isOnline,
        updateUIStatus: _updateUIStatus
    };
})();

// Auto-inicializar al cargar el DOM
if (typeof window !== 'undefined') {
    window.NovaSupabase = NovaSupabase;
    document.addEventListener('DOMContentLoaded', () => {
        NovaSupabase.init();
    });
}
