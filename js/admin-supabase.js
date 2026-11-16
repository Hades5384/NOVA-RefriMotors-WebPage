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
                console.log("[NovaSupabase] Cliente inicializado correctamente.");
            } catch (err) {
                console.warn("[NovaSupabase] Error al inicializar cliente:", err);
                _client = null;
            }
        } else {
            console.warn("[NovaSupabase] Librería supabase-js no disponible o faltan credenciales.");
        }

        // Monitorear conectividad de red
        window.addEventListener('online', () => {
            _isOnline = true;
            console.log("[NovaSupabase] Conexión a internet restaurada. Procesando sincronización...");
            _updateUIStatus();
            processQueue();
            checkAndSeedCatalog();
        });

        window.addEventListener('offline', () => {
            _isOnline = false;
            console.warn("[NovaSupabase] Sin conexión a internet. Activando Modo Local de contingencia.");
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

        // Monitoreo periódico de pedidos de mostrador para el usuario MASTER
        setInterval(async () => {
            if (_client && _isOnline && !_isSyncing) {
                if (typeof NovaUsers !== 'undefined' && NovaUsers.isAdmin()) {
                    const remoteOrders = await fetchPendingCounterOrders();
                    if (remoteOrders && remoteOrders.length > 0 && typeof window.NovaDB !== 'undefined') {
                        const hasChanges = window.NovaDB.mergeIncomingHeldSales(remoteOrders);
                        if (hasChanges) {
                            if (typeof renderHeldSalesList === 'function') renderHeldSalesList();
                            if (typeof renderHeldSalesModalContent === 'function') {
                                const modal = document.getElementById('heldSalesModal');
                                if (modal && modal.classList.contains('active')) {
                                    renderHeldSalesModalContent();
                                }
                            }
                        }
                    }
                }
            }
        }, 7000);

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
                    direccion: res.direccion || '',
                    tipo: res.tipo,
                    notas: res.notas
                });
            }
            return res;
        };

        const origDeleteCustomer = window.NovaDB.deleteCustomer;
        if (origDeleteCustomer) {
            window.NovaDB.deleteCustomer = function (customerId) {
                const res = origDeleteCustomer.apply(this, arguments);
                if (res) {
                    _enqueue('delete', 'clientes', { id: customerId });
                }
                return res;
            };
        }

        // Hook de Ventas en Espera / Pedidos de Mostrador
        const origHoldCurrentSale = window.NovaDB.holdCurrentSale;
        window.NovaDB.holdCurrentSale = function (cartItems, customerData, title, extraData) {
            const record = origHoldCurrentSale.apply(this, arguments);
            if (record && record.estacion && record.estacion !== 'MOSTRADOR') {
                _enqueue('insert', 'pedidos_mostrador', {
                    id: record.id,
                    estacion: record.estacion,
                    vendedor: record.vendedor || record.estacion,
                    cliente: record.customer || {},
                    items: record.cart || [],
                    tipo_precio: record.tipoPrecio || 'publico',
                    total_usd: record.totalUSD || 0,
                    total_bs: record.totalBs || 0,
                    estado: 'pendiente'
                });
            }
            return record;
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
    let _lastSyncError = null;

    async function processQueue() {
        if (!_client || !_isOnline || _isSyncing) return;
        const queue = _getQueue();
        if (queue.length === 0) {
            _lastSyncError = null;
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
                // En tablas relacionales con primary key 'id', usamos upsert
                // para garantizar idempotencia total y evitar bloqueos por clave duplicada (23505).
                if (item.action === 'insert' || item.action === 'upsert') {
                    const { error } = await _client.from(item.table).upsert([item.data], { onConflict: 'id' });
                    err = error;
                } else if (item.action === 'update') {
                    const { error } = await _client.from(item.table).update(item.data).eq('id', item.data.id);
                    err = error;
                } else if (item.action === 'delete') {
                    const { error } = await _client.from(item.table).delete().eq('id', item.data.id);
                    err = error;
                    // Si el registro ya no existía en la nube, se considera exitoso
                    if (err && (err.code === 'PGRST116' || (err.message && err.message.toLowerCase().includes('not found')))) {
                        err = null;
                    }
                } else if (item.action === 'update_stock') {
                    const updatePayload = { stock: item.data.stock, updated_at: new Date().toISOString() };
                    if (item.data.costo_compra) updatePayload.costo_compra = item.data.costo_compra;
                    
                    const { error } = await _client.from('productos').update(updatePayload).eq('id', item.data.id);
                    err = error;

                    // Registrar en log de auditoría kardex si fue exitoso (tolerante a si no existe la tabla)
                    if (!err) {
                        try {
                            await _client.from('movimientos_stock').insert([{
                                producto_id: item.data.id,
                                new_stock: item.data.stock,
                                reason: item.data.reason || 'Sincronización'
                            }]);
                        } catch (kardexErr) {
                            console.warn("[NovaSupabase] Aviso kardex opcional:", kardexErr);
                        }
                    }
                }

                // Si el error es por clave duplicada (código 23505), el registro ya está en Supabase
                if (err && (err.code === '23505' || (err.message && err.message.toLowerCase().includes('duplicate key')))) {
                    console.log(`[NovaSupabase] Item ${item.id} ya existe en Supabase (${item.table}). Marcado como sincronizado.`);
                    err = null;
                }

                if (err) {
                    item.retries = (item.retries || 0) + 1;
                    item.lastError = err.message || err.details || JSON.stringify(err);
                    _lastSyncError = `[${item.table}] ${item.lastError}`;
                    console.warn(`[NovaSupabase] Error sincronizando item ${item.id} en ${item.table} (intento ${item.retries}):`, err);

                    // Si falla más de 3 veces consecutivas por error de tabla, esquema o RLS,
                    // se purga de la cola para no dejar el sistema congelado permanentemente
                    if (item.retries >= 3) {
                        console.error(`[NovaSupabase] Registro atascado ${item.id} en ${item.table} descartado tras ${item.retries} intentos:`, item.lastError);
                    } else {
                        remaining.push(item);
                    }
                } else {
                    successCount++;
                }
            } catch (e) {
                console.error(`Fallo en conexión al procesar ${item.id}:`, e);
                item.retries = (item.retries || 0) + 1;
                item.lastError = e.message || String(e);
                _lastSyncError = item.lastError;
                if ((item.retries || 0) < 3) {
                    remaining.push(item);
                }
            }
        }

        _saveQueue(remaining);
        _isSyncing = false;
        _updateUIStatus();

        if (successCount > 0) {
            console.log(`[NovaSupabase] ${successCount} registros sincronizados con la nube.`);
        }
    }

    function clearQueue() {
        _saveQueue([]);
        _lastSyncError = null;
        _updateUIStatus();
        return true;
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
                    console.log(`[NovaSupabase] Base de datos ya cuenta con ${count} repuestos cargados.`);
                    return;
                }
            }

            console.log("[NovaSupabase] Iniciando carga masiva de repuestos a Supabase...");
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

        console.log(`[NovaSupabase] Preparados ${rowsToInsert.length} repuestos para subir en lotes...`);

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

        console.log(`[NovaSupabase] Catálogo cargado con éxito en Supabase (${inserted} productos).`);
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

    async function fetchPendingCounterOrders() {
        if (!_client || !_isOnline) return [];
        try {
            const { data, error } = await _client
                .from('pedidos_mostrador')
                .select('*')
                .eq('estado', 'pendiente')
                .order('created_at', { ascending: false });
            if (error) return [];
            return (data || []).map(p => ({
                id: p.id,
                timestamp: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
                fechaStr: p.created_at ? new Date(p.created_at).toLocaleDateString('es-VE') : '',
                horaStr: p.created_at ? new Date(p.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
                title: (p.cliente && p.cliente.nombre) ? p.cliente.nombre : `Pedido ${p.id}`,
                customer: p.cliente,
                cart: p.items,
                estacion: p.estacion,
                vendedor: p.vendedor,
                tipoPrecio: p.tipo_precio,
                totalUSD: parseFloat(p.total_usd) || 0,
                totalBs: parseFloat(p.total_bs) || 0,
                estado: p.estado
            }));
        } catch (e) {
            return [];
        }
    }

    async function markCounterOrderServed(orderId) {
        if (!_client || !_isOnline) {
            _enqueue('update', 'pedidos_mostrador', { id: orderId, estado: 'atendido' });
            return;
        }
        try {
            await _client.from('pedidos_mostrador').update({ estado: 'atendido' }).eq('id', orderId);
        } catch (e) {
            _enqueue('update', 'pedidos_mostrador', { id: orderId, estado: 'atendido' });
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
        clearQueue,
        getLastError: () => _lastSyncError,
        processQueue,
        fetchPendingCounterOrders,
        markCounterOrderServed,
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
