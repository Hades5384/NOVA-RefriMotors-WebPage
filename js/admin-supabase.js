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
        window.addEventListener('online', async () => {
            _isOnline = true;
            console.log("[NovaSupabase] Conexión a internet restaurada. Procesando sincronización...");
            _updateUIStatus();
            await processQueue();
            await checkAndSeedCatalog();
            await pullCloudUpdates();
        });

        window.addEventListener('offline', () => {
            _isOnline = false;
            console.warn("[NovaSupabase] Sin conexión a internet. Activando Modo Local de contingencia.");
            _updateUIStatus();
        });

        // Intervalo periódico de sincronización bidireccional (Push + Pull)
        if (cfg.autoSync) {
            if (_syncTimer) clearInterval(_syncTimer);
            _syncTimer = setInterval(async () => {
                if (_isOnline && !_isSyncing) {
                    await processQueue();
                    if (_getQueue().length === 0) {
                        await pullCloudUpdates();
                    }
                }
            }, (cfg.syncIntervalSeconds || 25) * 1000);
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

        // Sincronizar inmediatamente la tasa BCV y datos de la empresa desde la nube
        _pullInitialConfig();

        // Verificar si la base de datos necesita carga inicial y descargar cambios recientes
        setTimeout(async () => {
            await checkAndSeedCatalog();
            await processQueue();
            await pullCloudUpdates();
            _subscribeRealtime();
        }, 1500);
    }

    async function _pullInitialConfig() {
        if (!_client || !_isOnline) return;
        try {
            const { data, error } = await _client.from('configuracion').select('*').eq('id', 'default').maybeSingle();
            if (!error && data) {
                const local = (typeof window.NovaDB !== 'undefined' && window.NovaDB.getSettings) ? window.NovaDB.getSettings() : null;
                if (!local) return;
                let changed = false;

                const remoteBCV = parseFloat(data.tasa_bcv);
                if (!isNaN(remoteBCV) && remoteBCV > 0 && Math.abs(remoteBCV - (local.tasaBCV || 0)) > 0.001) {
                    local.tasaBCV = remoteBCV;
                    changed = true;
                }

                const remoteInt = parseFloat(data.tasa_interna);
                if (!isNaN(remoteInt) && remoteInt > 0 && Math.abs(remoteInt - (local.tasaInterna || 0)) > 0.001) {
                    local.tasaInterna = remoteInt;
                    changed = true;
                }

                if (data.empresa_nombre) {
                    if (!local.empresa) local.empresa = {};
                    if (local.empresa.nombre !== data.empresa_nombre) {
                        local.empresa.nombre = data.empresa_nombre;
                        changed = true;
                    }
                    if (data.empresa_rif && local.empresa.rif !== data.empresa_rif) {
                        local.empresa.rif = data.empresa_rif;
                        changed = true;
                    }
                    if (data.empresa_telefono && local.empresa.telefono !== data.empresa_telefono) {
                        local.empresa.telefono = data.empresa_telefono;
                        changed = true;
                    }
                    if (data.empresa_direccion && local.empresa.direccion !== data.empresa_direccion) {
                        local.empresa.direccion = data.empresa_direccion;
                        changed = true;
                    }
                }

                if (changed) {
                    localStorage.setItem('nova_erp_settings', JSON.stringify(local));
                    if (typeof updateBCVDisplay === 'function') updateBCVDisplay();
                    if (typeof renderPOSCart === 'function') renderPOSCart();
                    if (typeof renderPOSCatalog === 'function') renderPOSCatalog();
                    console.log(`[NovaSupabase] Tasa BCV sincronizada desde la nube: Bs. ${local.tasaBCV.toFixed(2)}`);
                }
            }
        } catch (e) {
            console.warn('[NovaSupabase] Aviso obteniendo configuración inicial:', e);
        }
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

        // Hook de Deducción Directa de Stock
        const origDeductStock = window.NovaDB.deductStock;
        if (origDeductStock) {
            window.NovaDB.deductStock = function (productId, qtyToDeduct, reason) {
                const res = origDeductStock.apply(this, arguments);
                if (res) {
                    const newStock = window.NovaDB.getStock(productId);
                    _enqueue('update_stock', 'productos', {
                        id: productId,
                        stock: newStock,
                        reason: reason || 'Deducción de existencias'
                    });
                }
                return res;
            };
        }

        // Hook de Entrada de Stock
        const origAddStock = window.NovaDB.addStock;
        if (origAddStock) {
            window.NovaDB.addStock = function (productId, qtyToAdd, reason, responsable) {
                const res = origAddStock.apply(this, arguments);
                if (res) {
                    const newStock = window.NovaDB.getStock(productId);
                    const syncReason = responsable ? `${reason || 'Entrada de existencias'} (Resp: ${responsable})` : (reason || 'Entrada de existencias');
                    _enqueue('update_stock', 'productos', {
                        id: productId,
                        stock: newStock,
                        reason: syncReason
                    });
                }
                return res;
            };
        }

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

        // Hook de Alta de Nuevo Producto en Inventario
        const origAddNewProduct = window.NovaDB.addNewProduct;
        if (origAddNewProduct) {
            window.NovaDB.addNewProduct = function (prodData) {
                const res = origAddNewProduct.apply(this, arguments);
                if (res) {
                    const util = typeof res.porcentajeUtilidad === 'number' ? res.porcentajeUtilidad : 30;
                    const ivaVal = typeof res.iva === 'number' ? res.iva : 16;
                    const cost = parseFloat(res.costoCompra) || 0;
                    const finalPrice = typeof res.precioFinalUSD === 'number'
                        ? res.precioFinalUSD
                        : +(cost * (1 + util / 100) * (1 + ivaVal / 100)).toFixed(2);

                    _enqueue('upsert', 'productos', {
                        id: res.id,
                        nombre: res.name,
                        categoria: res.category || 'General',
                        descripcion: res.descripcionDetallada || res.description || null,
                        costo_compra: cost,
                        precio_novacliente: +finalPrice.toFixed(2),
                        specs: {
                            porcentaje_utilidad: util,
                            iva: ivaVal
                        },
                        stock: parseInt(res.stock) || 0,
                        stock_minimo: parseInt(res.stockMinimo) || 3,
                        ubicacion: res.ubicacion || 'Almacén Central',
                        activo: true,
                        updated_at: new Date().toISOString()
                    });
                }
                return res;
            };
        }

        // Hook de Modificación Completa de Producto (Nombre, Descripción Larga, Costo, Utilidad, IVA, Precio Final)
        const origUpdateProduct = window.NovaDB.updateProduct;
        if (origUpdateProduct) {
            window.NovaDB.updateProduct = function (productId, updates) {
                const res = origUpdateProduct.apply(this, arguments);
                if (res) {
                    const inv = window.NovaDB.getInventory();
                    const item = inv[productId];
                    if (item) {
                        const util = typeof item.porcentajeUtilidad === 'number' ? item.porcentajeUtilidad : 30;
                        const ivaVal = typeof item.iva === 'number' ? item.iva : 16;
                        const cost = parseFloat(item.costoCompra) || 0;
                        const finalPrice = typeof item.precioFinalUSD === 'number'
                            ? item.precioFinalUSD
                            : +(cost * (1 + util / 100) * (1 + ivaVal / 100)).toFixed(2);

                        _enqueue('upsert', 'productos', {
                            id: item.id,
                            nombre: item.name,
                            categoria: item.category || 'General',
                            descripcion: item.descripcionDetallada || item.description || null,
                            costo_compra: cost,
                            precio_novacliente: +finalPrice.toFixed(2),
                            specs: {
                                porcentaje_utilidad: util,
                                iva: ivaVal
                            },
                            stock: parseInt(item.stock) || 0,
                            stock_minimo: parseInt(item.stockMinimo) || 3,
                            ubicacion: item.ubicacion || 'Almacén Central',
                            activo: true,
                            updated_at: new Date().toISOString()
                        });
                    }
                }
                return res;
            };
        }

        // Hook de Actualización Rápida de Costo
        const origUpdateProductCost = window.NovaDB.updateProductCost;
        if (origUpdateProductCost) {
            window.NovaDB.updateProductCost = function (productId, newCost) {
                const res = origUpdateProductCost.apply(this, arguments);
                if (res) {
                    _enqueue('update', 'productos', {
                        id: productId,
                        costo_compra: parseFloat(newCost) || 0,
                        updated_at: new Date().toISOString()
                    });
                }
                return res;
            };
        }

        // Hook de Eliminación de Producto
        const origDeleteProduct = window.NovaDB.deleteProduct;
        if (origDeleteProduct) {
            window.NovaDB.deleteProduct = function (productId) {
                const res = origDeleteProduct.apply(this, arguments);
                if (res) {
                    _enqueue('delete', 'productos', { id: productId });
                }
                return res;
            };
        }

        // Hook de Tasa Oficial BCV
        const origSetTasaBCV = window.NovaDB.setTasaBCV;
        if (origSetTasaBCV) {
            window.NovaDB.setTasaBCV = function (newRate) {
                const res = origSetTasaBCV.apply(this, arguments);
                if (res) {
                    const r = parseFloat(newRate);
                    const payload = {
                        id: 'default',
                        tasa_bcv: r,
                        updated_at: new Date().toISOString()
                    };
                    _enqueue('upsert', 'configuracion', payload);
                    if (_client && _isOnline) {
                        _client.from('configuracion').upsert([payload], { onConflict: 'id' }).then(({ error }) => {
                            if (error) console.warn('[NovaSupabase] Error directo guardando tasa_bcv:', error);
                            else console.log('[NovaSupabase] Tasa BCV guardada inmediatamente en Supabase:', r);
                        });
                    }
                }
                return res;
            };
        }

        // Hook de Tasa Interna del Sistema
        const origSetTasaInterna = window.NovaDB.setTasaInterna;
        if (origSetTasaInterna) {
            window.NovaDB.setTasaInterna = function (newRate) {
                const res = origSetTasaInterna.apply(this, arguments);
                if (res) {
                    const r = parseFloat(newRate);
                    const payload = {
                        id: 'default',
                        tasa_interna: r,
                        updated_at: new Date().toISOString()
                    };
                    _enqueue('upsert', 'configuracion', payload);
                    if (_client && _isOnline) {
                        _client.from('configuracion').upsert([payload], { onConflict: 'id' }).then(({ error }) => {
                            if (error) console.warn('[NovaSupabase] Error directo guardando tasa_interna:', error);
                            else console.log('[NovaSupabase] Tasa interna guardada inmediatamente en Supabase:', r);
                        });
                    }
                }
                return res;
            };
        }

        // Hook de Configuración General de Empresa y Márgenes
        const origUpdateSettings = window.NovaDB.updateSettings;
        if (origUpdateSettings) {
            window.NovaDB.updateSettings = function (newSettings) {
                const res = origUpdateSettings.apply(this, arguments);
                if (res) {
                    const payload = {
                        id: 'default',
                        updated_at: new Date().toISOString()
                    };
                    if (typeof res.tasaBCV === 'number') payload.tasa_bcv = res.tasaBCV;
                    if (typeof res.tasaInterna === 'number') payload.tasa_interna = res.tasaInterna;
                    if (typeof res.porcentajeUtilidad === 'number') payload.porcentaje_utilidad = res.porcentajeUtilidad;
                    if (typeof res.porcentajeIva === 'number') payload.porcentaje_iva = res.porcentajeIva;
                    if (res.empresa) {
                        if (res.empresa.nombre) payload.empresa_nombre = res.empresa.nombre;
                        if (res.empresa.rif) payload.empresa_rif = res.empresa.rif;
                        if (res.empresa.telefono) payload.empresa_telefono = res.empresa.telefono;
                        if (res.empresa.direccion) payload.empresa_direccion = res.empresa.direccion;
                        if (res.empresa.lema) payload.empresa_lema = res.empresa.lema;
                    }
                    _enqueue('upsert', 'configuracion', payload);
                    if (_client && _isOnline) {
                        _client.from('configuracion').upsert([payload], { onConflict: 'id' }).then(({ error }) => {
                            if (error) console.warn('[NovaSupabase] Error directo guardando configuración:', error);
                        });
                    }
                }
                return res;
            };
        }
    }

    // ==========================================
    // 3. PROCESAMIENTO DE COLA DE SINCRONIZACIÓN
    // ==========================================
    let _lastSyncError = null;

    async function processQueue() {
        if (!_client || !_isOnline || _isSyncing) return;
        const initialQueue = _getQueue();
        if (initialQueue.length === 0) {
            _lastSyncError = null;
            _updateUIStatus();
            return;
        }

        _isSyncing = true;
        _updateUIStatus(true); // Sincronizando...

        const processedIds = new Set();
        const failedItemsMap = new Map();
        let successCount = 0;

        for (let i = 0; i < initialQueue.length; i++) {
            const item = initialQueue[i];
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
                            console.warn("[NovaSupabase] Kardex opcional:", kardexErr);
                        }
                    }
                }

                // Si el error es por clave duplicada (código 23505), el registro ya está en Supabase
                if (err && (err.code === '23505' || (err.message && err.message.toLowerCase().includes('duplicate key')))) {
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
                        processedIds.add(item.id);
                    } else {
                        failedItemsMap.set(item.id, item);
                    }
                } else {
                    successCount++;
                    processedIds.add(item.id);
                }
            } catch (e) {
                console.error(`Fallo en conexión al procesar ${item.id}:`, e);
                item.retries = (item.retries || 0) + 1;
                item.lastError = e.message || String(e);
                _lastSyncError = item.lastError;
                if ((item.retries || 0) >= 3) {
                    processedIds.add(item.id);
                } else {
                    failedItemsMap.set(item.id, item);
                }
            }
        }

        // Actualizar la cola en localStorage preservando ítems encolados concurrentemente
        const latestQueue = _getQueue();
        const updatedQueue = [];
        latestQueue.forEach(it => {
            if (processedIds.has(it.id)) return; // Completado con éxito o descartado
            if (failedItemsMap.has(it.id)) {
                updatedQueue.push(failedItemsMap.get(it.id)); // Con reintentos incrementados
            } else {
                updatedQueue.push(it); // Ítem nuevo encolado durante el await asíncrono
            }
        });

        _saveQueue(updatedQueue);
        _isSyncing = false;
        _updateUIStatus();

        if (successCount > 0) {
            console.log(`[NovaSupabase] ${successCount} registros sincronizados con la nube.`);
        }

        // Si entraron nuevos ítems a la cola durante el ciclo, procesarlos inmediatamente
        if (updatedQueue.length > 0 && updatedQueue.some(it => !it.retries || it.retries < 3)) {
            setTimeout(processQueue, 250);
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
            if (!force) {
                const { count, error } = await _client.from('productos').select('*', { count: 'exact', head: true });
                if (error) return;

                if (count && count > 0) {
                    // Verificar si quedó una carga parcial incompleta (ej: interrumpida antes de terminar todos los SKUs)
                    const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
                    const catalogIds = new Map();
                    prods.forEach(p => {
                        if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                            p.variants.forEach(v => catalogIds.set(v.id, { p, v }));
                        } else {
                            catalogIds.set(p.id, { p, v: null });
                        }
                    });

                    let deletedIds = [];
                    try { deletedIds = JSON.parse(localStorage.getItem('nova_erp_deleted_products') || '[]'); } catch (e) {}
                    const deletedSet = new Set(deletedIds);

                    if (count < catalogIds.size - deletedSet.size) {
                        const existingRes = await _fetchAllPaginated('productos', 'id');
                        if (!existingRes.error && Array.isArray(existingRes.data)) {
                            const existingSet = new Set(existingRes.data.map(r => r.id));
                            const inv = (typeof NovaDB !== 'undefined') ? NovaDB.getInventory() : {};
                            const missingRows = [];

                            catalogIds.forEach(({ p, v }, skuId) => {
                                if (existingSet.has(skuId) || deletedSet.has(skuId)) return;
                                const localItem = inv[skuId];
                                const costo = (localItem && typeof localItem.costoCompra === 'number' && localItem.costoCompra > 0)
                                    ? localItem.costoCompra
                                    : (v ? (v.costoCompra || 0) : (p.costoCompra || 0));
                                const util = (localItem && typeof localItem.porcentajeUtilidad === 'number') ? localItem.porcentajeUtilidad : 30;
                                const ivaVal = (localItem && typeof localItem.iva === 'number') ? localItem.iva : 16;
                                const precioNova = +(costo * (1 + util / 100) * (1 + ivaVal / 100)).toFixed(2);
                                const baseSpecs = (p.specs && typeof p.specs === 'object') ? p.specs : {};

                                missingRows.push({
                                    id: skuId,
                                    parent_id: v ? p.id : null,
                                    nombre: (localItem && localItem.name) ? localItem.name : (v ? `${p.name} (${v.name})` : p.name),
                                    categoria: (localItem && localItem.category) ? localItem.category : (p.category || "General"),
                                    modelo: p.model || null,
                                    descripcion: (localItem && (localItem.descripcionDetallada || localItem.description)) || p.desc || null,
                                    costo_compra: costo,
                                    precio_novacliente: precioNova,
                                    imagenes: p.images || [],
                                    specs: Object.assign({}, baseSpecs, { porcentaje_utilidad: util, iva: ivaVal }),
                                    stock: localItem ? (parseInt(localItem.stock) || 0) : (v ? 12 : 15),
                                    stock_minimo: localItem ? (parseInt(localItem.stockMinimo) || 3) : (v ? 3 : 4),
                                    ubicacion: (localItem && localItem.ubicacion) || "Almacén Central",
                                    activo: true
                                });
                            });

                            if (missingRows.length > 0) {
                                console.log(`[NovaSupabase] Completando ${missingRows.length} repuestos faltantes en Supabase sin sobrescribir los existentes...`);
                                const batchSize = 50;
                                for (let i = 0; i < missingRows.length; i += batchSize) {
                                    const batch = missingRows.slice(i, i + batchSize);
                                    await _client.from('productos').upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
                                }
                                console.log(`[NovaSupabase] Catálogo completado (${count + missingRows.length} repuestos en la nube).`);
                            }
                        }
                    } else {
                        console.log(`[NovaSupabase] Base de datos ya cuenta con ${count} repuestos cargados.`);
                    }
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
        const rowsMap = new Map();

        // Desglosar productos y variantes (deduplicados por id para evitar conflictos en lote)
        prods.forEach(p => {
            const specsJson = (p.specs && typeof p.specs === 'object') ? Object.assign({}, p.specs) : {};
            const imagesJson = p.images || [];

            if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                p.variants.forEach(v => {
                    const localItem = inv[v.id];
                    const vStock = localItem ? localItem.stock : 12;
                    const vMin = localItem ? localItem.stockMinimo : 3;
                    const vUbic = localItem ? localItem.ubicacion : "Almacén Central";
                    const costo = (localItem && typeof localItem.costoCompra === 'number' && localItem.costoCompra > 0) ? localItem.costoCompra : (v.costoCompra || 0);
                    const util = (localItem && typeof localItem.porcentajeUtilidad === 'number') ? localItem.porcentajeUtilidad : 30;
                    const ivaVal = (localItem && typeof localItem.iva === 'number') ? localItem.iva : 16;
                    const precioNova = +(costo * (1 + util / 100) * (1 + ivaVal / 100)).toFixed(2);
                    const rowSpecs = Object.assign({}, specsJson, { porcentaje_utilidad: util, iva: ivaVal });

                    rowsMap.set(v.id, {
                        id: v.id,
                        parent_id: p.id,
                        nombre: (localItem && localItem.name) ? localItem.name : `${p.name} (${v.name})`,
                        categoria: (localItem && localItem.category) ? localItem.category : (p.category || "General"),
                        modelo: p.model || null,
                        descripcion: (localItem && (localItem.descripcionDetallada || localItem.description)) ? (localItem.descripcionDetallada || localItem.description) : (p.desc || null),
                        costo_compra: costo,
                        precio_novacliente: precioNova,
                        imagenes: imagesJson,
                        specs: rowSpecs,
                        stock: vStock,
                        stock_minimo: vMin,
                        ubicacion: vUbic,
                        activo: true
                    });
                });
            } else {
                const localItem = inv[p.id];
                const pStock = localItem ? localItem.stock : 15;
                const pMin = localItem ? localItem.stockMinimo : 4;
                const pUbic = localItem ? localItem.ubicacion : "Almacén Central";
                const costo = (localItem && typeof localItem.costoCompra === 'number' && localItem.costoCompra > 0) ? localItem.costoCompra : (p.costoCompra || 0);
                const util = (localItem && typeof localItem.porcentajeUtilidad === 'number') ? localItem.porcentajeUtilidad : 30;
                const ivaVal = (localItem && typeof localItem.iva === 'number') ? localItem.iva : 16;
                const precioNova = +(costo * (1 + util / 100) * (1 + ivaVal / 100)).toFixed(2);
                const rowSpecs = Object.assign({}, specsJson, { porcentaje_utilidad: util, iva: ivaVal });

                rowsMap.set(p.id, {
                    id: p.id,
                    parent_id: null,
                    nombre: (localItem && localItem.name) ? localItem.name : p.name,
                    categoria: (localItem && localItem.category) ? localItem.category : (p.category || "General"),
                    modelo: p.model || null,
                    descripcion: (localItem && (localItem.descripcionDetallada || localItem.description)) ? (localItem.descripcionDetallada || localItem.description) : (p.desc || null),
                    costo_compra: costo,
                    precio_novacliente: precioNova,
                    imagenes: imagesJson,
                    specs: rowSpecs,
                    stock: pStock,
                    stock_minimo: pMin,
                    ubicacion: pUbic,
                    activo: true
                });
            }
        });

        // Incluir también productos personalizados creados en el inventario local
        Object.values(inv).forEach(localItem => {
            if (localItem && localItem.id && !rowsMap.has(localItem.id)) {
                const costo = parseFloat(localItem.costoCompra) || 0;
                const util = typeof localItem.porcentajeUtilidad === 'number' ? localItem.porcentajeUtilidad : 30;
                const ivaVal = typeof localItem.iva === 'number' ? localItem.iva : 16;
                const precioNova = typeof localItem.precioFinalUSD === 'number'
                    ? +localItem.precioFinalUSD.toFixed(2)
                    : +(costo * (1 + util / 100) * (1 + ivaVal / 100)).toFixed(2);

                rowsMap.set(localItem.id, {
                    id: localItem.id,
                    parent_id: localItem.parentId || null,
                    nombre: localItem.name || localItem.id,
                    categoria: localItem.category || "General",
                    modelo: null,
                    descripcion: localItem.descripcionDetallada || localItem.description || null,
                    costo_compra: costo,
                    precio_novacliente: precioNova,
                    imagenes: ['assets/products/default.png'],
                    specs: { porcentaje_utilidad: util, iva: ivaVal },
                    stock: parseInt(localItem.stock) || 0,
                    stock_minimo: parseInt(localItem.stockMinimo) || 3,
                    ubicacion: localItem.ubicacion || "Almacén Central",
                    activo: true
                });
            }
        });

        const rowsToInsert = Array.from(rowsMap.values());

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
                    direccion: c.direccion || '',
                    tipo: c.tipo || 'cliente',
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
    // 5.1 SINCRONIZACIÓN BIDIRECCIONAL COMPLETA Y REALTIME (FUENTE ÚNICA DE VERDAD)
    // ==========================================
    let _realtimeChannel = null;
    let _isPulling = false;
    let _realtimePullTimer = null;

    function _scheduleRealtimePull() {
        clearTimeout(_realtimePullTimer);
        _realtimePullTimer = setTimeout(() => {
            if (_isOnline && !_isSyncing && _getQueue().length === 0) {
                pullCloudUpdates();
            }
        }, 350);
    }

    function _mapRemoteProductToInv(r, prevItem) {
        const specs = (r.specs && typeof r.specs === 'object') ? r.specs : {};
        const cost = parseFloat(r.costo_compra) || 0;
        const util = (typeof specs.porcentaje_utilidad === 'number') ? specs.porcentaje_utilidad : (prevItem?.porcentajeUtilidad ?? 30);
        const ivaVal = (typeof specs.iva === 'number') ? specs.iva : (prevItem?.iva ?? 16);
        const precioFinal = parseFloat(r.precio_novacliente) || +(cost * (1 + util / 100) * (1 + ivaVal / 100)).toFixed(2);
        const detailedDesc = r.descripcion || '';

        return Object.assign({}, prevItem || {}, {
            id: r.id,
            parentId: r.parent_id || (prevItem ? prevItem.parentId : null),
            name: r.nombre || (prevItem ? prevItem.name : r.id),
            descripcionDetallada: detailedDesc,
            description: detailedDesc,
            category: r.categoria || (prevItem ? prevItem.category : 'General'),
            costoCompra: cost,
            porcentajeUtilidad: util,
            iva: ivaVal,
            precioFinalUSD: precioFinal,
            stock: parseInt(r.stock) || 0,
            stockMinimo: parseInt(r.stock_minimo) || (prevItem ? prevItem.stockMinimo : 3),
            ubicacion: r.ubicacion || (prevItem ? prevItem.ubicacion : 'Almacén Central')
        });
    }

    function _syncMemoryProductsFromInv(inv, remoteRowsById) {
        if (typeof window.products === 'undefined' || !Array.isArray(window.products)) return;

        const existingIds = new Set();
        const updatedProducts = [];

        window.products.forEach(p => {
            if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                const keptVariants = [];
                p.variants.forEach(v => {
                    if (inv[v.id]) {
                        const item = inv[v.id];
                        v.name = item.name;
                        v.descripcionDetallada = item.descripcionDetallada || '';
                        v.description = item.descripcionDetallada || '';
                        v.costoCompra = item.costoCompra;
                        v.porcentajeUtilidad = item.porcentajeUtilidad;
                        v.iva = item.iva;
                        v.price = item.precioFinalUSD;
                        v.precioVentaUSD = item.precioFinalUSD;
                        v.stock = typeof item.stock === 'number' ? item.stock : 0;
                        v.stockMinimo = typeof item.stockMinimo === 'number' ? item.stockMinimo : 3;
                        keptVariants.push(v);
                        existingIds.add(v.id);
                    }
                });
                if (keptVariants.length > 0) {
                    p.variants = keptVariants;
                    p.stock = keptVariants.reduce((sum, cv) => sum + (cv.stock || 0), 0);
                    updatedProducts.push(p);
                }
            } else if (inv[p.id]) {
                const item = inv[p.id];
                p.name = item.name;
                p.category = item.category;
                p.descripcionDetallada = item.descripcionDetallada || '';
                p.description = item.descripcionDetallada || '';
                p.costoCompra = item.costoCompra;
                p.porcentajeUtilidad = item.porcentajeUtilidad;
                p.iva = item.iva;
                p.price = item.precioFinalUSD;
                p.precioVentaUSD = item.precioFinalUSD;
                p.stock = typeof item.stock === 'number' ? item.stock : 0;
                p.stockMinimo = typeof item.stockMinimo === 'number' ? item.stockMinimo : 3;
                updatedProducts.push(p);
                existingIds.add(p.id);
            }
        });

        // Agregar productos creados desde otra computadora que no existan aún en window.products
        Object.keys(inv).forEach(id => {
            if (!existingIds.has(id)) {
                const item = inv[id];
                const rawRow = remoteRowsById ? remoteRowsById[id] : null;
                updatedProducts.push({
                    id: item.id,
                    name: item.name,
                    descripcionDetallada: item.descripcionDetallada || '',
                    description: item.descripcionDetallada || '',
                    category: item.category || 'General',
                    costoCompra: item.costoCompra || 0,
                    porcentajeUtilidad: item.porcentajeUtilidad ?? 30,
                    iva: item.iva ?? 16,
                    price: item.precioFinalUSD || 0,
                    precioVentaUSD: item.precioFinalUSD || 0,
                    images: (rawRow && Array.isArray(rawRow.imagenes) && rawRow.imagenes.length > 0) ? rawRow.imagenes : ['assets/products/default.png'],
                    specs: (rawRow && rawRow.specs) ? rawRow.specs : {}
                });
            }
        });

        window.products = updatedProducts;
    }

    async function _fetchAllPaginated(table, selectCols, orderCol) {
        const allRows = [];
        const pageSize = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            let query = _client.from(table).select(selectCols);
            if (orderCol) query = query.order(orderCol, { ascending: false });
            const { data, error } = await query.range(from, from + pageSize - 1);
            if (error) return { data: null, error };
            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                allRows.push(...data);
                if (data.length < pageSize) hasMore = false;
                else from += pageSize;
            }
        }
        return { data: allRows, error: null };
    }

    async function pullCloudUpdates() {
        if (!_client || !_isOnline || _isSyncing || _isPulling || _getQueue().length > 0) return false;
        if (typeof window.NovaDB === 'undefined') return false;

        _isPulling = true;
        try {
            let anyChanged = false;
            let productsChanged = false;
            let customersChanged = false;
            let cashOrSalesChanged = false;
            let purchasesChanged = false;

            // 0. CONFIGURACIÓN Y TASA BCV DESDE LA NUBE
            try {
                const { data: remoteCfg, error: cfgErr } = await _client
                    .from('configuracion')
                    .select('*')
                    .eq('id', 'default')
                    .maybeSingle();

                if (!cfgErr && remoteCfg) {
                    const localSettings = window.NovaDB.getSettings();
                    let cfgChanged = false;

                    const remoteTasaBCV = parseFloat(remoteCfg.tasa_bcv);
                    if (!isNaN(remoteTasaBCV) && remoteTasaBCV > 0 && Math.abs(remoteTasaBCV - (localSettings.tasaBCV || 0)) > 0.001) {
                        localSettings.tasaBCV = remoteTasaBCV;
                        cfgChanged = true;
                    }

                    const remoteTasaInt = parseFloat(remoteCfg.tasa_interna);
                    if (!isNaN(remoteTasaInt) && remoteTasaInt > 0 && Math.abs(remoteTasaInt - (localSettings.tasaInterna || 0)) > 0.001) {
                        localSettings.tasaInterna = remoteTasaInt;
                        cfgChanged = true;
                    }

                    if (remoteCfg.empresa_nombre) {
                        if (!localSettings.empresa) localSettings.empresa = {};
                        if (localSettings.empresa.nombre !== remoteCfg.empresa_nombre) {
                            localSettings.empresa.nombre = remoteCfg.empresa_nombre;
                            cfgChanged = true;
                        }
                        if (remoteCfg.empresa_rif && localSettings.empresa.rif !== remoteCfg.empresa_rif) {
                            localSettings.empresa.rif = remoteCfg.empresa_rif;
                            cfgChanged = true;
                        }
                        if (remoteCfg.empresa_telefono && localSettings.empresa.telefono !== remoteCfg.empresa_telefono) {
                            localSettings.empresa.telefono = remoteCfg.empresa_telefono;
                            cfgChanged = true;
                        }
                        if (remoteCfg.empresa_direccion && localSettings.empresa.direccion !== remoteCfg.empresa_direccion) {
                            localSettings.empresa.direccion = remoteCfg.empresa_direccion;
                            cfgChanged = true;
                        }
                    }

                    if (cfgChanged) {
                        localStorage.setItem('nova_erp_settings', JSON.stringify(localSettings));
                        anyChanged = true;
                        if (typeof updateBCVDisplay === 'function') updateBCVDisplay();
                        if (typeof renderPOSCart === 'function') renderPOSCart();
                        if (typeof renderPOSCatalog === 'function') renderPOSCatalog();
                    }
                }
            } catch (cfgEx) {
                console.warn('[NovaSupabase] Error sincronizando configuración:', cfgEx);
            }

            // 1. PRODUCTOS E INVENTARIO (Fuente única de verdad)
            const prodRes = await _fetchAllPaginated(
                'productos',
                'id, parent_id, nombre, categoria, descripcion, costo_compra, precio_novacliente, specs, stock, stock_minimo, ubicacion, imagenes'
            );
            if (!prodRes.error && Array.isArray(prodRes.data) && prodRes.data.length > 0) {
                const prevInv = window.NovaDB.getInventory();
                const prevInvJson = JSON.stringify(prevInv);
                const freshInv = {};
                const rowsById = {};

                prodRes.data.forEach(r => {
                    rowsById[r.id] = r;
                    freshInv[r.id] = _mapRemoteProductToInv(r, prevInv[r.id]);
                });

                const newInvJson = JSON.stringify(freshInv);
                localStorage.setItem('nova_erp_cloud_synced', '1');
                if (newInvJson !== prevInvJson) {
                    localStorage.setItem('nova_erp_inventory', newInvJson);
                    productsChanged = true;
                    anyChanged = true;
                }
                _syncMemoryProductsFromInv(freshInv, rowsById);
            }

            // 2. CLIENTES (CRM)
            const { data: remoteCust, error: custErr } = await _client
                .from('clientes')
                .select('id, nombre, rif, telefono, direccion, tipo, notas')
                .order('id', { ascending: true });

            if (!custErr && Array.isArray(remoteCust)) {
                let mappedCust = remoteCust.map(rc => ({
                    id: rc.id,
                    nombre: rc.nombre,
                    rif: rc.rif,
                    telefono: rc.telefono || '',
                    direccion: rc.direccion || '',
                    tipo: 'cliente',
                    notas: rc.notas || ''
                }));
                if (mappedCust.length === 0) {
                    mappedCust = [{ id: "CLI-001", nombre: "Cliente Mostrador (Contado)", rif: "V-00000000", telefono: "0424-0000000", direccion: "Cabimas, Edo. Zulia", tipo: "cliente", notas: "Cliente general" }];
                }
                // Garantizar que CLI-001 quede primero si existe
                mappedCust.sort((a, b) => (a.id === 'CLI-001' ? -1 : b.id === 'CLI-001' ? 1 : a.id.localeCompare(b.id)));
                const newCustJson = JSON.stringify(mappedCust);
                if (newCustJson !== localStorage.getItem('nova_erp_customers')) {
                    localStorage.setItem('nova_erp_customers', newCustJson);
                    customersChanged = true;
                    anyChanged = true;
                }
            }

            // 3. VENTAS Y FACTURACIÓN
            const salesRes = await _fetchAllPaginated('ventas', '*', 'timestamp');
            if (!salesRes.error && Array.isArray(salesRes.data)) {
                const mappedSales = salesRes.data.map(s => ({
                    id: s.id,
                    timestamp: Number(s.timestamp) || (s.created_at ? new Date(s.created_at).getTime() : Date.now()),
                    fechaStr: s.fecha_str || '',
                    horaStr: s.hora_str || '',
                    cliente: s.cliente || { nombre: 'Cliente Mostrador', rif: 'V-00000000' },
                    items: Array.isArray(s.items) ? s.items : [],
                    tipoPrecio: s.tipo_precio || 'publico',
                    tipoDocumento: s.tipo_documento || 'factura',
                    tasaBCV: parseFloat(s.tasa_bcv) || 0,
                    totalUSD: parseFloat(s.total_usd) || 0,
                    totalBs: parseFloat(s.total_bs) || 0,
                    metodosPago: Array.isArray(s.metodos_pago) ? s.metodos_pago : [],
                    montoPagadoUSD: parseFloat(s.monto_pagado_usd) || 0,
                    montoPagadoBs: parseFloat(s.monto_pagado_bs) || 0,
                    vueltoUSD: parseFloat(s.vuelto_usd) || 0,
                    vueltoBs: parseFloat(s.vuelto_bs) || 0,
                    vendedor: s.vendedor || 'Caja Principal',
                    cajero: s.cajero || 'MASTER'
                }));
                const newSalesJson = JSON.stringify(mappedSales);
                if (newSalesJson !== localStorage.getItem('nova_erp_sales')) {
                    localStorage.setItem('nova_erp_sales', newSalesJson);
                    cashOrSalesChanged = true;
                    anyChanged = true;
                }
            }

            // 4. EGRESOS DE CAJA
            const { data: remoteExp, error: expErr } = await _client
                .from('egresos')
                .select('*')
                .order('timestamp', { ascending: false });

            if (!expErr && Array.isArray(remoteExp)) {
                const mappedExp = remoteExp.map(e => ({
                    id: e.id,
                    timestamp: Number(e.timestamp) || (e.created_at ? new Date(e.created_at).getTime() : Date.now()),
                    fechaStr: e.fecha_str || '',
                    concepto: e.concepto || '',
                    categoria: e.categoria || 'General',
                    montoUSD: parseFloat(e.monto_usd) || 0,
                    montoBs: parseFloat(e.monto_bs) || 0,
                    metodoPago: e.metodo_pago || 'Efectivo USD'
                }));
                const newExpJson = JSON.stringify(mappedExp);
                if (newExpJson !== localStorage.getItem('nova_erp_expenses')) {
                    localStorage.setItem('nova_erp_expenses', newExpJson);
                    cashOrSalesChanged = true;
                    anyChanged = true;
                }
            }

            // 5. PROVEEDORES
            const { data: remoteSupp, error: suppErr } = await _client
                .from('proveedores')
                .select('*')
                .order('id', { ascending: true });

            if (!suppErr && Array.isArray(remoteSupp)) {
                const mappedSupp = remoteSupp.map(s => ({
                    id: s.id,
                    razonSocial: s.razon_social || '',
                    rif: s.rif || '',
                    telefono: s.telefono || '',
                    contacto: s.contacto || '',
                    rubro: s.rubro || ''
                }));
                const newSuppJson = JSON.stringify(mappedSupp);
                if (newSuppJson !== localStorage.getItem('nova_erp_suppliers')) {
                    localStorage.setItem('nova_erp_suppliers', newSuppJson);
                    purchasesChanged = true;
                    anyChanged = true;
                }
            }

            // 6. COMPRAS A PROVEEDORES
            const { data: remotePurch, error: purchErr } = await _client
                .from('compras')
                .select('*')
                .order('timestamp', { ascending: false });

            if (!purchErr && Array.isArray(remotePurch)) {
                const mappedPurch = remotePurch.map(c => ({
                    id: c.id,
                    timestamp: Number(c.timestamp) || (c.created_at ? new Date(c.created_at).getTime() : Date.now()),
                    fechaStr: c.fecha_str || '',
                    proveedorId: c.proveedor_id || '',
                    proveedorNombre: c.proveedor_nombre || '',
                    facturaNumero: c.factura_numero || '',
                    items: Array.isArray(c.items) ? c.items : [],
                    totalUSD: parseFloat(c.total_usd) || 0,
                    notas: c.notas || ''
                }));
                const newPurchJson = JSON.stringify(mappedPurch);
                if (newPurchJson !== localStorage.getItem('nova_erp_purchases')) {
                    localStorage.setItem('nova_erp_purchases', newPurchJson);
                    purchasesChanged = true;
                    anyChanged = true;
                }
            }

            // 7. TURNOS Y CIERRES DE CAJA
            const { data: remoteShifts, error: shiftErr } = await _client
                .from('turnos_caja')
                .select('*')
                .order('created_at', { ascending: false });

            if (!shiftErr && Array.isArray(remoteShifts) && remoteShifts.length > 0) {
                const mappedShifts = remoteShifts.map(t => ({
                    id: t.id,
                    fechaApertura: t.fecha_apertura || '',
                    fechaCierre: t.fecha_cierre || null,
                    montoInicialUSD: parseFloat(t.monto_inicial_usd) || 0,
                    montoInicialBs: parseFloat(t.monto_inicial_bs) || 0,
                    estado: t.estado || 'cerrada',
                    ventasIds: Array.isArray(t.ventas_ids) ? t.ventas_ids : [],
                    egresosIds: Array.isArray(t.egresos_ids) ? t.egresos_ids : [],
                    arqueoFisico: t.arqueo_fisico || null
                }));
                // Mantener un turno abierto si todos los remotos están cerrados
                const localShifts = window.NovaDB.getCashShifts ? window.NovaDB.getCashShifts() : [];
                const hasRemoteOpen = mappedShifts.some(s => s.estado === 'abierta' || s.estado === 'abierto');
                if (!hasRemoteOpen) {
                    const localOpen = localShifts.find(s => s.estado === 'abierta' || s.estado === 'abierto');
                    if (localOpen) mappedShifts.unshift(localOpen);
                }
                const newShiftJson = JSON.stringify(mappedShifts);
                if (newShiftJson !== localStorage.getItem('nova_erp_cash_shifts')) {
                    localStorage.setItem('nova_erp_cash_shifts', newShiftJson);
                    cashOrSalesChanged = true;
                    anyChanged = true;
                }
            }

            // Refrescar únicamente las vistas afectadas
            if (productsChanged) {
                if (typeof renderInventoryView === 'function') renderInventoryView();
                if (typeof renderPOSCatalog === 'function') renderPOSCatalog();
            }
            if (customersChanged) {
                if (typeof renderCustomersView === 'function') renderCustomersView();
                if (typeof renderPOSCustomerSelect === 'function') renderPOSCustomerSelect();
            }
            if (cashOrSalesChanged) {
                if (typeof renderCashView === 'function') renderCashView();
            }
            if (purchasesChanged) {
                if (typeof renderPurchasesView === 'function') renderPurchasesView();
            }

            return anyChanged;
        } catch (e) {
            console.warn('[NovaSupabase] Aviso al descargar actualizaciones de la nube:', e);
            return false;
        } finally {
            _isPulling = false;
        }
    }

    function _subscribeRealtime() {
        if (!_client || _realtimeChannel) return;
        try {
            _realtimeChannel = _client
                .channel('nova-erp-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, (payload) => {
                    if (typeof window.NovaDB === 'undefined') return;
                    const inv = window.NovaDB.getInventory();
                    if (payload.eventType === 'DELETE' && payload.old && payload.old.id) {
                        delete inv[payload.old.id];
                        localStorage.setItem('nova_erp_inventory', JSON.stringify(inv));
                        _syncMemoryProductsFromInv(inv, null);
                    } else if (payload.new) {
                        inv[payload.new.id] = _mapRemoteProductToInv(payload.new, inv[payload.new.id]);
                        localStorage.setItem('nova_erp_inventory', JSON.stringify(inv));
                        _syncMemoryProductsFromInv(inv, { [payload.new.id]: payload.new });
                    }
                    if (typeof renderInventoryView === 'function') renderInventoryView();
                    if (typeof renderPOSCatalog === 'function') renderPOSCatalog();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, (payload) => {
                    if (typeof window.NovaDB === 'undefined') return;
                    let list = window.NovaDB.getCustomers();
                    if (payload.eventType === 'DELETE' && payload.old && payload.old.id) {
                        list = list.filter(c => c.id !== payload.old.id);
                    } else if (payload.new) {
                        const rc = payload.new;
                        const idx = list.findIndex(c => c.id === rc.id);
                        const mapped = {
                            id: rc.id,
                            nombre: rc.nombre,
                            rif: rc.rif,
                            telefono: rc.telefono || '',
                            direccion: rc.direccion || '',
                            tipo: 'cliente',
                            notas: rc.notas || ''
                        };
                        if (idx !== -1) list[idx] = mapped;
                        else list.push(mapped);
                    }
                    localStorage.setItem('nova_erp_customers', JSON.stringify(list));
                    if (typeof renderCustomersView === 'function') renderCustomersView();
                    if (typeof renderPOSCustomerSelect === 'function') renderPOSCustomerSelect();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, () => _scheduleRealtimePull())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'egresos' }, () => _scheduleRealtimePull())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'compras' }, () => _scheduleRealtimePull())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'proveedores' }, () => _scheduleRealtimePull())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_caja' }, () => _scheduleRealtimePull())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, (payload) => {
                    if (typeof window.NovaDB === 'undefined') return;
                    const newRow = payload.new;
                    if (!newRow) return;

                    const local = window.NovaDB.getSettings();
                    let changed = false;

                    const remoteBCV = parseFloat(newRow.tasa_bcv);
                    if (!isNaN(remoteBCV) && remoteBCV > 0 && Math.abs(remoteBCV - (local.tasaBCV || 0)) > 0.001) {
                        local.tasaBCV = remoteBCV;
                        changed = true;
                    }

                    const remoteInt = parseFloat(newRow.tasa_interna);
                    if (!isNaN(remoteInt) && remoteInt > 0 && Math.abs(remoteInt - (local.tasaInterna || 0)) > 0.001) {
                        local.tasaInterna = remoteInt;
                        changed = true;
                    }

                    if (newRow.empresa_nombre) {
                        if (!local.empresa) local.empresa = {};
                        if (local.empresa.nombre !== newRow.empresa_nombre) {
                            local.empresa.nombre = newRow.empresa_nombre;
                            changed = true;
                        }
                        if (newRow.empresa_rif && local.empresa.rif !== newRow.empresa_rif) {
                            local.empresa.rif = newRow.empresa_rif;
                            changed = true;
                        }
                        if (newRow.empresa_telefono && local.empresa.telefono !== newRow.empresa_telefono) {
                            local.empresa.telefono = newRow.empresa_telefono;
                            changed = true;
                        }
                        if (newRow.empresa_direccion && local.empresa.direccion !== newRow.empresa_direccion) {
                            local.empresa.direccion = newRow.empresa_direccion;
                            changed = true;
                        }
                    }

                    if (changed) {
                        localStorage.setItem('nova_erp_settings', JSON.stringify(local));
                        if (typeof updateBCVDisplay === 'function') updateBCVDisplay();
                        if (typeof renderPOSCart === 'function') renderPOSCart();
                        if (typeof renderPOSCatalog === 'function') renderPOSCatalog();
                        if (typeof renderInventoryTable === 'function' && typeof currentView !== 'undefined' && currentView === 'inventory') {
                            renderInventoryTable();
                        }
                    }
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_mostrador' }, async () => {
                    if (typeof NovaUsers !== 'undefined' && NovaUsers.isAdmin() && typeof window.NovaDB !== 'undefined') {
                        const remoteOrders = await fetchPendingCounterOrders();
                        if (remoteOrders && remoteOrders.length > 0) {
                            window.NovaDB.mergeIncomingHeldSales(remoteOrders);
                            if (typeof renderHeldSalesList === 'function') renderHeldSalesList();
                        }
                    }
                })
                .subscribe();
        } catch (e) {
            console.warn('[NovaSupabase] Suscripción Realtime opcional no disponible:', e);
        }
    }

    // ==========================================
    // 5.2 PURGA Y LIMPIEZA TOTAL DE DATOS DE PRUEBA EN LA NUBE
    // ==========================================
    async function purgeCloudTestData() {
        if (!_client || !_isOnline) return false;
        try {
            console.log("[NovaSupabase] Iniciando purga segura de datos de prueba en la nube...");
            await _client.from('ventas').delete().neq('id', '___NONE___');
            await _client.from('pedidos_mostrador').delete().neq('id', '___NONE___');
            await _client.from('egresos').delete().neq('id', '___NONE___');
            await _client.from('compras').delete().neq('id', '___NONE___');
            await _client.from('proveedores').delete().neq('id', '___NONE___');
            await _client.from('turnos_caja').delete().neq('id', '___NONE___');
            await _client.from('movimientos_stock').delete().neq('id', 0);
            await _client.from('clientes').delete().neq('id', 'CLI-001');

            await _client.from('clientes').upsert([{
                id: "CLI-001",
                nombre: "Cliente Mostrador (Contado)",
                rif: "V-00000000",
                telefono: "0424-0000000",
                direccion: "Cabimas, Edo. Zulia",
                tipo: "cliente",
                notas: "Cliente general"
            }], { onConflict: 'id' });

            clearQueue();
            console.log("[NovaSupabase] Purga en la nube finalizada con éxito.");
            return true;
        } catch (e) {
            console.error("[NovaSupabase] Error en purgeCloudTestData:", e);
            throw e;
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
        pullCloudUpdates,
        fetchPendingCounterOrders,
        markCounterOrderServed,
        seedFullCatalog,
        checkAndSeedCatalog,
        purgeCloudTestData,
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
