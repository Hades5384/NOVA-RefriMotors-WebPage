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
        tasaBCV: 914.02,
        tasaInterna: 1050,
        porcentajeUtilidad: 1.30,
        porcentajeIva: 1.16,
        masterPin: "1234",
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
        { id: "CLI-002", nombre: "Técnico Luis González (Frío Express)", rif: "V-18456123", telefono: "0424-6112233", direccion: "Sector Delicias Nuevas, Calle Rosario, Cabimas", tipo: "cliente", notas: "Cliente registrado" },
        { id: "CLI-003", nombre: "Refrigeración Industrial Serviluz C.A.", rif: "J-309988771", telefono: "0412-5544332", direccion: "Av. Intercomunal con Carretera H, Cabimas", tipo: "cliente", notas: "Cliente registrado" }
    ];

    const DEFAULT_SUPPLIERS = [
        { id: "PRV-001", razonSocial: "Distribuidora Internacional Steinmann C.A.", rif: "J-31002299", telefono: "0414-9988776", contacto: "Carlos Mendoza", rubro: "Filtros y Herramientas" },
        { id: "PRV-002", razonSocial: "Importaciones Maxwell Gold", rif: "J-40223311", telefono: "0424-8877665", contacto: "Roberto Silva", rubro: "Capacitores y Relés" },
        { id: "PRV-003", razonSocial: "Corporación Exceline Venezuela", rif: "J-29881177", telefono: "0412-7766554", contacto: "Elena Romero", rubro: "Protectores de Voltaje" },
        { id: "PRV-004", razonSocial: "Gases Refrigerantes de Occidente", rif: "J-40556677", telefono: "0424-1122334", contacto: "Marcos Vivas", rubro: "Gases R134a, R410a, R22" }
    ];

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
        if (!_read('customers', null)) {
            _write('customers', DEFAULT_CUSTOMERS);
        }
        if (!_read('suppliers', null)) {
            _write('suppliers', DEFAULT_SUPPLIERS);
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

        // Inicializar inventario a partir de los 460 productos y variantes
        _syncInitialInventory();

        // Verificar o abrir turno de caja inicial si no existe
        _checkActiveCashShift();
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
                            name: `${p.name} (${v.name})`,
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
    }

    // ==========================================
    // 2. MÉTODOS DE CONFIGURACIÓN Y TASAS
    // ==========================================
    function getSettings() {
        return _read('settings', DEFAULT_SETTINGS);
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

    // ==========================================
    // 3. MÉTODOS DE INVENTARIO Y STOCK
    // ==========================================
    function getInventory() {
        return _read('inventory', {});
    }

    function getStock(productId) {
        const inv = getInventory();
        return inv[productId] ? inv[productId].stock : 0;
    }

    function setStock(productId, newQty, reason = "Ajuste manual de almacén") {
        const inv = getInventory();
        const qty = parseInt(newQty);
        if (isNaN(qty) || qty < 0) return false;

        if (inv[productId]) {
            const oldStock = inv[productId].stock;
            inv[productId].stock = qty;
            _write('inventory', inv);
            _logStockMovement({
                productId,
                oldStock,
                newStock: qty,
                diff: qty - oldStock,
                reason,
                timestamp: new Date().toISOString()
            });
            return true;
        }
        return false;
    }

    function deductStock(productId, qtyToDeduct, reason = "Venta Mostrador") {
        const inv = getInventory();
        const qty = parseInt(qtyToDeduct);
        if (isNaN(qty) || qty <= 0) return false;

        if (inv[productId]) {
            const oldStock = inv[productId].stock;
            inv[productId].stock = Math.max(0, oldStock - qty);
            _write('inventory', inv);
            _logStockMovement({
                productId,
                oldStock,
                newStock: inv[productId].stock,
                diff: -qty,
                reason,
                timestamp: new Date().toISOString()
            });
            return true;
        }
        return false;
    }

    function addStock(productId, qtyToAdd, reason = "Entrada por compra") {
        const inv = getInventory();
        const qty = parseInt(qtyToAdd);
        if (isNaN(qty) || qty <= 0) return false;

        if (inv[productId]) {
            const oldStock = inv[productId].stock;
            inv[productId].stock = oldStock + qty;
            _write('inventory', inv);
            _logStockMovement({
                productId,
                oldStock,
                newStock: inv[productId].stock,
                diff: qty,
                reason,
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

    function updateProductCost(productId, newCost) {
        const cost = parseFloat(newCost);
        if (isNaN(cost) || cost < 0) return false;
        const inv = getInventory();
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
        return true;
    }

    function updateProduct(productId, updates) {
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

        _write('inventory', inv);

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
        const saleId = 'FAC-' + (sales.length + 1).toString().padStart(5, '0');
        const now = new Date();

        const record = {
            id: saleId,
            timestamp: now.getTime(),
            fechaStr: now.toLocaleDateString('es-VE'),
            horaStr: now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
            cliente: saleData.cliente || { nombre: "Cliente Mostrador", rif: "V-00000000", telefono: "" },
            items: saleData.items || [],
            tipoPrecio: saleData.tipoPrecio || 'publico', // 'publico' | 'novacliente'
            tipoDocumento: saleData.tipoDocumento || 'factura', // 'factura' | 'presupuesto' | 'nota_entrega'
            tasaBCV: saleData.tasaBCV || getSettings().tasaBCV,
            totalUSD: saleData.totalUSD || 0,
            totalBs: saleData.totalBs || 0,
            metodosPago: saleData.metodosPago || [],
            montoPagadoUSD: saleData.montoPagadoUSD || 0,
            montoPagadoBs: saleData.montoPagadoBs || 0,
            vueltoUSD: saleData.vueltoUSD || 0,
            vueltoBs: saleData.vueltoBs || 0,
            vendedor: saleData.vendedor || "Caja Principal"
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

    function getActiveShift() {
        const shifts = getCashShifts();
        return shifts.find(s => s.estado === 'abierta') || null;
    }

    function _addSaleToActiveShift(saleId) {
        const shifts = getCashShifts();
        const activeIdx = shifts.findIndex(s => s.estado === 'abierta');
        if (activeIdx !== -1) {
            shifts[activeIdx].ventasIds.push(saleId);
            _write('cash_shifts', shifts);
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
        const shifts = getCashShifts();
        const idx = shifts.findIndex(s => s.estado === 'abierta');
        if (idx === -1) return null;

        const shift = shifts[idx];
        shift.estado = 'cerrada';
        shift.fechaCierre = new Date().toISOString();
        shift.arqueoFisico = reconciliation; // Conteo real en gaveta vs sistema
        _write('cash_shifts', shifts);

        // Abrir automáticamente el siguiente turno
        const nextShift = {
            id: 'TURNO-' + Date.now().toString().slice(-6),
            fechaApertura: new Date().toISOString(),
            montoInicialUSD: reconciliation.montoInicialSiguienteUSD || 50.00,
            montoInicialBs: reconciliation.montoInicialSiguienteBs || 0.00,
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
        return _read('customers', DEFAULT_CUSTOMERS);
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
        if (!customerId || customerId === 'CLI-001') return false;
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

    function registerPurchase(purchaseData) {
        const purchases = getPurchases();
        const purId = 'COM-' + (purchases.length + 1).toString().padStart(4, '0');
        const now = new Date();

        const record = {
            id: purId,
            timestamp: now.getTime(),
            fechaStr: now.toLocaleDateString('es-VE'),
            proveedorId: purchaseData.proveedorId,
            proveedorNombre: purchaseData.proveedorNombre,
            facturaNumero: purchaseData.facturaNumero || 'N/A',
            items: purchaseData.items || [],
            totalUSD: purchaseData.totalUSD || 0,
            notas: purchaseData.notas || ''
        };

        // Aumentar stock de cada ítem comprado
        record.items.forEach(item => {
            addStock(item.id, item.cantidad, `Compra ${record.id}`);
            // Si vino con nuevo costo de compra, se actualiza en el catálogo de memoria
            if (item.costoCompra && typeof item.costoCompra === 'number' && item.costoCompra > 0) {
                _updateProductCostInMemory(item.id, item.costoCompra);
            }
        });

        purchases.unshift(record);
        _write('purchases', purchases);
        return record;
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

    return {
        init,
        getSettings,
        updateSettings,
        setTasaBCV,
        getInventory,
        getStock,
        setStock,
        addStock,
        deductStock,
        getStockLogs,
        getSales,
        registerSale,
        getHeldSales,
        holdCurrentSale,
        releaseHeldSale,
        deleteHeldSale,
        getCashShifts,
        getActiveShift,
        closeActiveShift,
        getExpenses,
        addExpense,
        getCustomers,
        saveCustomer,
        deleteCustomer,
        getSuppliers,
        saveSupplier,
        getPurchases,
        registerPurchase,
        addNewProduct,
        updateProduct,
        deleteProduct,
        updateProductCost,
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

