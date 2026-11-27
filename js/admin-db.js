/**
 * ==============================================================================
 * NOVA REFRIMOTORS - MOTOR DE BASE DE DATOS Y PERSISTENCIA LOCAL (admin-db.js)
 * ==============================================================================
 * Capa de almacenamiento Local-First de alta velocidad para entorno de mostrador.
 * Gestiona:
 * - Configuración del sistema (Tasas BCV, márgenes, datos fiscales).
 * - Inventario y existencias en tiempo real sincronizado con productos.js.
 * - Registro de Ventas, Tickets, Presupuestos y Notas de Entrega.
 * - Turnos de Caja (Aperturas, Arqueos X/Z, Gastos operativos).
 * - Directorio de Clientes (CRM) y Proveedores.
 * - Registro de Compras de mercancía con auto-actualización de stock y costos.
 * - Ventas en espera (Pausar y Reanudar carritos).
 * - Copias de seguridad (Backup / Restore en JSON).
 * ==============================================================================
 */

const NovaDB = (function () {
    const STORAGE_KEY_PREFIX = 'nova_erp_';

    const DEFAULT_SETTINGS = {
        tasaBCV: 915.75,
        tasaInterna: 1050,
        porcentajeUtilidad: 1.30,
        porcentajeIva: 1.16,
        masterPin: "1005",
        empresa: {
            nombre: "NOVA RefriMotors",
            rif: "J504401994",
            telefono: "+58 424-6192394",
            direccion: "Galpón al lado del Estacionamiento Centro Clínico, Av. Carabobo, Cabimas 4013, Zulia",
            lema: "Tu aliado estratégico en repuestos de refrigeración",
            email: "ventas@novarefrimotors.com"
        }
    };

    const DEFAULT_CUSTOMERS = [
        { id: "CLI-001", nombre: "Cliente Mostrador (Contado)", rif: "V-00000000", telefono: "0424-0000000", direccion: "Cabimas, Edo. Zulia", tipo: "cliente", notas: "Cliente general" },
        { id: "CLI-TALLER", nombre: "Taller Nova", rif: "J-504401994", telefono: "+58 424-6192394", direccion: "Galpón NOVA RefriMotors, Av. Carabobo, Cabimas, Edo. Zulia", tipo: "taller", notas: "Taller interno NOVA (Protegido)" }
    ];

    const DEFAULT_SUPPLIERS = [];

    // Registro en memoria de pedidos descartados/atendidos para prevenir resurrección en sondeos
    const _discardedOrders = new Set();

    function _read(key, fallback) {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            console.error(`Error leyendo ${key} de NovaDB:`, e);
            return fallback;
        }
    }

    function _write(key, data) {
        try {
            localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error(`Error guardando ${key} en NovaDB:`, e);
            return false;
        }
    }

    // ==========================================
    // 1. INICIALIZACIÓN DE LA BASE DE DATOS
    // ==========================================
    function init() {
        if (!_read('settings', null)) {
            _write('settings', DEFAULT_SETTINGS);
        }

        // Clientes: inicializar o depurar registros demo antiguos
        let currentCust = _read('customers', null);
        if (!currentCust) {
            _write('customers', DEFAULT_CUSTOMERS);
        } else {
            const cleanedCust = currentCust.filter(c => c.id !== 'CLI-002' && c.id !== 'CLI-003' && !c.nombre?.includes('Serviluz') && !c.nombre?.includes('Luis González'));
            if (cleanedCust.length === 0) cleanedCust.push(DEFAULT_CUSTOMERS[0]);
            if (cleanedCust.length !== currentCust.length) {
                _write('customers', cleanedCust);
            }
        }

        // Proveedores: inicializar o depurar proveedores demo antiguos
        let currentSupp = _read('suppliers', null);
        if (!currentSupp) {
            _write('suppliers', DEFAULT_SUPPLIERS);
        } else {
            const cleanedSupp = currentSupp.filter(s => !s.razonSocial?.includes('Steinmann') && !s.razonSocial?.includes('Maxwell') && !s.razonSocial?.includes('Exceline') && !s.razonSocial?.includes('Gases Refrigerantes'));
            if (cleanedSupp.length !== currentSupp.length) {
                _write('suppliers', cleanedSupp);
            }
        }

        if (!_read('sales', null)) {
            _write('sales', []);
        }
        if (!_read('purchases', null)) {
            _write('purchases', []);
        }
        if (!_read('expenses', null)) {
            _write('expenses', []);
        }
        if (!_read('held_sales', null)) {
            _write('held_sales', []);
        }
        if (!_read('sale_voids', null)) {
            _write('sale_voids', []);
        }
        if (!_read('product_exchanges', null)) {
            _write('product_exchanges', []);
        }
        if (!_read('price_change_log', null)) {
            _write('price_change_log', []);
        }
        if (!_read('security_audit_logs', null)) {
            _write('security_audit_logs', []);
        }

        // Inicializar inventario a partir de los 460 productos y variantes
        _syncInitialInventory();
        _migrateProductDistinctNames();
        _purgeNonStandardSkus();

        // Verificar o abrir turno de caja inicial si no existe
        _checkActiveCashShift();
    }

    function _isStandardSku(sku) {
        return /^[A-Z]{3}\d{3}$/.test(String(sku || '').trim().toUpperCase());
    }

    function _purgeNonStandardSkus() {
        const inv = _read('inventory', {});
        const keys = Object.keys(inv);
        let removed = 0;
        keys.forEach(k => {
            if (!_isStandardSku(k)) {
                delete inv[k];
                removed++;
            }
        });
        if (removed > 0) {
            _write('inventory', inv);
            console.log(`[NovaDB] Purgados ${removed} SKUs no estándar (fuera de regla 3 letras + 3 números).`);
        }
    }

    function _migrateProductDistinctNames() {
        let inv = _read('inventory', {});
        const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
        if (prods.length === 0 || Object.keys(inv).length === 0) return;

        const cleanMap = {};
        prods.forEach(p => {
            if (p.variants && Array.isArray(p.variants)) {
                p.variants.forEach(v => {
                    if (v && v.id && v.name) cleanMap[v.id] = v.name;
                });
            } else if (p.id && p.name) {
                cleanMap[p.id] = p.name;
            }
        });

        let modified = false;
        Object.keys(inv).forEach(id => {
            const cleanName = cleanMap[id];
            if (cleanName && inv[id].name !== cleanName) {
                inv[id].name = cleanName;
                modified = true;
            }
        });

        if (modified) {
            _write('inventory', inv);
            console.log('[NovaDB] Catálogo local actualizado a nombres distintivos.');
        }
    }

    function _syncInitialInventory() {
        let inv = _read('inventory', {});
        // Si ya se sincronizó con Supabase como fuente única de verdad, no resucitar productos eliminados desde productos.js
        if (localStorage.getItem('nova_erp_cloud_synced') === '1' && Object.keys(inv).length > 0) {
            return;
        }
        const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
        let modified = false;

        prods.forEach(p => {
            if (p.variants && Array.isArray(p.variants)) {
                p.variants.forEach(v => {
                    const vCode = v.id;
                    if (!inv[vCode]) {
                        inv[vCode] = {
                            id: vCode,
                            parentId: p.id,
                            name: v.name || `${p.name} (${v.name})`,
                            category: p.category,
                            stock: 12, // Stock inicial configurable
                            stockMinimo: 3,
                            ubicacion: "Pasillo 1 - Estante A"
                        };
                        modified = true;
                    }
                });
            } else {
                if (!inv[p.id]) {
                    inv[p.id] = {
                        id: p.id,
                        parentId: null,
                        name: p.name,
                        category: p.category,
                        stock: 15, // Stock inicial configurable
                        stockMinimo: 4,
                        ubicacion: "Almacén Central"
                    };
                    modified = true;
                }
            }
        });

        if (modified) {
            _write('inventory', inv);
        }
    }

    function _checkActiveCashShift() {
        let shifts = _read('cash_shifts', []);
        const active = shifts.find(s => s.estado === 'abierta');
        if (!active) {
            const newShift = {
                id: 'TURNO-' + Date.now().toString().slice(-6),
                fechaApertura: new Date().toISOString(),
                montoInicialUSD: 50.00, // Fondo base en caja $
                montoInicialBs: 0.00,
                estado: 'abierta',
                ventasIds: [],
                egresosIds: []
            };
            shifts.unshift(newShift);
            _write('cash_shifts', shifts);
        }
        reconcileActiveShiftSales();
    }

    // ==========================================
    // 2. MÉTODOS DE CONFIGURACIÓN Y TASAS
    // ==========================================
    function getSettings() {
        const s = _read('settings', DEFAULT_SETTINGS);
        if (!s.masterPin || s.masterPin === '1234') {
            s.masterPin = '1005';
            _write('settings', s);
        }
        return s;
    }

    function updateSettings(newSettings) {
        const current = getSettings();
        const updated = Object.assign({}, current, newSettings);
        _write('settings', updated);
        return updated;
    }

    function setTasaBCV(newRate) {
        const rate = parseFloat(newRate);
        if (isNaN(rate) || rate <= 0) return false;
        const s = getSettings();
        s.tasaBCV = rate;
        _write('settings', s);
        return true;
    }

    function setTasaInterna(newRate) {
        const rate = parseFloat(newRate);
        if (isNaN(rate) || rate <= 0) return false;
        const s = getSettings();
        s.tasaInterna = rate;
        _write('settings', s);
        return true;
    }

    // ==========================================
    // 3. MÉTODOS DE INVENTARIO Y STOCK
    // ==========================================
    function getInventory() {
        const inv = _read('inventory', {});
        let cleaned = false;
        Object.keys(inv).forEach(k => {
            if (!_isStandardSku(k)) {
                delete inv[k];
                cleaned = true;
            }
        });
        if (cleaned) _write('inventory', inv);
        return inv;
    }

    function _resolveInvKey(inv, productId) {
        if (!productId || !inv) return null;
        if (inv[productId]) return productId;
        const clean = String(productId).trim().toLowerCase();
        return Object.keys(inv).find(k => k.toLowerCase() === clean) || null;
    }

    function _syncStockToMemory(key, newStock) {
        if (typeof window !== 'undefined' && Array.isArray(window.products)) {
            for (let p of window.products) {
                if (p && p.id === key) {
                    p.stock = newStock;
                    break;
                }
                if (p && p.variants && Array.isArray(p.variants)) {
                    let v = p.variants.find(x => x && x.id === key);
                    if (v) {
                        v.stock = newStock;
                        break;
                    }
                }
            }
        }
    }

    function getStock(productId) {
        const inv = getInventory();
        const key = _resolveInvKey(inv, productId);
        return key ? (parseInt(inv[key].stock) || 0) : 0;
    }

    function setStock(productId, newQty, reason = "Ajuste manual de almacén") {
        const inv = getInventory();
        const qty = parseInt(newQty);
        if (isNaN(qty) || qty < 0) return false;

        const key = _resolveInvKey(inv, productId) || productId;
        if (inv[key]) {
            const oldStock = parseInt(inv[key].stock) || 0;
            inv[key].stock = qty;
            _write('inventory', inv);
            _syncStockToMemory(key, qty);
            _logStockMovement({
                productId: key,
                productoId: key,
                oldStock,
                newStock: qty,
                diff: qty - oldStock,
                reason,
                motivo: reason,
                timestamp: new Date().toISOString()
            });
            return true;
        }
        return false;
    }

    function deductStock(productId, qtyToDeduct, reason = "Venta Mostrador", responsable = "") {
        const inv = getInventory();
        const qty = parseInt(qtyToDeduct);
        if (isNaN(qty) || qty <= 0) return false;

        const key = _resolveInvKey(inv, productId) || productId;
        if (inv[key]) {
            const oldStock = parseInt(inv[key].stock) || 0;
            const newStock = Math.max(0, oldStock - qty);
            inv[key].stock = newStock;
            _write('inventory', inv);
            _syncStockToMemory(key, newStock);
            const docIdMatch = (typeof reason === 'string' && reason.includes('Venta ')) ? reason.replace('Venta ', '').trim() : '';
            _logStockMovement({
                productId: key,
                productoId: key,
                oldStock,
                newStock,
                diff: -qty,
                reason,
                motivo: reason,
                docId: docIdMatch || '-',
                responsable: responsable || 'Responsable',
                timestamp: new Date().toISOString()
            });
            return true;
        }
        return false;
    }

    function addStock(productId, qtyToAdd, reason = "Entrada por compra", responsable = "") {
        const inv = getInventory();
        const qty = parseInt(qtyToAdd);
        if (isNaN(qty) || qty <= 0) return false;

        let key = _resolveInvKey(inv, productId) || productId;
        if (!inv[key] && typeof window !== 'undefined' && Array.isArray(window.products)) {
            const p = window.products.find(x => x && x.id === productId);
            if (p) {
                inv[p.id] = { ...p, stock: 0 };
                key = p.id;
            }
        }
        if (inv[key]) {
            const oldStock = parseInt(inv[key].stock) || 0;
            const newStock = oldStock + qty;
            inv[key].stock = newStock;
            _write('inventory', inv);
            _syncStockToMemory(key, newStock);
            const fullReason = responsable ? `${reason} (Resp: ${responsable})` : reason;
            const docIdMatch = (typeof reason === 'string' && reason.includes('Compra ')) ? reason.replace('Compra ', '').trim().split(' ')[0] : '';
            _logStockMovement({
                productId: key,
                productoId: key,
                oldStock,
                newStock,
                diff: qty,
                reason: fullReason,
                motivo: fullReason,
                docId: docIdMatch || '-',
                responsable: responsable || 'Responsable',
                timestamp: new Date().toISOString()
            });
            return true;
        }
        return false;
    }

    function addNewProduct(prodData) {
        const inv = getInventory();
        const code = (prodData.id || ('PROD-' + Date.now().toString().slice(-4))).toUpperCase().trim();
        const initialStock = parseInt(prodData.stock) || 0;
        const cost = parseFloat(prodData.costoCompra) || 0;
        const util = (prodData.porcentajeUtilidad !== undefined && !isNaN(prodData.porcentajeUtilidad)) ? parseFloat(prodData.porcentajeUtilidad) : 30;
        const ivaVal = (prodData.iva !== undefined && !isNaN(prodData.iva)) ? parseFloat(prodData.iva) : 16;
        const precioFinal = (prodData.precioFinalUSD !== undefined && !isNaN(prodData.precioFinalUSD))
            ? parseFloat(prodData.precioFinalUSD)
            : cost * (1 + util / 100) * (1 + ivaVal / 100);
        const detailedDesc = (prodData.descripcionDetallada || '').trim();

        inv[code] = {
            id: code,
            name: prodData.name || 'Nuevo Repuesto',
            descripcionDetallada: detailedDesc,
            description: detailedDesc,
            category: prodData.category || 'General',
            stock: initialStock,
            stockMinimo: parseInt(prodData.stockMinimo) || 3,
            ubicacion: prodData.ubicacion || 'Almacén Central',
            costoCompra: cost,
            porcentajeUtilidad: util,
            iva: ivaVal,
            precioFinalUSD: precioFinal
        };
        _write('inventory', inv);

        if (typeof window.products !== 'undefined' && Array.isArray(window.products)) {
            const exists = window.products.some(p => p.id === code);
            if (!exists) {
                window.products.push({
                    id: code,
                    name: inv[code].name,
                    descripcionDetallada: detailedDesc,
                    description: detailedDesc,
                    category: inv[code].category,
                    costoCompra: cost,
                    porcentajeUtilidad: util,
                    iva: ivaVal,
                    price: precioFinal,
                    precioVentaUSD: precioFinal,
                    images: ['assets/products/default.png'],
                    specs: { "Garantía": "90 días por defecto de fábrica" }
                });
            }
        }

        _logStockMovement({
            productId: code,
            oldStock: 0,
            newStock: initialStock,
            diff: initialStock,
            reason: "Alta de nuevo producto en catálogo",
            timestamp: new Date().toISOString()
        });

        return inv[code];
    }

    function deleteProduct(productId) {
        const inv = getInventory();
        if (inv[productId]) {
            delete inv[productId];
            _write('inventory', inv);
            try {
                const deleted = _read('deleted_products', []);
                if (!deleted.includes(productId)) {
                    deleted.push(productId);
                    _write('deleted_products', deleted);
                }
            } catch (e) {}
            if (typeof window.products !== 'undefined' && Array.isArray(window.products)) {
                window.products = window.products.filter(p => p.id !== productId);
                window.products.forEach(p => {
                    if (p.variants) p.variants = p.variants.filter(v => v.id !== productId);
                });
            }
            return true;
        }
        return false;
    }

    function updateProductCost(productId, newCost, user) {
        const cost = parseFloat(newCost);
        if (isNaN(cost) || cost < 0) return false;
        const inv = getInventory();
        const oldCost = inv[productId] ? (parseFloat(inv[productId].costoCompra) || 0) : 0;

        if (inv[productId]) {
            inv[productId].costoCompra = cost;
            _write('inventory', inv);
        }
        if (typeof window.products !== 'undefined' && Array.isArray(window.products)) {
            const p = window.products.find(x => x.id === productId);
            if (p) p.costoCompra = cost;
            window.products.forEach(prod => {
                if (prod.variants) {
                    const v = prod.variants.find(x => x.id === productId);
                    if (v) v.costoCompra = cost;
                }
            });
        }

        if (oldCost !== cost) {
            logPriceChange({
                sku: productId,
                name: (inv[productId] && inv[productId].name) ? inv[productId].name : productId,
                costoAnterior: oldCost,
                costoNuevo: cost,
                precioAnterior: inv[productId] ? (parseFloat(inv[productId].precioFinalUSD) || 0) : 0,
                precioNuevo: inv[productId] ? (parseFloat(inv[productId].precioFinalUSD) || 0) : 0,
                usuario: user || (typeof NovaUsers !== 'undefined' ? NovaUsers.getCurrentUser().name : 'Responsable'),
                motivo: 'Ajuste de costo de compra'
            });
        }
        return true;
    }

    function updateProduct(productId, updates, user) {
        if (!productId || !updates) return false;
        const inv = getInventory();
        let target = inv[productId];
        if (!target) {
            target = {
                id: productId,
                name: updates.name || productId,
                category: updates.category || 'General',
                stock: 0,
                stockMinimo: 3,
                ubicacion: 'Almacén Central',
                costoCompra: 0
            };
            inv[productId] = target;
        }

        const oldCosto = parseFloat(target.costoCompra) || 0;
        const oldUtil = parseFloat(target.porcentajeUtilidad) || 0;
        const oldPrice = parseFloat(target.precioFinalUSD) || 0;

        if (updates.name !== undefined) target.name = updates.name.trim();
        if (updates.descripcionDetallada !== undefined) {
            target.descripcionDetallada = updates.descripcionDetallada.trim();
            target.description = updates.descripcionDetallada.trim();
        }
        if (updates.category !== undefined) target.category = updates.category;
        if (updates.costoCompra !== undefined) target.costoCompra = parseFloat(updates.costoCompra) || 0;
        if (updates.porcentajeUtilidad !== undefined) target.porcentajeUtilidad = parseFloat(updates.porcentajeUtilidad) || 0;
        if (updates.iva !== undefined) target.iva = parseFloat(updates.iva) || 0;
        if (updates.precioFinalUSD !== undefined) target.precioFinalUSD = parseFloat(updates.precioFinalUSD) || 0;
        if (updates.oferta !== undefined) target.oferta = updates.oferta;

        _write('inventory', inv);

        const newCosto = parseFloat(target.costoCompra) || 0;
        const newUtil = parseFloat(target.porcentajeUtilidad) || 0;
        const newPrice = parseFloat(target.precioFinalUSD) || 0;

        // Registrar auditoría de precio o costo si hubo variación
        if (oldCosto !== newCosto || oldUtil !== newUtil || oldPrice !== newPrice) {
            logPriceChange({
                sku: productId,
                name: target.name || productId,
                costoAnterior: oldCosto,
                costoNuevo: newCosto,
                precioAnterior: oldPrice,
                precioNuevo: newPrice,
                utilidadAnterior: oldUtil,
                utilidadNueva: newUtil,
                usuario: updates.usuario || user || (typeof NovaUsers !== 'undefined' && NovaUsers.getCurrentUser ? NovaUsers.getCurrentUser().name : 'Responsable'),
                motivo: updates.motivo || 'Modificación en Almacén'
            });
        }

        if (typeof window.products !== 'undefined' && Array.isArray(window.products)) {
            const updateItem = (item) => {
                if (updates.name !== undefined) item.name = updates.name.trim();
                if (updates.descripcionDetallada !== undefined) {
                    item.descripcionDetallada = updates.descripcionDetallada.trim();
                    item.description = updates.descripcionDetallada.trim();
                }
                if (updates.category !== undefined) item.category = updates.category;
                if (updates.costoCompra !== undefined) item.costoCompra = parseFloat(updates.costoCompra) || 0;
                if (updates.porcentajeUtilidad !== undefined) item.porcentajeUtilidad = parseFloat(updates.porcentajeUtilidad) || 0;
                if (updates.iva !== undefined) item.iva = parseFloat(updates.iva) || 0;
                if (updates.precioFinalUSD !== undefined) {
                    item.price = updates.precioFinalUSD;
                    item.precioVentaUSD = updates.precioFinalUSD;
                }
            };

            const p = window.products.find(x => x.id === productId);
            if (p) updateItem(p);
            window.products.forEach(prod => {
                if (prod.variants) {
                    const v = prod.variants.find(x => x.id === productId);
                    if (v) updateItem(v);
                }
            });
        }
        return true;
    }

    function _logStockMovement(entry) {
        const logs = _read('stock_logs', []);
        logs.unshift(entry);
        if (logs.length > 500) logs.pop();
        _write('stock_logs', logs);
    }

    function getStockLogs() {
        return _read('stock_logs', []);
    }

    // ==========================================
    // 4. MÉTODOS DE VENTAS Y FACTURACIÓN
    // ==========================================
    function getSales() {
        return _read('sales', []);
    }

    function registerSale(saleData) {
        const sales = getSales();
        const docType = saleData.tipoDocumento || 'factura';
        const prefix = docType === 'nota_entrega' ? 'ND-' : (docType === 'presupuesto' ? 'PRE-' : 'FAC-');

        // Generar correlativo único tomando el máximo numérico existente para evitar colisiones
        let maxNum = 0;
        sales.forEach(s => {
            if (s && s.id && s.id.startsWith(prefix)) {
                const n = parseInt(s.id.replace(/\D/g, ''), 10);
                if (!isNaN(n) && n > maxNum) maxNum = n;
            }
        });
        const saleId = prefix + (maxNum + 1).toString().padStart(5, '0');
        const now = new Date();

        const record = {
            id: saleId,
            timestamp: now.getTime(),
            fechaStr: now.toLocaleDateString('es-VE'),
            horaStr: now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
            cliente: saleData.cliente || { nombre: "Cliente Mostrador", rif: "V-00000000", telefono: "" },
            items: saleData.items || [],
            tipoPrecio: saleData.tipoPrecio || 'publico',
            descuentoDivisas: !!saleData.descuentoDivisas,
            tipoDocumento: docType, // 'factura' | 'presupuesto' | 'nota_entrega'
            tasaBCV: saleData.tasaBCV || getSettings().tasaBCV,
            totalUSD: saleData.totalUSD || 0,
            totalBs: saleData.totalBs || 0,
            banco: saleData.banco || null,
            metodosPago: saleData.metodosPago || [],
            montoPagadoUSD: saleData.montoPagadoUSD || 0,
            montoPagadoBs: saleData.montoPagadoBs || 0,
            vueltoUSD: saleData.vueltoUSD || 0,
            vueltoBs: saleData.vueltoBs || 0,
            vendedor: saleData.vendedor || "Caja Principal",
            cajero: saleData.cajero || "MASTER",
            esCredito: !!saleData.esCredito,
            pagadoCredito: !!saleData.pagadoCredito,
            estadoPago: saleData.estadoPago || (saleData.esCredito ? 'pendiente' : 'pagado')
        };

        // Si es factura o nota de entrega, descontar del stock
        if (record.tipoDocumento !== 'presupuesto') {
            record.items.forEach(item => {
                deductStock(item.id, item.quantity, `Venta ${record.id}`);
            });

            // Asociar al turno de caja activo
            _addSaleToActiveShift(record.id);
        }

        sales.unshift(record);
        _write('sales', sales);
        return record;
    }

    function voidSale(saleId, motivo = "Anulación solicitada en mostrador", responsable = "Responsable") {
        if (!saleId) return { success: false, message: "ID de comprobante no especificado." };
        const sales = getSales();
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return { success: false, message: `No se encontró el comprobante ${saleId}.` };
        if (sale.anulada) return { success: false, message: `El comprobante ${saleId} ya fue anulado previamente.` };

        // 1. Reintegrar existencias al inventario general
        if (sale.tipoDocumento !== 'presupuesto' && Array.isArray(sale.items)) {
            sale.items.forEach(it => {
                const qty = parseInt(it.quantity) || 1;
                addStock(it.id, qty, `Anulación Factura ${sale.id}: ${motivo}`, responsable);
            });
        }

        // 2. Marcar la venta como anulada en base de datos
        const now = new Date();
        sale.anulada = true;
        sale.fechaAnulacion = now.toISOString();
        sale.fechaAnulacionStr = now.toLocaleDateString('es-VE');
        sale.horaAnulacionStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
        sale.motivoAnulacion = motivo;
        sale.responsableAnulacion = responsable;

        _write('sales', sales);

        // 3. Registrar en bitácora inmutable de auditoría de anulaciones
        const voidLogs = _read('sale_voids', []);
        const voidEntry = {
            id: 'ANUL-' + Date.now().toString().slice(-5),
            saleId: sale.id,
            timestamp: now.getTime(),
            fechaStr: sale.fechaAnulacionStr,
            horaStr: sale.horaAnulacionStr,
            cliente: sale.cliente,
            totalUSD: sale.totalUSD || 0,
            totalBs: sale.totalBs || 0,
            items: sale.items || [],
            motivo: motivo,
            responsable: responsable
        };
        voidLogs.unshift(voidEntry);
        _write('sale_voids', voidLogs);

        // Notificar por BroadcastChannel si aplica
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('nova_pos_channel');
                bc.postMessage({ type: 'SALE_VOIDED', saleId: sale.id });
                bc.close();
            }
        } catch (e) {}

        return { success: true, sale, voidEntry };
    }

    function registerProductExchange(exchangeData) {
        const { saleId, returnedItemId, returnedQty, newItemId, newQty, motivo, responsable, diferenciaUSD, diferenciaBs } = exchangeData;
        if (!returnedItemId || !newItemId) {
            return { success: false, message: "Debe indicar tanto el repuesto devuelto como el repuesto nuevo entregado." };
        }
        const rQty = parseInt(returnedQty) || 1;
        const nQty = parseInt(newQty) || 1;
        const resp = responsable || 'Responsable';
        const mot = motivo || 'Cambio de repuesto';

        // 1. Ingresar existencias del producto devuelto
        addStock(returnedItemId, rQty, `Devolución por Cambio Doc ${saleId || 'Mostrador'}: ${mot}`, resp);

        // 2. Descontar existencias del producto entregado
        deductStock(newItemId, nQty, `Entrega por Cambio Doc ${saleId || 'Mostrador'}: ${mot}`);

        // 3. Obtener nombres y detalles de ambos productos
        const inv = getInventory();
        const retProd = inv[returnedItemId] || (typeof window !== 'undefined' && window.products ? window.products.find(p => p.id === returnedItemId) : null);
        const newProd = inv[newItemId] || (typeof window !== 'undefined' && window.products ? window.products.find(p => p.id === newItemId) : null);

        // 4. Crear registro inmutable de cambio
        const now = new Date();
        const exchanges = _read('product_exchanges', []);
        const exchangeEntry = {
            id: 'CAMB-' + Date.now().toString().slice(-5),
            saleId: saleId || 'S/F',
            timestamp: now.getTime(),
            fechaStr: now.toLocaleDateString('es-VE'),
            horaStr: now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
            returnedItem: {
                id: returnedItemId,
                name: retProd ? (retProd.name || retProd.description) : returnedItemId,
                quantity: rQty
            },
            newItem: {
                id: newItemId,
                name: newProd ? (newProd.name || newProd.description) : newItemId,
                quantity: nQty
            },
            diferenciaUSD: parseFloat(diferenciaUSD) || 0,
            diferenciaBs: parseFloat(diferenciaBs) || 0,
            motivo: mot,
            responsable: resp
        };
        exchanges.unshift(exchangeEntry);
        _write('product_exchanges', exchanges);

        // 5. Vincular a la venta original si existe
        if (saleId) {
            const sales = getSales();
            const s = sales.find(x => x.id === saleId);
            if (s) {
                s.cambios = s.cambios || [];
                s.cambios.push(exchangeEntry.id);
                _write('sales', sales);
            }
        }

        return { success: true, exchangeEntry };
    }

    function getVoidSales() {
        return _read('sale_voids', []);
    }

    function markSaleCreditPaid(saleId) {
        if (!saleId) return false;
        const sales = getSales();
        const idx = sales.findIndex(s => s && s.id === saleId);
        if (idx === -1) return false;
        const fechaPago = new Date().toLocaleDateString('es-VE');
        sales[idx].pagadoCredito = true;
        sales[idx].estadoPago = 'pagado';
        sales[idx].fechaPagoCredito = fechaPago;
        if (Array.isArray(sales[idx].metodosPago) && sales[idx].metodosPago.length > 0 && typeof sales[idx].metodosPago[0] === 'object') {
            sales[idx].metodosPago[0].pagadoCredito = true;
            sales[idx].metodosPago[0].fechaPago = fechaPago;
        }
        _write('sales', sales);
        return true;
    }

    function getProductExchanges() {
        return _read('product_exchanges', []);
    }

    // ==========================================
    // 4.1 AUDITORÍA DE PRECIOS Y EVENTOS DE SEGURIDAD
    // ==========================================
    function logPriceChange(entry) {
        const logs = _read('price_change_log', []);
        const now = new Date();
        const newEntry = {
            id: 'PRC-' + Date.now().toString().slice(-6),
            timestamp: now.getTime(),
            fechaStr: now.toLocaleDateString('es-VE'),
            horaStr: now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
            sku: entry.sku || entry.id || '',
            name: entry.name || '',
            costoAnterior: parseFloat(entry.costoAnterior) || 0,
            costoNuevo: parseFloat(entry.costoNuevo) || 0,
            precioAnterior: parseFloat(entry.precioAnterior) || 0,
            precioNuevo: parseFloat(entry.precioNuevo) || 0,
            utilidadAnterior: parseFloat(entry.utilidadAnterior) || 0,
            utilidadNueva: parseFloat(entry.utilidadNueva) || 0,
            usuario: entry.usuario || (typeof NovaUsers !== 'undefined' ? NovaUsers.getCurrentUser().name : 'MASTER'),
            motivo: entry.motivo || 'Modificación en Almacén'
        };
        logs.unshift(newEntry);
        if (logs.length > 1000) logs.length = 1000;
        _write('price_change_log', logs);
        return newEntry;
    }

    function getPriceChangeLogs() {
        return _read('price_change_log', []);
    }

    function logSecurityEvent(eventData) {
        const logs = _read('security_audit_logs', []);
        const now = new Date();
        const entry = {
            id: 'SEC-' + Date.now().toString().slice(-6),
            timestamp: now.getTime(),
            fechaStr: now.toLocaleDateString('es-VE'),
            horaStr: now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
            usuario: eventData.usuario || (typeof NovaUsers !== 'undefined' ? NovaUsers.getCurrentUser().name : 'MASTER'),
            modulo: eventData.modulo || 'Seguridad',
            accion: eventData.accion || 'Operación',
            documento: eventData.documento || '-',
            detalles: eventData.detalles || '',
            nivel: eventData.nivel || 'info'
        };
        logs.unshift(entry);
        if (logs.length > 1000) logs.length = 1000;
        _write('security_audit_logs', logs);
        return entry;
    }

    function getSecurityLogs() {
        return _read('security_audit_logs', []);
    }

    // ==========================================
    // 5. VENTAS EN ESPERA Y PEDIDOS DE MOSTRADOR
    // ==========================================
    function getHeldSales() {
        return _read('held_sales', []);
    }

    function holdCurrentSale(cartItems, customerData, title, extraData = {}) {
        if (!cartItems || cartItems.length === 0) return false;
        const held = getHeldSales();
        const newHold = Object.assign({
            id: 'HOLD-' + Date.now().toString().slice(-4),
            timestamp: Date.now(),
            fechaStr: new Date().toLocaleDateString('es-VE'),
            horaStr: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
            title: title || (customerData ? customerData.nombre : '') || `Pedido en espera (${cartItems.length} ítems)`,
            customer: customerData,
            cart: cartItems,
            estacion: extraData.estacion || 'MOSTRADOR',
            vendedor: extraData.vendedor || 'MOSTRADOR',
            tipoPrecio: extraData.tipoPrecio || 'publico',
            totalUSD: extraData.totalUSD || 0,
            totalBs: extraData.totalBs || 0,
            estado: 'pendiente'
        }, extraData);

        // Evitar duplicados por id
        const idx = held.findIndex(h => h.id === newHold.id);
        if (idx !== -1) {
            held[idx] = newHold;
        } else {
            held.unshift(newHold);
        }
        _write('held_sales', held);

        // Notificar en tiempo real a otras pestañas/ventanas abiertas en este equipo
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('nova_pos_channel');
                bc.postMessage({ type: 'HELD_SALES_UPDATED', hold: newHold });
                bc.close();
            }
        } catch (e) {}

        return newHold;
    }

    function releaseHeldSale(holdId) {
        let held = getHeldSales();
        const target = held.find(h => h.id === holdId);
        if (target) {
            _discardedOrders.add(holdId);
            held = held.filter(h => h.id !== holdId);
            _write('held_sales', held);

            try {
                if (typeof BroadcastChannel !== 'undefined') {
                    const bc = new BroadcastChannel('nova_pos_channel');
                    bc.postMessage({ type: 'HELD_SALES_RELEASED', holdId });
                    bc.close();
                }
            } catch (e) {}

            return target;
        }
        return null;
    }

    function deleteHeldSale(holdId) {
        _discardedOrders.add(holdId);
        let held = getHeldSales();
        held = held.filter(h => h.id !== holdId);
        _write('held_sales', held);

        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('nova_pos_channel');
                bc.postMessage({ type: 'HELD_SALES_DELETED', holdId });
                bc.close();
            }
        } catch (e) {}

        return true;
    }

    function mergeIncomingHeldSales(incomingList) {
        if (!Array.isArray(incomingList) || incomingList.length === 0) return false;
        const current = getHeldSales();
        let changed = false;
        incomingList.forEach(inc => {
            if (_discardedOrders.has(inc.id)) return;
            const exists = current.some(c => c.id === inc.id);
            if (!exists) {
                current.unshift(inc);
                changed = true;
            }
        });
        if (changed) {
            _write('held_sales', current);
        }
        return changed;
    }

    // ==========================================
    // 6. CAJA, TURNOS Y ARQUEOS DIARIOS (X / Z)
    // ==========================================
    function getCashShifts() {
        return _read('cash_shifts', []);
    }

    function reconcileActiveShiftSales() {
        let shifts = _read('cash_shifts', []);
        const activeIdx = shifts.findIndex(s => s.estado === 'abierta' || s.estado === 'abierto');
        if (activeIdx === -1) return null;

        const active = shifts[activeIdx];
        if (!Array.isArray(active.ventasIds)) active.ventasIds = [];
        if (!Array.isArray(active.egresosIds)) active.egresosIds = [];

        // IDs de ventas que ya pertenecen a turnos cerrados
        const closedSaleIds = new Set();
        shifts.forEach(s => {
            if ((s.estado === 'cerrada' || s.estado === 'cerrado') && Array.isArray(s.ventasIds)) {
                s.ventasIds.forEach(id => closedSaleIds.add(id));
            }
        });

        const allSales = _read('sales', []);
        let changed = false;
        allSales.forEach(s => {
            if (s && s.id && !s.anulada && s.tipoDocumento !== 'presupuesto' && !closedSaleIds.has(s.id)) {
                if (!active.ventasIds.includes(s.id)) {
                    active.ventasIds.push(s.id);
                    changed = true;
                }
            }
        });

        // IDs de egresos que ya pertenecen a turnos cerrados
        const closedExpIds = new Set();
        shifts.forEach(s => {
            if ((s.estado === 'cerrada' || s.estado === 'cerrado') && Array.isArray(s.egresosIds)) {
                s.egresosIds.forEach(id => closedExpIds.add(id));
            }
        });

        const allExpenses = _read('expenses', []);
        allExpenses.forEach(e => {
            if (e && e.id && !closedExpIds.has(e.id)) {
                if (!active.egresosIds.includes(e.id)) {
                    active.egresosIds.push(e.id);
                    changed = true;
                }
            }
        });

        if (changed) {
            _write('cash_shifts', shifts);
        }
        return active;
    }

    function getActiveShift() {
        reconcileActiveShiftSales();
        const shifts = getCashShifts();
        return shifts.find(s => s.estado === 'abierta') || null;
    }

    function _addSaleToActiveShift(saleId) {
        const shifts = getCashShifts();
        const activeIdx = shifts.findIndex(s => s.estado === 'abierta');
        if (activeIdx !== -1) {
            if (!shifts[activeIdx].ventasIds.includes(saleId)) {
                shifts[activeIdx].ventasIds.push(saleId);
                _write('cash_shifts', shifts);
            }
        }
    }

    function addExpense(expenseData) {
        const expenses = _read('expenses', []);
        const newExp = {
            id: 'EGR-' + (expenses.length + 1).toString().padStart(4, '0'),
            timestamp: Date.now(),
            fechaStr: new Date().toLocaleDateString('es-VE'),
            concepto: expenseData.concepto,
            categoria: expenseData.categoria || 'Operativo',
            montoUSD: parseFloat(expenseData.montoUSD) || 0,
            montoBs: parseFloat(expenseData.montoBs) || 0,
            metodoPago: expenseData.metodoPago || 'Efectivo USD'
        };
        expenses.unshift(newExp);
        _write('expenses', expenses);

        // Asociar al turno activo
        const active = getActiveShift();
        if (active) {
            const shifts = getCashShifts();
            const idx = shifts.findIndex(s => s.id === active.id);
            if (idx !== -1) {
                shifts[idx].egresosIds = shifts[idx].egresosIds || [];
                shifts[idx].egresosIds.push(newExp.id);
                _write('cash_shifts', shifts);
            }
        }
        return newExp;
    }

    function getExpenses() {
        return _read('expenses', []);
    }

    function closeActiveShift(reconciliation) {
        reconcileActiveShiftSales();
        const shifts = getCashShifts();
        const idx = shifts.findIndex(s => s.estado === 'abierta');
        if (idx === -1) return null;

        const shift = shifts[idx];
        shift.estado = 'cerrada';
        shift.fechaCierre = new Date().toISOString();

        // Calcular y almacenar el resumen definitivo de cobros por banco receptor y por método
        const allSales = getSales();
        const shiftSales = allSales.filter(s => shift.ventasIds && shift.ventasIds.includes(s.id) && !s.anulada && s.tipoDocumento !== 'presupuesto');
        const totalesPorBanco = {};
        const totalesPorMetodo = {};
        let totalVentasUSD = 0;
        let totalVentasBs = 0;

        shiftSales.forEach(s => {
            const u = parseFloat(s.totalUSD) || 0;
            const b = parseFloat(s.totalBs) || 0;
            totalVentasUSD += u;
            totalVentasBs += b;

            let bankName = s.banco;
            if (!bankName && Array.isArray(s.metodosPago) && s.metodosPago.length > 0 && s.metodosPago[0].banco) {
                bankName = s.metodosPago[0].banco;
            }
            if (!bankName) {
                const m = (Array.isArray(s.metodosPago) && s.metodosPago[0] && s.metodosPago[0].metodo) || '';
                bankName = (m.toLowerCase().includes('efectivo')) ? 'Caja Efectivo' : 'Otros Bancos';
            }

            if (!totalesPorBanco[bankName]) {
                totalesPorBanco[bankName] = { count: 0, totalBs: 0, totalUSD: 0 };
            }
            totalesPorBanco[bankName].count += 1;
            totalesPorBanco[bankName].totalBs += b;
            totalesPorBanco[bankName].totalUSD += u;

            const mName = (Array.isArray(s.metodosPago) && s.metodosPago[0] && s.metodosPago[0].metodo) || 'Sin Especificar';
            if (!totalesPorMetodo[mName]) {
                totalesPorMetodo[mName] = { count: 0, totalBs: 0, totalUSD: 0 };
            }
            totalesPorMetodo[mName].count += 1;
            totalesPorMetodo[mName].totalBs += b;
            totalesPorMetodo[mName].totalUSD += u;
        });

        shift.totalesPorBanco = (reconciliation && reconciliation.totalesPorBanco && Object.keys(reconciliation.totalesPorBanco).length > 0)
            ? reconciliation.totalesPorBanco
            : totalesPorBanco;
        shift.totalesPorMetodo = totalesPorMetodo;
        shift.totalVentasUSD = totalVentasUSD;
        shift.totalVentasBs = totalVentasBs;
        shift.arqueoFisico = reconciliation; // Conteo real en gaveta vs sistema
        _write('cash_shifts', shifts);

        // Abrir automáticamente el siguiente turno
        const nextShift = {
            id: 'TURNO-' + Date.now().toString().slice(-6),
            fechaApertura: new Date().toISOString(),
            montoInicialUSD: (reconciliation && reconciliation.montoInicialSiguienteUSD) || 50.00,
            montoInicialBs: (reconciliation && reconciliation.montoInicialSiguienteBs) || 0.00,
            estado: 'abierta',
            ventasIds: [],
            egresosIds: []
        };
        shifts.unshift(nextShift);
        _write('cash_shifts', shifts);
        return shift;
    }

    // ==========================================
    // 7. CLIENTES (CRM) Y PROVEEDORES
    // ==========================================
    function getCustomers() {
        const list = _read('customers', DEFAULT_CUSTOMERS);
        let changed = false;
        DEFAULT_CUSTOMERS.forEach(def => {
            if (!list.some(c => c && c.id === def.id)) {
                list.push(Object.assign({}, def));
                changed = true;
            }
        });
        if (changed) {
            list.sort((a, b) => {
                if (a.id === 'CLI-001') return -1;
                if (b.id === 'CLI-001') return 1;
                if (a.id === 'CLI-TALLER') return -1;
                if (b.id === 'CLI-TALLER') return 1;
                return 0;
            });
            _write('customers', list);
        }
        return list;
    }

    function saveCustomer(customer) {
        const list = getCustomers();
        const existingIdx = list.findIndex(c => (customer.id && c.id === customer.id) || (customer.rif && c.rif && c.rif.toUpperCase() === customer.rif.toUpperCase()));
        if (existingIdx !== -1) {
            list[existingIdx] = Object.assign({}, list[existingIdx], customer);
            if (customer.direccion) list[existingIdx].direccion = customer.direccion;
        } else {
            customer.id = customer.id || 'CLI-' + (list.length + 1).toString().padStart(3, '0');
            list.push(customer);
        }
        _write('customers', list);
        return customer;
    }

    function deleteCustomer(customerId) {
        if (!customerId || customerId === 'CLI-001' || customerId === 'CLI-TALLER') return false;
        let list = getCustomers();
        const initialLen = list.length;
        list = list.filter(c => c.id !== customerId);
        if (list.length < initialLen) {
            _write('customers', list);
            return true;
        }
        return false;
    }

    function getSuppliers() {
        return _read('suppliers', DEFAULT_SUPPLIERS);
    }

    function saveSupplier(supplier) {
        const list = getSuppliers();
        const existingIdx = list.findIndex(s => s.id === supplier.id);
        if (existingIdx !== -1) {
            list[existingIdx] = Object.assign({}, list[existingIdx], supplier);
        } else {
            supplier.id = supplier.id || 'PRV-' + (list.length + 1).toString().padStart(3, '0');
            list.push(supplier);
        }
        _write('suppliers', list);
        return supplier;
    }

    function getPurchases() {
        return _read('purchases', []);
    }

    function markPurchaseCreditPaid(purchaseId) {
        if (!purchaseId) return false;
        const list = getPurchases();
        const idx = list.findIndex(p => p && p.id === purchaseId);
        if (idx === -1) return false;
        list[idx].pagadoCredito = true;
        list[idx].fechaPagoCredito = new Date().toLocaleDateString('es-VE');
        _write('purchases', list);
        return true;
    }

    function registerPurchase(purchaseData) {
        const purchases = getPurchases();
        const purId = 'COM-' + (purchases.length + 1).toString().padStart(4, '0');
        const now = new Date();
        const fechaHoraStr = now.toLocaleDateString('es-VE') + ' ' + now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

        const record = {
            id: purId,
            timestamp: now.getTime(),
            fechaStr: now.toLocaleDateString('es-VE'),
            fechaHoraStr: fechaHoraStr,
            proveedorId: purchaseData.proveedorId,
            proveedorNombre: purchaseData.proveedorNombre,
            facturaNumero: purchaseData.facturaNumero || 'N/A',
            items: purchaseData.items || [],
            totalUSD: purchaseData.totalUSD || 0,
            notas: purchaseData.notas || '',
            condicionPago: purchaseData.condicionPago || 'contado',
            esCredito: !!purchaseData.esCredito,
            pagadoCredito: !!purchaseData.pagadoCredito,
            terminoComercial: purchaseData.terminoComercial || (purchaseData.esCredito ? '30 Días (Crédito)' : 'Contado'),
            fechaVencimiento: purchaseData.fechaVencimiento || ''
        };

        const inv = getInventory();
        let invChanged = false;

        // Aumentar stock de cada ítem comprado y registrar costo actual, costo anterior y fecha de última carga
        record.items.forEach(item => {
            const qty = parseInt(item.cantidad) || 0;
            if (qty > 0) {
                addStock(item.id, qty, `Compra ${record.id} (${record.proveedorNombre})`);
            }

            const newCost = (typeof item.costoCompra === 'number' && item.costoCompra > 0)
                ? item.costoCompra
                : (parseFloat(item.costoCompra) || 0);

            let key = _resolveInvKey(inv, item.id) || item.id;
            if (!inv[key] && typeof window !== 'undefined' && Array.isArray(window.products)) {
                const p = window.products.find(x => x && x.id === item.id);
                if (p) inv[key] = { ...p, stock: 0 };
            }

            if (inv[key]) {
                const prevCost = typeof inv[key].costoCompra === 'number' ? inv[key].costoCompra : 0;
                if (newCost > 0) {
                    if (prevCost > 0 && Math.abs(prevCost - newCost) > 0.001) {
                        inv[key].costoAnterior = prevCost;
                    } else if (inv[key].costoAnterior === undefined) {
                        inv[key].costoAnterior = prevCost;
                    }
                    inv[key].costoCompra = newCost;
                }
                inv[key].ultimaCargaFecha = now.toISOString();
                inv[key].ultimaCargaFechaStr = fechaHoraStr;
                inv[key].ultimoProveedorId = record.proveedorId;
                inv[key].ultimoProveedorNombre = record.proveedorNombre;
                inv[key].ultimaCompraId = record.id;
                invChanged = true;
            }

            if (newCost > 0) {
                _updateProductCostInMemory(item.id, newCost);
            }
        });

        if (invChanged) {
            _write('inventory', inv);
        }

        purchases.unshift(record);
        _write('purchases', purchases);
        return record;
    }

    function getProductPurchaseHistory(productId) {
        const purchases = getPurchases();
        const cleanId = (productId || '').toUpperCase().trim();
        const matching = [];

        for (const pur of purchases) {
            if (Array.isArray(pur.items)) {
                const item = pur.items.find(it => it.id && it.id.toUpperCase().trim() === cleanId);
                if (item) {
                    matching.push({
                        purchaseId: pur.id,
                        timestamp: pur.timestamp,
                        fechaStr: pur.fechaHoraStr || pur.fechaStr,
                        proveedorId: pur.proveedorId,
                        proveedorNombre: pur.proveedorNombre,
                        facturaNumero: pur.facturaNumero,
                        cantidad: item.cantidad,
                        costoCompra: item.costoCompra
                    });
                }
            }
        }
        return matching;
    }

    function _updateProductCostInMemory(productId, newCost) {
        if (typeof products !== 'undefined' && Array.isArray(products)) {
            for (let p of products) {
                if (p.id === productId) {
                    p.costoCompra = newCost;
                    return;
                }
                if (p.variants) {
                    let v = p.variants.find(x => x.id === productId);
                    if (v) {
                        v.costoCompra = newCost;
                        return;
                    }
                }
            }
        }
    }

    // ==========================================
    // 8. COPIAS DE SEGURIDAD (BACKUP / RESTORE)
    // ==========================================
    function exportFullBackupJSON() {
        const backup = {
            version: "1.0",
            exportDate: new Date().toISOString(),
            settings: getSettings(),
            inventory: getInventory(),
            sales: getSales(),
            sale_voids: getVoidSales(),
            product_exchanges: getProductExchanges(),
            cash_shifts: getCashShifts(),
            expenses: getExpenses(),
            customers: getCustomers(),
            suppliers: getSuppliers(),
            purchases: getPurchases(),
            stock_logs: getStockLogs()
        };
        return JSON.stringify(backup, null, 2);
    }

    function importFullBackupJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.version || !data.settings) {
                throw new Error("El archivo no tiene una estructura de copia de seguridad válida de NOVA ERP.");
            }
            if (data.settings) _write('settings', data.settings);
            if (data.inventory) _write('inventory', data.inventory);
            if (data.sales) _write('sales', data.sales);
            if (data.sale_voids) _write('sale_voids', data.sale_voids);
            if (data.product_exchanges) _write('product_exchanges', data.product_exchanges);
            if (data.cash_shifts) _write('cash_shifts', data.cash_shifts);
            if (data.expenses) _write('expenses', data.expenses);
            if (data.customers) _write('customers', data.customers);
            if (data.suppliers) _write('suppliers', data.suppliers);
            if (data.purchases) _write('purchases', data.purchases);
            if (data.stock_logs) _write('stock_logs', data.stock_logs);
            return { success: true, message: "Copia de seguridad restaurada correctamente." };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    function purgeTestData() {
        _write('sales', []);
        _write('sale_voids', []);
        _write('product_exchanges', []);
        _write('held_sales', []);
        _write('expenses', []);
        _write('purchases', []);
        _write('suppliers', []);
        _write('stock_logs', []);
        _write('customers', DEFAULT_CUSTOMERS);

        // Turno de caja limpio a cero
        const cleanShift = [{
            id: 'TURNO-' + Date.now().toString().slice(-6),
            fechaApertura: new Date().toISOString(),
            montoInicialUSD: 0.00,
            montoInicialBs: 0.00,
            estado: 'abierta',
            ventasIds: [],
            egresosIds: []
        }];
        _write('cash_shifts', cleanShift);

        try {
            localStorage.removeItem('nova_supabase_offline_queue');
        } catch (e) {}

        // IMPORTANTE: El inventario ('inventory') y los eliminados ('deleted_products')
        // se mantienen completamente protegidos e intactos.
        return true;
    }

    return {
        init,
        purgeTestData,
        getSettings,
        updateSettings,
        setTasaBCV,
        setTasaInterna,
        getInventory,
        getStock,
        setStock,
        addStock,
        deductStock,
        getStockLogs,
        getSales,
        registerSale,
        voidSale,
        markSaleCreditPaid,
        registerProductExchange,
        getVoidSales,
        getProductExchanges,
        getHeldSales,
        holdCurrentSale,
        releaseHeldSale,
        deleteHeldSale,
        getCashShifts,
        getActiveShift,
        closeActiveShift,
        reconcileActiveShiftSales,
        getExpenses,
        addExpense,
        getCustomers,
        saveCustomer,
        deleteCustomer,
        getSuppliers,
        saveSupplier,
        getPurchases,
        registerPurchase,
        markPurchaseCreditPaid,
        getProductPurchaseHistory,
        addNewProduct,
        updateProduct,
        deleteProduct,
        updateProductCost,
        logPriceChange,
        getPriceChangeLogs,
        logSecurityEvent,
        getSecurityLogs,
        mergeIncomingHeldSales,
        exportFullBackupJSON,
        importFullBackupJSON
    };
})();

// Inicialización automática
if (typeof window !== 'undefined') {
    window.NovaDB = NovaDB;
    document.addEventListener('DOMContentLoaded', () => {
        NovaDB.init();
    });
}

