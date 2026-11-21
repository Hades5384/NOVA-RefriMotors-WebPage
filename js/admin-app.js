/**
 * ==============================================================================
 * NOVA REFRIMOTORS - CONTROLADOR PRINCIPAL DEL SISTEMA ERP (admin-app.js)
 * ==============================================================================
 * Orquestador de la interfaz administrativa SPA.
 * Módulos integrados:
 * - POS 2.0 (Punto de Venta de mostrador, cálculo dual, ventas en espera, cobro)
 * - Inventario interactivo con ajuste de stock en tiempo real
 * - Compras de mercancía y gestión de proveedores
 * - Caja, arqueos diarios X/Z y registro de egresos
 * - Directorio de Clientes (CRM)
 * - Marketing, promociones WhatsApp y campañas comerciales
 * - Configuración de tasas y respaldos JSON
 * ==============================================================================
 */

let currentView = 'pos';
let posCart = [];
let posSelectedCustomer = null;
let posPriceTier = 'publico'; // 'publico' | 'novacliente'
let posCurrentCategory = 'Todos';
const POS_DEFAULT_PAGE_SIZE = 36;
let posVisibleLimit = POS_DEFAULT_PAGE_SIZE;

// ==========================================
// 1. INICIALIZACIÓN Y NAVEGACIÓN SPA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof NovaUsers !== 'undefined') NovaUsers.init();
    initBCVWidget();
    initPOS();
    renderCustomersView();
    if (typeof NovaReports !== 'undefined') NovaReports.init();
    setupKeyboardShortcuts();
    setupBroadcastSync();
});

function setupBroadcastSync() {
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('nova_pos_channel');
            bc.onmessage = (ev) => {
                if (ev.data && ev.data.type && ev.data.type.startsWith('HELD_SALES_')) {
                    renderHeldSalesList();
                    const modal = document.getElementById('heldSalesModal');
                    if (modal && modal.classList.contains('active')) {
                        renderHeldSalesModalContent();
                    }
                } else if (ev.data && ev.data.type === 'BCV_RATE_UPDATED') {
                    updateBCVDisplay();
                    if (currentView === 'pos') {
                        renderPOSCart();
                        renderPOSCatalog();
                    }
                    if (currentView === 'inventory' && typeof renderInventoryTable === 'function') {
                        renderInventoryTable();
                    }
                }
            };
        }
    } catch (e) { }
}

function navigateTo(viewName) {
    // Control de acceso por estación: los vendedores solo acceden a POS y Clientes CRM
    if (typeof NovaUsers !== 'undefined' && NovaUsers.isSeller()) {
        if (viewName !== 'pos' && viewName !== 'customers') {
            showNovaAlert({
                title: "Acceso Restringido a MASTER",
                message: "Esta sección contiene información confidencial de caja, compras, precios o inventario y está reservada exclusivamente para la estación MASTER.",
                type: "warning"
            });
            return;
        }
    }

    currentView = viewName;

    // Actualizar sidebar activo
    document.querySelectorAll('.nav-item').forEach(el => {
        if (el.dataset.view === viewName) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    // Cambiar contenedor visible
    document.querySelectorAll('.erp-view').forEach(v => {
        v.classList.remove('active');
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.add('active');
    }

    // Actualizar títulos del header
    updateHeaderTitles(viewName);

    // Cargar datos específicos del módulo
    if (viewName === 'pos') renderPOSCatalog();
    else if (viewName === 'inventory') renderInventoryView();
    else if (viewName === 'purchases') renderPurchasesView();
    else if (viewName === 'cash') renderCashView();
    else if (viewName === 'customers') renderCustomersView();
    else if (viewName === 'marketing') renderMarketingView();
    else if (viewName === 'reports') {
        if (typeof NovaReports !== 'undefined') NovaReports.renderReportsView();
    }
    else if (viewName === 'settings') renderSettingsView();
}

function updateHeaderTitles(viewName) {
    const titles = {
        pos: { title: "Punto de Venta y Facturación", subtitle: "Mostrador rápido multimoneda, emisión de tickets y presupuestos" },
        inventory: { title: "Gestión de Inventario y Almacén", subtitle: "Control de existencias, stock mínimo, alertas y valorización" },
        purchases: { title: "Compras y Proveedores", subtitle: "Recepción de mercancía, órdenes de compra y costos" },
        cash: { title: "Caja y Arqueo de Operaciones", subtitle: "Control de ventas en bolívares y divisas, utilidad de repuestos y auditoría" },
        customers: { title: "Directorio de Clientes (CRM)", subtitle: "Fichas de técnicos, talleres e historial de compras" },
        marketing: { title: "Marketing y Promociones", subtitle: "Campañas WhatsApp, combos y difusión comercial" },
        reports: { title: "Centro de Reportes y Auditoría Fiscal", subtitle: "Libros legales de IVA, control de caja, kardex de inventario, finanzas y auditoría interna" },
        settings: { title: "Configuración y Respaldos", subtitle: "Tasa BCV, datos fiscales de la empresa y copias de seguridad" }
    };

    const info = titles[viewName] || { title: "NOVA Admin ERP", subtitle: "Sistema Administrativo" };
    const h1 = document.getElementById('viewHeaderTitle');
    const p = document.getElementById('viewHeaderSubtitle');
    if (h1) h1.innerText = info.title;
    if (p) p.innerText = info.subtitle;
}

function toggleSidebar() {
    const sidebar = document.getElementById('erpSidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
}

function initBCVWidget() {
    updateBCVDisplay();
}

function updateBCVDisplay() {
    const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : { tasaBCV: 917.78, tasaInterna: 1050 };
    const valEl = document.getElementById('bcvRateVal');
    if (valEl) valEl.innerText = `Bs. ${(settings.tasaBCV || 917.78).toFixed(2)}`;
    const intEl = document.getElementById('internalRateVal');
    if (intEl) intEl.innerText = `Bs. ${(settings.tasaInterna || 1050).toFixed(2)}`;
}

function openRateSettingsModal() {
    if (typeof NovaUsers !== 'undefined' && NovaUsers.isSeller && NovaUsers.isSeller()) {
        showNovaAlert({
            title: "Acceso Restringido",
            message: "Solo el usuario MASTER puede modificar las tasas de cambio del sistema.",
            type: "warning"
        });
        return;
    }

    const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : { tasaBCV: 917.78, tasaInterna: 1050 };
    const bcvInput = document.getElementById('rateModalBcvInput');
    const intInput = document.getElementById('rateModalInternalInput');
    
    if (bcvInput) bcvInput.value = (settings.tasaBCV || 917.78).toFixed(2);
    if (intInput) intInput.value = (settings.tasaInterna || 1050).toFixed(2);

    openModal('rateSettingsModal');

    setTimeout(() => {
        if (bcvInput) { bcvInput.focus(); bcvInput.select(); }
    }, 150);
}

function saveRatesFromModal() {
    if (typeof NovaUsers !== 'undefined' && NovaUsers.isSeller && NovaUsers.isSeller()) {
        showNovaAlert({
            title: "Acceso Restringido",
            message: "Solo el usuario MASTER puede modificar las tasas de cambio del sistema.",
            type: "warning"
        });
        return;
    }

    const bcvInput = document.getElementById('rateModalBcvInput');
    const intInput = document.getElementById('rateModalInternalInput');

    const newBCV = parseFloat(bcvInput ? bcvInput.value.replace(',', '.') : '');
    const newInt = parseFloat(intInput ? intInput.value.replace(',', '.') : '');

    if (isNaN(newBCV) || newBCV <= 0) {
        showNovaAlert({
            title: "Tasa BCV Inválida",
            message: "Por favor ingrese un valor numérico válido y mayor a cero para la Tasa Oficial BCV.",
            type: "warning"
        });
        if (bcvInput) bcvInput.focus();
        return;
    }

    if (isNaN(newInt) || newInt <= 0) {
        showNovaAlert({
            title: "Tasa Interna Inválida",
            message: "Por favor ingrese un valor numérico válido y mayor a cero para la Tasa Interna del Sistema.",
            type: "warning"
        });
        if (intInput) intInput.focus();
        return;
    }

    // Guardar en almacenamiento y disparar hooks de sincronización inmediata con Supabase
    NovaDB.setTasaBCV(newBCV);
    NovaDB.setTasaInterna(newInt);
    updateBCVDisplay();

    // Actualizar vistas si están en pantalla
    if (typeof currentView !== 'undefined') {
        if (currentView === 'pos') {
            if (typeof renderPOSCart === 'function') renderPOSCart();
            if (typeof renderPOSCatalog === 'function') renderPOSCatalog();
        }
        if (currentView === 'inventory' && typeof renderInventoryTable === 'function') {
            renderInventoryTable();
        }
    }

    try {
        if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('nova_pos_channel');
            bc.postMessage({ type: 'BCV_RATE_UPDATED', rate: newBCV, internalRate: newInt });
        }
    } catch (e) { }

    closeModal('rateSettingsModal');

    showNovaAlert({
        title: "Tasas Actualizadas",
        message: `Las tasas han sido guardadas y sincronizadas con la base de datos central en la nube:<br>• <b>Tasa Oficial BCV:</b> Bs. ${newBCV.toFixed(2)}<br>• <b>Tasa Interna Reposición:</b> Bs. ${newInt.toFixed(2)}`,
        type: "success"
    });
}

function promptEditBCV() {
    openRateSettingsModal();
}

function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // F2: Búsqueda rápida POS
        if (e.key === 'F2') {
            e.preventDefault();
            navigateTo('pos');
            const inp = document.getElementById('posSearchInput');
            if (inp) { inp.focus(); inp.select(); }
        }
        // F4: Acción de cobro (MASTER) o Mandar a Caja (VENTAS)
        if (e.key === 'F4') {
            e.preventDefault();
            if (currentView === 'pos' && posCart.length > 0) {
                if (typeof NovaUsers !== 'undefined' && NovaUsers.isSeller()) {
                    sendOrderToMaster();
                } else {
                    openCheckoutModal();
                }
            }
        }
        // F6: Emitir Presupuesto (Cotización)
        if (e.key === 'F6') {
            e.preventDefault();
            if (currentView === 'pos' && posCart.length > 0) {
                emitPresupuestoFromCart();
            }
        }
        // F8: Pausar Venta
        if (e.key === 'F8') {
            e.preventDefault();
            if (currentView === 'pos' && posCart.length > 0) {
                holdPOSSale();
            }
        }
        // F9: Reimpresión de Comprobante / Factura
        if (e.key === 'F9') {
            e.preventDefault();
            openReprintModal();
        }
    });
}


// ==============================================================================
// 2. MÓDULO: PUNTO DE VENTA (POS) Y FACTURACIÓN
// ==============================================================================
function initPOS() {
    renderPOSCategoryPills();
    renderPOSCustomerSelect();
    renderPOSCatalog();
    renderPOSCart();
    renderHeldSalesList();
}

function renderPOSCategoryPills() {
    const cats = [
        "Todos", "Refrigeración", "Aires Acondicionados", "Lavadoras",
        "Licuadoras", "Motores", "Protectores", "Capacitores",
        "Químicos", "Herramientas", "Bombas de Agua", "Eléctrico", "Neveras / Cavas"
    ];
    const container = document.getElementById('posCatTabs');
    if (!container) return;

    let html = '';
    cats.forEach(c => {
        const activeClass = (c === posCurrentCategory) ? 'active' : '';
        html += `<button class="pos-cat-pill ${activeClass}" onclick="setPOSCategory('${c}', this)">${c}</button>`;
    });
    container.innerHTML = html;
}

function setPOSCategory(catName, btn) {
    posCurrentCategory = catName;
    posVisibleLimit = POS_DEFAULT_PAGE_SIZE;
    document.querySelectorAll('.pos-cat-pill').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderPOSCatalog();
}

function renderPOSCustomerSelect() {
    const customers = NovaDB.getCustomers();
    const sel = document.getElementById('posCustomerSelect');
    if (!sel) return;

    const prevId = (posSelectedCustomer && posSelectedCustomer.id) ? posSelectedCustomer.id : sel.value;

    let html = '';
    customers.forEach(c => {
        html += `<option value="${c.id}">${c.nombre} (${c.rif})</option>`;
    });
    sel.innerHTML = html;

    // Preservar cliente actualmente seleccionado si sigue existiendo; si no, asignar el primero
    const stillExists = prevId && customers.some(c => c.id === prevId);
    if (stillExists) {
        sel.value = prevId;
        onPOSCustomerChange(prevId);
    } else if (customers.length > 0) {
        sel.value = customers[0].id;
        onPOSCustomerChange(customers[0].id);
    }
}

function onPOSCustomerChange(custId) {
    const customers = NovaDB.getCustomers();
    const found = customers.find(c => c.id === custId);
    if (found) {
        posSelectedCustomer = found;
    }
}

function setPOSTier(tier, reRender = false) {
    posPriceTier = tier || 'publico';
    if (reRender) {
        renderPOSCatalog();
        renderPOSCart();
    }
}

let _posDebounceTimer = null;
function filterPOS() {
    clearTimeout(_posDebounceTimer);
    _posDebounceTimer = setTimeout(() => {
        posVisibleLimit = POS_DEFAULT_PAGE_SIZE;
        renderPOSCatalog();
    }, 120);
}

function _buildProductMetaLookup(prods) {
    const map = {};
    if (!Array.isArray(prods)) return map;
    prods.forEach(p => {
        if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
            p.variants.forEach(v => {
                map[v.id] = {
                    costoCompra: v.costoCompra || 0,
                    images: p.images || [],
                    model: p.model || ''
                };
            });
        } else {
            map[p.id] = {
                costoCompra: p.costoCompra || 0,
                images: p.images || [],
                model: p.model || ''
            };
        }
    });
    return map;
}

function renderPOSCatalog() {
    const container = document.getElementById('posItemsGrid');
    const footerEl = document.getElementById('posCatalogFooter');
    if (!container) return;

    const queryInput = document.getElementById('posSearchInput');
    const query = queryInput ? queryInput.value.toLowerCase().trim() : '';

    const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
    const inv = NovaDB.getInventory();
    const settings = NovaDB.getSettings();
    const metaById = _buildProductMetaLookup(prods);

    // Fuente única sincronizada: construir catálogo POS directamente desde NovaDB.getInventory()
    // para que POS e Inventario coincidan al 100% (mismos productos, nombres, costos, márgenes y stock)
    let displayList = [];
    Object.values(inv).forEach(invItem => {
        if (!invItem || !invItem.id) return;
        const cat = invItem.category || 'General';
        const matchesCategory = (posCurrentCategory === 'Todos') || (cat === posCurrentCategory);
        if (!matchesCategory) return;

        const meta = metaById[invItem.id] || {};
        const name = invItem.name || invItem.id;
        const model = meta.model || '';
        const matchesQuery = !query ||
            name.toLowerCase().includes(query) ||
            invItem.id.toLowerCase().includes(query) ||
            (invItem.parentId && invItem.parentId.toLowerCase().includes(query)) ||
            (model && model.toLowerCase().includes(query));

        if (matchesQuery) {
            const cost = (typeof invItem.costoCompra === 'number' && invItem.costoCompra > 0)
                ? invItem.costoCompra
                : (meta.costoCompra || 0);

            displayList.push({
                id: invItem.id,
                parentId: invItem.parentId || null,
                name: name,
                category: cat,
                costoCompra: cost,
                porcentajeUtilidad: invItem.porcentajeUtilidad,
                iva: invItem.iva,
                images: meta.images || [],
                stock: typeof invItem.stock === 'number' ? invItem.stock : 0
            });
        }
    });

    if (displayList.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                <p style="font-weight: 700; font-size: 15px;">No se encontraron repuestos con los filtros actuales.</p>
                <p style="font-size: 12px; margin-top: 6px;">Intenta con otra palabra clave o selecciona 'Todos'.</p>
            </div>`;
        if (footerEl) footerEl.innerHTML = '';
        return;
    }

    const total = displayList.length;
    const slice = displayList.slice(0, posVisibleLimit);
    const showing = slice.length;

    let html = '';
    slice.forEach(item => {
        const precios = calcularPreciosSegunAjustes(item.costoCompra, settings, item.porcentajeUtilidad, item.iva);
        const priceUSD = precios.publicoUSD;
        const priceBs = precios.publicoBs;

        let stockBadgeClass = 'pos-stock-badge';
        let stockLabel = `${item.stock} en stock`;
        let cardExtraClass = '';
        if (item.stock === 0) {
            stockBadgeClass += ' zero';
            stockLabel = 'Agotado';
            cardExtraClass = ' out-of-stock-card';
        } else if (item.stock <= 3) {
            stockBadgeClass += ' low';
            stockLabel = `Bajo: ${item.stock}`;
        }

        // Obtener foto adecuada
        let imgUrl = 'productos/NO_PHOTO.webp';
        if (item.images && item.images.length > 0) {
            const cleanId = item.id.toUpperCase();
            const found = item.images.find(u => {
                const fn = u.split('/').pop().toUpperCase().replace(/\.[^/.]+$/, "");
                return fn === cleanId || fn.includes(cleanId);
            });
            imgUrl = found || item.images[0];
        }

        html += `
            <div class="pos-item-card${cardExtraClass}" onclick="addToPOSCart('${item.id}')" title="${item.stock === 0 ? 'Producto agotado sin existencias' : item.name}">
                <img src="${imgUrl}" alt="${item.name}" class="pos-card-thumb" onerror="this.src='productos/NO_PHOTO.webp'" loading="lazy" decoding="async">
                <span class="pos-card-code">${item.id}</span>
                <h4 class="pos-card-name" title="${item.name}">${item.name}</h4>
                <div class="pos-card-footer">
                    <div class="pos-card-price-box">
                        <span class="pos-card-usd">$${priceUSD.toFixed(2)}</span>
                        <span class="pos-card-bs">Bs. ${priceBs.toFixed(2)}</span>
                    </div>
                    <span class="${stockBadgeClass}">${stockLabel}</span>
                </div>
            </div>`;
    });

    container.innerHTML = html;

    // Renderizar Footer de Paginación y Carga Progresiva
    if (footerEl) {
        if (total <= POS_DEFAULT_PAGE_SIZE) {
            footerEl.innerHTML = `
                <span class="pos-footer-info">Mostrando <b>${showing}</b> de <b>${total}</b> repuestos</span>
                <div class="pos-footer-actions">
                    <span class="pos-all-loaded-pill">Catálogo completo visible</span>
                </div>`;
        } else if (showing < total) {
            const remaining = total - showing;
            const nextBatch = Math.min(POS_DEFAULT_PAGE_SIZE, remaining);
            let buttonsHtml = `
                <button type="button" class="pos-load-btn btn-load-more" onclick="loadMorePOSCatalog(${POS_DEFAULT_PAGE_SIZE})">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Cargar ${nextBatch} más
                </button>
                <button type="button" class="pos-load-btn" onclick="loadAllPOSCatalog()">
                    Ver todos (${total})
                </button>`;
            if (posVisibleLimit > POS_DEFAULT_PAGE_SIZE) {
                buttonsHtml += `
                    <button type="button" class="pos-load-btn" onclick="resetPOSCatalogLimit()" title="Reducir a ${POS_DEFAULT_PAGE_SIZE} para mayor fluidez">
                        Reducir a ${POS_DEFAULT_PAGE_SIZE}
                    </button>`;
            }
            footerEl.innerHTML = `
                <span class="pos-footer-info">Mostrando <b>${showing}</b> de <b>${total}</b> repuestos</span>
                <div class="pos-footer-actions">${buttonsHtml}</div>`;
        } else {
            footerEl.innerHTML = `
                <span class="pos-footer-info">Mostrando <b>${total}</b> de <b>${total}</b> repuestos (Todos cargados)</span>
                <div class="pos-footer-actions">
                    <span class="pos-all-loaded-pill">Catálogo completo cargado</span>
                    <button type="button" class="pos-load-btn" onclick="resetPOSCatalogLimit()" title="Reducir a ${POS_DEFAULT_PAGE_SIZE} para mayor fluidez">
                        Reducir a ${POS_DEFAULT_PAGE_SIZE}
                    </button>
                </div>`;
        }
    }
}

function loadMorePOSCatalog(amount = POS_DEFAULT_PAGE_SIZE) {
    posVisibleLimit += amount;
    renderPOSCatalog();
}

function loadAllPOSCatalog() {
    posVisibleLimit = 999999;
    renderPOSCatalog();
}

function resetPOSCatalogLimit() {
    posVisibleLimit = POS_DEFAULT_PAGE_SIZE;
    renderPOSCatalog();
    const grid = document.getElementById('posItemsGrid');
    if (grid) grid.scrollTop = 0;
}

if (typeof window !== 'undefined') {
    window.loadMorePOSCatalog = loadMorePOSCatalog;
    window.loadAllPOSCatalog = loadAllPOSCatalog;
    window.resetPOSCatalogLimit = resetPOSCatalogLimit;
}

function addToPOSCart(itemId) {
    const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
    const inv = NovaDB.getInventory();
    const invItem = inv[itemId] || Object.values(inv).find(x => x && x.id && x.id.toLowerCase() === String(itemId).toLowerCase());
    const meta = _buildProductMetaLookup(prods)[itemId] || {};

    let found = null;
    if (invItem) {
        found = {
            id: invItem.id,
            name: invItem.name || invItem.id,
            costoCompra: (typeof invItem.costoCompra === 'number' && invItem.costoCompra > 0) ? invItem.costoCompra : (meta.costoCompra || 0),
            porcentajeUtilidad: invItem.porcentajeUtilidad,
            iva: invItem.iva,
            images: meta.images || []
        };
    } else if (meta.costoCompra !== undefined) {
        const p = prods.find(x => x.id === itemId);
        found = { id: itemId, name: p ? p.name : itemId, costoCompra: meta.costoCompra, images: meta.images || [] };
    }

    if (!found) return;

    const availableStock = invItem && typeof invItem.stock === 'number' ? invItem.stock : (meta.stock || 0);

    // Validación estricta de existencias: si no hay stock, no permitir agregar
    if (availableStock <= 0) {
        showNovaAlert({
            title: "Producto Agotado",
            message: `El repuesto "<b>${found.name}</b>" (${found.id}) actualmente <b>no tiene existencias disponibles</b> en almacén (Stock: 0).`,
            type: "warning"
        });
        return;
    }

    const existingIdx = posCart.findIndex(item => item.id === itemId || item.id === found.id);
    if (existingIdx !== -1) {
        if (posCart[existingIdx].quantity >= availableStock) {
            showNovaAlert({
                title: "Existencias Máximas Alcanzadas",
                message: `Solo hay <b>${availableStock}</b> unidad(es) disponibles de "<b>${found.name}</b>". No es posible agregar más al ticket de venta.`,
                type: "warning"
            });
            return;
        }
        posCart[existingIdx].quantity += 1;
    } else {
        posCart.push({
            id: found.id,
            name: found.name,
            costoCompra: found.costoCompra,
            porcentajeUtilidad: found.porcentajeUtilidad,
            iva: found.iva,
            images: found.images,
            quantity: 1
        });
    }

    renderPOSCart();
}

function changePOSQty(index, diff) {
    if (posCart[index]) {
        const it = posCart[index];
        if (diff > 0) {
            const currentStock = NovaDB.getStock(it.id);
            if (it.quantity + diff > currentStock) {
                showNovaAlert({
                    title: "Stock Insuficiente",
                    message: `Solo hay <b>${currentStock}</b> unidad(es) disponibles de "<b>${it.name}</b>".`,
                    type: "warning"
                });
                return;
            }
        }
        it.quantity += diff;
        if (it.quantity <= 0) {
            posCart.splice(index, 1);
        }
        renderPOSCart();
    }
}

function removePOSItem(index) {
    posCart.splice(index, 1);
    renderPOSCart();
}

function clearPOSCart() {
    if (posCart.length === 0) return;
    posCart = [];
    renderPOSCart();
}

function renderPOSCart() {
    const container = document.getElementById('posTicketItems');
    const badge = document.getElementById('posCartCountBadge');
    if (!container) return;

    if (badge) badge.innerText = posCart.reduce((sum, item) => sum + item.quantity, 0);

    if (posCart.length === 0) {
        container.innerHTML = `
            <div class="ticket-empty">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <p>El ticket de venta está vacío.</p>
                <p style="font-size: 11px; margin-top: 4px;">Selecciona repuestos del catálogo o usa la tecla <b>F2</b> para buscar.</p>
            </div>`;
        updatePOSTotals(0, 0, 0);
        return;
    }

    const settings = NovaDB.getSettings();
    let totalUSD = 0;
    let html = '';

    posCart.forEach((item, idx) => {
        const precios = calcularPreciosSegunAjustes(item.costoCompra, settings, item.porcentajeUtilidad, item.iva);
        const unitPrice = precios.publicoUSD;
        const lineTotal = unitPrice * item.quantity;
        totalUSD += lineTotal;

        html += `
            <div class="ticket-row">
                <div class="ticket-row-top">
                    <span class="ticket-item-name">[${item.id}] ${item.name}</span>
                    <button class="ticket-item-del" onclick="removePOSItem(${idx})" title="Quitar ítem">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="ticket-row-bottom">
                    <div class="ticket-qty-control">
                        <button class="qty-btn" onclick="changePOSQty(${idx}, -1)">-</button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn" onclick="changePOSQty(${idx}, 1)">+</button>
                    </div>
                    <span class="ticket-item-total">$${lineTotal.toFixed(2)}</span>
                </div>
            </div>`;
    });

    container.innerHTML = html;
    const totalBs = totalUSD * settings.tasaBCV;
    updatePOSTotals(totalUSD, totalBs, posCart.length);
}

function updatePOSTotals(totalUSD, totalBs, itemCount) {
    const usdEl = document.getElementById('posTotalUSD');
    const bsEl = document.getElementById('posTotalBs');
    const subEl = document.getElementById('posSubtotalUSD');
    const btn = document.getElementById('btnPOSCheckout');
    const btnQuote = document.getElementById('btnPOSQuote');

    if (usdEl) usdEl.innerText = `$${totalUSD.toFixed(2)}`;
    if (bsEl) bsEl.innerText = `Bs. ${totalBs.toFixed(2)}`;
    if (subEl) subEl.innerText = `$${totalUSD.toFixed(2)}`;
    if (btn) btn.disabled = (itemCount === 0);
    if (btnQuote) btnQuote.disabled = (itemCount === 0);

    const badge = document.getElementById('posCartCountBadge');
    if (badge) badge.innerText = itemCount;
}

function calcularPreciosSegunAjustes(costoCompra, settings, customUtil, customIva) {
    const s = settings || (typeof NovaDB !== 'undefined' && NovaDB.getSettings ? NovaDB.getSettings() : {});

    // Porcentaje de utilidad (si viene en porcentaje ej: 30, o factor 1.30)
    let utilFactor = 1.30;
    if (customUtil !== undefined && customUtil !== null && !isNaN(customUtil)) {
        const u = parseFloat(customUtil);
        utilFactor = u >= 1 ? (u > 10 ? 1 + (u / 100) : u) : 1 + u;
    } else if (s.porcentajeUtilidad) {
        utilFactor = s.porcentajeUtilidad >= 1 ? s.porcentajeUtilidad : 1 + s.porcentajeUtilidad;
    }

    // Porcentaje de IVA (si viene en porcentaje ej: 16, o factor 1.16)
    let ivaFactor = 1.16;
    if (customIva !== undefined && customIva !== null && !isNaN(customIva)) {
        const v = parseFloat(customIva);
        ivaFactor = v >= 0 ? 1 + (v / 100) : 1.16;
    } else if (s.porcentajeIva) {
        ivaFactor = s.porcentajeIva >= 1 ? s.porcentajeIva : 1 + s.porcentajeIva;
    }

    const tasaInt = s.tasaInterna || 1050;
    const tasaBCV = s.tasaBCV || 914.02;

    const subtotal = costoCompra * utilFactor;
    const novaClientesUSD = subtotal * ivaFactor;
    const publicoBs = novaClientesUSD * tasaInt;
    const publicoUSD = publicoBs / tasaBCV;

    return { 
        novaClientesUSD, 
        publicoBs, 
        publicoUSD, 
        subtotal,
        gananciaUSD: costoCompra * (utilFactor - 1),
        montoIvaUSD: subtotal * (ivaFactor - 1),
        precioFinalUSD: novaClientesUSD,
        precioFinalBs: novaClientesUSD * tasaBCV
    };
}

// ==========================================
// VENTAS EN ESPERA Y COMANDAS DE MOSTRADOR
// ==========================================
function holdPOSSale() {
    if (posCart.length === 0) return;
    const title = prompt("Identificador para esta venta en espera (ej: Técnico taller azul / Nombre):", posSelectedCustomer ? posSelectedCustomer.nombre : "");
    if (title !== null) {
        const currentUser = (typeof NovaUsers !== 'undefined') ? NovaUsers.getCurrentUser() : { id: 'MOSTRADOR', name: 'MOSTRADOR' };
        NovaDB.holdCurrentSale(posCart, posSelectedCustomer, title, {
            estacion: currentUser.id,
            vendedor: currentUser.name,
            tipoPrecio: 'publico'
        });
        posCart = [];
        renderPOSCart();
        renderHeldSalesList();
        showNovaAlert({
            title: "Venta en Espera",
            message: "La venta ha sido retenida en memoria. Puedes reanudarla cuando el cliente regrese.",
            type: "info"
        });
    }
}

function sendOrderToMaster() {
    if (posCart.length === 0) {
        showNovaAlert({
            title: "Carrito Vacío",
            message: "Agrega repuestos al carrito antes de enviar el pedido a Caja Principal.",
            type: "warning"
        });
        return;
    }

    const currentUser = (typeof NovaUsers !== 'undefined') ? NovaUsers.getCurrentUser() : { id: 'VENTAS01', name: 'VENTAS 01' };
    const settings = NovaDB.getSettings();

    let totalUSD = 0;
    posCart.forEach(item => {
        const p = calcularPreciosSegunAjustes(item.costoCompra, settings, item.porcentajeUtilidad, item.iva);
        totalUSD += p.publicoUSD * item.quantity;
    });
    const totalBs = totalUSD * settings.tasaBCV;

    const cust = posSelectedCustomer || {
        nombre: 'Cliente Mostrador',
        rif: 'V-00000000',
        telefono: '',
        direccion: 'Cabimas, Edo. Zulia'
    };

    const orderId = 'PED-' + currentUser.id.replace('VENTAS', 'V') + '-' + Math.floor(1000 + Math.random() * 9000);

    NovaDB.holdCurrentSale(posCart, cust, `${cust.nombre} [${currentUser.name}]`, {
        id: orderId,
        estacion: currentUser.id,
        vendedor: currentUser.name,
        tipoPrecio: 'publico',
        totalUSD,
        totalBs
    });

    // Limpiar carrito en la computadora de mostrador
    posCart = [];
    renderPOSCart();

    showNovaAlert({
        title: "¡Pedido Enviado a Caja Principal!",
        message: `Pedido #${orderId} de "${cust.nombre}" por $${totalUSD.toFixed(2)} (Bs. ${totalBs.toFixed(2)}) enviado con éxito a la computadora principal (MASTER). El cliente ya puede pasar a caja para pagar y retirar su factura.`,
        type: "success"
    });
}

async function emitPresupuestoFromCart() {
    if (posCart.length === 0) {
        showNovaAlert({
            title: "Carrito Vacío",
            message: "Agrega productos al carrito para emitir un presupuesto.",
            type: "warning"
        });
        return;
    }

    const settings = NovaDB.getSettings();
    let totalUSD = 0;
    posCart.forEach(item => {
        const p = calcularPreciosSegunAjustes(item.costoCompra, settings, item.porcentajeUtilidad, item.iva);
        totalUSD += p.publicoUSD * item.quantity;
    });
    const totalBs = totalUSD * settings.tasaBCV;

    const cust = posSelectedCustomer || {
        nombre: 'Cliente Presupuesto',
        rif: 'V-00000000',
        telefono: '',
        direccion: 'Cabimas, Edo. Zulia'
    };

    const currentUser = (typeof NovaUsers !== 'undefined') ? NovaUsers.getCurrentUser() : { id: 'VENTAS01', name: 'VENTAS 01' };

    const fakePresupuestoSale = {
        id: 'PRE-' + Math.floor(100000 + Math.random() * 900000),
        fechaStr: new Date().toLocaleDateString('es-VE'),
        horaStr: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
        cliente: cust,
        items: JSON.parse(JSON.stringify(posCart)),
        tipoPrecio: 'publico',
        tipoDocumento: 'presupuesto',
        tasaBCV: settings.tasaBCV,
        totalUSD,
        totalBs,
        metodosPago: [],
        vendedor: currentUser.name
    };

    await generateInvoiceDocument(fakePresupuestoSale);
}

function renderHeldSalesList() {
    const held = NovaDB.getHeldSales();
    const btn = document.getElementById('btnHeldSales');
    if (btn) {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> En Espera (${held.length})`;
        if (held.length > 0) {
            btn.style.borderColor = 'var(--accent-red)';
            btn.style.color = 'var(--accent-red)';
        } else {
            btn.style.borderColor = '';
            btn.style.color = '';
        }
    }
}

function renderHeldSalesModalContent() {
    const held = NovaDB.getHeldSales();
    const container = document.getElementById('heldSalesListContainer');
    if (!container) return;

    if (held.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px; opacity:0.5;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <p style="font-weight: 700; font-size: 15px; color: var(--text-main); margin-bottom: 4px;">No hay pedidos en espera</p>
                <p style="font-size: 13px; margin: 0;">Todos los pedidos y tickets pendientes han sido atendidos o descartados.</p>
            </div>`;
        return;
    }

    let listHtml = '';
    held.forEach(h => {
        const time = h.horaStr || (h.timestamp ? new Date(h.timestamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }) : '');
        const station = h.estacion || 'MOSTRADOR';
        const stationClass = station.toLowerCase();
        const totalStr = h.totalUSD ? `$${h.totalUSD.toFixed(2)}` : '';
        const totalBsStr = h.totalBs ? `Bs. ${h.totalBs.toFixed(2)}` : '';
        const custName = (h.customer && h.customer.nombre) ? h.customer.nombre : (h.title || 'Cliente Mostrador');
        const custRif = (h.customer && h.customer.rif) ? ` (${h.customer.rif})` : '';

        listHtml += `
            <div id="held-row-${h.id}" style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border:1px solid var(--border-color); border-radius:var(--radius-md); background:#ffffff; margin-bottom:8px; transition:opacity 0.2s ease;">
                <div style="overflow:hidden; padding-right:10px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
                        <span class="station-tag ${stationClass}">${station}</span>
                        <b style="font-size:13.5px; color:var(--text-main);">${custName}${custRif}</b>
                    </div>
                    <p style="font-size:12px; color:var(--text-muted); margin:0;">
                        ${h.cart.length} productos ${totalStr ? `| <b style="color:var(--primary);">${totalStr}</b> <span style="font-size:11px;">(${totalBsStr})</span>` : ''} | Hora: ${time}
                    </p>
                </div>
                <div style="display:flex; gap:8px; flex-shrink:0;">
                    <button class="header-action-btn btn-primary-action" onclick="resumeHeldSale('${h.id}')" style="padding:7px 14px; font-size:12px;">Cobrar en Caja</button>
                    <button class="ticket-btn-sm" onclick="deleteHeldSale('${h.id}')" style="color:var(--danger);" title="Descartar">✕</button>
                </div>
            </div>`;
    });

    container.innerHTML = listHtml;
}

function openHeldSalesModal() {
    renderHeldSalesModalContent();
    const modal = document.getElementById('heldSalesModal');
    if (modal) modal.classList.add('active');
}

function resumeHeldSale(holdId) {
    const resumed = NovaDB.releaseHeldSale(holdId);
    if (resumed) {
        posCart = resumed.cart;
        if (resumed.customer) posSelectedCustomer = resumed.customer;
        if (resumed.tipoPrecio) setPOSTier(resumed.tipoPrecio);
        window._currentHeldSaleOrigin = resumed; // Guardar estación de origen (ej: VENTAS01)
        renderPOSCart();
        renderHeldSalesList();
        closeModal('heldSalesModal');

        // Notificar a Supabase que el pedido fue tomado por MASTER
        if (typeof NovaSupabase !== 'undefined' && NovaSupabase.markCounterOrderServed) {
            NovaSupabase.markCounterOrderServed(holdId);
        }

        // Si estamos en la computadora MASTER, abrir modal de cobro de inmediato
        if (typeof NovaUsers !== 'undefined' && NovaUsers.isAdmin()) {
            openCheckoutModal();
        } else {
            showNovaAlert({ title: "Pedido Cargado", message: `Pedido de "${resumed.title}" listo en el carrito.`, type: "success" });
        }
    }
}

function deleteHeldSale(holdId) {
    if (!confirm("¿Deseas descartar definitivamente este pedido en espera?")) return;

    // 1. Eliminar de la base de datos local
    NovaDB.deleteHeldSale(holdId);

    // 2. Notificar a Supabase para marcar como atendido/descartado
    if (typeof NovaSupabase !== 'undefined' && NovaSupabase.markCounterOrderServed) {
        NovaSupabase.markCounterOrderServed(holdId);
    }

    // 3. Eliminar la fila del DOM de inmediato sin esperar ni requerir reabrir el modal
    const row = document.getElementById('held-row-' + holdId);
    if (row) {
        row.remove();
    }

    // 4. Actualizar contador en el header
    renderHeldSalesList();

    // 5. Si ya no quedan filas de pedidos en el modal, mostrar el estado vacío
    const container = document.getElementById('heldSalesListContainer');
    if (container && container.querySelectorAll('[id^="held-row-"]').length === 0) {
        renderHeldSalesModalContent();
    }
}

// ==========================================
// MODAL DE REIMPRESIÓN DE COMPROBANTES (POS-58)
// ==========================================
function openReprintModal() {
    const modal = document.getElementById('reprintInvoiceModal');
    if (!modal) return;

    // Resetear filtros del buscador
    const searchInp = document.getElementById('reprintSearchInput');
    if (searchInp) searchInp.value = '';
    const typeFilter = document.getElementById('reprintTypeFilter');
    if (typeFilter) typeFilter.value = 'all';

    // Obtener historial de ventas emitidas
    const sales = (typeof NovaDB !== 'undefined' && NovaDB.getSales) ? NovaDB.getSales() : [];

    // Configurar acción rápida de la última venta
    const quickCard = document.getElementById('reprintQuickActionCard');
    const lastSaleInfo = document.getElementById('reprintLastSaleInfo');
    if (sales.length > 0) {
        const last = sales[0];
        const custName = last.cliente?.nombre || 'Cliente Mostrador';
        if (lastSaleInfo) {
            lastSaleInfo.innerHTML = `<span class="code-badge">${last.id}</span> · <b>${custName}</b> · <span style="color:var(--accent-red); font-weight:800;">$${(last.totalUSD || 0).toFixed(2)}</span> (Bs. ${(last.totalBs || 0).toFixed(2)}) · <span style="font-size:11px; color:var(--text-muted);">${last.fechaStr || ''} ${last.horaStr || ''}</span>`;
        }
        if (quickCard) quickCard.style.display = 'flex';
    } else {
        if (quickCard) quickCard.style.display = 'none';
    }

    renderReprintSalesList(sales);
    modal.classList.add('active');

    setTimeout(() => {
        if (searchInp) searchInp.focus();
    }, 120);
}

function filterReprintSales() {
    const sales = (typeof NovaDB !== 'undefined' && NovaDB.getSales) ? NovaDB.getSales() : [];
    const query = (document.getElementById('reprintSearchInput')?.value || '').toLowerCase().trim();
    const typeFilter = document.getElementById('reprintTypeFilter')?.value || 'all';

    const filtered = sales.filter(s => {
        if (typeFilter !== 'all') {
            if (typeFilter === 'factura' && s.tipoDocumento !== 'factura') return false;
            if (typeFilter === 'nota_entrega' && s.tipoDocumento !== 'nota_entrega') return false;
            if (typeFilter === 'presupuesto' && s.tipoDocumento !== 'presupuesto') return false;
        }

        if (!query) return true;

        const idMatch = (s.id || '').toLowerCase().includes(query);
        const nameMatch = (s.cliente?.nombre || '').toLowerCase().includes(query);
        const rifMatch = (s.cliente?.rif || '').toLowerCase().includes(query);
        const phoneMatch = (s.cliente?.telefono || '').toLowerCase().includes(query);
        return idMatch || nameMatch || rifMatch || phoneMatch;
    });

    renderReprintSalesList(filtered);
}

function renderReprintSalesList(salesList) {
    const tbody = document.getElementById('reprintSalesTableBody');
    if (!tbody) return;

    if (!salesList || salesList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.6" style="margin-bottom:8px; opacity:0.4;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    <p style="font-weight: 700; font-size: 14px; margin-bottom: 3px; color: var(--text-main);">No hay comprobantes emitidos</p>
                    <p style="font-size: 12px; margin: 0;">No se encontraron registros en el historial con los filtros actuales.</p>
                </td>
            </tr>`;
        return;
    }

    let rowsHtml = '';
    const slice = salesList.slice(0, 50);

    slice.forEach(s => {
        let docTypeLabel = 'Factura';
        let badgeStyle = 'background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
        if (s.tipoDocumento === 'nota_entrega') {
            docTypeLabel = 'Nota Despacho';
            badgeStyle = 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;';
        } else if (s.tipoDocumento === 'presupuesto') {
            docTypeLabel = 'Presupuesto';
            badgeStyle = 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;';
        }

        const custName = s.cliente?.nombre || 'Cliente Mostrador';
        const custRif = s.cliente?.rif || 'V-00000000';
        const totalUSD = (typeof s.totalUSD === 'number') ? s.totalUSD.toFixed(2) : '0.00';
        const totalBs = (typeof s.totalBs === 'number') ? s.totalBs.toFixed(2) : '0.00';
        const dateTime = `${s.fechaStr || ''} <span style="color:var(--text-muted); font-size:11px;">${s.horaStr || ''}</span>`;

        rowsHtml += `
            <tr id="reprint-row-${s.id}">
                <td style="padding: 6px 8px;"><span class="code-badge" style="font-weight:800; font-size:11px;">${s.id}</span></td>
                <td style="padding: 6px 8px; white-space:nowrap; font-size:11.5px;">${dateTime}</td>
                <td style="padding: 6px 8px;"><span style="font-size: 10.5px; font-weight:700; padding: 2px 6px; border-radius: 4px; ${badgeStyle}">${docTypeLabel}</span></td>
                <td style="padding: 6px 8px;">
                    <div style="font-weight:700; color:var(--text-main); font-size:12px; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${custName}</div>
                    <div style="font-size:10.5px; color:var(--text-muted);">${custRif}</div>
                </td>
                <td style="padding: 6px 8px; text-align:right; font-weight:800; color:var(--accent-red); font-size:12px;">$${totalUSD}</td>
                <td style="padding: 6px 8px; text-align:right; font-weight:700; color:var(--text-main); font-size:11.5px;">Bs. ${totalBs}</td>
                <td style="padding: 6px 8px; text-align:center;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:4px; flex-wrap:nowrap;">
                        <button type="button" class="ticket-btn-sm" onclick="reprintSaleDirectly('${s.id}')" title="Reimprimir copia directa en impresora térmica POS-58 (Sin descontar inventario)" style="color: #1e40af; border-color: #bfdbfe; background: #eff6ff; font-weight:700; display:inline-flex; align-items:center; gap:3px; padding: 3px 6px; font-size:11px; white-space:nowrap;">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Imprimir
                        </button>
                        <button type="button" class="ticket-btn-sm" onclick="reprintViewDocument('${s.id}')" title="Ver comprobante en pantalla completa" style="color: var(--text-main); padding: 3px 6px; font-size:11px; white-space:nowrap;">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="12 8 8 12 12 16 12 8"></polygon></svg>
                            Ver
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml;
}

async function reprintLastSaleDirectly() {
    const sales = (typeof NovaDB !== 'undefined' && NovaDB.getSales) ? NovaDB.getSales() : [];
    if (sales.length === 0) {
        showNovaAlert({ title: "Sin Comprobantes", message: "No hay comprobantes emitidos en el sistema para reimprimir.", type: "warning" });
        return;
    }
    await reprintSaleDirectly(sales[0].id);
}

async function reprintSaleDirectly(saleId) {
    if (!saleId) return;
    const sales = (typeof NovaDB !== 'undefined' && NovaDB.getSales) ? NovaDB.getSales() : [];
    let sale = sales.find(s => s.id === saleId);

    // Fallback a Supabase si no está en la memoria local
    if (!sale && typeof NovaSupabase !== 'undefined' && NovaSupabase.getClient && NovaSupabase.getClient()) {
        try {
            const { data, error } = await NovaSupabase.getClient()
                .from('ventas')
                .select('*')
                .eq('id', saleId)
                .maybeSingle();
            if (!error && data) {
                sale = {
                    id: data.id,
                    timestamp: Number(data.timestamp) || Date.now(),
                    fechaStr: data.fecha_str || '',
                    horaStr: data.hora_str || '',
                    cliente: data.cliente || { nombre: 'Cliente Mostrador', rif: 'V-00000000' },
                    items: Array.isArray(data.items) ? data.items : [],
                    tipoPrecio: data.tipo_precio || 'publico',
                    tipoDocumento: data.tipo_documento || 'factura',
                    tasaBCV: parseFloat(data.tasa_bcv) || 0,
                    totalUSD: parseFloat(data.total_usd) || 0,
                    totalBs: parseFloat(data.total_bs) || 0,
                    metodosPago: Array.isArray(data.metodos_pago) ? data.metodos_pago : [],
                    vendedor: data.vendedor || 'Caja Principal',
                    cajero: data.cajero || 'MASTER'
                };
            }
        } catch (e) {
            console.warn('[reprintSaleDirectly] Error consultando Supabase:', e);
        }
    }

    if (!sale) {
        showNovaAlert({
            title: "Comprobante no encontrado",
            message: `No se encontró el comprobante <b>${saleId}</b> en la base de datos.`,
            type: "warning"
        });
        return;
    }

    closeModal('reprintInvoiceModal');

    // Reimprimir directamente vía iframe térmico 58mm nativo (NO altera inventario ni cajas)
    printThermalReceipt(sale);

    showNovaAlert({
        title: "Reimpresión Enviada",
        message: `El comprobante <b>${sale.id}</b> (${sale.cliente?.nombre || 'Cliente'}) fue enviado a reimpresión térmica en la impresora POS-58.<br><br><span style="color:var(--success); font-weight:700;">✓ El inventario se mantuvo intacto (no se descontó stock).</span>`,
        type: "success"
    });
}

function reprintViewDocument(saleId) {
    closeModal('reprintInvoiceModal');
    openSaleInvoiceById(saleId);
}

// ==========================================
// MODAL DE COBRO Y EMISIÓN DE FACTURA/TICKET
// ==========================================
function isDivisaPaymentMethod(method) {
    const m = (method || '').toLowerCase();
    // Biopago / Patria es estrictamente Moneda Nacional (Bolívares / Tasa BCV)
    if (m.includes('biopago') || m.includes('patria')) return false;
    return m.includes('usd') || m.includes('dolar') || m.includes('dólar') || m.includes('zelle') || m.includes('binance');
}

/**
 * Resuelve de forma unificada y estricta los datos de pago y moneda de cualquier venta.
 * En presupuestos nunca hay pago ni es divisa.
 * En facturas y notas de despacho: es divisa SOLAMENTE si el método es explícitamente USD/Zelle/Binance.
 * En pagos en Bolívares (Punto de Venta, Pago Móvil, Biopago, Transferencia, Efectivo Bs) NUNCA es divisa.
 */
function getSalePaymentInfo(sale) {
    if (!sale) return { primaryMethod: '', isUSD: false, refNum: '', methodLabel: '' };
    const isPresupuesto = (sale.tipoDocumento === 'presupuesto');
    if (isPresupuesto) {
        return { primaryMethod: '', isUSD: false, refNum: '', methodLabel: '' };
    }

    let primaryMethod = '';
    let refNum = '';

    if (Array.isArray(sale.metodosPago) && sale.metodosPago.length > 0) {
        const first = sale.metodosPago[0];
        if (typeof first === 'string') {
            primaryMethod = first;
        } else if (first && typeof first === 'object') {
            primaryMethod = first.metodo || first.name || first.tipo || '';
            refNum = first.referencia || first.ref || '';
        }
    } else if (typeof sale.metodoPago === 'string') {
        primaryMethod = sale.metodoPago;
    } else if (typeof sale.metodos_pago === 'string') {
        primaryMethod = sale.metodos_pago;
    } else if (Array.isArray(sale.metodos_pago) && sale.metodos_pago.length > 0) {
        const first = sale.metodos_pago[0];
        primaryMethod = typeof first === 'string' ? first : (first.metodo || '');
        refNum = (typeof first === 'object' && first) ? (first.referencia || '') : '';
    }

    let isUSD = false;
    if (primaryMethod) {
        isUSD = isDivisaPaymentMethod(primaryMethod);
    } else if (sale.tipoPrecio === 'divisas' && (!sale.totalBs || sale.totalBs === 0)) {
        isUSD = true;
        primaryMethod = 'Efectivo USD';
    }

    const methodLower = primaryMethod.toLowerCase();
    let methodLabel = primaryMethod ? primaryMethod.toUpperCase() : '';
    if (methodLower.includes('biopago') || methodLower.includes('patria')) methodLabel = "BIOPAGO";
    else if (methodLower.includes('efectivo') && isUSD) methodLabel = "EFECTIVO ($ USD)";
    else if (methodLower.includes('efectivo') && !isUSD) methodLabel = "EFECTIVO (BS)";
    else if (methodLower.includes('punto') || methodLower.includes('débito') || methodLower.includes('debito')) methodLabel = "PUNTO DE VENTA (DEBITO)";
    else if (methodLower.includes('móvil') || methodLower.includes('movil')) methodLabel = "PAGO MOVIL";
    else if (methodLower.includes('transferencia')) methodLabel = "TRANSFERENCIA BANCARIA";
    else if (methodLower.includes('zelle')) methodLabel = "ZELLE";
    else if (methodLower.includes('binance')) methodLabel = "BINANCE PAY";

    if (refNum && !methodLabel.includes(refNum)) {
        methodLabel += ` [REF: ${refNum}]`;
    }

    return { primaryMethod, isUSD, refNum, methodLabel };
}

function onDocTypeChange() {
    const docType = document.getElementById('coDocType')?.value || 'factura';
    const isQuote = (docType === 'presupuesto');

    const payMethodEl = document.getElementById('coPaymentMethod');
    const payBankEl = document.getElementById('coPaymentBank');
    const payRefEl = document.getElementById('coPaymentRef');
    const payRowEl = document.getElementById('coPaymentRow');
    const breakdownEl = document.getElementById('coPaymentBreakdownBox');
    const payUSD = document.getElementById('payAmountUSD');
    const payBs = document.getElementById('payAmountBs');
    const submitBtn = document.getElementById('coSubmitBtn');

    if (payMethodEl) payMethodEl.disabled = isQuote;
    if (payBankEl) payBankEl.disabled = isQuote;
    if (payRefEl) {
        payRefEl.disabled = isQuote;
        if (isQuote) payRefEl.value = '';
    }
    if (payUSD) payUSD.disabled = isQuote;
    if (payBs) payBs.disabled = isQuote;

    if (payRowEl) {
        payRowEl.style.opacity = isQuote ? '0.45' : '1';
        payRowEl.style.pointerEvents = isQuote ? 'none' : 'auto';
    }
    if (breakdownEl) {
        breakdownEl.style.opacity = isQuote ? '0.45' : '1';
        breakdownEl.style.pointerEvents = isQuote ? 'none' : 'auto';
    }
    if (submitBtn) {
        submitBtn.innerText = isQuote ? 'Emitir Presupuesto' : 'Emitir y Concluir Venta';
    }

    updateCheckoutTotals();
}

function updateCheckoutTotals() {
    if (posCart.length === 0) return;

    const settings = NovaDB.getSettings();
    const docType = document.getElementById('coDocType') ? document.getElementById('coDocType').value : 'factura';
    const isQuote = (docType === 'presupuesto');
    const payMethod = document.getElementById('coPaymentMethod') ? document.getElementById('coPaymentMethod').value : 'Efectivo USD';
    const isUSD = !isQuote && isDivisaPaymentMethod(payMethod);

    let totalUSD = 0;
    let totalBs = 0;

    posCart.forEach(item => {
        const p = calcularPreciosSegunAjustes(item.costoCompra, settings, item.porcentajeUtilidad, item.iva);
        if (isUSD) {
            // Descuento automático al pagar en divisas (efectivo $, zelle, binance)
            totalUSD += p.novaClientesUSD * item.quantity;
        } else {
            // Precio estándar en Bolívares (tarjeta, debito, pago movil, biopago o presupuesto)
            totalUSD += p.publicoUSD * item.quantity;
            totalBs += p.publicoBs * item.quantity;
        }
    });

    if (isUSD) {
        totalBs = totalUSD * settings.tasaBCV;
    }

    const usdEl = document.getElementById('checkoutTotalUSD');
    const bsEl = document.getElementById('checkoutTotalBs');
    const badgeEl = document.getElementById('checkoutDiscountBadge');

    if (usdEl) usdEl.innerText = `$${totalUSD.toFixed(2)}`;
    if (bsEl) bsEl.innerText = `Bs. ${totalBs.toFixed(2)}`;

    if (badgeEl) {
        badgeEl.style.display = isUSD ? 'inline-block' : 'none';
    }

    const inputUSD = document.getElementById('payAmountUSD');
    const inputBs = document.getElementById('payAmountBs');
    if (isQuote) {
        if (inputUSD) inputUSD.value = "0.00";
        if (inputBs) inputBs.value = "0.00";
    } else if (isUSD) {
        if (inputUSD) inputUSD.value = totalUSD.toFixed(2);
        if (inputBs) inputBs.value = "0.00";
    } else {
        if (inputUSD) inputUSD.value = "0.00";
        if (inputBs) inputBs.value = totalBs.toFixed(2);
    }

    calculateChange();
}

function onPaymentMethodChange() {
    const payMethod = document.getElementById('coPaymentMethod') ? document.getElementById('coPaymentMethod').value : '';
    const bankSelect = document.getElementById('coPaymentBank');
    if (bankSelect) {
        if (payMethod === 'Biopago') {
            bankSelect.value = 'Patria (Biopago)';
        } else if (payMethod === 'Efectivo USD' || payMethod === 'Efectivo Bs') {
            bankSelect.value = 'Caja Efectivo';
        } else if (payMethod === 'Pago Móvil' || payMethod === 'Transferencia' || payMethod === 'Punto de Venta') {
            if (bankSelect.value === 'Caja Efectivo') {
                bankSelect.value = 'Banesco';
            }
        }
    }
    updateCheckoutTotals();
}

function openCheckoutModal() {
    if (posCart.length === 0) return;

    // Precargar cliente en el badge informativo del modal
    const cust = posSelectedCustomer || { nombre: 'Cliente Mostrador (Contado)', rif: 'V-00000000', telefono: '' };
    const nameEl = document.getElementById('coCustBadgeName');
    const rifEl = document.getElementById('coCustBadgeRif');
    const phoneEl = document.getElementById('coCustBadgePhone');
    if (nameEl) nameEl.innerText = cust.nombre || 'Cliente Mostrador (Contado)';
    if (rifEl) rifEl.innerText = `RIF: ${cust.rif || 'V-00000000'}`;
    if (phoneEl) {
        if (cust.telefono && cust.telefono.trim()) {
            phoneEl.innerText = `Telf: ${cust.telefono.trim()}`;
            phoneEl.style.display = 'inline-block';
        } else {
            phoneEl.innerText = '';
            phoneEl.style.display = 'none';
        }
    }

    // Auto-seleccionar banco emisor acorde al método seleccionado
    const payMethodEl = document.getElementById('coPaymentMethod');
    const bankEl = document.getElementById('coPaymentBank');
    if (payMethodEl && bankEl) {
        if (payMethodEl.value === 'Biopago') bankEl.value = 'Patria (Biopago)';
        else if (payMethodEl.value.includes('Efectivo')) bankEl.value = 'Caja Efectivo';
    }

    // Sincronizar estado de campos de pago según tipo de documento y recalcular montos
    onDocTypeChange();

    openModal('checkoutModal');
}

function calculateChange() {
    const settings = NovaDB.getSettings();
    const payMethod = document.getElementById('coPaymentMethod') ? document.getElementById('coPaymentMethod').value : '';
    const isUSD = isDivisaPaymentMethod(payMethod);

    const totalUSDStr = (document.getElementById('checkoutTotalUSD')?.innerText || '$0').replace('$', '').trim();
    const totalUSD = parseFloat(totalUSDStr) || 0;
    const totalBsStr = (document.getElementById('checkoutTotalBs')?.innerText || 'Bs. 0').replace('Bs.', '').trim();
    const totalBs = parseFloat(totalBsStr) || (totalUSD * settings.tasaBCV);

    const paidUSD = parseFloat(document.getElementById('payAmountUSD').value) || 0;
    const paidBs = parseFloat(document.getElementById('payAmountBs').value) || 0;

    const changeUSDBox = document.getElementById('changeUSDDisplay');
    const changeBsBox = document.getElementById('changeBsDisplay');

    if (isUSD) {
        const diffUSD = paidUSD + (paidBs / settings.tasaBCV) - totalUSD;
        if (diffUSD >= -0.005) {
            if (changeUSDBox) changeUSDBox.innerText = `$${Math.max(0, diffUSD).toFixed(2)}`;
            if (changeBsBox) changeBsBox.innerText = `Bs. ${(Math.max(0, diffUSD) * settings.tasaBCV).toFixed(2)}`;
            if (changeUSDBox) changeUSDBox.style.color = "var(--success)";
        } else {
            if (changeUSDBox) changeUSDBox.innerText = `Falta: $${Math.abs(diffUSD).toFixed(2)}`;
            if (changeBsBox) changeBsBox.innerText = `Falta: Bs. ${(Math.abs(diffUSD) * settings.tasaBCV).toFixed(2)}`;
            if (changeUSDBox) changeUSDBox.style.color = "var(--danger)";
        }
    } else {
        const totalPaidInBs = paidBs + (paidUSD * settings.tasaBCV);
        const diffBs = totalPaidInBs - totalBs;
        if (diffBs >= -0.5) {
            if (changeUSDBox) changeUSDBox.innerText = `$${(Math.max(0, diffBs) / settings.tasaBCV).toFixed(2)}`;
            if (changeBsBox) changeBsBox.innerText = `Bs. ${Math.max(0, diffBs).toFixed(2)}`;
            if (changeUSDBox) changeUSDBox.style.color = "var(--success)";
        } else {
            if (changeUSDBox) changeUSDBox.innerText = `Falta: $${(Math.abs(diffBs) / settings.tasaBCV).toFixed(2)}`;
            if (changeBsBox) changeBsBox.innerText = `Falta: Bs. ${Math.abs(diffBs).toFixed(2)}`;
            if (changeUSDBox) changeUSDBox.style.color = "var(--danger)";
        }
    }
}

async function finalizeSale() {
    const cust = posSelectedCustomer || { nombre: 'Cliente Mostrador (Contado)', rif: 'V-00000000', telefono: '', tipo: 'cliente' };
    const custName = cust.nombre || 'Cliente Mostrador (Contado)';
    const custRif = cust.rif || 'V-00000000';
    const custPhone = cust.telefono || '';
    const docType = document.getElementById('coDocType').value;
    const isQuote = (docType === 'presupuesto');
    const payMethod = document.getElementById('coPaymentMethod').value;
    const payBank = document.getElementById('coPaymentBank') ? document.getElementById('coPaymentBank').value : 'Caja Efectivo';
    const refNum = document.getElementById('coPaymentRef').value.trim();

    // Si no es presupuesto (es Factura o Nota de Entrega), validar existencias disponibles antes de cobrar
    if (!isQuote) {
        for (const item of posCart) {
            const availStock = NovaDB.getStock(item.id);
            if (item.quantity > availStock) {
                showNovaAlert({
                    title: "Stock Insuficiente para Cobrar",
                    message: `No se puede emitir el documento: El repuesto "<b>${item.name}</b>" solo dispone de <b>${availStock}</b> unidad(es) en inventario (intentas cobrar ${item.quantity}). Ajusta la cantidad antes de concluir.`,
                    type: "error"
                });
                return;
            }
        }
    }

    const isUSD = !isQuote && isDivisaPaymentMethod(payMethod);
    const settings = NovaDB.getSettings();
    const defaultIvaPct = (settings && typeof settings.porcentajeIva === 'number')
        ? (settings.porcentajeIva >= 1 ? Math.round((settings.porcentajeIva - 1) * 1000) / 10 : Math.round(settings.porcentajeIva * 1000) / 10)
        : 16;

    let totalUSD = 0;
    let totalBs = 0;

    // Congelar instantánea histórica liviana (~600 bytes por factura) para reconstruir
    // la imagen exacta de la factura en el futuro sin guardar imágenes pesadas en la BD
    const frozenItems = posCart.map(item => {
        const p = calcularPreciosSegunAjustes(item.costoCompra, settings, item.porcentajeUtilidad, item.iva);
        const qty = parseInt(item.quantity) || 1;
        const unitUSD = isUSD ? p.novaClientesUSD : p.publicoUSD;
        const unitBs = isUSD ? (p.novaClientesUSD * settings.tasaBCV) : p.publicoBs;
        const subUSD = unitUSD * qty;
        const subBs = unitBs * qty;
        const itemIva = (typeof item.iva === 'number' && !isNaN(item.iva)) ? item.iva : defaultIvaPct;

        totalUSD += subUSD;
        totalBs += subBs;

        return {
            id: item.id,
            name: item.name,
            quantity: qty,
            costoCompra: Number(item.costoCompra) || 0,
            porcentajeUtilidad: item.porcentajeUtilidad,
            iva: itemIva,
            priceUSD: +unitUSD.toFixed(2),
            priceBs: +unitBs.toFixed(2),
            subtotalUSD: +subUSD.toFixed(2),
            subtotalBs: +subBs.toFixed(2)
        };
    });

    totalUSD = +totalUSD.toFixed(2);
    totalBs = +totalBs.toFixed(2);

    const activeUser = (typeof NovaUsers !== 'undefined') ? NovaUsers.getCurrentUser() : { id: 'MASTER', name: 'MASTER' };
    const originalOrigin = window._currentHeldSaleOrigin;

    const saleRecord = {
        cliente: { nombre: custName, rif: custRif, telefono: custPhone, tipo: cust.tipo || 'cliente' },
        items: frozenItems,
        tipoPrecio: isUSD ? 'divisas' : 'publico',
        descuentoDivisas: isUSD,
        tipoDocumento: docType,
        tasaBCV: settings.tasaBCV,
        totalUSD,
        totalBs,
        banco: isQuote ? null : payBank,
        metodosPago: isQuote ? [] : [{
            metodo: payMethod,
            montoUSD: totalUSD,
            montoBs: totalBs,
            referencia: refNum,
            banco: payBank
        }],
        vendedor: originalOrigin ? (originalOrigin.estacion || originalOrigin.vendedor) : activeUser.name,
        cajero: activeUser.name,
        pedIdOriginal: originalOrigin ? originalOrigin.id : null
    };

    window._currentHeldSaleOrigin = null;

    const saved = NovaDB.registerSale(saleRecord);
    closeModal('checkoutModal');

    // Limpiar carrito de mostrador y sincronizar vistas de catálogo e inventario
    posCart = [];
    renderPOSCart();
    renderPOSCatalog();
    if (typeof renderInventoryView === 'function') {
        renderInventoryView();
    }

    // Generar documento visual y abrir modal de comprobante directamente
    await generateInvoiceDocument(saved);
}

/**
 * Resuelve el precio unitario y total de un ítem respetando primero la instantánea
 * histórica congelada al emitir el documento (garantiza fidelidad eterna del comprobante).
 */
function _resolveHistoricalItemPrices(it, sale, settings, isUSD, tasa) {
    const qty = parseInt(it.quantity) || 1;
    const isDivisa = isUSD || sale.tipoPrecio === 'divisas' || sale.descuentoDivisas || sale.tipoPrecio === 'novacliente';

    if (typeof it.priceUSD === 'number' && it.priceUSD > 0) {
        const unitPriceUSD = it.priceUSD;
        const unitPriceBs = (typeof it.priceBs === 'number' && it.priceBs > 0) ? it.priceBs : (unitPriceUSD * tasa);
        return {
            qty,
            unitPriceUSD,
            unitPriceBs,
            lineTotalUSD: (typeof it.subtotalUSD === 'number' && it.subtotalUSD > 0) ? it.subtotalUSD : (unitPriceUSD * qty),
            lineTotalBs: (typeof it.subtotalBs === 'number' && it.subtotalBs > 0) ? it.subtotalBs : (unitPriceBs * qty)
        };
    }

    const prices = (typeof calcularPreciosSegunAjustes === 'function')
        ? calcularPreciosSegunAjustes(it.costoCompra, settings, it.porcentajeUtilidad, it.iva)
        : { publicoUSD: (it.costoCompra || 0) * 1.77, novaClientesUSD: (it.costoCompra || 0) * 1.508, publicoBs: (it.costoCompra || 0) * 1.77 * tasa };

    const unitPriceUSD = isDivisa ? prices.novaClientesUSD : prices.publicoUSD;
    const unitPriceBs = isDivisa ? (unitPriceUSD * tasa) : (prices.publicoBs || (unitPriceUSD * tasa));
    return {
        qty,
        unitPriceUSD,
        unitPriceBs,
        lineTotalUSD: unitPriceUSD * qty,
        lineTotalBs: unitPriceBs * qty
    };
}

/**
 * Extrae el IVA incluido de los productos de la venta (para Facturas)
 * Fórmula exacta con IVA incluido: Base = Total / (1 + iva/100); IVA = Total - Base
 */
function _computeInvoiceIvaBreakdown(sale, settings, isUSD, tasa) {
    const defaultIvaPct = (settings && typeof settings.porcentajeIva === 'number')
        ? (settings.porcentajeIva >= 1 ? Math.round((settings.porcentajeIva - 1) * 1000) / 10 : Math.round(settings.porcentajeIva * 1000) / 10)
        : 16;

    let baseImponible = 0;
    let exento = 0;
    let ivaTotal = 0;

    if (Array.isArray(sale.items) && sale.items.length > 0) {
        sale.items.forEach(it => {
            const p = _resolveHistoricalItemPrices(it, sale, settings, isUSD, tasa);
            const lineTotal = isUSD ? p.lineTotalUSD : p.lineTotalBs;
            const itemIvaPct = (typeof it.iva === 'number' && !isNaN(it.iva)) ? it.iva : defaultIvaPct;

            if (itemIvaPct > 0) {
                const base = lineTotal / (1 + itemIvaPct / 100);
                baseImponible += base;
                ivaTotal += (lineTotal - base);
            } else {
                exento += lineTotal;
            }
        });
    } else {
        const total = isUSD ? (Number(sale.totalUSD) || 0) : (Number(sale.totalBs) || 0);
        if (defaultIvaPct > 0) {
            baseImponible = total / (1 + defaultIvaPct / 100);
            ivaTotal = total - baseImponible;
        } else {
            exento = total;
        }
    }

    return {
        ivaPctLabel: defaultIvaPct,
        baseImponible,
        exento,
        ivaTotal,
        total: baseImponible + exento + ivaTotal
    };
}

/**
 * Abre la imagen exacta (y lista para re-imprimir o descargar) de cualquier factura
 * o nota de despacho guardada en la base de datos local o en Supabase.
 */
async function openSaleInvoiceById(saleId) {
    if (!saleId) return;
    const sales = (typeof NovaDB !== 'undefined' && NovaDB.getSales) ? NovaDB.getSales() : [];
    let sale = sales.find(s => s.id === saleId);

    // Si no está en caché local, consultar directamente la tabla 'ventas' en Supabase
    if (!sale && typeof NovaSupabase !== 'undefined' && NovaSupabase.getClient && NovaSupabase.getClient()) {
        try {
            const { data, error } = await NovaSupabase.getClient()
                .from('ventas')
                .select('*')
                .eq('id', saleId)
                .maybeSingle();
            if (!error && data) {
                sale = {
                    id: data.id,
                    timestamp: Number(data.timestamp) || Date.now(),
                    fechaStr: data.fecha_str || '',
                    horaStr: data.hora_str || '',
                    cliente: data.cliente || { nombre: 'Cliente Mostrador', rif: 'V-00000000' },
                    items: Array.isArray(data.items) ? data.items : [],
                    tipoPrecio: data.tipo_precio || 'publico',
                    tipoDocumento: data.tipo_documento || 'factura',
                    tasaBCV: parseFloat(data.tasa_bcv) || 0,
                    totalUSD: parseFloat(data.total_usd) || 0,
                    totalBs: parseFloat(data.total_bs) || 0,
                    metodosPago: Array.isArray(data.metodos_pago) ? data.metodos_pago : [],
                    vendedor: data.vendedor || 'Caja Principal',
                    cajero: data.cajero || 'MASTER'
                };
            }
        } catch (e) {
            console.warn('[openSaleInvoiceById] Error consultando Supabase:', e);
        }
    }

    // Fallback a caché temporal del reporte (ej. registros demostrativos cuando aún no hay ventas reales)
    if (!sale && window._reportSalesCache && window._reportSalesCache[saleId]) {
        sale = window._reportSalesCache[saleId];
    }

    if (!sale) {
        showNovaAlert({
            title: "Comprobante No Encontrado",
            message: `No se encontró el registro del documento <b>${saleId}</b> en la base de datos.`,
            type: "warning"
        });
        return;
    }

    await generateInvoiceDocument(sale);
}

// ==========================================
// GENERACIÓN DE DOCUMENTOS (CANVAS TÉRMICO / NOTA DE DESPACHO)
// ==========================================
function loadTicketImage(src) {
    return new Promise((resolve) => {
        const targetSrc = (typeof NOVA_FACTURA_BASE64 !== 'undefined' && NOVA_FACTURA_BASE64) ? NOVA_FACTURA_BASE64 : src;
        const img = new Image();
        let settled = false;
        const done = (res) => {
            if (!settled) {
                settled = true;
                resolve(res);
            }
        };
        img.onload = () => done(img);
        img.onerror = () => done(null);
        img.src = targetSrc;
        if (img.complete && img.naturalWidth > 0) {
            done(img);
        }
        setTimeout(() => {
            if (img.complete && img.naturalWidth > 0) done(img);
            else done(null);
        }, 600);
    });
}

async function generateInvoiceDocument(sale) {
    window._lastGeneratedSale = sale;
    const modal = document.getElementById('invoiceDocModal');
    const titleEl = document.getElementById('docModalBadge');

    try {
        let docHeaderTitle = "NOTA DE DESPACHO";
        if (sale.tipoDocumento === 'factura') docHeaderTitle = "FACTURA";
        else if (sale.tipoDocumento === 'presupuesto') docHeaderTitle = "PRESUPUESTO";
        else if (sale.tipoDocumento === 'nota_entrega') docHeaderTitle = "NOTA DE DESPACHO";

        if (titleEl) {
            titleEl.innerText = docHeaderTitle;
        }

        const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : { tasaBCV: 914.02, tasaInterna: 1050 };

        const isPresupuesto = (sale.tipoDocumento === 'presupuesto');
        const isFactura = (sale.tipoDocumento === 'factura');

        // Determinar método de pago principal y moneda de forma unificada
        const { primaryMethod, isUSD, refNum, methodLabel } = getSalePaymentInfo(sale);
        const tasa = Number(sale.tasaBCV) || Number(settings.tasaBCV) || 915.75;

        const totalProductosVendidos = (sale.items || []).reduce((acc, it) => acc + (parseInt(it.quantity) || 1), 0);
        const ivaData = isFactura ? _computeInvoiceIvaBreakdown(sale, settings, isUSD, tasa) : null;

        // Cargar logotipo oficial para encabezado (prioriza Data URI Base64 seguro)
        let headerImg = null;
        try {
            headerImg = await loadTicketImage('assets/nova-factura.png');
        } catch (imgErr) {
            console.warn("Aviso al cargar headerImg:", imgErr);
        }

        // Canvas de Alta Definición Térmica
        const canvas = document.createElement('canvas');
        const SCALE = 2;
        const WIDTH = 380 * SCALE;
        const PAD = 16 * SCALE;
        const FONT_MONO = "'Courier New', Consolas, 'Lucida Console', Monaco, monospace";

        // Estimación dinámica de altura (ajusta espacio extra para IVA en factura y Tasa BCV)
        const extraFacturaH = isFactura ? (ivaData && ivaData.exento > 0.005 ? 54 : 38) : (isPresupuesto ? -18 : 0);
        const extraTasaH = (!isUSD) ? 22 : 0;
        const estimatedH = Math.ceil((415 + extraFacturaH + extraTasaH + ((sale.items ? sale.items.length : 0) * 38) + (PAD * 2)) * SCALE);
        canvas.width = WIDTH;
        canvas.height = estimatedH;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, WIDTH, estimatedH);
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';

        let curY = PAD;

        // Helper línea discontinua
        function drawDashedLine(y) {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.2 * SCALE;
            ctx.setLineDash([5 * SCALE, 4 * SCALE]);
            ctx.beginPath();
            ctx.moveTo(PAD, y);
            ctx.lineTo(WIDTH - PAD, y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 1. ENCABEZADO: Imagen de cabecera centrada y título de documento
        if (headerImg && headerImg.naturalWidth > 0) {
            const imgW = 280 * SCALE;
            const imgH = Math.round(imgW * (headerImg.naturalHeight / headerImg.naturalWidth));
            const imgX = (WIDTH - imgW) / 2;
            ctx.drawImage(headerImg, imgX, curY, imgW, imgH);
            curY += imgH + (12 * SCALE);
        }

        ctx.font = `bold ${17 * SCALE}px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(docHeaderTitle, WIDTH / 2, curY);
        curY += 24 * SCALE;

        // 2. DATOS DEL CLIENTE
        const custNombre = (sale.cliente && sale.cliente.nombre ? sale.cliente.nombre : 'CLIENTE MOSTRADOR').toUpperCase();
        const custRif = (sale.cliente && sale.cliente.rif ? sale.cliente.rif : 'V-00000000').toUpperCase();
        const custDir = (sale.cliente && sale.cliente.direccion ? sale.cliente.direccion : 'CABIMAS, EDO. ZULIA').toUpperCase();
        const custPhone = (sale.cliente && sale.cliente.telefono ? sale.cliente.telefono : '').toUpperCase();

        const colValX = PAD + (100 * SCALE);
        ctx.textAlign = 'left';

        ctx.font = `bold ${11.5 * SCALE}px ${FONT_MONO}`;
        ctx.fillText("NOMBRE:", PAD, curY);
        ctx.fillText(custNombre.length > 25 ? custNombre.substring(0, 24) + '..' : custNombre, colValX, curY);
        curY += 16 * SCALE;

        ctx.fillText("RIF:", PAD, curY);
        ctx.fillText(custRif, colValX, curY);
        curY += 16 * SCALE;

        if (custPhone) {
            ctx.fillText("TELEFONO:", PAD, curY);
            ctx.fillText(custPhone, colValX, curY);
            curY += 16 * SCALE;
        }
        curY += 6 * SCALE;

        // 3. LÍNEA DISCONTINUA & DATOS DEL COMPROBANTE
        drawDashedLine(curY);
        curY += 12 * SCALE;

        const docNumStr = String(sale.id || '1').replace(/\D/g, '').padStart(8, '0');
        ctx.font = `bold ${12 * SCALE}px ${FONT_MONO}`;
        ctx.textAlign = 'left';
        ctx.fillText(`${docHeaderTitle}:`, PAD, curY);
        ctx.textAlign = 'right';
        ctx.fillText(docNumStr, WIDTH - PAD, curY);
        curY += 16 * SCALE;

        ctx.font = `bold ${11.5 * SCALE}px ${FONT_MONO}`;
        ctx.textAlign = 'left';
        ctx.fillText(`FECHA: ${sale.fechaStr || ''}`, PAD, curY);
        ctx.textAlign = 'right';
        ctx.fillText(`HORA: ${sale.horaStr || ''}`, WIDTH - PAD, curY);
        curY += 16 * SCALE;

        if (!isUSD) {
            ctx.font = `bold ${11 * SCALE}px ${FONT_MONO}`;
            ctx.textAlign = 'left';
            ctx.fillText(`TASA BCV: Bs. ${tasa.toFixed(2)}`, PAD, curY);
            curY += 16 * SCALE;
        }
        curY += 2 * SCALE;

        // 4. LÍNEA DISCONTINUA & LISTA DE PRODUCTOS (MONEDA SEGÚN PAGO)
        drawDashedLine(curY);
        curY += 12 * SCALE;

        ctx.font = `bold ${12 * SCALE}px ${FONT_MONO}`;
        ctx.textAlign = 'left';
        ctx.fillText("DESCRIPCION", PAD, curY);
        curY += 16 * SCALE;

        if (Array.isArray(sale.items)) {
            sale.items.forEach(it => {
                const hp = _resolveHistoricalItemPrices(it, sale, settings, isUSD, tasa);

                // Renglón 1: Descripción en mayúsculas
                ctx.font = `bold ${11 * SCALE}px ${FONT_MONO}`;
                ctx.textAlign = 'left';
                const itName = (it.name || it.id || '').toUpperCase();
                ctx.fillText(itName.length > 34 ? itName.substring(0, 32) + '..' : itName, PAD, curY);
                curY += 14 * SCALE;

                // Renglón 2: Código   Cant x PrecioUnit (sin duplicar total cuando cant = 1)
                ctx.font = `bold ${11 * SCALE}px ${FONT_MONO}`;
                ctx.textAlign = 'left';

                if (isUSD) {
                    ctx.fillText(`${it.id}    ${hp.qty} x $${hp.unitPriceUSD.toFixed(2)}`, PAD, curY);
                    if (hp.qty > 1) {
                        ctx.textAlign = 'right';
                        ctx.fillText(`$${hp.lineTotalUSD.toFixed(2)}`, WIDTH - PAD, curY);
                    }
                } else {
                    ctx.fillText(`${it.id}    ${hp.qty} x Bs. ${hp.unitPriceBs.toFixed(2)}`, PAD, curY);
                    if (hp.qty > 1) {
                        ctx.textAlign = 'right';
                        ctx.fillText(`Bs. ${hp.lineTotalBs.toFixed(2)}`, WIDTH - PAD, curY);
                    }
                }
                curY += 18 * SCALE;
            });
        }
        curY += 4 * SCALE;

        // 5. LÍNEA DISCONTINUA & DESGLOSE IVA (SOLO FACTURA) + TOTAL Y FORMA DE PAGO
        drawDashedLine(curY);
        curY += 12 * SCALE;

        // DESGLOSE DE IVA INCLUIDO ÚNICAMENTE PARA FACTURA
        if (isFactura && ivaData) {
            const fmtVal = (v) => isUSD ? `$${v.toFixed(2)}` : `Bs. ${v.toFixed(2)}`;
            ctx.font = `bold ${11 * SCALE}px ${FONT_MONO}`;

            ctx.textAlign = 'left';
            ctx.fillText("BASE IMPONIBLE:", PAD, curY);
            ctx.textAlign = 'right';
            ctx.fillText(fmtVal(ivaData.baseImponible), WIDTH - PAD, curY);
            curY += 16 * SCALE;

            if (ivaData.exento > 0.005) {
                ctx.textAlign = 'left';
                ctx.fillText("EXENTO:", PAD, curY);
                ctx.textAlign = 'right';
                ctx.fillText(fmtVal(ivaData.exento), WIDTH - PAD, curY);
                curY += 16 * SCALE;
            }

            ctx.textAlign = 'left';
            ctx.fillText(`IVA (${ivaData.ivaPctLabel}%):`, PAD, curY);
            ctx.textAlign = 'right';
            ctx.fillText(fmtVal(ivaData.ivaTotal), WIDTH - PAD, curY);
            curY += 18 * SCALE;
        }

        // TOTAL EN LA MONEDA DE PAGO
        ctx.font = `bold ${13 * SCALE}px ${FONT_MONO}`;
        ctx.textAlign = 'left';
        ctx.fillText("TOTAL", PAD, curY);
        ctx.textAlign = 'right';
        if (isUSD) {
            ctx.fillText(`$${sale.totalUSD.toFixed(2)}`, WIDTH - PAD, curY);
        } else {
            ctx.fillText(`Bs. ${sale.totalBs.toFixed(2)}`, WIDTH - PAD, curY);
        }
        curY += 18 * SCALE;

        // TOTAL PRODUCTOS
        ctx.font = `bold ${12 * SCALE}px ${FONT_MONO}`;
        ctx.textAlign = 'left';
        ctx.fillText(isPresupuesto ? "TOTAL PRODUCTOS COTIZADOS:" : "TOTAL PRODUCTOS VENDIDOS:", PAD, curY);
        ctx.textAlign = 'right';
        ctx.fillText(String(totalProductosVendidos), WIDTH - PAD, curY);
        curY += 18 * SCALE;

        // 6. LÍNEA DISCONTINUA & AVISO LEGAL INFERIOR (CENTRALIZADO)
        drawDashedLine(curY);
        curY += 14 * SCALE;
        ctx.font = `bold ${9.5 * SCALE}px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText("*** CONSERVE SU RECIBO PARA CUALQUIER RECLAMO ***", WIDTH / 2, curY);
        curY += 14 * SCALE;
        ctx.fillText("**** LAS PIEZAS ELECTRICAS NO TIENEN GARANTIA ****", WIDTH / 2, curY);
        curY += 16 * SCALE;

        // Asignar imagen a la vista previa del modal con fallback de seguridad
        const imgEl = document.getElementById('invoiceDocImg');
        let dataUrl = '';
        try {
            dataUrl = canvas.toDataURL('image/png');
            if (imgEl) {
                imgEl.src = dataUrl;
                imgEl.style.display = 'block';
            }
            window._lastGeneratedDocUrl = dataUrl;
        } catch (exportErr) {
            console.warn("Aviso toDataURL:", exportErr);
            if (imgEl && imgEl.parentNode) {
                imgEl.style.display = 'none';
                let fbCanvas = document.getElementById('invoiceDocCanvasFallback');
                if (!fbCanvas) {
                    fbCanvas = document.createElement('canvas');
                    fbCanvas.id = 'invoiceDocCanvasFallback';
                    imgEl.parentNode.appendChild(fbCanvas);
                }
                fbCanvas.width = canvas.width;
                fbCanvas.height = canvas.height;
                fbCanvas.style.maxWidth = '100%';
                fbCanvas.style.boxShadow = 'var(--shadow-md)';
                fbCanvas.style.borderRadius = '4px';
                fbCanvas.style.background = '#ffffff';
                fbCanvas.style.display = 'block';
                const fbCtx = fbCanvas.getContext('2d');
                fbCtx.drawImage(canvas, 0, 0);
            }
        }

        window._lastGeneratedDocName = `${docHeaderTitle.replace(/\s+/g, '_')}-${docNumStr}.png`;

        if (modal) modal.classList.add('active');
    } catch (fatalErr) {
        console.error("Error al generar comprobante:", fatalErr);
        if (modal) modal.classList.add('active');
        showNovaAlert({
            title: "Comprobante Registrado",
            message: `La venta #${sale.id || ''} se registró correctamente con éxito en el sistema.`,
            type: "success"
        });
    }
}

function _escThermal(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Genera el HTML vectorial de alta nitidez para impresora térmica POS-58
 * Calibrado para Jaltech 40021 / OCPP-586-U — Papel 58(48) x 210 mm a 203 DPI
 */
function buildThermal58mmHTML(sale) {
    const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings)
        ? NovaDB.getSettings()
        : { tasaBCV: 915.75, tasaInterna: 1050, empresa: {} };
    const emp = settings.empresa || {};

    const isPresupuesto = (sale.tipoDocumento === 'presupuesto');
    const isFactura = (sale.tipoDocumento === 'factura');

    let docHeaderTitle = "NOTA DE DESPACHO";
    if (isFactura) docHeaderTitle = "FACTURA";
    else if (isPresupuesto) docHeaderTitle = "PRESUPUESTO";
    else if (sale.tipoDocumento === 'nota_entrega') docHeaderTitle = "NOTA DE DESPACHO";

    // Determinar método de pago principal y moneda de forma unificada
    const { primaryMethod, isUSD, refNum, methodLabel } = getSalePaymentInfo(sale);
    const tasa = Number(sale.tasaBCV) || Number(settings.tasaBCV) || 915.75;

    const ivaData = isFactura ? _computeInvoiceIvaBreakdown(sale, settings, isUSD, tasa) : null;
    const fmtThermalVal = (v) => isUSD ? `$${v.toFixed(2)}` : `Bs.${v.toFixed(2)}`;
    const ivaBlockHtml = (isFactura && ivaData)
        ? `
        <div class="row">
            <span>BASE IMPONIBLE:</span>
            <span class="nowrap">${fmtThermalVal(ivaData.baseImponible)}</span>
        </div>
        ${ivaData.exento > 0.005 ? `<div class="row"><span>EXENTO:</span><span class="nowrap">${fmtThermalVal(ivaData.exento)}</span></div>` : ''}
        <div class="row">
            <span>IVA (${ivaData.ivaPctLabel}%):</span>
            <span class="nowrap">${fmtThermalVal(ivaData.ivaTotal)}</span>
        </div>
        `
        : '';

    const docNumStr = String(sale.id || '1').replace(/\D/g, '').padStart(8, '0');
    const custNombre = (sale.cliente && sale.cliente.nombre ? sale.cliente.nombre : 'CLIENTE MOSTRADOR').toUpperCase();
    const custRif = (sale.cliente && sale.cliente.rif ? sale.cliente.rif : 'V-00000000').toUpperCase();
    const custDir = (sale.cliente && sale.cliente.direccion ? sale.cliente.direccion : 'CABIMAS, EDO. ZULIA').toUpperCase();
    const custPhone = (sale.cliente && sale.cliente.telefono ? sale.cliente.telefono : '').toUpperCase();
    const totalProductosVendidos = (sale.items || []).reduce((acc, it) => acc + (parseInt(it.quantity) || 1), 0);

    const empRif = (emp.rif || 'J-50440199-4').toUpperCase();
    const empTel = emp.telefono || '+58 424-6192394';
    const empDir = emp.direccion || 'Av. Carabobo, Cabimas, Zulia';

    const logoSrc = (typeof NOVA_FACTURA_BASE64 !== 'undefined' && NOVA_FACTURA_BASE64)
        ? NOVA_FACTURA_BASE64
        : 'assets/nova-factura.png';

    let itemsHtml = '';
    if (Array.isArray(sale.items)) {
        sale.items.forEach(it => {
            const hp = _resolveHistoricalItemPrices(it, sale, settings, isUSD, tasa);

            let leftCalc = '';
            let rightTotal = '';
            if (isUSD) {
                leftCalc = hp.qty > 1
                    ? `${_escThermal(it.id)} &nbsp; ${hp.qty}x$${hp.unitPriceUSD.toFixed(2)}`
                    : `${_escThermal(it.id)} &nbsp; ${hp.qty} und.`;
                rightTotal = `$${hp.lineTotalUSD.toFixed(2)}`;
            } else {
                leftCalc = `${_escThermal(it.id)} &nbsp; ${hp.qty} und.`;
                rightTotal = `Bs.${hp.lineTotalBs.toFixed(2)}`;
            }

            itemsHtml += `
                <div class="item-block">
                    <div class="item-name">${_escThermal((it.name || it.id || '').toUpperCase())}</div>
                    <div class="item-calc">
                        <span class="nowrap">${leftCalc}</span>
                        <span class="nowrap">${rightTotal}</span>
                    </div>
                </div>
            `;
        });
    }

    const totalFormatted = isUSD
        ? `$${(Number(sale.totalUSD) || 0).toFixed(2)}`
        : `Bs.${(Number(sale.totalBs) || 0).toFixed(2)}`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${_escThermal(docHeaderTitle)} ${docNumStr}</title>
<style>
    @page {
        size: 58mm auto;
        margin: 0mm;
    }
    * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    html, body {
        margin: 0;
        padding: 0;
        width: 47mm;
        max-width: 47mm;
        background: #ffffff;
        color: #000000;
        font-family: Arial, Helvetica, "Segoe UI", sans-serif;
        font-size: 8.5pt;
        line-height: 1.24;
        font-weight: 600;
    }
    .ticket-58 {
        width: 47mm;
        padding: 1mm 1.2mm 10mm 1.2mm;
    }
    .logo {
        display: block;
        width: 34mm;
        max-width: 100%;
        height: auto;
        margin: 0 auto 1.2mm auto;
        filter: grayscale(100%) contrast(400%);
    }
    .company-meta {
        font-size: 7.4pt;
        font-weight: 700;
        line-height: 1.22;
        text-align: center;
        color: #000000;
        margin-bottom: 1.5mm;
    }
    .doc-title {
        font-size: 10.5pt;
        font-weight: 800;
        text-align: center;
        letter-spacing: 0.4px;
        margin: 1.5mm 0;
        padding: 1mm 0;
        border-top: 1.5px solid #000000;
        border-bottom: 1.5px solid #000000;
    }
    .divider {
        border: none;
        border-top: 1.2px dashed #000000;
        margin: 1.8mm 0;
    }
    .divider-solid {
        border: none;
        border-top: 1.5px solid #000000;
        margin: 1.8mm 0;
    }
    .row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 1.5mm;
        font-size: 8pt;
        font-weight: 700;
        margin-bottom: 0.6mm;
    }
    .row-wrap {
        font-size: 7.8pt;
        font-weight: 700;
        margin-bottom: 0.6mm;
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
    .nowrap {
        white-space: nowrap;
    }
    .section-head {
        display: flex;
        justify-content: space-between;
        font-size: 7.8pt;
        font-weight: 800;
        margin-bottom: 1.2mm;
        padding-bottom: 0.6mm;
        border-bottom: 1px solid #000000;
    }
    .item-block {
        margin-bottom: 1.6mm;
        padding-bottom: 1mm;
        border-bottom: 1px dotted #000000;
    }
    .item-block:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }
    .item-name {
        font-size: 7.8pt;
        font-weight: 700;
        line-height: 1.18;
        word-wrap: break-word;
        overflow-wrap: break-word;
        margin-bottom: 0.5mm;
    }
    .item-calc {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 1mm;
        font-size: 7.8pt;
        font-weight: 700;
    }
    .total-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 11pt;
        font-weight: 800;
        margin: 1.5mm 0 1mm 0;
    }
    .footer-note {
        font-size: 7.2pt;
        font-weight: 700;
        text-align: center;
        line-height: 1.28;
        margin-top: 2mm;
    }
</style>
</head>
<body>
    <div class="ticket-58">
        <img class="logo" src="${logoSrc}" alt="NOVA REFRIMOTORS">
        <div class="company-meta">
            RIF: ${_escThermal(empRif)}<br>
            ${_escThermal(empDir)}<br>
            TELF: ${_escThermal(empTel)}
        </div>

        <div class="doc-title">${_escThermal(docHeaderTitle)}</div>

        <div class="row">
            <span>NRO:</span>
            <span class="nowrap">${docNumStr}</span>
        </div>
        <div class="row">
            <span>FECHA: ${_escThermal(sale.fechaStr || '')}</span>
            <span class="nowrap">${_escThermal(sale.horaStr || '')}</span>
        </div>
        ${!isUSD ? `<div class="row"><span>TASA BCV:</span><span class="nowrap">Bs. ${tasa.toFixed(2)}</span></div>` : ''}

        <hr class="divider">

        <div class="row-wrap"><b>CLIENTE:</b> ${_escThermal(custNombre)}</div>
        <div class="row-wrap"><b>RIF/CI:</b> ${_escThermal(custRif)}</div>
        ${custPhone ? `<div class="row-wrap"><b>TELF:</b> ${_escThermal(custPhone)}</div>` : ''}

        <hr class="divider">

        <div class="section-head">
            <span>DESCRIPCION / CANT</span>
            <span>TOTAL</span>
        </div>

        ${itemsHtml}

        <hr class="divider-solid">

        ${ivaBlockHtml}

        <div class="total-row">
            <span>TOTAL:</span>
            <span class="nowrap">${totalFormatted}</span>
        </div>

        <div class="row">
            <span>${isPresupuesto ? 'PRODUCTOS COTIZADOS:' : 'PRODUCTOS VENDIDOS:'}</span>
            <span>${totalProductosVendidos}</span>
        </div>

        <hr class="divider">

        <div class="footer-note">
            CONSERVE SU RECIBO PARA RECLAMOS<br>
            PIEZAS ELECTRICAS SIN GARANTIA<br>
            *** GRACIAS POR SU COMPRA ***
        </div>
    </div>
</body>
</html>`;
}

function printThermalReceipt(sale) {
    if (!sale) return;
    const html = buildThermal58mmHTML(sale);

    let iframe = document.getElementById('thermalPrintIframe');
    if (iframe) iframe.remove();

    iframe = document.createElement('iframe');
    iframe.id = 'thermalPrintIframe';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '58mm';
    iframe.style.height = '1px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = () => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            console.warn("Error al invocar impresión térmica:", e);
        }
    };

    const logoEl = doc.querySelector('img.logo');
    if (logoEl && !logoEl.complete) {
        let printed = false;
        const safePrint = () => {
            if (!printed) {
                printed = true;
                setTimeout(triggerPrint, 120);
            }
        };
        logoEl.onload = safePrint;
        logoEl.onerror = safePrint;
        setTimeout(safePrint, 600);
    } else {
        setTimeout(triggerPrint, 150);
    }
}

function printCurrentDocument() {
    // Priorizar impresión vectorial nativa 58mm (alta nitidez en impresora térmica Jaltech POS-58)
    if (window._lastGeneratedSale) {
        printThermalReceipt(window._lastGeneratedSale);
        return;
    }

    // Fallback a imagen solo si no existe el objeto de venta
    let docUrl = window._lastGeneratedDocUrl;
    if (!docUrl) {
        const fbCanvas = document.getElementById('invoiceDocCanvasFallback');
        if (fbCanvas) {
            try { docUrl = fbCanvas.toDataURL('image/png'); } catch (e) { }
        }
    }
    if (!docUrl) {
        window.print();
        return;
    }
    const w = window.open('', '_blank');
    if (!w) {
        window.print();
        return;
    }
    w.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Imprimir Comprobante</title>
    <style>
        @page { margin: 0; size: 58mm auto; }
        body { margin: 0; padding: 0; width: 47mm; background: #ffffff; }
        img { width: 47mm; height: auto; filter: grayscale(100%) contrast(300%); }
    </style>
</head>
<body>
    <img src="${docUrl}" onload="setTimeout(()=>{ window.print(); window.close(); }, 250);">
</body>
</html>`);
    w.document.close();
}

function printTestReceipt58mm() {
    const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : { tasaBCV: 915.75 };
    const now = new Date();
    const testSale = {
        id: 'PRUEBA-0001',
        fechaStr: now.toLocaleDateString('es-VE'),
        horaStr: now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
        tipoDocumento: 'factura',
        tasaBCV: settings.tasaBCV || 915.75,
        cliente: {
            nombre: 'CLIENTE DE PRUEBA POS-58',
            rif: 'V-12345678',
            direccion: 'CABIMAS, EDO. ZULIA',
            telefono: '0424-0000000'
        },
        items: [
            { id: 'GAS002', name: 'Recarga de Gas Refrigerante R134a (Por Kilo)', quantity: 1, costoCompra: 13.26, porcentajeUtilidad: 30, iva: 16 },
            { id: 'CAP001', name: 'Capacitor 45uF 440V Maxwell', quantity: 2, costoCompra: 4.31, porcentajeUtilidad: 30, iva: 16 }
        ],
        totalUSD: 33.00,
        totalBs: +(33.00 * (settings.tasaBCV || 915.75)).toFixed(2),
        metodosPago: [{ metodo: 'Punto de Venta' }],
        vendedor: 'MASTER'
    };
    printThermalReceipt(testSale);
}

function downloadCurrentDocument() {
    let docUrl = window._lastGeneratedDocUrl;
    if (!docUrl) {
        const fbCanvas = document.getElementById('invoiceDocCanvasFallback');
        if (fbCanvas) {
            try { docUrl = fbCanvas.toDataURL('image/png'); } catch (e) { }
        }
    }
    if (!docUrl) return;
    const a = document.createElement('a');
    a.href = docUrl;
    a.download = window._lastGeneratedDocName || 'Nota_de_Despacho.png';
    a.click();
}

// ==============================================================================
// 3. MÓDULO: GESTIÓN DE INVENTARIO Y ALMACÉN
// ==============================================================================
function renderInventoryView() {
    const inv = NovaDB.getInventory();
    const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
    const settings = NovaDB.getSettings();

    let totalItems = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockValuationUSD = 0;

    const list = Object.values(inv);
    totalItems = list.length;

    list.forEach(item => {
        if (item.stock === 0) outOfStockCount++;
        else if (item.stock <= item.stockMinimo) lowStockCount++;

        // Buscar costo para valorización
        const cost = getProductCost(item.id, prods, item);
        totalStockValuationUSD += cost * item.stock;
    });

    const kpiTotal = document.getElementById('invKpiTotal');
    const kpiVal = document.getElementById('invKpiValuation');
    const kpiLow = document.getElementById('invKpiLow');
    const kpiOut = document.getElementById('invKpiOut');

    if (kpiTotal) kpiTotal.innerText = totalItems;
    if (kpiVal) kpiVal.innerText = `$${totalStockValuationUSD.toFixed(2)}`;
    if (kpiLow) kpiLow.innerText = lowStockCount;
    if (kpiOut) kpiOut.innerText = outOfStockCount;

    renderInventoryTable();
}

function getProductCost(code, prods, invItem) {
    if (invItem && typeof invItem.costoCompra === 'number' && invItem.costoCompra > 0) {
        return invItem.costoCompra;
    }
    if (prods && Array.isArray(prods)) {
        for (let p of prods) {
            if (p.id === code && typeof p.costoCompra === 'number') return p.costoCompra;
            if (p.variants) {
                let v = p.variants.find(x => x.id === code);
                if (v && typeof v.costoCompra === 'number') return v.costoCompra;
            }
        }
    }
    const inv = (typeof NovaDB !== 'undefined' && NovaDB.getInventory) ? NovaDB.getInventory() : null;
    if (inv && inv[code] && typeof inv[code].costoCompra === 'number') {
        return inv[code].costoCompra;
    }
    return 0;
}

function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    const query = document.getElementById('invSearchInput')?.value?.toLowerCase().trim() || '';
    const catFilter = document.getElementById('invCatFilter')?.value || 'Todos';
    const statusFilter = document.getElementById('invStatusFilter')?.value || 'Todos';

    const inv = NovaDB.getInventory();
    const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
    const settings = NovaDB.getSettings();

    let filtered = Object.values(inv).filter(item => {
        const matchQ = !query || item.id.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
        const matchCat = (catFilter === 'Todos') || (item.category === catFilter);

        let matchStat = true;
        if (statusFilter === 'optimal') matchStat = item.stock > item.stockMinimo;
        else if (statusFilter === 'low') matchStat = item.stock > 0 && item.stock <= item.stockMinimo;
        else if (statusFilter === 'out') matchStat = item.stock === 0;

        return matchQ && matchCat && matchStat;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--text-muted);">No se encontraron repuestos en el inventario con los criterios seleccionados.</td></tr>`;
        return;
    }

    let html = '';
    // Paginación virtual ligera
    filtered.slice(0, 100).forEach(item => {
        const cost = getProductCost(item.id, prods, item);
        const precios = calcularPreciosSegunAjustes(cost, settings, item.porcentajeUtilidad, item.iva);

        let statusBadge = '<span class="status-badge status-optimal">● Óptimo</span>';
        if (item.stock === 0) statusBadge = '<span class="status-badge status-out">● Agotado</span>';
        else if (item.stock <= item.stockMinimo) statusBadge = '<span class="status-badge status-low">● Stock Bajo</span>';

        const descPreview = item.descripcionDetallada
            ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px; max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.descripcionDetallada.replace(/"/g, '&quot;')}">${item.descripcionDetallada}</div>`
            : '';

        html += `
            <tr>
                <td><span class="code-badge">${item.id}</span></td>
                <td><div style="font-weight:700; max-width:260px; line-height:1.25;">${item.name}</div>${descPreview}</td>
                <td><span style="font-size:12px; color:var(--text-muted);">${item.category || 'General'}</span></td>
                <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span>$${cost.toFixed(2)}</span>
                        <button class="ticket-btn-sm" onclick="openEditProductModal('${item.id}')" title="Modificar datos, costo, utilidad e IVA">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </div>
                </td>
                <td><b style="color:var(--accent-red);">$${precios.publicoUSD.toFixed(2)}</b></td>
                <td><b style="color:var(--primary);">$${precios.novaClientesUSD.toFixed(2)}</b></td>
                <td style="text-align:center;">
                    <span style="font-weight:800; font-size:13.5px; color:var(--text-main);">${item.stock}</span>
                </td>
                <td>${statusBadge}</td>
                <td style="text-align:right;">
                    <div style="display:flex; align-items:center; justify-content:flex-end; gap:4px; flex-wrap:nowrap;">
                        <button class="ticket-btn-sm" onclick="openEditProductModal('${item.id}')" title="Modificar descripción, costo, utilidad e IVA" style="color:var(--primary); font-weight:700; padding:3px 7px; display:inline-flex; align-items:center; gap:3px; font-size:11.5px; white-space:nowrap;">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Editar
                        </button>
                        <button class="ticket-btn-sm" onclick="confirmDeleteProduct('${item.id}')" style="color:var(--danger); padding:3px 6px; font-size:11.5px;" title="Eliminar del catálogo">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    tbody.innerHTML = html;
}

function quickStockAdjust(itemId, diff) {
    const current = NovaDB.getStock(itemId);
    const newQty = Math.max(0, current + diff);
    NovaDB.setStock(itemId, newQty, "Ajuste rápido en tabla");
    renderInventoryView();
}

function promptUpdateCost(itemId) {
    openEditProductModal(itemId);
}

function openEditProductModal(productId) {
    const inv = NovaDB.getInventory();
    const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
    const item = inv[productId] || prods.find(p => p.id === productId);

    if (!item) {
        showNovaAlert({
            title: "Producto No Encontrado",
            message: `No se encontró la información del producto [${productId}].`,
            type: "warning"
        });
        return;
    }

    const cost = getProductCost(productId, prods, item);
    const settings = NovaDB.getSettings();

    // Valores iniciales
    const currentName = item.name || '';
    const currentDetailed = item.descripcionDetallada || item.description || '';
    const currentUtil = (typeof item.porcentajeUtilidad === 'number')
        ? item.porcentajeUtilidad
        : (settings.porcentajeUtilidad ? (settings.porcentajeUtilidad >= 1 ? Math.round((settings.porcentajeUtilidad - 1) * 1000) / 10 : Math.round(settings.porcentajeUtilidad * 1000) / 10) : 30);
    const currentIva = (typeof item.iva === 'number')
        ? item.iva
        : (settings.porcentajeIva ? (settings.porcentajeIva >= 1 ? Math.round((settings.porcentajeIva - 1) * 1000) / 10 : Math.round(settings.porcentajeIva * 1000) / 10) : 16);

    // Poblar campos
    document.getElementById('editProdId').value = productId;
    const badgeCode = document.getElementById('editProdCodeBadge');
    if (badgeCode) badgeCode.innerText = productId;
    const badgeCat = document.getElementById('editProdCategoryBadge');
    if (badgeCat) badgeCat.innerText = item.category || 'General';

    const inpName = document.getElementById('editProdName');
    if (inpName) inpName.value = currentName;

    const inpDetailed = document.getElementById('editProdDetailedDesc');
    if (inpDetailed) inpDetailed.value = currentDetailed;

    const inpCosto = document.getElementById('editProdCosto');
    if (inpCosto) inpCosto.value = cost > 0 ? cost.toFixed(2) : '0.00';

    const inpUtil = document.getElementById('editProdUtilidad');
    if (inpUtil) inpUtil.value = currentUtil;

    const inpIva = document.getElementById('editProdIva');
    if (inpIva) inpIva.value = currentIva;

    // Poblar historial de última carga y registro de subida de costo
    const history = (typeof NovaDB !== 'undefined' && NovaDB.getProductPurchaseHistory) ? NovaDB.getProductPurchaseHistory(productId) : [];
    let lastDate = 'Sin compras registradas aún';
    let lastSupplier = 'N/A';
    let currentCostVal = cost;
    let previousCostVal = (typeof item.costoAnterior === 'number' && item.costoAnterior > 0) ? item.costoAnterior : 0;

    if (history.length > 0) {
        const latest = history[0];
        lastDate = latest.fechaStr || (latest.timestamp ? new Date(latest.timestamp).toLocaleDateString('es-VE') : 'N/A');
        lastSupplier = latest.proveedorNombre || 'Proveedor';
        currentCostVal = Number(latest.costoCompra) || cost;
        if (history.length > 1) {
            previousCostVal = Number(history[1].costoCompra) || previousCostVal;
        }
    } else if (item.ultimaCargaFechaStr) {
        lastDate = item.ultimaCargaFechaStr;
        lastSupplier = item.ultimoProveedorNombre || 'N/A';
    }

    const lastDateEl = document.getElementById('editProdLastDate');
    if (lastDateEl) {
        if (history.length > 0 && history[0].purchaseId) {
            lastDateEl.innerHTML = `${lastDate} <button type="button" class="code-badge" onclick="viewPurchaseDetails('${history[0].purchaseId}')" style="margin-left:6px; cursor:pointer; font-size:10px; padding:2px 7px; background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; font-weight:800;" title="Ver factura y comprobante de esta compra">Ver Factura ${history[0].purchaseId}</button>`;
        } else if (item.ultimaCompraId) {
            lastDateEl.innerHTML = `${lastDate} <button type="button" class="code-badge" onclick="viewPurchaseDetails('${item.ultimaCompraId}')" style="margin-left:6px; cursor:pointer; font-size:10px; padding:2px 7px; background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; font-weight:800;" title="Ver factura y comprobante de esta compra">Ver Factura ${item.ultimaCompraId}</button>`;
        } else {
            lastDateEl.innerText = lastDate;
        }
    }
    const lastSupplierEl = document.getElementById('editProdLastSupplier');
    if (lastSupplierEl) lastSupplierEl.innerText = lastSupplier;
    const currentCostEl = document.getElementById('editProdCurrentCost');
    if (currentCostEl) currentCostEl.innerText = `$${currentCostVal.toFixed(2)} USD`;
    const prevCostEl = document.getElementById('editProdPreviousCost');
    if (prevCostEl) prevCostEl.innerText = previousCostVal > 0 ? `$${previousCostVal.toFixed(2)} USD` : 'Sin registro anterior';

    const diffBadge = document.getElementById('editProdCostDiffBadge');
    if (diffBadge) {
        if (previousCostVal > 0 && Math.abs(currentCostVal - previousCostVal) > 0.001) {
            const diff = currentCostVal - previousCostVal;
            const pct = ((diff / previousCostVal) * 100).toFixed(1);
            if (diff > 0) {
                diffBadge.style.background = '#fef2f2';
                diffBadge.style.color = '#dc2626';
                diffBadge.style.border = '1px solid #fecaca';
                diffBadge.innerHTML = `▲ Subió +$${diff.toFixed(2)} (+${pct}%)`;
            } else {
                diffBadge.style.background = '#f0fdf4';
                diffBadge.style.color = '#16a34a';
                diffBadge.style.border = '1px solid #bbf7d0';
                diffBadge.innerHTML = `▼ Bajó -$${Math.abs(diff).toFixed(2)} (${pct}%)`;
            }
        } else if (previousCostVal > 0) {
            diffBadge.style.background = '#f1f5f9';
            diffBadge.style.color = '#475569';
            diffBadge.style.border = '1px solid #e2e8f0';
            diffBadge.innerText = 'Sin variación (Mismo costo)';
        } else {
            diffBadge.style.background = '#f1f5f9';
            diffBadge.style.color = '#475569';
            diffBadge.style.border = '1px solid #e2e8f0';
            diffBadge.innerText = 'Costo Inicial Base';
        }
    }

    calculateEditProductPrice();
    openModal('editProductModal');
    setTimeout(() => { if (inpName) inpName.focus(); }, 100);
}

function calculateEditProductPrice() {
    const costoInp = document.getElementById('editProdCosto');
    const utilInp = document.getElementById('editProdUtilidad');
    const ivaInp = document.getElementById('editProdIva');

    const costo = Math.max(0, parseFloat(costoInp ? costoInp.value : 0) || 0);
    const utilidad = Math.max(0, parseFloat(utilInp ? utilInp.value : 0) || 0);
    const iva = Math.max(0, parseFloat(ivaInp ? ivaInp.value : 0) || 0);

    const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : { tasaBCV: 914.02 };
    const tasaBCV = settings.tasaBCV || 914.02;

    const ganancia = costo * (utilidad / 100);
    const subtotal = costo + ganancia;
    const montoIva = subtotal * (iva / 100);
    const precioFinalUSD = subtotal + montoIva;
    const precioFinalBs = precioFinalUSD * tasaBCV;

    // Actualizar etiquetas en la tarjeta de cálculo
    const elCosto = document.getElementById('editCalcCostoDisplay');
    if (elCosto) elCosto.innerText = `$${costo.toFixed(2)}`;

    const elUtilPct = document.getElementById('editCalcUtilPercent');
    if (elUtilPct) elUtilPct.innerText = `${utilidad}%`;

    const elGanancia = document.getElementById('editCalcGananciaDisplay');
    if (elGanancia) elGanancia.innerText = `+$${ganancia.toFixed(2)}`;

    const elIvaPct = document.getElementById('editCalcIvaPercent');
    if (elIvaPct) elIvaPct.innerText = `${iva}%`;

    const elIva = document.getElementById('editCalcIvaDisplay');
    if (elIva) elIva.innerText = `+$${montoIva.toFixed(2)}`;

    const elPrecioUSD = document.getElementById('editCalcPrecioUSD');
    if (elPrecioUSD) elPrecioUSD.innerText = `$${precioFinalUSD.toFixed(2)}`;

    const elPrecioBs = document.getElementById('editCalcPrecioBs');
    if (elPrecioBs) elPrecioBs.innerText = `Bs. ${precioFinalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return { costo, utilidad, iva, subtotal, ganancia, montoIva, precioFinalUSD, precioFinalBs };
}

function saveEditedProduct() {
    const id = document.getElementById('editProdId').value;
    const name = document.getElementById('editProdName').value.trim();
    const descripcionDetallada = (document.getElementById('editProdDetailedDesc')?.value || '').trim();
    const costo = Math.max(0, parseFloat(document.getElementById('editProdCosto').value) || 0);
    const utilidad = Math.max(0, parseFloat(document.getElementById('editProdUtilidad').value) || 0);
    const iva = Math.max(0, parseFloat(document.getElementById('editProdIva').value) || 0);

    if (!id || !name) {
        showNovaAlert({
            title: "Datos Requeridos",
            message: "La descripción del producto no puede estar vacía.",
            type: "warning"
        });
        return;
    }

    const calc = calculateEditProductPrice();
    const precioFinalUSD = calc.precioFinalUSD;

    NovaDB.updateProduct(id, {
        name,
        descripcionDetallada,
        costoCompra: costo,
        porcentajeUtilidad: utilidad,
        iva: iva,
        precioFinalUSD: precioFinalUSD
    });

    closeModal('editProductModal');
    renderInventoryView();
    renderPOSCatalog();

    showNovaAlert({
        title: "Producto Actualizado",
        message: `El repuesto <b>${name}</b> fue actualizado exitosamente.<br>Nuevo precio final de venta: <b>$${precioFinalUSD.toFixed(2)} USD</b>.`,
        type: "success"
    });
}

function confirmDeleteProduct(itemId) {
    if (confirm(`¿Estás seguro de que deseas eliminar definitivamente el producto [${itemId}] del inventario y del catálogo?`)) {
        NovaDB.deleteProduct(itemId);
        renderInventoryView();
        renderPOSCatalog();
        showNovaAlert({
            title: "Producto Eliminado",
            message: `El repuesto [${itemId}] fue removido correctamente.`,
            type: "info"
        });
    }
}

function openAddNewProductModal() {
    const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : {};
    const defaultUtil = settings.porcentajeUtilidad
        ? (settings.porcentajeUtilidad >= 1 ? Math.round((settings.porcentajeUtilidad - 1) * 1000) / 10 : settings.porcentajeUtilidad * 100)
        : 30;
    const defaultIva = settings.porcentajeIva
        ? (settings.porcentajeIva >= 1 ? Math.round((settings.porcentajeIva - 1) * 1000) / 10 : settings.porcentajeIva * 100)
        : 16;

    const inpId = document.getElementById('newProdId');
    const inpName = document.getElementById('newProdName');
    const inpDesc = document.getElementById('newProdDetailedDesc');
    const inpCosto = document.getElementById('newProdCosto');
    const inpUtil = document.getElementById('newProdUtilidad');
    const inpIva = document.getElementById('newProdIva');

    if (inpId) inpId.value = '';
    if (inpName) inpName.value = '';
    if (inpDesc) inpDesc.value = '';
    if (inpCosto) inpCosto.value = '';
    if (inpUtil) inpUtil.value = defaultUtil;
    if (inpIva) inpIva.value = defaultIva;

    calculateNewProductPrice();
    openModal('addNewProductModal');
    setTimeout(() => { if (inpId) inpId.focus(); }, 100);
}

function calculateNewProductPrice() {
    const costoInp = document.getElementById('newProdCosto');
    const utilInp = document.getElementById('newProdUtilidad');
    const ivaInp = document.getElementById('newProdIva');

    const costo = Math.max(0, parseFloat(costoInp ? costoInp.value : 0) || 0);
    const utilidad = Math.max(0, parseFloat(utilInp ? utilInp.value : 0) || 0);
    const iva = Math.max(0, parseFloat(ivaInp ? ivaInp.value : 0) || 0);

    const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : { tasaBCV: 914.02 };
    const tasaBCV = settings.tasaBCV || 914.02;

    const ganancia = costo * (utilidad / 100);
    const subtotal = costo + ganancia;
    const montoIva = subtotal * (iva / 100);
    const precioFinalUSD = subtotal + montoIva;
    const precioFinalBs = precioFinalUSD * tasaBCV;

    const elCosto = document.getElementById('newCalcCostoDisplay');
    if (elCosto) elCosto.innerText = `$${costo.toFixed(2)}`;

    const elUtilPct = document.getElementById('newCalcUtilPercent');
    if (elUtilPct) elUtilPct.innerText = `${utilidad}%`;

    const elGanancia = document.getElementById('newCalcGananciaDisplay');
    if (elGanancia) elGanancia.innerText = `+$${ganancia.toFixed(2)}`;

    const elIvaPct = document.getElementById('newCalcIvaPercent');
    if (elIvaPct) elIvaPct.innerText = `${iva}%`;

    const elIva = document.getElementById('newCalcIvaDisplay');
    if (elIva) elIva.innerText = `+$${montoIva.toFixed(2)}`;

    const elPrecioUSD = document.getElementById('newCalcPrecioUSD');
    if (elPrecioUSD) elPrecioUSD.innerText = `$${precioFinalUSD.toFixed(2)}`;

    const elPrecioBs = document.getElementById('newCalcPrecioBs');
    if (elPrecioBs) elPrecioBs.innerText = `Bs. ${precioFinalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return { costo, utilidad, iva, subtotal, ganancia, montoIva, precioFinalUSD, precioFinalBs };
}

function submitNewProduct() {
    const id = document.getElementById('newProdId').value.trim();
    const name = document.getElementById('newProdName').value.trim();
    const descripcionDetallada = (document.getElementById('newProdDetailedDesc')?.value || '').trim();
    const category = document.getElementById('newProdCategory').value;
    const costoCompra = Math.max(0, parseFloat(document.getElementById('newProdCosto').value) || 0);
    const porcentajeUtilidad = Math.max(0, parseFloat(document.getElementById('newProdUtilidad')?.value) || 0);
    const iva = Math.max(0, parseFloat(document.getElementById('newProdIva')?.value) || 0);
    const stock = 0;
    const stockMinimo = parseInt(document.getElementById('newProdStockMin')?.value) || 3;
    const ubicacion = 'Almacén Central';

    if (!id || !name) {
        showNovaAlert({
            title: "Campos Requeridos",
            message: "El código SKU y la descripción del producto son obligatorios.",
            type: "warning"
        });
        return;
    }

    const calc = calculateNewProductPrice();
    const precioFinalUSD = calc.precioFinalUSD;

    NovaDB.addNewProduct({
        id,
        name,
        descripcionDetallada,
        category,
        costoCompra,
        porcentajeUtilidad,
        iva,
        precioFinalUSD,
        stock,
        stockMinimo,
        ubicacion
    });
    closeModal('addNewProductModal');

    // Limpiar campos
    document.getElementById('newProdId').value = '';
    document.getElementById('newProdName').value = '';
    if (document.getElementById('newProdDetailedDesc')) document.getElementById('newProdDetailedDesc').value = '';
    document.getElementById('newProdCosto').value = '';

    renderInventoryView();
    renderPOSCatalog();
    showNovaAlert({
        title: "Producto Guardado",
        message: `El repuesto <b>[${id}] ${name}</b> fue registrado con éxito.<br>Precio final de venta: <b>$${precioFinalUSD.toFixed(2)} USD</b>.`,
        type: "success"
    });
}

// ==========================================================
// MÓDULO: CARGA DE EXISTENCIAS POR LOTE CON JUSTIFICATIVO (INVENTARIO)
// ==========================================================
let stockInBatchItems = [];
let stockInDropdownActiveIndex = -1;
let stockInCurrentMatches = [];

function getAllCatalogProducts() {
    const inv = (typeof NovaDB !== 'undefined' && NovaDB.getInventory) ? NovaDB.getInventory() : {};
    const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];

    const map = new Map();
    for (const key in inv) {
        const item = inv[key];
        const cost = getProductCost(key, prods, item);
        map.set(key.toUpperCase(), {
            id: key,
            name: item.name || 'Sin descripción',
            stock: parseInt(item.stock) || 0,
            cost: cost,
            category: item.category || ''
        });
    }
    for (const p of prods) {
        const up = p.id.toUpperCase();
        if (!map.has(up)) {
            const cost = getProductCost(p.id, prods, null);
            map.set(up, {
                id: p.id,
                name: p.name || 'Sin descripción',
                stock: 0,
                cost: cost,
                category: p.category || ''
            });
        }
    }

    const list = Array.from(map.values());
    list.sort((a, b) => a.id.localeCompare(b.id));
    return list;
}

function getMatchingStockProducts(term, mode = 'code') {
    const all = getAllCatalogProducts();
    const cleanTerm = (term || '').trim().toLowerCase();
    if (!cleanTerm) return all;

    if (mode === 'code') {
        return all.filter(p => p.id.toLowerCase().includes(cleanTerm));
    } else {
        return all.filter(p => p.id.toLowerCase().includes(cleanTerm) || (p.name && p.name.toLowerCase().includes(cleanTerm)));
    }
}

function openStockInModal() {
    if (typeof NovaUsers !== 'undefined' && !NovaUsers.hasPermission('canManageInventory')) {
        showNovaAlert({
            title: "Acceso Denegado",
            message: "Solo usuarios con permisos administrativos pueden cargar existencias al almacén.",
            type: "warning"
        });
        return;
    }

    stockInBatchItems = [];
    stockInDropdownActiveIndex = -1;
    stockInCurrentMatches = [];

    // Pre-llenar responsable con usuario actual
    const currentUser = (typeof NovaUsers !== 'undefined' && NovaUsers.getCurrentUser) ? NovaUsers.getCurrentUser() : null;
    const defaultResp = currentUser ? (currentUser.name || currentUser.id || 'MASTER') : 'MASTER';
    const respInput = document.getElementById('stockInResponsible');
    if (respInput) respInput.value = defaultResp;

    // Limpiar justificativo
    const reasonInput = document.getElementById('stockInReason');
    if (reasonInput) reasonInput.value = '';

    // Limpiar campos de selección
    const codeInput = document.getElementById('stockInCodeInput');
    if (codeInput) codeInput.value = '';
    const descInput = document.getElementById('stockInDescInput');
    if (descInput) descInput.value = '';
    const hidId = document.getElementById('stockInSelectedProductId');
    if (hidId) hidId.value = '';
    const qtyInput = document.getElementById('stockInQuantity');
    if (qtyInput) qtyInput.value = '1';

    closeStockInDropdown();
    renderStockInItemsTable();
    openModal('loadStockModal');

    setTimeout(() => {
        if (codeInput) codeInput.focus();
    }, 150);
}

function setStockInReasonPreset(text) {
    const reasonInput = document.getElementById('stockInReason');
    if (reasonInput) {
        reasonInput.value = text;
        reasonInput.focus();
    }
}

function renderStockInDropdownResults(matches) {
    const dropdown = document.getElementById('stockInDropdownMenu');
    if (!dropdown) return;

    stockInCurrentMatches = matches ? matches.slice(0, 30) : [];
    stockInDropdownActiveIndex = -1;

    if (stockInCurrentMatches.length === 0) {
        dropdown.innerHTML = `<div style="padding:10px 14px; color:#94a3b8; font-size:12px; text-align:center;">No se encontraron repuestos con esa coincidencia</div>`;
        return;
    }

    let html = '';
    stockInCurrentMatches.forEach((p, idx) => {
        const safeName = (p.name || '').replace(/"/g, '&quot;');
        const costStr = (typeof p.cost === 'number' && p.cost > 0) ? `$${p.cost.toFixed(2)}` : '$0.00';
        const catStr = p.category ? `<span class="stockin-cat-badge">${p.category}</span>` : '';
        const stockClass = p.stock === 0 ? 'stock-pill-empty' : (p.stock <= 5 ? 'stock-pill-low' : 'stock-pill-ok');

        html += `
            <div class="stockin-dropdown-item" data-index="${idx}" data-id="${p.id}" onclick="selectStockInProductByIndex(${idx})">
                <span class="stockin-dropdown-item-code">${p.id}</span>
                <span class="stockin-dropdown-item-name" title="${safeName}">${p.name}</span>
                <div class="stockin-dropdown-item-meta">
                    ${catStr}
                    <span class="stockin-cost-badge">Costo: ${costStr}</span>
                    <span class="stockin-dropdown-item-stock ${stockClass}">Stock: ${p.stock}</span>
                </div>
            </div>`;
    });

    if (matches.length > stockInCurrentMatches.length) {
        html += `<div style="padding:6px 12px; font-size:11px; color:#64748b; background:#f8fafc; text-align:center; border-top:1px solid #e2e8f0;">... y ${matches.length - stockInCurrentMatches.length} coincidencias más (siga escribiendo para filtrar) ...</div>`;
    }

    dropdown.innerHTML = html;
}

function updateStockInDropdownActiveItem() {
    const dropdown = document.getElementById('stockInDropdownMenu');
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.stockin-dropdown-item');
    items.forEach((item, idx) => {
        if (idx === stockInDropdownActiveIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

function openStockInDropdown() {
    const codeVal = (document.getElementById('stockInCodeInput')?.value || '').trim();
    const descVal = (document.getElementById('stockInDescInput')?.value || '').trim();

    let matches = [];
    if (codeVal) {
        matches = getMatchingStockProducts(codeVal, 'code');
    } else if (descVal) {
        matches = getMatchingStockProducts(descVal, 'all');
    } else {
        matches = getMatchingStockProducts('', 'all').slice(0, 25);
    }

    renderStockInDropdownResults(matches);
    const dropdown = document.getElementById('stockInDropdownMenu');
    if (dropdown) dropdown.style.display = 'block';
}

function closeStockInDropdown() {
    const dropdown = document.getElementById('stockInDropdownMenu');
    if (dropdown) dropdown.style.display = 'none';
    stockInDropdownActiveIndex = -1;
}

function onStockInCodeInput(codeVal) {
    const term = (codeVal || '').trim().toLowerCase();
    const dropdown = document.getElementById('stockInDropdownMenu');
    const descInput = document.getElementById('stockInDescInput');
    const hidId = document.getElementById('stockInSelectedProductId');

    if (hidId) hidId.value = '';

    if (!term) {
        if (dropdown) dropdown.style.display = 'none';
        if (descInput) descInput.value = '';
        return;
    }

    const matches = getMatchingStockProducts(term, 'code');
    renderStockInDropdownResults(matches);

    // Abrir automáticamente el desplegable en el cuadro de descripción
    if (dropdown) {
        dropdown.style.display = 'block';
    }

    // Si coincide exactamente con un código único
    const exact = matches.find(p => p.id.toLowerCase() === term);
    if (exact) {
        if (descInput) descInput.value = exact.name;
        if (hidId) hidId.value = exact.id;
    } else if (matches.length > 0) {
        if (descInput && !descInput.matches(':focus')) {
            descInput.value = `[${matches.length} coincidencias] Seleccione abajo o use flechas...`;
        }
    } else {
        if (descInput) descInput.value = '';
    }
}

function onStockInCodeKeyDown(e) {
    const dropdown = document.getElementById('stockInDropdownMenu');
    const isDropdownVisible = dropdown && dropdown.style.display === 'block';

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isDropdownVisible) {
            openStockInDropdown();
        }
        if (stockInCurrentMatches.length > 0) {
            stockInDropdownActiveIndex = (stockInDropdownActiveIndex + 1) % stockInCurrentMatches.length;
            updateStockInDropdownActiveItem();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (isDropdownVisible && stockInCurrentMatches.length > 0) {
            stockInDropdownActiveIndex = (stockInDropdownActiveIndex - 1 + stockInCurrentMatches.length) % stockInCurrentMatches.length;
            updateStockInDropdownActiveItem();
        }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (isDropdownVisible && stockInCurrentMatches.length > 0) {
            e.preventDefault();
            const targetIdx = stockInDropdownActiveIndex >= 0 ? stockInDropdownActiveIndex : 0;
            selectStockInProductByIndex(targetIdx);
        } else {
            const hidId = document.getElementById('stockInSelectedProductId')?.value;
            if (hidId) {
                e.preventDefault();
                const qtyInput = document.getElementById('stockInQuantity');
                if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
            } else {
                const typedCode = (document.getElementById('stockInCodeInput')?.value || '').trim().toLowerCase();
                if (typedCode) {
                    const all = getAllCatalogProducts();
                    const found = all.find(p => p.id.toLowerCase() === typedCode);
                    if (found) {
                        e.preventDefault();
                        selectStockInProduct(found.id, found.name, found.cost);
                    }
                }
            }
        }
    } else if (e.key === 'Escape') {
        closeStockInDropdown();
    }
}

function onStockInDescInput(descVal) {
    const term = (descVal || '').trim().toLowerCase();
    const dropdown = document.getElementById('stockInDropdownMenu');
    const hidId = document.getElementById('stockInSelectedProductId');
    if (hidId) hidId.value = '';

    const matches = getMatchingStockProducts(term, 'all');
    renderStockInDropdownResults(matches);
    if (dropdown) dropdown.style.display = 'block';
}

function onStockInDescKeyDown(e) {
    const dropdown = document.getElementById('stockInDropdownMenu');
    const isDropdownVisible = dropdown && dropdown.style.display === 'block';

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isDropdownVisible) {
            openStockInDropdown();
        }
        if (stockInCurrentMatches.length > 0) {
            stockInDropdownActiveIndex = (stockInDropdownActiveIndex + 1) % stockInCurrentMatches.length;
            updateStockInDropdownActiveItem();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (isDropdownVisible && stockInCurrentMatches.length > 0) {
            stockInDropdownActiveIndex = (stockInDropdownActiveIndex - 1 + stockInCurrentMatches.length) % stockInCurrentMatches.length;
            updateStockInDropdownActiveItem();
        }
    } else if (e.key === 'Enter') {
        if (isDropdownVisible && stockInCurrentMatches.length > 0) {
            e.preventDefault();
            const targetIdx = stockInDropdownActiveIndex >= 0 ? stockInDropdownActiveIndex : 0;
            selectStockInProductByIndex(targetIdx);
        }
    } else if (e.key === 'Escape') {
        closeStockInDropdown();
    }
}

function selectStockInProductByIndex(idx) {
    if (idx >= 0 && idx < stockInCurrentMatches.length) {
        const p = stockInCurrentMatches[idx];
        selectStockInProduct(p.id, p.name, p.cost);
    }
}

function selectStockInProduct(id, name, cost) {
    const codeInput = document.getElementById('stockInCodeInput');
    const descInput = document.getElementById('stockInDescInput');
    const hidId = document.getElementById('stockInSelectedProductId');

    if (codeInput) codeInput.value = id;
    if (descInput) descInput.value = name;
    if (hidId) hidId.value = id;

    closeStockInDropdown();

    const qtyInput = document.getElementById('stockInQuantity');
    if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
    }
}

// Cerrar desplegable si se hace clic afuera
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('stockInDropdownMenu');
    if (dropdown && dropdown.style.display === 'block') {
        const descInput = document.getElementById('stockInDescInput');
        const codeInput = document.getElementById('stockInCodeInput');
        if (!dropdown.contains(e.target) && e.target !== descInput && e.target !== codeInput) {
            dropdown.style.display = 'none';
        }
    }
});

function addSelectedProductToStockInList() {
    let productId = (document.getElementById('stockInSelectedProductId')?.value || '').trim();
    let productName = (document.getElementById('stockInDescInput')?.value || '').trim();

    // Si no se seleccionó del menú, verificar si lo escrito en Código coincide exactamente con un repuesto
    if (!productId) {
        const typedCode = (document.getElementById('stockInCodeInput')?.value || '').trim().toLowerCase();
        if (typedCode) {
            const all = getAllCatalogProducts();
            const found = all.find(p => p.id.toLowerCase() === typedCode);
            if (found) {
                productId = found.id;
                productName = found.name;
            } else {
                const partials = all.filter(p => p.id.toLowerCase().includes(typedCode));
                if (partials.length === 1) {
                    productId = partials[0].id;
                    productName = partials[0].name;
                }
            }
        }
    }

    if (!productId) {
        showNovaAlert({
            title: "Seleccione un Repuesto",
            message: "Por favor escriba un código o seleccione el repuesto correspondiente en la lista desplegable.",
            type: "warning"
        });
        const codeInput = document.getElementById('stockInCodeInput');
        if (codeInput) codeInput.focus();
        return;
    }

    const qtyInput = document.getElementById('stockInQuantity');
    const qty = parseInt(qtyInput ? qtyInput.value : 1);
    if (isNaN(qty) || qty <= 0) {
        showNovaAlert({
            title: "Cantidad Inválida",
            message: "La cantidad a cargar debe ser un número entero mayor a cero.",
            type: "warning"
        });
        if (qtyInput) qtyInput.focus();
        return;
    }

    const currentStock = (typeof NovaDB !== 'undefined' && NovaDB.getStock) ? NovaDB.getStock(productId) : 0;
    const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
    const inv = (typeof NovaDB !== 'undefined' && NovaDB.getInventory) ? NovaDB.getInventory() : {};
    const itemCost = getProductCost(productId, prods, inv[productId]);

    const existing = stockInBatchItems.find(item => item.id === productId);
    if (existing) {
        existing.qtyToAdd += qty;
        renderStockInItemsTable();
        setTimeout(() => {
            const row = document.getElementById(`stockin-row-${productId}`);
            if (row) {
                row.classList.remove('stockin-row-updated');
                void row.offsetWidth;
                row.classList.add('stockin-row-updated');
            }
        }, 50);
    } else {
        stockInBatchItems.push({
            id: productId,
            name: productName || productId,
            currentStock: currentStock,
            qtyToAdd: qty,
            cost: itemCost
        });
        renderStockInItemsTable();
    }

    // Limpiar campos para la siguiente entrada
    const codeInput = document.getElementById('stockInCodeInput');
    const descInput = document.getElementById('stockInDescInput');
    const hidId = document.getElementById('stockInSelectedProductId');
    if (codeInput) codeInput.value = '';
    if (descInput) descInput.value = '';
    if (hidId) hidId.value = '';
    if (qtyInput) qtyInput.value = '1';
    closeStockInDropdown();

    // Devolver foco al código para carga rápida sucesiva
    if (codeInput) codeInput.focus();
}

function renderStockInItemsTable() {
    const tbody = document.getElementById('stockInTableBody');
    const countEl = document.getElementById('stockInListCount');
    const totalUnitsBadge = document.getElementById('stockInTotalUnitsBadge');
    const valBadge = document.getElementById('stockInTotalValuationBadge');

    if (!tbody) return;

    if (stockInBatchItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:24px 12px; color:var(--text-muted); font-size:12.5px;">
                    No hay productos agregados a la lista de carga.<br>
                    <span style="font-size:11.5px;">Escriba el código o descripción arriba, coloque la cantidad a cargar y pulse <b>Agregar a Lista</b>.</span>
                </td>
            </tr>`;
        if (countEl) countEl.innerText = '0';
        if (totalUnitsBadge) totalUnitsBadge.innerText = '0 Unidades Totales';
        if (valBadge) valBadge.innerHTML = 'Costo Total: $0.00';
        return;
    }

    let totalUnits = 0;
    let totalCostUSD = 0;
    const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : { tasaBCV: 917.78 };
    const bcvRate = settings.tasaBCV || 917.78;
    let html = '';

    stockInBatchItems.forEach((item) => {
        totalUnits += item.qtyToAdd;
        const itemCost = Number(item.cost) || 0;
        const lineCost = itemCost * item.qtyToAdd;
        totalCostUSD += lineCost;

        const costSubtitle = itemCost > 0
            ? `<div style="font-size:11px; color:#15803d; font-weight:600; margin-top:2px;">Costo unit: $${itemCost.toFixed(2)} | Subtotal: $${lineCost.toFixed(2)} USD</div>`
            : `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Costo unit: $0.00</div>`;

        html += `
            <tr id="stockin-row-${item.id}">
                <td><span class="code-badge">${item.id}</span></td>
                <td>
                    <div style="font-weight:700; line-height:1.25; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${item.name}">
                        ${item.name}
                    </div>
                    ${costSubtitle}
                </td>
                <td style="text-align:center; font-weight:700; color:var(--text-muted);">${item.currentStock}</td>
                <td style="text-align:center;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                        <button type="button" class="ticket-btn-sm" onclick="updateStockInItemQty('${item.id}', -1)" style="font-weight:800; width:24px; height:24px; padding:0;">-</button>
                        <input type="number" min="1" step="1" value="${item.qtyToAdd}" onchange="setStockInItemQtyDirect('${item.id}', this.value)" style="width:52px; text-align:center; font-weight:800; font-size:13px; padding:2px 4px; border:1px solid #cbd5e1; border-radius:4px;">
                        <button type="button" class="ticket-btn-sm" onclick="updateStockInItemQty('${item.id}', 1)" style="font-weight:800; width:24px; height:24px; padding:0;">+</button>
                    </div>
                </td>
                <td style="text-align:center;">
                    <button type="button" class="ticket-btn-sm" onclick="removeStockInItem('${item.id}')" style="color:var(--danger); padding:3px 6px;" title="Quitar de la lista">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            </tr>`;
    });

    tbody.innerHTML = html;
    if (countEl) countEl.innerText = stockInBatchItems.length;
    if (totalUnitsBadge) totalUnitsBadge.innerText = `${totalUnits} ${totalUnits === 1 ? 'Unidad Total' : 'Unidades Totales'}`;
    if (valBadge) {
        const totalCostBs = totalCostUSD * bcvRate;
        valBadge.innerHTML = `Costo Total: <b>$${totalCostUSD.toFixed(2)} USD</b> <span style="font-size:10.5px; opacity:0.85;">(Bs. ${totalCostBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>`;
    }
}

function updateStockInItemQty(id, diff) {
    const item = stockInBatchItems.find(i => i.id === id);
    if (item) {
        item.qtyToAdd = Math.max(1, item.qtyToAdd + diff);
        renderStockInItemsTable();
    }
}

function setStockInItemQtyDirect(id, val) {
    const item = stockInBatchItems.find(i => i.id === id);
    if (item) {
        const qty = parseInt(val);
        item.qtyToAdd = (!isNaN(qty) && qty > 0) ? qty : 1;
        renderStockInItemsTable();
    }
}

function removeStockInItem(id) {
    stockInBatchItems = stockInBatchItems.filter(i => i.id !== id);
    renderStockInItemsTable();
}

function clearStockInList() {
    if (stockInBatchItems.length === 0) return;
    stockInBatchItems = [];
    renderStockInItemsTable();
}

function submitStockInBatch() {
    const reasonInput = document.getElementById('stockInReason');
    const respInput = document.getElementById('stockInResponsible');

    const reason = reasonInput ? reasonInput.value.trim() : '';
    if (!reason) {
        showNovaAlert({
            title: "Justificativo Requerido",
            message: "Por favor indique la descripción o justificación de esta acción (ej. Conteo Físico, Reingreso, etc.).",
            type: "warning"
        });
        if (reasonInput) reasonInput.focus();
        return;
    }

    const responsible = respInput ? respInput.value.trim() : '';
    if (!responsible) {
        showNovaAlert({
            title: "Responsable Requerido",
            message: "Por favor indique el nombre del responsable de esta acción.",
            type: "warning"
        });
        if (respInput) respInput.focus();
        return;
    }

    if (stockInBatchItems.length === 0) {
        showNovaAlert({
            title: "Lista de Carga Vacía",
            message: "Debe agregar al menos un repuesto a la lista de carga para registrar existencias.",
            type: "warning"
        });
        return;
    }

    const totalProds = stockInBatchItems.length;
    let totalUnits = 0;
    let totalValuation = 0;

    // Aplicar entrada a cada producto
    stockInBatchItems.forEach(item => {
        NovaDB.addStock(item.id, item.qtyToAdd, reason, responsible);
        totalUnits += item.qtyToAdd;
        totalValuation += (Number(item.cost) || 0) * item.qtyToAdd;
    });

    // Actualizar interfaz
    renderInventoryView();
    if (typeof renderPOSCatalog === 'function') renderPOSCatalog();

    closeModal('loadStockModal');

    const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : { tasaBCV: 917.78 };
    const totalValuationBs = totalValuation * (settings.tasaBCV || 917.78);

    showNovaAlert({
        title: "Existencias Cargadas con Éxito",
        message: `Se han ingresado correctamente <b>${totalUnits} unidades</b> distribuidas en <b>${totalProds} repuesto(s)</b> al inventario.<br><div style="margin-top:8px; font-size:12px; color:var(--text-muted); background:#f8fafc; padding:8px 12px; border-radius:6px; border:1px solid #e2e8f0; line-height:1.4;"><b>Motivo:</b> ${reason}<br><b>Responsable:</b> ${responsible}<br><b>Valorización Ingreso:</b> $${totalValuation.toFixed(2)} USD (Bs. ${totalValuationBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</div>`,
        type: "success"
    });

    stockInBatchItems = [];
}

// Exportar globalmente
window.openStockInModal = openStockInModal;
window.setStockInReasonPreset = setStockInReasonPreset;
window.onStockInCodeInput = onStockInCodeInput;
window.onStockInCodeKeyDown = onStockInCodeKeyDown;
window.onStockInDescInput = onStockInDescInput;
window.onStockInDescKeyDown = onStockInDescKeyDown;
window.openStockInDropdown = openStockInDropdown;
window.closeStockInDropdown = closeStockInDropdown;
window.selectStockInProduct = selectStockInProduct;
window.selectStockInProductByIndex = selectStockInProductByIndex;
window.addSelectedProductToStockInList = addSelectedProductToStockInList;
window.renderStockInItemsTable = renderStockInItemsTable;
window.updateStockInItemQty = updateStockInItemQty;
window.setStockInItemQtyDirect = setStockInItemQtyDirect;
window.removeStockInItem = removeStockInItem;
window.clearStockInList = clearStockInList;
window.submitStockInBatch = submitStockInBatch;
window.openRateSettingsModal = openRateSettingsModal;
window.saveRatesFromModal = saveRatesFromModal;

// ==========================================
// CONTROL DE ESTACIONES Y USUARIOS (MASTER & VENTAS)
// ==========================================
function openSwitchStationModal() {
    openModal('userStationModal');
}

function selectStationOption(stationId) {
    if (stationId === 'MASTER') {
        closeModal('userStationModal');
        const pinInp = document.getElementById('inputMasterPin');
        if (pinInp) pinInp.value = '';
        openModal('masterPinModal');
        setTimeout(() => { if (pinInp) pinInp.focus(); }, 150);
        return;
    }

    const res = NovaUsers.switchStation(stationId);
    if (res.success) {
        closeModal('userStationModal');
        showNovaAlert({
            title: "Estación Cambiada",
            message: `Esta computadora ahora está operando como estación [${res.user.name}].`,
            type: "success"
        });
    }
}

function submitMasterPin() {
    const pinInp = document.getElementById('inputMasterPin');
    const entered = pinInp ? pinInp.value.trim() : '';

    const res = NovaUsers.switchStation('MASTER', entered);
    if (res.success) {
        closeModal('masterPinModal');
        if (pinInp) pinInp.value = '';
        showNovaAlert({
            title: "Estación MASTER Activada",
            message: "Acceso concedido. Tienes el control total sobre el sistema, caja, facturas e inventario.",
            type: "success"
        });
    } else {
        showNovaAlert({
            title: "PIN Incorrecto",
            message: res.message || "El PIN ingresado no coincide con el de Administrador.",
            type: "warning"
        });
        if (pinInp) { pinInp.focus(); pinInp.select(); }
    }
}

// ==============================================================================
// 4. MÓDULO: CAJA, ARQUEO Y CONTROL DE OPERACIONES
// ==============================================================================
let currentCashTab = 'sales';
let currentCashMethodFilter = 'todos';

const CASH_PAYMENT_METHODS_CONFIG = [
    {
        key: 'todos',
        label: 'Todos',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect></svg>`
    },
    {
        key: 'efectivo_usd',
        label: 'Efectivo USD',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle><path d="M6 12h.01M18 12h.01"></path></svg>`
    },
    {
        key: 'efectivo_bs',
        label: 'Efectivo Bs.',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="12" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line><circle cx="12" cy="14" r="1.5"></circle></svg>`
    },
    {
        key: 'pago_movil',
        label: 'Pago Móvil',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="3"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line><path d="M9 6h6"></path></svg>`
    },
    {
        key: 'punto_venta',
        label: 'Punto de Venta',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line><line x1="6" y1="15" x2="10" y2="15"></line></svg>`
    },
    {
        key: 'biopago',
        label: 'Biopago',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 0-10 10c0 3.3 1.6 6.2 4 8"></path><path d="M12 6a6 6 0 0 0-6 6c0 2 1 3.8 2.5 5"></path><path d="M12 10a2 2 0 0 0-2 2c0 .8.4 1.5 1 2"></path><path d="M12 22a10 10 0 0 0 10-10c0-3.3-1.6-6.2-4-8"></path><path d="M12 18a6 6 0 0 0 6-6c0-2-1-3.8-2.5-5"></path></svg>`
    },
    {
        key: 'transferencia',
        label: 'Transferencia',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"></path><path d="M3 10h18"></path><path d="M5 10v11"></path><path d="M9 10v11"></path><path d="M15 10v11"></path><path d="M19 10v11"></path><path d="M12 2L2 7h20L12 2z"></path></svg>`
    },
    {
        key: 'zelle',
        label: 'Zelle',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`
    },
    {
        key: 'binance',
        label: 'Binance Pay',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M14.5 9h-5v6h5"></path><path d="M9.5 12h4"></path></svg>`
    }
];

function getSalePaymentMethodKey(sale) {
    if (!sale) return 'otros';
    let raw = '';
    if (Array.isArray(sale.metodosPago) && sale.metodosPago.length > 0) {
        const item = sale.metodosPago[0];
        raw = String((typeof item === 'object' && item) ? (item.metodo || item.name || '') : item);
    } else if (sale.metodoPago) {
        raw = String(sale.metodoPago);
    }

    const m = raw.toLowerCase().trim();
    if (m.includes('biopago') || m.includes('patria')) return 'biopago';
    if (m.includes('pago móvil') || m.includes('pago movil')) return 'pago_movil';
    if (m.includes('punto') || m.includes('débito') || m.includes('debito')) return 'punto_venta';
    if (m.includes('transferencia')) return 'transferencia';
    if (m.includes('zelle')) return 'zelle';
    if (m.includes('binance')) return 'binance';
    if (m.includes('efectivo bs') || m.includes('bolívares') || m.includes('bolivares')) return 'efectivo_bs';
    if (m.includes('efectivo') || m.includes('usd') || m.includes('$')) return 'efectivo_usd';
    if (isPaymentNational(sale)) return 'pago_movil';
    return 'efectivo_usd';
}

function renderCashMethodFilterCards(shiftSales) {
    const grid = document.getElementById('cashMethodFilterGrid');
    const summary = document.getElementById('cashMethodFilterSummary');
    if (!grid) return;

    const settings = NovaDB.getSettings() || { tasaBCV: 917.78 };
    const bcvRate = parseFloat(settings.tasaBCV) || 917.78;

    const stats = {
        todos: { count: 0, totalUSD: 0, totalBs: 0 },
        efectivo_usd: { count: 0, totalUSD: 0, totalBs: 0 },
        efectivo_bs: { count: 0, totalUSD: 0, totalBs: 0 },
        pago_movil: { count: 0, totalUSD: 0, totalBs: 0 },
        punto_venta: { count: 0, totalUSD: 0, totalBs: 0 },
        biopago: { count: 0, totalUSD: 0, totalBs: 0 },
        transferencia: { count: 0, totalUSD: 0, totalBs: 0 },
        zelle: { count: 0, totalUSD: 0, totalBs: 0 },
        binance: { count: 0, totalUSD: 0, totalBs: 0 }
    };

    (shiftSales || []).forEach(s => {
        if (s.anulada || s.tipoDocumento === 'presupuesto') return;
        const u = parseFloat(s.totalUSD) || 0;
        const b = (parseFloat(s.totalBs) && !isNaN(s.totalBs)) ? parseFloat(s.totalBs) : (u * bcvRate);
        const key = getSalePaymentMethodKey(s);

        stats.todos.count += 1;
        stats.todos.totalUSD += u;
        stats.todos.totalBs += b;

        if (stats[key]) {
            stats[key].count += 1;
            stats[key].totalUSD += u;
            stats[key].totalBs += b;
        }
    });

    let html = '';
    CASH_PAYMENT_METHODS_CONFIG.forEach(cfg => {
        const itemStat = stats[cfg.key] || { count: 0, totalUSD: 0, totalBs: 0 };
        const isActive = (currentCashMethodFilter === cfg.key);
        html += `
            <div class="cash-method-card ${isActive ? 'active' : ''}" onclick="setCashMethodFilter('${cfg.key}')" title="Filtrar por ${cfg.label} (${itemStat.count} operaciones)">
                <span class="method-count-badge">${itemStat.count}</span>
                <div class="method-icon-wrap">${cfg.iconSvg}</div>
                <span class="method-label">${cfg.label}</span>
                <div class="method-stats">
                    <span>$${itemStat.totalUSD.toFixed(2)}</span>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;

    if (summary) {
        const activeCfg = CASH_PAYMENT_METHODS_CONFIG.find(c => c.key === currentCashMethodFilter);
        const activeStat = stats[currentCashMethodFilter] || stats.todos;
        const label = activeCfg ? activeCfg.label : 'Todos';
        if (currentCashMethodFilter === 'todos') {
            summary.innerText = `Mostrando: Todas las transacciones (${activeStat.count} ventas · $${activeStat.totalUSD.toFixed(2)})`;
        } else {
            summary.innerText = `Mostrando: ${activeStat.count} venta${activeStat.count === 1 ? '' : 's'} con ${label} ($${activeStat.totalUSD.toFixed(2)} / Bs. ${activeStat.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
        }
    }
}

function setCashMethodFilter(methodKey) {
    if (currentCashMethodFilter === methodKey && methodKey !== 'todos') {
        currentCashMethodFilter = 'todos';
    } else {
        currentCashMethodFilter = methodKey;
    }
    renderCashView();
}

function switchCashTab(tab) {
    currentCashTab = tab;
    const tabSales = document.getElementById('tabCashSales');
    const tabAudit = document.getElementById('tabCashAudit');
    const boxSales = document.getElementById('cashSalesContainer');
    const boxAudit = document.getElementById('cashAuditContainer');
    const filterSection = document.getElementById('cashMethodFilterSection');
    const titleEl = document.getElementById('cashTableTitle');

    if (tab === 'sales') {
        if (tabSales) tabSales.classList.add('active');
        if (tabAudit) tabAudit.classList.remove('active');
        if (boxSales) boxSales.style.display = 'block';
        if (boxAudit) boxAudit.style.display = 'none';
        if (filterSection) filterSection.style.display = 'block';
        if (titleEl) titleEl.innerText = 'Ventas y Comprobantes del Turno Activo';
    } else {
        if (tabSales) tabSales.classList.remove('active');
        if (tabAudit) tabAudit.classList.add('active');
        if (boxSales) boxSales.style.display = 'none';
        if (boxAudit) boxAudit.style.display = 'block';
        if (filterSection) filterSection.style.display = 'none';
        if (titleEl) titleEl.innerText = 'Auditoría de Anulaciones y Cambios de Mercancía';
        renderCashAuditTable();
    }
}

function isPaymentNational(sale) {
    if (Array.isArray(sale.metodosPago) && sale.metodosPago.length > 0) {
        const first = sale.metodosPago[0];
        const m = String((typeof first === 'object' && first) ? (first.metodo || first.name || '') : first).toLowerCase();
        if (m.includes('punto') || m.includes('pago móvil') || m.includes('pago movil') || m.includes('biopago') || m.includes('patria') || m.includes('transferencia') || m.includes('bs') || m.includes('bolívares') || m.includes('bolivares')) {
            return true;
        }
        if (m.includes('usd') || m.includes('dólar') || m.includes('dolar') || m.includes('zelle') || m.includes('binance') || m.includes('$')) {
            return false;
        }
    }
    // Fallback por tipo de precio o descuento divisas
    if (sale.descuentoDivisas || sale.tipoPrecio === 'divisas') return false;
    return true;
}

function renderCashView() {
    const activeShift = NovaDB.getActiveShift();
    const allSales = NovaDB.getSales();
    const settings = NovaDB.getSettings() || { tasaBCV: 917.78, tasaInterna: 1050 };
    const bcvRate = parseFloat(settings.tasaBCV) || 917.78;

    const shiftSales = activeShift ? allSales.filter(s => activeShift.ventasIds && activeShift.ventasIds.includes(s.id)) : [];
    const activeSales = shiftSales.filter(s => !s.anulada);

    // 1. Clasificación: Ventas Moneda Nacional (Bolívares / BCV)
    const nacSales = activeSales.filter(s => isPaymentNational(s));
    let totalNacUSD = 0;
    let totalNacBs = 0;
    nacSales.forEach(s => {
        const u = parseFloat(s.totalUSD) || 0;
        const b = (parseFloat(s.totalBs) && !isNaN(s.totalBs)) ? parseFloat(s.totalBs) : (u * bcvRate);
        totalNacUSD += u;
        totalNacBs += b;
    });
    const countNac = nacSales.length;

    // 2. Clasificación: Ventas Facturadas en Divisas
    const divSales = activeSales.filter(s => !isPaymentNational(s));
    let totalDivUSD = 0;
    divSales.forEach(s => {
        totalDivUSD += (parseFloat(s.totalUSD) || 0);
    });
    const totalDivBs = totalDivUSD * bcvRate;
    const countDiv = divSales.length;

    // 3. Cálculo de Ganancia Neta en Productos (Precio Venta - Costo Reposición)
    let totalProfitUSD = 0;
    const inventory = NovaDB.getInventory();
    activeSales.forEach(s => {
        if (Array.isArray(s.items)) {
            s.items.forEach(it => {
                const qty = parseFloat(it.quantity) || 1;
                const salePrice = (it.priceUSD !== undefined && !isNaN(it.priceUSD))
                    ? parseFloat(it.priceUSD)
                    : ((it.subtotalUSD !== undefined) ? parseFloat(it.subtotalUSD) / qty : 0);

                let cost = (it.costoCompra !== undefined && it.costoCompra !== null && !isNaN(it.costoCompra))
                    ? parseFloat(it.costoCompra)
                    : 0;
                if (cost <= 0 && inventory && inventory[it.id] && inventory[it.id].costoCompra) {
                    cost = parseFloat(inventory[it.id].costoCompra) || 0;
                }
                const lineRev = (it.subtotalUSD !== undefined && !isNaN(it.subtotalUSD))
                    ? parseFloat(it.subtotalUSD)
                    : salePrice * qty;
                const lineCost = cost * qty;
                totalProfitUSD += (lineRev - lineCost);
            });
        }
    });
    const totalProfitBs = totalProfitUSD * bcvRate;

    // Actualización de KPIs en el DOM
    const kpiNacUSD = document.getElementById('cashKpiVentasNac');
    if (kpiNacUSD) kpiNacUSD.innerText = `$${totalNacUSD.toFixed(2)}`;
    const kpiNacBs = document.getElementById('cashKpiVentasNacBs');
    if (kpiNacBs) kpiNacBs.innerText = `Bs. ${totalNacBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const kpiNacCount = document.getElementById('cashKpiVentasNacCount');
    if (kpiNacCount) kpiNacCount.innerText = `${countNac} venta${countNac === 1 ? '' : 's'} (Bolívares / BCV)`;

    const kpiDivUSD = document.getElementById('cashKpiVentasDiv');
    if (kpiDivUSD) kpiDivUSD.innerText = `$${totalDivUSD.toFixed(2)}`;
    const kpiDivBs = document.getElementById('cashKpiVentasDivBs');
    if (kpiDivBs) kpiDivBs.innerText = `Bs. ${totalDivBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV)`;
    const kpiDivCount = document.getElementById('cashKpiVentasDivCount');
    if (kpiDivCount) kpiDivCount.innerText = `${countDiv} venta${countDiv === 1 ? '' : 's'} (Divisas)`;

    const kpiProfitUSD = document.getElementById('cashKpiGanancia');
    if (kpiProfitUSD) kpiProfitUSD.innerText = `$${totalProfitUSD.toFixed(2)}`;
    const kpiProfitBs = document.getElementById('cashKpiGananciaBs');
    if (kpiProfitBs) kpiProfitBs.innerText = `Bs. ${totalProfitBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Renderizar tarjetas interactivas de filtro por método de pago (SVG)
    renderCashMethodFilterCards(shiftSales);

    // Renderizar tabla de comprobantes del turno activo (con filtro de método aplicado)
    renderCashSalesTable(shiftSales);

    // Actualizar tabla de auditoría si está activa
    if (currentCashTab === 'audit') {
        renderCashAuditTable();
    }
}

function renderCashSalesTable(shiftSales) {
    const tbody = document.getElementById('cashSalesTableBody');
    if (!tbody) return;

    if (!shiftSales || shiftSales.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.6" style="margin-bottom:8px; opacity:0.4;"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                    <p style="font-weight: 700; font-size: 14px; margin-bottom: 3px; color: var(--text-main);">No hay ventas en este turno</p>
                    <p style="font-size: 12px; margin: 0;">Las facturas y notas de despacho emitidas en mostrador aparecerán aquí automáticamente.</p>
                </td>
            </tr>`;
        return;
    }

    const filteredSales = (currentCashMethodFilter === 'todos')
        ? shiftSales
        : shiftSales.filter(s => getSalePaymentMethodKey(s) === currentCashMethodFilter);

    if (filteredSales.length === 0) {
        const activeCfg = CASH_PAYMENT_METHODS_CONFIG.find(c => c.key === currentCashMethodFilter);
        const methodTitle = activeCfg ? activeCfg.label : currentCashMethodFilter;
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
                    <div style="width:40px; height:40px; border-radius:50%; background:#f1f5f9; color:#64748b; display:flex; align-items:center; justify-content:center; margin:0 auto 10px;">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <p style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: var(--text-main);">No hay ventas con "${methodTitle}" en este turno</p>
                    <p style="font-size: 12px; margin: 0 0 10px 0; color: var(--text-muted);">No se han registrado pagos bajo este método en el turno activo.</p>
                    <button type="button" class="header-action-btn btn-secondary-action" style="margin: 0 auto; padding: 4px 12px; font-size: 11.5px;" onclick="setCashMethodFilter('todos')">
                        Ver todas las transacciones
                    </button>
                </td>
            </tr>`;
        return;
    }

    let rowsHtml = '';
    filteredSales.forEach(s => {
        const isVoid = !!s.anulada;
        const custName = s.cliente?.nombre || 'Cliente Mostrador';
        const totalUSD = (typeof s.totalUSD === 'number') ? s.totalUSD.toFixed(2) : '0.00';
        const totalBs = (typeof s.totalBs === 'number') ? s.totalBs.toFixed(2) : '0.00';

        let payBadge = 'Divisas';
        let payBadgeStyle = 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;';
        if (Array.isArray(s.metodosPago) && s.metodosPago.length > 0) {
            const m = String(s.metodosPago[0].metodo || s.metodosPago[0] || '');
            payBadge = m;
            const b = s.banco || s.metodosPago[0].banco;
            if (b && b !== 'Caja Efectivo') {
                payBadge += ` (${b})`;
            }
            if (isPaymentNational(s)) {
                payBadgeStyle = 'background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;';
            }
        } else if (isPaymentNational(s)) {
            payBadge = 'Moneda Nacional';
            payBadgeStyle = 'background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;';
        }

        const statusHtml = isVoid
            ? `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:800; border:1px solid #fca5a5; font-size:11px;" title="Motivo: ${s.motivoAnulacion || 'Anulada'}">ANULADA</span>`
            : `<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:800; border:1px solid #bbf7d0; font-size:11px;">Cobrada</span>`;

        const actionsHtml = isVoid
            ? `<div style="display:flex; justify-content:flex-end; align-items:center; gap:6px;">
                 <span style="font-size:11px; color:#be123c; font-weight:700;">Reversada</span>
                 <button type="button" class="ticket-btn-sm" onclick="reprintSaleDirectly('${s.id}')" title="Ver comprobante anulado">Ver</button>
               </div>`
            : `<div style="display:flex; justify-content:flex-end; align-items:center; gap:6px;">
                 <button type="button" class="ticket-btn-sm" style="color:#b91c1c; border-color:#fca5a5; background:#fff1f2; font-weight:700;" onclick="openVoidSaleModal('${s.id}')" title="Anular esta factura y devolver inventario">Anular</button>
                 <button type="button" class="ticket-btn-sm" style="color:#0369a1; border-color:#bae6fd; background:#f0f9ff; font-weight:700;" onclick="openProductExchangeModal('${s.id}')" title="Registrar cambio de repuesto de esta factura">Cambio</button>
                 <button type="button" class="ticket-btn-sm" onclick="reprintSaleDirectly('${s.id}')" title="Imprimir o ver">Ver</button>
               </div>`;

        const textStyle = isVoid ? 'text-decoration: line-through; opacity: 0.65;' : '';

        rowsHtml += `
            <tr style="${isVoid ? 'background:#fffafa;' : ''}">
                <td style="padding: 7px 10px;"><span class="code-badge" style="font-weight:800; font-size:11px;">${s.id}</span></td>
                <td style="padding: 7px 10px; font-size:12px; color:var(--text-muted);">${s.horaStr || ''}</td>
                <td style="padding: 7px 10px; font-size:12px; font-weight:700; color:var(--text-main);"><span style="${textStyle}">${custName}</span></td>
                <td style="padding: 7px 10px;"><span style="font-size:11px; font-weight:700; padding:2px 7px; border-radius:4px; ${payBadgeStyle}">${payBadge}</span></td>
                <td style="padding: 7px 10px; font-weight:800; color:#0f172a; font-size:12.5px; ${textStyle}">$${totalUSD}</td>
                <td style="padding: 7px 10px; font-weight:700; color:#475569; font-size:12px; ${textStyle}">Bs. ${totalBs}</td>
                <td style="padding: 7px 10px;">${statusHtml}</td>
                <td style="padding: 7px 10px; text-align:right;">${actionsHtml}</td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml;
}

function renderCashAuditTable() {
    const tbody = document.getElementById('cashAuditTableBody');
    if (!tbody) return;

    const voidLogs = (typeof NovaDB !== 'undefined' && NovaDB.getVoidSales) ? NovaDB.getVoidSales() : [];
    const exchanges = (typeof NovaDB !== 'undefined' && NovaDB.getProductExchanges) ? NovaDB.getProductExchanges() : [];

    // Combinar y ordenar cronológicamente descendente
    const events = [];
    voidLogs.forEach(v => {
        events.push({
            type: 'ANULACION',
            timestamp: v.timestamp || 0,
            fechaHora: `${v.fechaStr || ''} ${v.horaStr || ''}`,
            docId: v.saleId || v.id,
            details: (v.items || []).map(it => `[${it.id}] ${it.name || ''} (x${it.quantity})`).join(', ') || 'Todos los ítems',
            montoStr: `-$${(v.totalUSD || 0).toFixed(2)} USD`,
            motivo: v.motivo || 'Anulación de venta',
            responsable: v.responsable || 'MASTER'
        });
    });

    exchanges.forEach(ex => {
        const ret = ex.returnedItem ? `Dev: [${ex.returnedItem.id}] x${ex.returnedItem.quantity || 1}` : '';
        const ent = ex.newItem ? `Ent: [${ex.newItem.id}] x${ex.newItem.quantity || 1}` : '';
        const diff = parseFloat(ex.diferenciaUSD) || 0;
        let diffStr = '$0.00 (Mano a mano)';
        if (diff > 0) diffStr = `+$${diff.toFixed(2)} (Cobrado)`;
        else if (diff < 0) diffStr = `-$${Math.abs(diff).toFixed(2)} (Reembolso)`;

        events.push({
            type: 'CAMBIO',
            timestamp: ex.timestamp || 0,
            fechaHora: `${ex.fechaStr || ''} ${ex.horaStr || ''}`,
            docId: ex.saleId || ex.id,
            details: `${ret} ➔ ${ent}`,
            montoStr: diffStr,
            motivo: ex.motivo || 'Cambio de repuesto',
            responsable: ex.responsable || 'MASTER'
        });
    });

    events.sort((a, b) => b.timestamp - a.timestamp);

    if (events.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.6" style="margin-bottom:8px; opacity:0.4;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                    <p style="font-weight: 700; font-size: 14px; margin-bottom: 3px; color: var(--text-main);">Sin anulaciones ni cambios registrados</p>
                    <p style="font-size: 12px; margin: 0;">Cuando anules una factura o efectúes un cambio de producto, el registro de auditoría aparecerá aquí con trazabilidad completa.</p>
                </td>
            </tr>`;
        return;
    }

    let rowsHtml = '';
    events.forEach(ev => {
        const isVoid = (ev.type === 'ANULACION');
        const badgeStyle = isVoid
            ? 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;'
            : 'background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;';
        const label = isVoid ? 'Anulación Total' : 'Cambio de Repuesto';

        rowsHtml += `
            <tr>
                <td style="padding: 7px 10px; font-size:11.5px; white-space:nowrap; color:#475569;">${ev.fechaHora}</td>
                <td style="padding: 7px 10px;"><span style="font-size:10.5px; font-weight:800; padding:2px 7px; border-radius:4px; ${badgeStyle}">${label}</span></td>
                <td style="padding: 7px 10px;"><span class="code-badge" style="font-weight:800; font-size:11px;">${ev.docId}</span></td>
                <td style="padding: 7px 10px; font-size:12px; color:#1e293b; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${ev.details}">${ev.details}</td>
                <td style="padding: 7px 10px; font-weight:800; font-size:12px; color:${isVoid ? '#dc2626' : '#0369a1'};">${ev.montoStr}</td>
                <td style="padding: 7px 10px; font-size:12px; color:#475569;">${ev.motivo}</td>
                <td style="padding: 7px 10px; font-size:11.5px; font-weight:700; color:#0f172a;">${ev.responsable}</td>
            </tr>`;
    });

    tbody.innerHTML = rowsHtml;
}

// ------------------------------------------------------------------------------
// MODAL: ANULACIÓN DE FACTURA / COMPROBANTE
// ------------------------------------------------------------------------------
function openVoidSaleModal(preselectedSaleId = null) {
    const allSales = (typeof NovaDB !== 'undefined' && NovaDB.getSales) ? NovaDB.getSales() : [];
    const select = document.getElementById('voidSaleSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Selecciona una factura o comprobante emitido --</option>';

    // Solo comprobantes NO presupuestos que no estén ya anulados
    const validSales = allSales.filter(s => s.tipoDocumento !== 'presupuesto' && !s.anulada);

    if (validSales.length === 0) {
        select.innerHTML = '<option value="">No hay facturas activas disponibles para anular</option>';
    } else {
        validSales.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.id} - ${s.cliente?.nombre || 'Cliente'} ($${(s.totalUSD || 0).toFixed(2)} USD) - ${s.fechaStr || ''}`;
            select.appendChild(opt);
        });
    }

    const detailsBox = document.getElementById('voidSaleDetailsBox');
    if (detailsBox) detailsBox.style.display = 'none';

    const reasonInput = document.getElementById('voidSaleReason');
    if (reasonInput) reasonInput.value = '';

    const respInput = document.getElementById('voidSaleResponsible');
    if (respInput) {
        const curUser = (typeof NovaUsers !== 'undefined' && NovaUsers.getCurrentUser) ? NovaUsers.getCurrentUser() : null;
        respInput.value = (curUser && curUser.name) ? curUser.name : 'MASTER';
    }

    if (preselectedSaleId) {
        select.value = preselectedSaleId;
        onVoidSaleSelected(preselectedSaleId);
    }

    openModal('voidSaleModal');
}

function onVoidSaleSelected(saleId) {
    const detailsBox = document.getElementById('voidSaleDetailsBox');
    if (!saleId) {
        if (detailsBox) detailsBox.style.display = 'none';
        return;
    }

    const allSales = NovaDB.getSales();
    const sale = allSales.find(s => s.id === saleId);
    if (!sale) return;

    if (detailsBox) detailsBox.style.display = 'block';

    const custName = document.getElementById('voidSaleCustName');
    if (custName) custName.innerText = sale.cliente?.nombre || 'Cliente Mostrador';
    const custRif = document.getElementById('voidSaleCustRif');
    if (custRif) custRif.innerText = sale.cliente?.rif || 'V-00000000';
    const dateEl = document.getElementById('voidSaleDate');
    if (dateEl) dateEl.innerText = `${sale.fechaStr || ''} ${sale.horaStr || ''}`;
    const totalEl = document.getElementById('voidSaleTotal');
    if (totalEl) totalEl.innerText = `$${(sale.totalUSD || 0).toFixed(2)} (Bs. ${(sale.totalBs || 0).toFixed(2)})`;

    const itemsTbody = document.getElementById('voidSaleItemsList');
    if (itemsTbody) {
        let itHtml = '';
        (sale.items || []).forEach(it => {
            const qty = it.quantity || 1;
            const price = (typeof it.priceUSD === 'number') ? it.priceUSD : ((it.subtotalUSD || 0) / qty);
            const sub = it.subtotalUSD || (price * qty);
            itHtml += `
                <tr>
                    <td style="padding:5px 8px;"><span class="code-badge" style="font-size:10.5px;">${it.id}</span></td>
                    <td style="padding:5px 8px; font-weight:600; color:#0f172a;">${it.name || it.id}</td>
                    <td style="padding:5px 8px; text-align:center;"><b style="color:#16a34a;">+${qty}</b></td>
                    <td style="padding:5px 8px; text-align:right;">$${price.toFixed(2)}</td>
                    <td style="padding:5px 8px; text-align:right; font-weight:700;">$${sub.toFixed(2)}</td>
                </tr>`;
        });
        itemsTbody.innerHTML = itHtml;
    }
}

function submitVoidSale() {
    const saleId = document.getElementById('voidSaleSelect')?.value;
    if (!saleId) {
        showNovaAlert({ title: "Selecciona una Factura", message: "Debe seleccionar la factura o comprobante que desea anular.", type: "warning" });
        return;
    }

    const reason = document.getElementById('voidSaleReason')?.value.trim();
    if (!reason) {
        showNovaAlert({ title: "Motivo Requerido", message: "Por favor indique el motivo o justificativo de la anulación para los registros de auditoría.", type: "warning" });
        return;
    }

    const resp = document.getElementById('voidSaleResponsible')?.value.trim() || 'MASTER';

    const res = NovaDB.voidSale(saleId, reason, resp);
    if (!res.success) {
        showNovaAlert({ title: "Error al Anular", message: res.message, type: "error" });
        return;
    }

    closeModal('voidSaleModal');
    renderCashView();

    // Actualizar vista de inventario y catálogo para reflejar reposición de existencias
    if (typeof renderInventoryView === 'function') renderInventoryView();
    if (typeof renderPOSCatalog === 'function') renderPOSCatalog();

    showNovaAlert({
        title: "¡Factura Anulada con Éxito!",
        message: `El comprobante <b>${saleId}</b> ha sido anulado. Las existencias de sus repuestos fueron restituidas al catálogo y los montos descontados de la caja.`,
        type: "success"
    });
}

// ------------------------------------------------------------------------------
// MODAL: REGISTRO DE CAMBIO DE PRODUCTO / REPUESTO
// ------------------------------------------------------------------------------
let currentExchangeNewProduct = null;

function openProductExchangeModal(preselectedSaleId = null) {
    const allSales = (typeof NovaDB !== 'undefined' && NovaDB.getSales) ? NovaDB.getSales() : [];
    const select = document.getElementById('exchangeSaleSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Cambio libre de mostrador / Sin comprobante previo --</option>';
    allSales.filter(s => !s.anulada && s.tipoDocumento !== 'presupuesto').forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.id} - ${s.cliente?.nombre || 'Cliente'} ($${(s.totalUSD || 0).toFixed(2)}) - ${s.fechaStr || ''}`;
        select.appendChild(opt);
    });

    if (preselectedSaleId) {
        select.value = preselectedSaleId;
    }

    onExchangeSaleSelected(select.value);

    // Resetear producto nuevo
    currentExchangeNewProduct = null;
    const searchInput = document.getElementById('exchangeNewSearchInput');
    if (searchInput) searchInput.value = '';
    const selBox = document.getElementById('exchangeNewProductSelectedBox');
    if (selBox) selBox.style.display = 'none';
    const newQty = document.getElementById('exchangeNewQty');
    if (newQty) newQty.value = '1';
    const newPrice = document.getElementById('exchangeNewPrice');
    if (newPrice) newPrice.value = '';

    const reasonInput = document.getElementById('exchangeReason');
    if (reasonInput) reasonInput.value = '';
    const respInput = document.getElementById('exchangeResponsible');
    if (respInput) {
        const curUser = (typeof NovaUsers !== 'undefined' && NovaUsers.getCurrentUser) ? NovaUsers.getCurrentUser() : null;
        respInput.value = (curUser && curUser.name) ? curUser.name : 'MASTER';
    }

    updateExchangePreview();
    openModal('exchangeProductModal');
}

function onExchangeSaleSelected(saleId) {
    const retSelect = document.getElementById('exchangeReturnedSelect');
    if (!retSelect) return;

    retSelect.innerHTML = '<option value="">-- Selecciona repuesto --</option>';

    if (saleId) {
        const allSales = NovaDB.getSales();
        const sale = allSales.find(s => s.id === saleId);
        if (sale && Array.isArray(sale.items) && sale.items.length > 0) {
            sale.items.forEach(it => {
                const opt = document.createElement('option');
                opt.value = it.id;
                const price = (typeof it.priceUSD === 'number') ? it.priceUSD : ((it.subtotalUSD || 0) / (it.quantity || 1));
                opt.textContent = `[${it.id}] ${it.name} ($${price.toFixed(2)})`;
                opt.dataset.price = price;
                opt.dataset.maxQty = it.quantity || 1;
                retSelect.appendChild(opt);
            });
            retSelect.selectedIndex = 1;
            onExchangeReturnedProductChange();
            return;
        }
    }

    // Si no hay venta seleccionada o es cambio libre, poblar desde catálogo
    const inv = NovaDB.getInventory();
    Object.keys(inv).slice(0, 80).forEach(key => {
        const p = inv[key];
        const opt = document.createElement('option');
        opt.value = p.id;
        const price = p.precioFinalUSD || p.price || 0;
        opt.textContent = `[${p.id}] ${p.name} ($${price.toFixed(2)})`;
        opt.dataset.price = price;
        opt.dataset.maxQty = 999;
        retSelect.appendChild(opt);
    });
    onExchangeReturnedProductChange();
}

function onExchangeReturnedProductChange() {
    const retSelect = document.getElementById('exchangeReturnedSelect');
    const selectedOpt = retSelect?.options[retSelect.selectedIndex];
    const priceInput = document.getElementById('exchangeReturnedPrice');
    const qtyInput = document.getElementById('exchangeReturnedQty');

    if (selectedOpt && selectedOpt.dataset.price) {
        if (priceInput) priceInput.value = parseFloat(selectedOpt.dataset.price).toFixed(2);
    }
    if (qtyInput && (!qtyInput.value || parseInt(qtyInput.value) <= 0)) {
        qtyInput.value = 1;
    }
    updateExchangePreview();
}

function onExchangeNewProductSearch(query) {
    const resultsContainer = document.getElementById('exchangeNewSearchResults');
    if (!resultsContainer) return;

    const term = (query || '').toLowerCase().trim();
    if (!term) {
        resultsContainer.style.display = 'none';
        return;
    }

    const inv = NovaDB.getInventory();
    const settings = NovaDB.getSettings() || { tasaBCV: 917.78, tasaInterna: 1050 };

    const matches = [];
    Object.keys(inv).forEach(key => {
        const p = inv[key];
        const idMatch = (p.id || '').toLowerCase().includes(term);
        const nameMatch = (p.name || '').toLowerCase().includes(term);
        if (idMatch || nameMatch) {
            matches.push(p);
        }
    });

    if (matches.length === 0) {
        resultsContainer.innerHTML = '<div style="padding:10px 12px; font-size:12px; color:var(--text-muted);">No se encontraron repuestos con ese código o nombre.</div>';
        resultsContainer.style.display = 'block';
        return;
    }

    let html = '';
    matches.slice(0, 10).forEach(p => {
        const stock = parseInt(p.stock) || 0;
        const prices = calcularPreciosSegunAjustes(p.costoCompra, settings, p.porcentajeUtilidad, p.iva);
        const priceUSD = prices.publicoUSD;
        html += `
            <div style="padding:8px 12px; border-bottom:1px solid #f1f5f9; cursor:pointer; display:flex; justify-content:space-between; align-items:center;"
                 onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'"
                 onclick="selectExchangeNewProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${priceUSD}, ${stock})">
                <div>
                    <span class="code-badge" style="font-size:10.5px;">${p.id}</span>
                    <b style="font-size:12px; margin-left:6px; color:#0f172a;">${p.name}</b>
                    <span style="display:block; font-size:10.5px; color:#64748b;">Stock disponible: <b>${stock}</b> unid(s)</span>
                </div>
                <div style="text-align:right;">
                    <b style="color:#15803d; font-size:13px;">$${priceUSD.toFixed(2)}</b>
                </div>
            </div>`;
    });

    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
}

function selectExchangeNewProduct(id, name, price, stock) {
    currentExchangeNewProduct = { id, name, price, stock };

    const resultsContainer = document.getElementById('exchangeNewSearchResults');
    if (resultsContainer) resultsContainer.style.display = 'none';

    const searchInput = document.getElementById('exchangeNewSearchInput');
    if (searchInput) searchInput.value = `[${id}] ${name}`;

    const selBox = document.getElementById('exchangeNewProductSelectedBox');
    if (selBox) selBox.style.display = 'block';

    const selName = document.getElementById('exchangeNewSelectedName');
    if (selName) selName.innerText = `[${id}] ${name}`;

    const selStock = document.getElementById('exchangeNewSelectedStock');
    if (selStock) selStock.innerHTML = `Stock disponible: <b>${stock}</b> unidades`;

    const priceInput = document.getElementById('exchangeNewPrice');
    if (priceInput) priceInput.value = parseFloat(price).toFixed(2);

    updateExchangePreview();
}

function updateExchangePreview() {
    const retQty = parseInt(document.getElementById('exchangeReturnedQty')?.value) || 0;
    const retPrice = parseFloat(document.getElementById('exchangeReturnedPrice')?.value) || 0;
    const retTotal = retQty * retPrice;

    const retTotalDisplay = document.getElementById('exchangeReturnedTotalDisplay');
    if (retTotalDisplay) retTotalDisplay.innerText = `$${retTotal.toFixed(2)}`;

    const newQty = parseInt(document.getElementById('exchangeNewQty')?.value) || 0;
    const newPrice = parseFloat(document.getElementById('exchangeNewPrice')?.value) || 0;
    const newTotal = newQty * newPrice;

    const newTotalDisplay = document.getElementById('exchangeNewTotalDisplay');
    if (newTotalDisplay) newTotalDisplay.innerText = `$${newTotal.toFixed(2)}`;

    const diff = newTotal - retTotal;
    const settings = NovaDB.getSettings() || { tasaBCV: 917.78 };
    const bcvRate = parseFloat(settings.tasaBCV) || 917.78;
    const diffBs = Math.abs(diff) * bcvRate;

    const diffLabel = document.getElementById('exchangeDiffLabel');
    const diffUSD = document.getElementById('exchangeDiffAmountUSD');
    const diffBsEl = document.getElementById('exchangeDiffAmountBs');
    const diffBox = document.getElementById('exchangeDiffBox');

    if (Math.abs(diff) < 0.005) {
        if (diffLabel) diffLabel.innerText = 'Cambio exacto mano a mano ($0.00)';
        if (diffUSD) { diffUSD.innerText = '$0.00 USD'; diffUSD.style.color = '#0f172a'; }
        if (diffBsEl) diffBsEl.innerText = 'Sin diferencia económica';
        if (diffBox) { diffBox.style.borderColor = '#cbd5e1'; diffBox.style.background = '#f8fafc'; }
    } else if (diff > 0) {
        if (diffLabel) diffLabel.innerHTML = '<span style="color:#15803d;">Saldo a Cobrar al Cliente (Producto de mayor valor):</span>';
        if (diffUSD) { diffUSD.innerText = `+$${diff.toFixed(2)} USD`; diffUSD.style.color = '#15803d'; }
        if (diffBsEl) diffBsEl.innerText = `Equiv: Bs. ${diffBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (diffBox) { diffBox.style.borderColor = '#86efac'; diffBox.style.background = '#f0fdf4'; }
    } else {
        const absDiff = Math.abs(diff);
        if (diffLabel) diffLabel.innerHTML = '<span style="color:#ea580c;">Saldo a Favor del Cliente / Reembolso (Producto de menor valor):</span>';
        if (diffUSD) { diffUSD.innerText = `-$${absDiff.toFixed(2)} USD`; diffUSD.style.color = '#c2410c'; }
        if (diffBsEl) diffBsEl.innerText = `Equiv: Bs. ${diffBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (diffBox) { diffBox.style.borderColor = '#fed7aa'; diffBox.style.background = '#fff7ed'; }
    }
}

function submitProductExchange() {
    const saleId = document.getElementById('exchangeSaleSelect')?.value || null;
    const retSelect = document.getElementById('exchangeReturnedSelect');
    const returnedItemId = retSelect?.value;
    const returnedQty = parseInt(document.getElementById('exchangeReturnedQty')?.value) || 0;
    const returnedPrice = parseFloat(document.getElementById('exchangeReturnedPrice')?.value) || 0;

    if (!returnedItemId || returnedQty <= 0) {
        showNovaAlert({ title: "Repuesto Devuelto Incompleto", message: "Seleccione el repuesto devuelto por el cliente y la cantidad.", type: "warning" });
        return;
    }

    if (!currentExchangeNewProduct || !currentExchangeNewProduct.id) {
        showNovaAlert({ title: "Repuesto Entregado Requerido", message: "Busque y seleccione el nuevo repuesto que se entregará al cliente.", type: "warning" });
        return;
    }

    const newItemId = currentExchangeNewProduct.id;
    const newQty = parseInt(document.getElementById('exchangeNewQty')?.value) || 0;
    const newPrice = parseFloat(document.getElementById('exchangeNewPrice')?.value) || 0;

    if (newQty <= 0) {
        showNovaAlert({ title: "Cantidad Inválida", message: "Indique la cantidad del repuesto nuevo a entregar.", type: "warning" });
        return;
    }

    // Validar stock disponible
    const availStock = NovaDB.getStock(newItemId);
    if (newQty > availStock) {
        showNovaAlert({ title: "Stock Insuficiente", message: `No hay suficiente existencia en inventario para entregar ${newQty} unidad(es) de ${newItemId}. Stock actual: ${availStock}.`, type: "warning" });
        return;
    }

    const reason = document.getElementById('exchangeReason')?.value.trim();
    if (!reason) {
        showNovaAlert({ title: "Motivo Requerido", message: "Indique el motivo del cambio para el registro de auditoría.", type: "warning" });
        return;
    }

    const resp = document.getElementById('exchangeResponsible')?.value.trim() || 'MASTER';

    const diffUSD = (newQty * newPrice) - (returnedQty * returnedPrice);
    const settings = NovaDB.getSettings() || { tasaBCV: 917.78 };
    const diffBs = diffUSD * (parseFloat(settings.tasaBCV) || 917.78);

    const res = NovaDB.registerProductExchange({
        saleId,
        returnedItemId,
        returnedQty,
        newItemId,
        newQty,
        motivo: reason,
        responsable: resp,
        diferenciaUSD: diffUSD,
        diferenciaBs: diffBs
    });

    if (!res.success) {
        showNovaAlert({ title: "Error en el Cambio", message: res.message, type: "error" });
        return;
    }

    closeModal('exchangeProductModal');
    renderCashView();

    // Actualizar vistas si están abiertas
    if (typeof renderInventoryView === 'function') renderInventoryView();
    if (typeof renderPOSCatalog === 'function') renderPOSCatalog();

    showNovaAlert({
        title: "¡Cambio de Producto Registrado!",
        message: `Se registró el cambio con éxito. Se reingresaron <b>${returnedQty}</b> unids de [${returnedItemId}] y se descontaron <b>${newQty}</b> unids de [${newItemId}].`,
        type: "success"
    });
}

// Stubs para compatibilidad de gastos / egresos
function openAddExpenseModal() {
    openModal('addExpenseModal');
}

function submitNewExpense() {
    const concepto = document.getElementById('expConcepto')?.value.trim();
    const categoria = document.getElementById('expCategoria')?.value;
    const monto = parseFloat(document.getElementById('expMonto')?.value) || 0;
    const metodo = document.getElementById('expMetodo')?.value || 'Efectivo USD';

    if (!concepto || monto <= 0) {
        showNovaAlert({ title: "Datos Incompletos", message: "Ingrese el concepto y un monto válido para el gasto.", type: "warning" });
        return;
    }

    NovaDB.addExpense({ concepto, categoria, montoUSD: monto, metodoPago: metodo });
    closeModal('addExpenseModal');
    renderCashView();
    showNovaAlert({ title: "Egreso Registrado", message: `Se registró el egreso con éxito.`, type: "success" });
}

function openCashReconciliationModal() {
    const active = NovaDB.getActiveShift();
    if (!active) return;

    const settings = NovaDB.getSettings() || { tasaBCV: 917.78 };
    const bcvRate = parseFloat(settings.tasaBCV) || 917.78;

    const sales = NovaDB.getSales().filter(s => active.ventasIds && active.ventasIds.includes(s.id) && !s.anulada && s.tipoDocumento !== 'presupuesto');
    
    let totalUSD = 0;
    let totalBs = 0;
    const bankTotals = {};

    sales.forEach(s => {
        const u = parseFloat(s.totalUSD) || 0;
        const b = (parseFloat(s.totalBs) && !isNaN(s.totalBs)) ? parseFloat(s.totalBs) : (u * bcvRate);
        totalUSD += u;
        totalBs += b;

        let bankName = s.banco;
        if (!bankName && Array.isArray(s.metodosPago) && s.metodosPago.length > 0 && s.metodosPago[0].banco) {
            bankName = s.metodosPago[0].banco;
        }
        if (!bankName) {
            const m = (Array.isArray(s.metodosPago) && s.metodosPago[0] && s.metodosPago[0].metodo) || '';
            bankName = m.toLowerCase().includes('efectivo') ? 'Caja Efectivo' : 'Otros Bancos';
        }

        if (!bankTotals[bankName]) {
            bankTotals[bankName] = { count: 0, totalBs: 0, totalUSD: 0 };
        }
        bankTotals[bankName].count += 1;
        bankTotals[bankName].totalBs += b;
        bankTotals[bankName].totalUSD += u;
    });

    window._currentShiftBankTotals = bankTotals;

    const recUSD = document.getElementById('recExpectedUSD');
    const recBs = document.getElementById('recExpectedBs');
    if (recUSD) recUSD.innerText = `$${totalUSD.toFixed(2)}`;
    if (recBs) recBs.innerText = `Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const bankContainer = document.getElementById('recBankBreakdownContainer');
    if (bankContainer) {
        const bankKeys = Object.keys(bankTotals);
        if (bankKeys.length === 0) {
            bankContainer.innerHTML = `
                <div style="padding:16px; text-align:center; color:var(--text-muted); font-size:12px;">
                    No se han registrado cobranzas con bancos en este turno aún.
                </div>`;
        } else {
            let tableHtml = `
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead>
                        <tr style="background:#f8fafc; border-bottom:1px solid var(--border-color); color:var(--text-muted); text-align:left;">
                            <th style="padding:8px 12px; font-weight:700;">Banco Emisor</th>
                            <th style="padding:8px 12px; text-align:center; font-weight:700;">Operaciones</th>
                            <th style="padding:8px 12px; text-align:right; font-weight:700;">Total Bolívares (Bs)</th>
                            <th style="padding:8px 12px; text-align:right; font-weight:700;">Equivalente ($ USD)</th>
                        </tr>
                    </thead>
                    <tbody>`;
            bankKeys.forEach(bank => {
                const bData = bankTotals[bank];
                const isCash = bank.toLowerCase().includes('caja');
                const badgeBg = isCash ? '#f1f5f9' : '#eff6ff';
                const badgeColor = isCash ? '#475569' : '#1d4ed8';
                tableHtml += `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:8px 12px; font-weight:700;">
                            <span style="display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; background:${badgeBg}; color:${badgeColor}; font-weight:800;">
                                ${bank}
                            </span>
                        </td>
                        <td style="padding:8px 12px; text-align:center; color:var(--text-muted);">${bData.count} trans.</td>
                        <td style="padding:8px 12px; text-align:right; font-weight:700; color:var(--text-main);">Bs. ${bData.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding:8px 12px; text-align:right; font-weight:800; color:var(--primary);">$${bData.totalUSD.toFixed(2)}</td>
                    </tr>`;
            });
            tableHtml += `
                    </tbody>
                    <tfoot>
                        <tr style="background:#f8fafc; border-top:2px solid var(--border-color); font-weight:800;">
                            <td style="padding:8px 12px;" colspan="2">TOTAL CONCILIADO POR BANCO EMISOR</td>
                            <td style="padding:8px 12px; text-align:right; color:var(--text-main);">Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td style="padding:8px 12px; text-align:right; color:var(--primary);">$${totalUSD.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>`;
            bankContainer.innerHTML = tableHtml;
        }
    }

    // Limpiar campos de conteo para nuevo arqueo
    const inputUSD = document.getElementById('recCountedUSD');
    const inputBs = document.getElementById('recCountedBs');
    if (inputUSD) inputUSD.value = '';
    if (inputBs) inputBs.value = '';

    openModal('reconciliationModal');
}

function submitCashReconciliation() {
    const countedUSD = parseFloat(document.getElementById('recCountedUSD')?.value) || 0;
    const countedBs = parseFloat(document.getElementById('recCountedBs')?.value) || 0;
    const nextUSD = parseFloat(document.getElementById('recNextShiftUSD')?.value) || 50;

    const closedShift = NovaDB.closeActiveShift({
        conteoFisicoUSD: countedUSD,
        conteoFisicoBs: countedBs,
        montoInicialSiguienteUSD: nextUSD,
        totalesPorBanco: window._currentShiftBankTotals || {}
    });

    closeModal('reconciliationModal');
    renderCashView();

    if (closedShift) {
        window._lastClosedShift = closedShift;
        openClosedShiftSuccessModal(closedShift);
    } else {
        showNovaAlert({
            title: "¡Arqueo Completado!",
            message: "El turno ha sido cerrado con conciliación bancaria y se ha abierto automáticamente el nuevo ciclo de caja.",
            type: "success"
        });
    }
}

function formatDateTimeSafe(d) {
    if (!d) return '-';
    try {
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return String(d);
        return dateObj.toLocaleDateString('es-VE') + ' ' + dateObj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
        return String(d);
    }
}

function getShiftClosingReportData(shiftOrId) {
    let shift = null;
    const allShifts = (typeof NovaDB !== 'undefined' && NovaDB.getCashShifts) ? NovaDB.getCashShifts() : [];

    if (!shiftOrId || shiftOrId === 'active') {
        shift = (typeof NovaDB !== 'undefined' && NovaDB.getActiveShift) ? NovaDB.getActiveShift() : null;
    } else if (typeof shiftOrId === 'string') {
        shift = allShifts.find(s => s.id === shiftOrId) || null;
    } else if (typeof shiftOrId === 'object' && shiftOrId !== null) {
        shift = shiftOrId;
    }

    if (!shift) {
        shift = allShifts[0] || null;
    }

    if (!shift) return null;

    const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : { tasaBCV: 917.78 };
    const bcvRate = parseFloat(settings.tasaBCV) || 917.78;

    const allSales = (typeof NovaDB !== 'undefined' && NovaDB.getSales) ? NovaDB.getSales() : [];
    const sales = allSales.filter(s => shift.ventasIds && shift.ventasIds.includes(s.id));
    const activeSales = sales.filter(s => !s.anulada && s.tipoDocumento !== 'presupuesto');

    const methodTotals = {
        'Efectivo USD': { label: 'Efectivo USD ($)', count: 0, totalUSD: 0, totalBs: 0 },
        'Efectivo Bs': { label: 'Efectivo Bolívares (Bs)', count: 0, totalUSD: 0, totalBs: 0 },
        'Pago Móvil': { label: 'Pago Móvil (Bs)', count: 0, totalUSD: 0, totalBs: 0 },
        'Punto de Venta': { label: 'Punto de Venta / Débito', count: 0, totalUSD: 0, totalBs: 0 },
        'Biopago': { label: 'Biopago (Patria / BDV)', count: 0, totalUSD: 0, totalBs: 0 },
        'Transferencia': { label: 'Transferencia Bancaria', count: 0, totalUSD: 0, totalBs: 0 },
        'Zelle': { label: 'Zelle ($)', count: 0, totalUSD: 0, totalBs: 0 },
        'Binance': { label: 'Binance Pay ($)', count: 0, totalUSD: 0, totalBs: 0 }
    };

    let totalCobradoUSD = 0;
    let totalCobradoBs = 0;
    const bankTotals = {};

    activeSales.forEach(s => {
        const u = parseFloat(s.totalUSD) || 0;
        const b = (parseFloat(s.totalBs) && !isNaN(s.totalBs)) ? parseFloat(s.totalBs) : (u * bcvRate);
        totalCobradoUSD += u;
        totalCobradoBs += b;

        let bankName = s.banco;
        if (!bankName && Array.isArray(s.metodosPago) && s.metodosPago.length > 0 && s.metodosPago[0].banco) {
            bankName = s.metodosPago[0].banco;
        }
        if (!bankName) {
            const m = (Array.isArray(s.metodosPago) && s.metodosPago[0] && s.metodosPago[0].metodo) || '';
            bankName = (m.toLowerCase().includes('efectivo')) ? 'Caja Efectivo' : 'Otros Bancos';
        }
        if (!bankTotals[bankName]) {
            bankTotals[bankName] = { count: 0, totalBs: 0, totalUSD: 0 };
        }
        bankTotals[bankName].count += 1;
        bankTotals[bankName].totalBs += b;
        bankTotals[bankName].totalUSD += u;

        const mKey = getSalePaymentMethodKey(s);
        let targetKey = 'Efectivo USD';
        if (mKey === 'efectivo_bs') targetKey = 'Efectivo Bs';
        else if (mKey === 'pago_movil') targetKey = 'Pago Móvil';
        else if (mKey === 'punto_venta') targetKey = 'Punto de Venta';
        else if (mKey === 'biopago') targetKey = 'Biopago';
        else if (mKey === 'transferencia') targetKey = 'Transferencia';
        else if (mKey === 'zelle') targetKey = 'Zelle';
        else if (mKey === 'binance') targetKey = 'Binance';

        if (methodTotals[targetKey]) {
            methodTotals[targetKey].count += 1;
            methodTotals[targetKey].totalUSD += u;
            methodTotals[targetKey].totalBs += b;
        }
    });

    if (shift.totalesPorBanco && Object.keys(shift.totalesPorBanco).length > 0) {
        Object.keys(shift.totalesPorBanco).forEach(k => {
            if (!bankTotals[k]) {
                bankTotals[k] = shift.totalesPorBanco[k];
            }
        });
    }

    const modalInpUSD = document.getElementById('recCountedUSD');
    const modalInpBs = document.getElementById('recCountedBs');
    const modalNextUSD = document.getElementById('recNextShiftUSD');

    let conteoFisicoUSD = 0;
    let conteoFisicoBs = 0;
    let montoInicialSiguienteUSD = 50;

    if (shift.arqueoFisico) {
        conteoFisicoUSD = parseFloat(shift.arqueoFisico.conteoFisicoUSD) || 0;
        conteoFisicoBs = parseFloat(shift.arqueoFisico.conteoFisicoBs) || 0;
        montoInicialSiguienteUSD = parseFloat(shift.arqueoFisico.montoInicialSiguienteUSD) || 50;
    } else if (modalInpUSD && modalInpUSD.value !== '') {
        conteoFisicoUSD = parseFloat(modalInpUSD.value) || 0;
        conteoFisicoBs = parseFloat(modalInpBs?.value) || 0;
        montoInicialSiguienteUSD = parseFloat(modalNextUSD?.value) || 50;
    }

    return {
        shift,
        sales,
        activeSales,
        methodTotals,
        bankTotals,
        summary: {
            totalCobradoUSD,
            totalCobradoBs,
            totalVentasCount: activeSales.length,
            conteoFisicoUSD,
            conteoFisicoBs,
            montoInicialSiguienteUSD
        },
        settings
    };
}

function downloadShiftClosingExcel(shiftOrId) {
    const data = getShiftClosingReportData(shiftOrId);
    if (!data) {
        showNovaAlert({ title: "Error", message: "No se encontraron datos del turno solicitado para exportar a Excel.", type: "danger" });
        return;
    }

    const { shift, sales, methodTotals, bankTotals, summary, settings } = data;
    const colCount = 8;

    const excelDoc = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Corte_Z_${shift.id}</x:Name>
                            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
                body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; }
                table { border-collapse: collapse; width: 100%; }
                th { background-color: #003366; color: #ffffff; font-weight: bold; padding: 6px 10px; border: 0.5pt solid #cbd5e1; }
                td { padding: 5px 10px; border: 0.5pt solid #cbd5e1; font-size: 10pt; }
                .title-row { font-size: 15pt; font-weight: bold; color: #003366; text-align: center; }
                .section-header { background-color: #e2e8f0; font-weight: bold; font-size: 11pt; color: #003366; }
                .num-usd { mso-number-format: "\\$#,##0.00"; text-align: right; }
                .num-bs { mso-number-format: "#,##0.00"; text-align: right; }
            </style>
        </head>
        <body>
            <table>
                <tr><td colspan="${colCount}" class="title-row">NOVA REFRIMOTORS C.A.</td></tr>
                <tr><td colspan="${colCount}" style="text-align:center; font-size:10pt; color:#475569;">RIF: J-504401994 | Galpón al lado del Estacionamiento Centro Clínico, Av. Carabobo, Cabimas, Zulia</td></tr>
                <tr><td colspan="${colCount}" style="text-align:center; font-size:12pt; font-weight:bold; color:#0f172a; padding:6px 0;">COMPROBANTE DE CIERRE DE CAJA Y ARQUEO DIARIO (CORTE Z)</td></tr>
                <tr><td colspan="${colCount}" style="height:10px;"></td></tr>

                <tr style="background:#f8fafc;">
                    <td colspan="2"><b>N° de Turno / Corte Z:</b> ${shift.id}</td>
                    <td colspan="2"><b>Estado:</b> ${shift.estado === 'cerrada' ? 'CERRADA (CORTE Z)' : 'TURNO ACTIVO (CORTE X)'}</td>
                    <td colspan="2"><b>Cajero(a):</b> ${shift.usuario || 'MASTER'}</td>
                    <td colspan="2"><b>Tasa Oficial BCV:</b> Bs. ${settings.tasaBCV}</td>
                </tr>
                <tr style="background:#f8fafc;">
                    <td colspan="4"><b>Fecha/Hora Apertura:</b> ${formatDateTimeSafe(shift.fechaApertura)}</td>
                    <td colspan="4"><b>Fecha/Hora Cierre:</b> ${formatDateTimeSafe(shift.fechaCierre || new Date().toISOString())}</td>
                </tr>
                <tr><td colspan="${colCount}" style="height:12px;"></td></tr>

                <tr><td colspan="${colCount}" class="section-header">1. RESUMEN FINANCIERO Y CUADRE DE GAVETA (ARQUEO FÍSICO)</td></tr>
                <tr style="background:#f1f5f9; font-weight:bold;">
                    <td colspan="2">Concepto</td>
                    <td colspan="2" style="text-align:right;">Monto ($ USD)</td>
                    <td colspan="2" style="text-align:right;">Monto (Bs.)</td>
                    <td colspan="2">Auditoría / Estado</td>
                </tr>
                <tr>
                    <td colspan="2">Total Cobrado en Turno (Sistema)</td>
                    <td colspan="2" class="num-usd">$${summary.totalCobradoUSD.toFixed(2)}</td>
                    <td colspan="2" class="num-bs">Bs. ${summary.totalCobradoBs.toFixed(2)}</td>
                    <td colspan="2">${summary.totalVentasCount} ventas cobradas</td>
                </tr>
                <tr>
                    <td colspan="2">Efectivo Físico Contado en Gaveta</td>
                    <td colspan="2" class="num-usd">$${summary.conteoFisicoUSD.toFixed(2)}</td>
                    <td colspan="2" class="num-bs">Bs. ${summary.conteoFisicoBs.toFixed(2)}</td>
                    <td colspan="2">Reportado por cajero</td>
                </tr>
                <tr>
                    <td colspan="2">Fondo Base para Próximo Turno</td>
                    <td colspan="2" class="num-usd">$${summary.montoInicialSiguienteUSD.toFixed(2)}</td>
                    <td colspan="2" class="num-bs">-</td>
                    <td colspan="2">Efectivo reservado en gaveta</td>
                </tr>
                <tr><td colspan="${colCount}" style="height:12px;"></td></tr>

                <tr><td colspan="${colCount}" class="section-header">2. RESUMEN DE COBROS POR TIPO DE MÉTODO DE PAGO</td></tr>
                <tr style="background:#003366; color:#ffffff; font-weight:bold;">
                    <td colspan="3" style="color:#ffffff;">Tipo de Método de Pago</td>
                    <td colspan="2" style="text-align:center; color:#ffffff;">N° Operaciones</td>
                    <td colspan="1" style="text-align:right; color:#ffffff;">Total ($ USD)</td>
                    <td colspan="2" style="text-align:right; color:#ffffff;">Total Bolívares (Bs.)</td>
                </tr>
                ${Object.keys(methodTotals).map(k => {
                    const m = methodTotals[k];
                    return `
                    <tr>
                        <td colspan="3"><b>${m.label}</b></td>
                        <td colspan="2" style="text-align:center;">${m.count}</td>
                        <td colspan="1" class="num-usd">$${m.totalUSD.toFixed(2)}</td>
                        <td colspan="2" class="num-bs">Bs. ${m.totalBs.toFixed(2)}</td>
                    </tr>`;
                }).join('')}
                <tr style="background:#f8fafc; font-weight:bold;">
                    <td colspan="3">TOTAL POR MÉTODOS DE PAGO</td>
                    <td colspan="2" style="text-align:center;">${summary.totalVentasCount}</td>
                    <td colspan="1" class="num-usd">$${summary.totalCobradoUSD.toFixed(2)}</td>
                    <td colspan="2" class="num-bs">Bs. ${summary.totalCobradoBs.toFixed(2)}</td>
                </tr>
                <tr><td colspan="${colCount}" style="height:12px;"></td></tr>

                <tr><td colspan="${colCount}" class="section-header">3. CONCILIACIÓN DE INGRESOS POR BANCO EMISOR</td></tr>
                <tr style="background:#003366; color:#ffffff; font-weight:bold;">
                    <td colspan="3" style="color:#ffffff;">Banco Emisor / Receptor</td>
                    <td colspan="2" style="text-align:center; color:#ffffff;">Operaciones</td>
                    <td colspan="2" style="text-align:right; color:#ffffff;">Total Bolívares (Bs.)</td>
                    <td colspan="1" style="text-align:right; color:#ffffff;">Equivalente ($ USD)</td>
                </tr>
                ${Object.keys(bankTotals).map(b => {
                    const bk = bankTotals[b];
                    return `
                    <tr>
                        <td colspan="3"><b>${b}</b></td>
                        <td colspan="2" style="text-align:center;">${bk.count} trans.</td>
                        <td colspan="2" class="num-bs">Bs. ${bk.totalBs.toFixed(2)}</td>
                        <td colspan="1" class="num-usd">$${bk.totalUSD.toFixed(2)}</td>
                    </tr>`;
                }).join('')}
                <tr><td colspan="${colCount}" style="height:12px;"></td></tr>

                <tr><td colspan="${colCount}" class="section-header">4. RELACIÓN DETALLADA DE FACTURAS Y NOTAS DEL TURNO</td></tr>
                <tr style="background:#003366; color:#ffffff; font-weight:bold;">
                    <th style="color:#ffffff;">Comprobante</th>
                    <th style="color:#ffffff;">Hora</th>
                    <th style="color:#ffffff;">Cliente</th>
                    <th style="color:#ffffff;">RIF / CI</th>
                    <th style="color:#ffffff;">Método de Pago</th>
                    <th style="color:#ffffff;">Banco Emisor</th>
                    <th style="color:#ffffff; text-align:right;">Total ($ USD)</th>
                    <th style="color:#ffffff; text-align:right;">Total (Bs.)</th>
                </tr>
                ${sales.map(s => {
                    const isVoid = !!s.anulada;
                    const u = parseFloat(s.totalUSD) || 0;
                    const b = parseFloat(s.totalBs) || (u * (parseFloat(settings.tasaBCV) || 917.78));
                    const cust = s.cliente || {};
                    let payMethod = 'Efectivo USD';
                    let bank = s.banco || '-';
                    if (Array.isArray(s.metodosPago) && s.metodosPago.length > 0) {
                        payMethod = s.metodosPago[0].metodo || payMethod;
                        bank = s.metodosPago[0].banco || bank;
                    }
                    return `
                    <tr style="${isVoid ? 'color:#94a3b8; text-decoration:line-through;' : ''}">
                        <td style="text-align:center;"><b>${s.id}</b></td>
                        <td style="text-align:center;">${s.horaStr || '-'}</td>
                        <td>${cust.nombre || 'Cliente Mostrador'}</td>
                        <td>${cust.rif || '-'}</td>
                        <td>${payMethod}</td>
                        <td>${bank}</td>
                        <td class="num-usd">${isVoid ? 'ANULADA' : '$' + u.toFixed(2)}</td>
                        <td class="num-bs">${isVoid ? 'ANULADA' : 'Bs. ' + b.toFixed(2)}</td>
                    </tr>`;
                }).join('')}
                <tr><td colspan="${colCount}" style="height:20px;"></td></tr>

                <tr>
                    <td colspan="4" style="text-align:center; padding-top:30px; border-top:1pt solid #0f172a;">
                        <b>Cajero(a) Responsable:</b><br>${shift.usuario || 'MASTER'}<br><span style="font-size:9pt; color:#64748b;">Firma y Huella Dactilar</span>
                    </td>
                    <td colspan="4" style="text-align:center; padding-top:30px; border-top:1pt solid #0f172a;">
                        <b>Gerencia / Administración Central MASTER:</b><br>NOVA REFRIMOTORS C.A.<br><span style="font-size:9pt; color:#64748b;">Firma y Sello de Validación</span>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([excelDoc], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `NOVA_CierreCaja_CorteZ_${shift.id}_${new Date().toISOString().slice(0, 10)}.xls`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNovaAlert({
        title: "Archivo Excel Descargado",
        message: `El archivo "${filename}" se ha descargado con éxito en su computadora.`,
        type: "success"
    });
}

function printShiftClosingPDF(shiftOrId) {
    const data = getShiftClosingReportData(shiftOrId);
    if (!data) {
        showNovaAlert({ title: "Error", message: "No se encontraron datos del turno solicitado para generar PDF.", type: "danger" });
        return;
    }

    const { shift, sales, methodTotals, bankTotals, summary, settings } = data;
    const nowStr = new Date().toLocaleDateString('es-VE') + ' ' + new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });

    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Corte Z - Cierre de Caja ${shift.id} - NOVA RefriMotors</title>
            <style>
                @page { size: letter portrait; margin: 12mm 15mm; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                    font-size: 11px;
                    line-height: 1.4;
                    color: #0f172a;
                    background: #ffffff;
                    margin: 0;
                    padding: 0;
                }
                .corte-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #003366;
                    padding-bottom: 12px;
                    margin-bottom: 14px;
                }
                .company-name {
                    font-size: 20px;
                    font-weight: 900;
                    color: #003366;
                    letter-spacing: -0.5px;
                }
                .company-sub {
                    font-size: 10px;
                    color: #475569;
                    margin-top: 2px;
                }
                .corte-title-badge {
                    text-align: right;
                }
                .badge-z {
                    display: inline-block;
                    background: #003366;
                    color: #ffffff;
                    font-size: 13px;
                    font-weight: 800;
                    padding: 4px 10px;
                    border-radius: 4px;
                    margin-bottom: 4px;
                }
                .meta-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    background: #f8fafc;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    padding: 10px;
                    margin-bottom: 14px;
                }
                .meta-item-label {
                    font-size: 9px;
                    text-transform: uppercase;
                    color: #64748b;
                    font-weight: 700;
                }
                .meta-item-val {
                    font-size: 12px;
                    font-weight: 800;
                    color: #0f172a;
                }
                .kpi-row {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin-bottom: 14px;
                }
                .kpi-box {
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    padding: 10px;
                    border-top: 3px solid #003366;
                }
                .kpi-box-title {
                    font-size: 9px;
                    text-transform: uppercase;
                    font-weight: 800;
                    color: #64748b;
                }
                .kpi-box-amount {
                    font-size: 16px;
                    font-weight: 900;
                    color: #003366;
                    margin: 3px 0 1px 0;
                }
                .kpi-box-sub {
                    font-size: 10px;
                    font-weight: 600;
                    color: #475569;
                }
                h3.sec-title {
                    font-size: 12px;
                    font-weight: 800;
                    color: #003366;
                    text-transform: uppercase;
                    border-bottom: 1px solid #cbd5e1;
                    padding-bottom: 4px;
                    margin: 14px 0 8px 0;
                }
                table.corte-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10.5px;
                    margin-bottom: 12px;
                }
                table.corte-table th {
                    background: #003366;
                    color: #ffffff;
                    font-weight: 700;
                    text-align: left;
                    padding: 6px 8px;
                    border: 1px solid #003366;
                }
                table.corte-table td {
                    padding: 5px 8px;
                    border: 1px solid #e2e8f0;
                }
                table.corte-table tr:nth-child(even) {
                    background: #f8fafc;
                }
                .signatures {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 40px;
                    margin-top: 30px;
                    padding-top: 10px;
                }
                .sig-line {
                    border-top: 1px solid #0f172a;
                    text-align: center;
                    padding-top: 6px;
                    font-size: 10px;
                    font-weight: 700;
                }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="corte-header">
                <div>
                    <div class="company-name">NOVA REFRIMOTORS C.A.</div>
                    <div class="company-sub">RIF: J-504401994 &bull; Galpón al lado del Estacionamiento Centro Clínico, Av. Carabobo, Cabimas, Zulia</div>
                    <div class="company-sub">TELF: +58 424-6192394 &bull; Sistema Integrado de Control y Arqueo Fiscal</div>
                </div>
                <div class="corte-title-badge">
                    <span class="badge-z">${shift.estado === 'cerrada' ? 'CORTE Z DE CAJA' : 'CORTE X PARCIAL'}</span>
                    <div style="font-size:11px; font-weight:800; color:#0f172a;">${shift.id}</div>
                    <div style="font-size:9.5px; color:#64748b;">Emisión: ${nowStr}</div>
                </div>
            </div>

            <div class="meta-grid">
                <div>
                    <div class="meta-item-label">Cajero(a) Responsable:</div>
                    <div class="meta-item-val">${shift.usuario || 'MASTER'}</div>
                </div>
                <div>
                    <div class="meta-item-label">Tasa Oficial BCV:</div>
                    <div class="meta-item-val">Bs. ${settings.tasaBCV}</div>
                </div>
                <div>
                    <div class="meta-item-label">Apertura de Turno:</div>
                    <div class="meta-item-val">${formatDateTimeSafe(shift.fechaApertura)}</div>
                </div>
                <div>
                    <div class="meta-item-label">Cierre de Turno:</div>
                    <div class="meta-item-val">${formatDateTimeSafe(shift.fechaCierre || new Date().toISOString())}</div>
                </div>
            </div>

            <div class="kpi-row">
                <div class="kpi-box">
                    <div class="kpi-box-title">Total Cobrado (Sistema)</div>
                    <div class="kpi-box-amount">$${summary.totalCobradoUSD.toFixed(2)}</div>
                    <div class="kpi-box-sub">Bs. ${summary.totalCobradoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-box-title">Efectivo Físico Gaveta ($)</div>
                    <div class="kpi-box-amount" style="color:#15803d;">$${summary.conteoFisicoUSD.toFixed(2)}</div>
                    <div class="kpi-box-sub">Arqueo contado real</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-box-title">Efectivo Físico Gaveta (Bs)</div>
                    <div class="kpi-box-amount" style="color:#15803d;">Bs. ${summary.conteoFisicoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div class="kpi-box-sub">Arqueo contado real</div>
                </div>
                <div class="kpi-box">
                    <div class="kpi-box-title">Fondo Próximo Turno</div>
                    <div class="kpi-box-amount" style="color:#0284c7;">$${summary.montoInicialSiguienteUSD.toFixed(2)}</div>
                    <div class="kpi-box-sub">Base caja chica</div>
                </div>
            </div>

            <h3 class="sec-title">1. Resumen de Cobros por Tipo de Método de Pago</h3>
            <table class="corte-table">
                <thead>
                    <tr>
                        <th>Método de Pago</th>
                        <th style="text-align:center;">N° Transacciones</th>
                        <th style="text-align:right;">Total Divisas ($ USD)</th>
                        <th style="text-align:right;">Total Bolívares (Bs.)</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(methodTotals).map(k => {
                        const m = methodTotals[k];
                        return `
                        <tr>
                            <td><b>${m.label}</b></td>
                            <td style="text-align:center;">${m.count}</td>
                            <td style="text-align:right; font-weight:700;">$${m.totalUSD.toFixed(2)}</td>
                            <td style="text-align:right; font-weight:700;">Bs. ${m.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr style="background:#f1f5f9; font-weight:800;">
                        <td>TOTAL RECAUDADO</td>
                        <td style="text-align:center;">${summary.totalVentasCount}</td>
                        <td style="text-align:right; color:#003366;">$${summary.totalCobradoUSD.toFixed(2)}</td>
                        <td style="text-align:right; color:#003366;">Bs. ${summary.totalCobradoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tfoot>
            </table>

            <h3 class="sec-title">2. Conciliación de Ingresos por Banco Emisor</h3>
            <table class="corte-table">
                <thead>
                    <tr>
                        <th>Banco Emisor Receptor</th>
                        <th style="text-align:center;">Operaciones</th>
                        <th style="text-align:right;">Total Bolívares (Bs.)</th>
                        <th style="text-align:right;">Equivalente ($ USD)</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(bankTotals).map(b => {
                        const bk = bankTotals[b];
                        return `
                        <tr>
                            <td><b>${b}</b></td>
                            <td style="text-align:center;">${bk.count} trans.</td>
                            <td style="text-align:right; font-weight:700;">Bs. ${bk.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td style="text-align:right; font-weight:700;">$${bk.totalUSD.toFixed(2)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>

            <h3 class="sec-title">3. Detalle de Comprobantes Emitidos en el Turno (${sales.length} registros)</h3>
            <table class="corte-table">
                <thead>
                    <tr>
                        <th>Comprobante</th>
                        <th>Hora</th>
                        <th>Cliente</th>
                        <th>Método</th>
                        <th>Banco</th>
                        <th style="text-align:right;">Total ($ USD)</th>
                        <th style="text-align:right;">Total (Bs.)</th>
                        <th style="text-align:center;">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${sales.map(s => {
                        const isVoid = !!s.anulada;
                        const u = parseFloat(s.totalUSD) || 0;
                        const b = parseFloat(s.totalBs) || (u * (parseFloat(settings.tasaBCV) || 917.78));
                        const cust = s.cliente || {};
                        let payMethod = 'Efectivo USD';
                        let bank = s.banco || '-';
                        if (Array.isArray(s.metodosPago) && s.metodosPago.length > 0) {
                            payMethod = s.metodosPago[0].metodo || payMethod;
                            bank = s.metodosPago[0].banco || bank;
                        }
                        return `
                        <tr style="${isVoid ? 'color:#94a3b8; text-decoration:line-through;' : ''}">
                            <td style="font-weight:700;">${s.id}</td>
                            <td>${s.horaStr || '-'}</td>
                            <td>${cust.nombre || 'Cliente Mostrador'}</td>
                            <td>${payMethod}</td>
                            <td>${bank}</td>
                            <td style="text-align:right; font-weight:700;">$${u.toFixed(2)}</td>
                            <td style="text-align:right; font-weight:700;">Bs. ${b.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td style="text-align:center;">${isVoid ? '<span style="color:#b91c1c; font-weight:700;">ANULADA</span>' : '<span style="color:#15803d; font-weight:700;">COBRADA</span>'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>

            <div class="signatures">
                <div class="sig-line">
                    <b>Cajero(a) Responsable:</b><br>${shift.usuario || 'MASTER'}<br><span style="font-weight:normal; color:#64748b;">Firma y Huella Dactilar</span>
                </div>
                <div class="sig-line">
                    <b>Gerencia General MASTER:</b><br>NOVA REFRIMOTORS C.A.<br><span style="font-weight:normal; color:#64748b;">Firma y Sello Administrativo</span>
                </div>
            </div>
        </body>
        </html>
    `;

    let iframe = document.getElementById('reportPrintHiddenIframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'reportPrintHiddenIframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }, 250);
}

function downloadCurrentReconciliationExcel() {
    downloadShiftClosingExcel('active');
}

function printCurrentReconciliationPDF() {
    printShiftClosingPDF('active');
}

function downloadClosedShiftExcel(shiftId) {
    const id = shiftId || (window._lastClosedShift ? window._lastClosedShift.id : 'active');
    downloadShiftClosingExcel(id);
}

function downloadClosedShiftPDF(shiftId) {
    const id = shiftId || (window._lastClosedShift ? window._lastClosedShift.id : 'active');
    printShiftClosingPDF(id);
}

function openClosedShiftSuccessModal(closedShift) {
    const detailsEl = document.getElementById('closedShiftSuccessDetails');
    if (detailsEl && closedShift) {
        const u = (typeof closedShift.totalVentasUSD === 'number') ? closedShift.totalVentasUSD : 0;
        const b = (typeof closedShift.totalVentasBs === 'number') ? closedShift.totalVentasBs : 0;
        const count = Array.isArray(closedShift.ventasIds) ? closedShift.ventasIds.length : 0;
        const arqueo = closedShift.arqueoFisico || {};
        detailsEl.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div><span style="color:var(--text-muted); font-size:11px;">Comprobante de Cierre:</span><div style="font-weight:800; font-size:13px; color:var(--primary);">${closedShift.id}</div></div>
                <div><span style="color:var(--text-muted); font-size:11px;">Fecha de Cierre:</span><div style="font-weight:700;">${formatDateTimeSafe(closedShift.fechaCierre)}</div></div>
                <div><span style="color:var(--text-muted); font-size:11px;">Total Cobrado (Sistema):</span><div style="font-weight:800; font-size:14px; color:#15803d;">$${u.toFixed(2)} (Bs. ${b.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</div></div>
                <div><span style="color:var(--text-muted); font-size:11px;">Operaciones Cobradas:</span><div style="font-weight:700;">${count} ventas</div></div>
                <div><span style="color:var(--text-muted); font-size:11px;">Efectivo Gaveta ($ USD):</span><div style="font-weight:800; color:#0f172a;">$${(arqueo.conteoFisicoUSD || 0).toFixed(2)}</div></div>
                <div><span style="color:var(--text-muted); font-size:11px;">Efectivo Gaveta (Bs):</span><div style="font-weight:800; color:#0f172a;">Bs. ${(arqueo.conteoFisicoBs || 0).toFixed(2)}</div></div>
            </div>
        `;
    }
    openModal('closedShiftSuccessModal');
}

function openShiftHistoryModal() {
    const shifts = (typeof NovaDB !== 'undefined' && NovaDB.getCashShifts) ? NovaDB.getCashShifts() : [];
    const container = document.getElementById('shiftHistoryTableContainer');
    if (!container) return;

    if (shifts.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:30px; color:var(--text-muted);">
                <p style="font-weight:700; font-size:14px; color:var(--text-main);">No hay turnos registrados aún en la base de datos.</p>
            </div>`;
        openModal('shiftHistoryModal');
        return;
    }

    let rowsHtml = '';
    shifts.forEach((s) => {
        const isClosed = (s.estado === 'cerrada');
        const count = Array.isArray(s.ventasIds) ? s.ventasIds.length : 0;
        const totalUSD = (typeof s.totalVentasUSD === 'number') ? s.totalVentasUSD : (s.totalesPorMetodo ? Object.values(s.totalesPorMetodo).reduce((a, b) => a + (parseFloat(b.totalUSD || b) || 0), 0) : 0);
        const totalBs = (typeof s.totalVentasBs === 'number') ? s.totalVentasBs : (totalUSD * 917.78);
        const fecha = s.fechaCierre ? formatDateTimeSafe(s.fechaCierre) : formatDateTimeSafe(s.fechaApertura);

        rowsHtml += `
            <tr style="border-bottom:1px solid var(--border-color);">
                <td style="padding:10px 12px; font-weight:800; color:var(--text-main);">
                    <span class="code-badge" style="font-weight:800; font-size:11px;">${s.id}</span>
                </td>
                <td style="padding:10px 12px; font-size:12px; color:var(--text-muted);">${fecha}</td>
                <td style="padding:10px 12px; font-size:12px; font-weight:700;">${s.usuario || 'MASTER'}</td>
                <td style="padding:10px 12px; text-align:center; font-size:12px;">${count} ventas</td>
                <td style="padding:10px 12px; text-align:right; font-weight:800; color:#0f172a; font-size:13px;">$${totalUSD.toFixed(2)}</td>
                <td style="padding:10px 12px; text-align:right; font-weight:700; color:#475569; font-size:12px;">Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="padding:10px 12px; text-align:center;">
                    ${isClosed
                        ? '<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:800; border:1px solid #bbf7d0; font-size:10.5px;">Cerrada (Z)</span>'
                        : '<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:800; border:1px solid #bae6fd; font-size:10.5px;">Turno Activo</span>'}
                </td>
                <td style="padding:10px 12px; text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:6px;">
                        <button type="button" class="header-action-btn btn-secondary-action" style="padding:4px 8px; font-size:11px; background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;" onclick="printShiftClosingPDF('${s.id}')" title="Imprimir o guardar en PDF">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            PDF
                        </button>
                        <button type="button" class="header-action-btn btn-secondary-action" style="padding:4px 8px; font-size:11px; background:#ecfdf5; color:#047857; border-color:#a7f3d0;" onclick="downloadShiftClosingExcel('${s.id}')" title="Descargar en Excel">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            Excel
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    container.innerHTML = `
        <table class="data-table" style="width:100%;">
            <thead>
                <tr style="background:#f8fafc;">
                    <th>N° Turno (Corte Z)</th>
                    <th>Fecha / Hora</th>
                    <th>Cajero</th>
                    <th style="text-align:center;">Operaciones</th>
                    <th style="text-align:right;">Total USD</th>
                    <th style="text-align:right;">Total Bs.</th>
                    <th style="text-align:center;">Estado</th>
                    <th style="text-align:right;">Descargas</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;

    openModal('shiftHistoryModal');
}

// ==============================================================================
// ==============================================================================
// 5. MÓDULO: COMPRAS Y PROVEEDORES (REPOSITORIO DE MERCANCÍA MULTI-PRODUCTO)
// ==============================================================================
let purchaseBatchItems = [];
let purDropdownActiveIndex = -1;
let purCurrentMatches = [];

function renderPurchasesView() {
    const purchases = NovaDB.getPurchases();
    const tbody = document.getElementById('purchasesTableBody');
    if (!tbody) return;

    if (purchases.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">No se han registrado compras de mercancía aún.</td></tr>`;
        return;
    }

    let html = '';
    purchases.forEach(p => {
        const itemCount = Array.isArray(p.items) ? p.items.length : 0;
        const totalUnits = Array.isArray(p.items) ? p.items.reduce((acc, it) => acc + (parseInt(it.cantidad) || 0), 0) : 0;
        const invoiceStr = p.facturaNumero && p.facturaNumero !== 'N/A' && p.facturaNumero.trim() !== ''
            ? `<span style="font-size:11px; color:#2563eb; font-weight:700; display:block; margin-top:2px;">Doc: ${p.facturaNumero}</span>`
            : `<span style="font-size:11px; color:#94a3b8; display:block; margin-top:2px;">Sin N° Doc</span>`;
        html += `
            <tr class="purchase-row-clickable" onclick="viewPurchaseDetails('${p.id}')" title="Haz clic para ver qué repuestos llegaron e información general de la compra ${p.id}">
                <td>
                    <span class="code-badge" style="display:inline-flex; align-items:center; gap:5px; background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; font-weight:800;">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        ${p.id}
                    </span>
                </td>
                <td><span style="font-size:12.5px; color:#334155; font-weight:600;">${p.fechaHoraStr || p.fechaStr}</span></td>
                <td>
                    <b style="color:#0f172a; font-size:13px;">${p.proveedorNombre || 'Distribuidor'}</b>
                    ${invoiceStr}
                </td>
                <td>
                    <b style="color:#0f172a; font-size:12.5px;">${itemCount} ${itemCount === 1 ? 'repuesto' : 'repuestos'}</b>
                    <span style="font-size:11px; color:var(--text-muted); display:block;">(${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'})</span>
                </td>
                <td>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="color:var(--primary); font-size:14px; font-weight:800;">$${Number(p.totalUSD || 0).toFixed(2)}</b>
                        <button type="button" class="ticket-btn-sm" onclick="event.stopPropagation(); viewPurchaseDetails('${p.id}')" title="Ver qué repuestos llegaron e información general" style="padding:4px 10px; font-size:11.5px; display:inline-flex; align-items:center; gap:5px; background:#f8fafc; color:#1e293b; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer;">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            Ver
                        </button>
                    </div>
                </td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

function openAddPurchaseModal() {
    purchaseBatchItems = [];
    purDropdownActiveIndex = -1;
    purCurrentMatches = [];

    refreshSupplierSelect();

    // Reset inputs
    const invNum = document.getElementById('purInvoiceNumber');
    if (invNum) invNum.value = '';
    const codeInp = document.getElementById('purCodeInput');
    if (codeInp) codeInp.value = '';
    const descInp = document.getElementById('purDescInput');
    if (descInp) descInp.value = '';
    const costInp = document.getElementById('purCostInput');
    if (costInp) costInp.value = '';
    const qtyInp = document.getElementById('purQtyInput');
    if (qtyInp) qtyInp.value = '1';
    const hidId = document.getElementById('purSelectedProductId');
    if (hidId) hidId.value = '';

    hidePurContextBar();
    closePurDropdown();
    renderPurchaseItemsTable();
    openModal('addPurchaseModal');

    setTimeout(() => {
        if (codeInp) codeInp.focus();
    }, 150);
}

function refreshSupplierSelect(selectedId = null) {
    const provs = (typeof NovaDB !== 'undefined' && NovaDB.getSuppliers) ? NovaDB.getSuppliers() : [];
    const sel = document.getElementById('purSupplierSelect');
    if (!sel) return;

    if (provs.length === 0) {
        sel.innerHTML = '<option value="">-- No hay proveedores registrados (Pulse + para registrar) --</option>';
        return;
    }

    sel.innerHTML = provs.map(p => {
        const extra = p.rubro ? ` (${p.rubro})` : (p.rif ? ` - ${p.rif}` : '');
        return `<option value="${p.id}">${p.razonSocial}${extra}</option>`;
    }).join('');

    if (selectedId) {
        sel.value = selectedId;
    }
}

// ----------------------------------------------------
// REGISTRO RÁPIDO DE PROVEEDORES (+)
// ----------------------------------------------------
function openAddSupplierModal() {
    const nameInp = document.getElementById('suppModalName');
    const rifInp = document.getElementById('suppModalRif');
    const phoneInp = document.getElementById('suppModalPhone');
    const rubroInp = document.getElementById('suppModalRubro');

    if (nameInp) nameInp.value = '';
    if (rifInp) rifInp.value = '';
    if (phoneInp) phoneInp.value = '';
    if (rubroInp) rubroInp.value = '';

    openModal('addSupplierModal');
    setTimeout(() => {
        if (nameInp) nameInp.focus();
    }, 120);
}

function submitNewSupplier() {
    const nameInp = document.getElementById('suppModalName');
    const rifInp = document.getElementById('suppModalRif');
    const phoneInp = document.getElementById('suppModalPhone');
    const rubroInp = document.getElementById('suppModalRubro');

    const razonSocial = nameInp ? nameInp.value.trim() : '';
    if (!razonSocial) {
        showNovaAlert({
            title: "Nombre Requerido",
            message: "Por favor ingrese el nombre o razón social del proveedor distribuidor.",
            type: "warning"
        });
        if (nameInp) nameInp.focus();
        return;
    }

    const rif = rifInp ? rifInp.value.trim() : '';
    const telefono = phoneInp ? phoneInp.value.trim() : '';
    const rubro = rubroInp ? rubroInp.value.trim() : '';

    const newSupplier = NovaDB.saveSupplier({
        razonSocial,
        rif,
        telefono,
        rubro
    });

    closeModal('addSupplierModal');

    // Refrescar selector de proveedores y preseleccionar el nuevo
    if (newSupplier) {
        refreshSupplierSelect(newSupplier.id);
    }

    showNovaAlert({
        title: "Proveedor Guardado",
        message: `El proveedor <b>"${razonSocial}"</b> ha sido registrado y seleccionado con éxito.`,
        type: "success"
    });
}

// ----------------------------------------------------
// AUTOCOMPLETE Y SELECCIÓN DE PRODUCTOS EN COMPRA
// ----------------------------------------------------
function renderPurDropdownResults(matches) {
    const dropdown = document.getElementById('purDropdownMenu');
    if (!dropdown) return;

    purCurrentMatches = matches ? matches.slice(0, 30) : [];
    purDropdownActiveIndex = -1;

    if (purCurrentMatches.length === 0) {
        dropdown.innerHTML = `<div style="padding:10px 14px; color:#94a3b8; font-size:12px; text-align:center;">No se encontraron repuestos con esa coincidencia</div>`;
        return;
    }

    let html = '';
    purCurrentMatches.forEach((p, idx) => {
        const safeName = (p.name || '').replace(/"/g, '&quot;');
        const costStr = (typeof p.cost === 'number' && p.cost > 0) ? `$${p.cost.toFixed(2)}` : '$0.00';
        const catStr = p.category ? `<span class="stockin-cat-badge">${p.category}</span>` : '';
        const stockClass = p.stock === 0 ? 'stock-pill-empty' : (p.stock <= 5 ? 'stock-pill-low' : 'stock-pill-ok');

        html += `
            <div class="stockin-dropdown-item" data-index="${idx}" data-id="${p.id}" onclick="selectPurProductByIndex(${idx})">
                <span class="stockin-dropdown-item-code">${p.id}</span>
                <span class="stockin-dropdown-item-name" title="${safeName}">${p.name}</span>
                <div class="stockin-dropdown-item-meta">
                    ${catStr}
                    <span class="stockin-cost-badge">Costo: ${costStr}</span>
                    <span class="stockin-dropdown-item-stock ${stockClass}">Stock: ${p.stock}</span>
                </div>
            </div>`;
    });

    if (matches.length > purCurrentMatches.length) {
        html += `<div style="padding:6px 12px; font-size:11px; color:#64748b; background:#f8fafc; text-align:center; border-top:1px solid #e2e8f0;">... y ${matches.length - purCurrentMatches.length} coincidencias más ...</div>`;
    }

    dropdown.innerHTML = html;
}

function updatePurDropdownActiveItem() {
    const dropdown = document.getElementById('purDropdownMenu');
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.stockin-dropdown-item');
    items.forEach((item, idx) => {
        if (idx === purDropdownActiveIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

function openPurDropdown() {
    const codeVal = (document.getElementById('purCodeInput')?.value || '').trim();
    const descVal = (document.getElementById('purDescInput')?.value || '').trim();

    let matches = [];
    if (codeVal) {
        matches = getMatchingStockProducts(codeVal, 'code');
    } else if (descVal) {
        matches = getMatchingStockProducts(descVal, 'all');
    } else {
        matches = getMatchingStockProducts('', 'all').slice(0, 25);
    }

    renderPurDropdownResults(matches);
    const dropdown = document.getElementById('purDropdownMenu');
    if (dropdown) dropdown.style.display = 'block';
}

function closePurDropdown() {
    const dropdown = document.getElementById('purDropdownMenu');
    if (dropdown) dropdown.style.display = 'none';
    purDropdownActiveIndex = -1;
}

function onPurCodeInput(codeVal) {
    const term = (codeVal || '').trim().toLowerCase();
    const dropdown = document.getElementById('purDropdownMenu');
    const descInput = document.getElementById('purDescInput');
    const hidId = document.getElementById('purSelectedProductId');

    if (hidId) hidId.value = '';

    if (!term) {
        if (dropdown) dropdown.style.display = 'none';
        if (descInput) descInput.value = '';
        hidePurContextBar();
        return;
    }

    const matches = getMatchingStockProducts(term, 'code');
    renderPurDropdownResults(matches);

    if (dropdown) dropdown.style.display = 'block';

    const exact = matches.find(p => p.id.toLowerCase() === term);
    if (exact) {
        selectPurProduct(exact.id, exact.name, exact.cost);
    } else if (matches.length > 0) {
        if (descInput && !descInput.matches(':focus')) {
            descInput.value = `[${matches.length} coincidencias] Seleccione o use flechas...`;
        }
        hidePurContextBar();
    } else {
        if (descInput) descInput.value = '';
        hidePurContextBar();
    }
}

function onPurCodeKeyDown(e) {
    const dropdown = document.getElementById('purDropdownMenu');
    const isDropdownVisible = dropdown && dropdown.style.display === 'block';

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isDropdownVisible) openPurDropdown();
        if (purCurrentMatches.length > 0) {
            purDropdownActiveIndex = (purDropdownActiveIndex + 1) % purCurrentMatches.length;
            updatePurDropdownActiveItem();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (isDropdownVisible && purCurrentMatches.length > 0) {
            purDropdownActiveIndex = (purDropdownActiveIndex - 1 + purCurrentMatches.length) % purCurrentMatches.length;
            updatePurDropdownActiveItem();
        }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (isDropdownVisible && purCurrentMatches.length > 0) {
            e.preventDefault();
            const targetIdx = purDropdownActiveIndex >= 0 ? purDropdownActiveIndex : 0;
            selectPurProductByIndex(targetIdx);
        } else {
            const hidId = document.getElementById('purSelectedProductId')?.value;
            if (hidId) {
                e.preventDefault();
                const costInp = document.getElementById('purCostInput');
                if (costInp) { costInp.focus(); costInp.select(); }
            } else {
                const typedCode = (document.getElementById('purCodeInput')?.value || '').trim().toLowerCase();
                if (typedCode) {
                    const all = getAllCatalogProducts();
                    const found = all.find(p => p.id.toLowerCase() === typedCode);
                    if (found) {
                        e.preventDefault();
                        selectPurProduct(found.id, found.name, found.cost);
                    }
                }
            }
        }
    } else if (e.key === 'Escape') {
        closePurDropdown();
    }
}

function onPurDescInput(descVal) {
    const term = (descVal || '').trim().toLowerCase();
    const dropdown = document.getElementById('purDropdownMenu');
    const hidId = document.getElementById('purSelectedProductId');
    if (hidId) hidId.value = '';

    const matches = getMatchingStockProducts(term, 'all');
    renderPurDropdownResults(matches);
    if (dropdown) dropdown.style.display = 'block';
}

function onPurDescKeyDown(e) {
    const dropdown = document.getElementById('purDropdownMenu');
    const isDropdownVisible = dropdown && dropdown.style.display === 'block';

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isDropdownVisible) openPurDropdown();
        if (purCurrentMatches.length > 0) {
            purDropdownActiveIndex = (purDropdownActiveIndex + 1) % purCurrentMatches.length;
            updatePurDropdownActiveItem();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (isDropdownVisible && purCurrentMatches.length > 0) {
            purDropdownActiveIndex = (purDropdownActiveIndex - 1 + purCurrentMatches.length) % purCurrentMatches.length;
            updatePurDropdownActiveItem();
        }
    } else if (e.key === 'Enter') {
        if (isDropdownVisible && purCurrentMatches.length > 0) {
            e.preventDefault();
            const targetIdx = purDropdownActiveIndex >= 0 ? purDropdownActiveIndex : 0;
            selectPurProductByIndex(targetIdx);
        }
    } else if (e.key === 'Escape') {
        closePurDropdown();
    }
}

function onPurCostKeyDown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const qtyInp = document.getElementById('purQtyInput');
        if (qtyInp) { qtyInp.focus(); qtyInp.select(); }
    }
}

function selectPurProductByIndex(idx) {
    if (idx >= 0 && idx < purCurrentMatches.length) {
        const p = purCurrentMatches[idx];
        selectPurProduct(p.id, p.name, p.cost);
    }
}

function selectPurProduct(id, name, cost) {
    const codeInput = document.getElementById('purCodeInput');
    const descInput = document.getElementById('purDescInput');
    const costInput = document.getElementById('purCostInput');
    const hidId = document.getElementById('purSelectedProductId');

    if (codeInput) codeInput.value = id;
    if (descInput) descInput.value = name;
    if (hidId) hidId.value = id;

    const unitCost = (typeof cost === 'number' && cost > 0) ? cost : 0;
    if (costInput) {
        costInput.value = unitCost > 0 ? unitCost.toFixed(2) : '';
    }

    closePurDropdown();
    showPurProductHistoryHint(id, name, unitCost);

    // Enfocar el costo si es cero o enfocar cantidad
    if (costInput && (!costInput.value || parseFloat(costInput.value) <= 0)) {
        costInput.focus();
        costInput.select();
    } else {
        const qtyInput = document.getElementById('purQtyInput');
        if (qtyInput) {
            qtyInput.focus();
            qtyInput.select();
        }
    }
}

function showPurProductHistoryHint(productId, name, currentCost) {
    const bar = document.getElementById('purItemContextBar');
    const prodEl = document.getElementById('purContextProduct');
    const histEl = document.getElementById('purContextHistory');
    if (!bar || !prodEl || !histEl) return;

    const history = (typeof NovaDB !== 'undefined' && NovaDB.getProductPurchaseHistory) ? NovaDB.getProductPurchaseHistory(productId) : [];
    const inv = (typeof NovaDB !== 'undefined' && NovaDB.getInventory) ? NovaDB.getInventory() : {};
    const item = inv[productId] || {};

    let lastDate = 'Sin compras previas';
    let supplierName = 'N/A';
    let prevCost = (typeof item.costoAnterior === 'number' && item.costoAnterior > 0) ? item.costoAnterior : 0;

    if (history.length > 0) {
        lastDate = history[0].fechaStr;
        supplierName = history[0].proveedorNombre || 'Proveedor';
        if (history.length > 1) {
            prevCost = Number(history[1].costoCompra) || prevCost;
        }
    } else if (item.ultimaCargaFechaStr) {
        lastDate = item.ultimaCargaFechaStr;
        supplierName = item.ultimoProveedorNombre || 'N/A';
    }

    prodEl.innerHTML = `Repuesto: <b>[${productId}] ${name}</b>`;
    let histText = `Última Carga: <b>${lastDate}</b> • Proveedor: <b>${supplierName}</b>`;
    if (prevCost > 0) {
        histText += ` • Costo Anterior: <b>$${prevCost.toFixed(2)}</b>`;
    }
    histEl.innerHTML = histText;
    bar.style.display = 'flex';
}

function hidePurContextBar() {
    const bar = document.getElementById('purItemContextBar');
    if (bar) bar.style.display = 'none';
}

// Cerrar desplegable si se hace clic afuera
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('purDropdownMenu');
    if (dropdown && dropdown.style.display === 'block') {
        const descInput = document.getElementById('purDescInput');
        const codeInput = document.getElementById('purCodeInput');
        if (!dropdown.contains(e.target) && e.target !== descInput && e.target !== codeInput) {
            dropdown.style.display = 'none';
        }
    }
});

function addSelectedProductToPurchaseList() {
    let productId = (document.getElementById('purSelectedProductId')?.value || '').trim();
    let productName = (document.getElementById('purDescInput')?.value || '').trim();

    if (!productId) {
        const typedCode = (document.getElementById('purCodeInput')?.value || '').trim().toLowerCase();
        if (typedCode) {
            const all = getAllCatalogProducts();
            const found = all.find(p => p.id.toLowerCase() === typedCode);
            if (found) {
                productId = found.id;
                productName = found.name;
            } else {
                const partials = all.filter(p => p.id.toLowerCase().includes(typedCode));
                if (partials.length === 1) {
                    productId = partials[0].id;
                    productName = partials[0].name;
                }
            }
        }
    }

    if (!productId) {
        showNovaAlert({
            title: "Seleccione un Repuesto",
            message: "Por favor escriba el código o seleccione el repuesto a cargar en la compra.",
            type: "warning"
        });
        const codeInp = document.getElementById('purCodeInput');
        if (codeInp) codeInp.focus();
        return;
    }

    const costInput = document.getElementById('purCostInput');
    const cost = parseFloat(costInput ? costInput.value : 0);
    if (isNaN(cost) || cost <= 0) {
        showNovaAlert({
            title: "Costo Unitario Requerido",
            message: "Por favor indique el costo unitario de compra en dólares ($ USD) para este repuesto.",
            type: "warning"
        });
        if (costInput) costInput.focus();
        return;
    }

    const qtyInput = document.getElementById('purQtyInput');
    const qty = parseInt(qtyInput ? qtyInput.value : 1);
    if (isNaN(qty) || qty <= 0) {
        showNovaAlert({
            title: "Cantidad Inválida",
            message: "La cantidad recibida debe ser un número entero mayor a cero.",
            type: "warning"
        });
        if (qtyInput) qtyInput.focus();
        return;
    }

    const existing = purchaseBatchItems.find(item => item.id === productId);
    if (existing) {
        existing.cantidad += qty;
        existing.costoCompra = cost;
        renderPurchaseItemsTable();
        setTimeout(() => {
            const row = document.getElementById(`pur-row-${productId}`);
            if (row) {
                row.classList.remove('stockin-row-updated');
                void row.offsetWidth;
                row.classList.add('stockin-row-updated');
            }
        }, 50);
    } else {
        purchaseBatchItems.push({
            id: productId,
            name: productName || productId,
            cantidad: qty,
            costoCompra: cost
        });
        renderPurchaseItemsTable();
    }

    // Resetear campos para siguiente ítem
    const codeInp = document.getElementById('purCodeInput');
    const descInp = document.getElementById('purDescInput');
    const hidId = document.getElementById('purSelectedProductId');
    if (codeInp) codeInp.value = '';
    if (descInp) descInp.value = '';
    if (costInput) costInput.value = '';
    if (qtyInput) qtyInput.value = '1';
    if (hidId) hidId.value = '';
    hidePurContextBar();
    closePurDropdown();

    if (codeInp) codeInp.focus();
}

function renderPurchaseItemsTable() {
    const tbody = document.getElementById('purchaseTableBody');
    const countEl = document.getElementById('purListCount');
    const totalUnitsBadge = document.getElementById('purTotalUnitsBadge');
    const totalAmountBadge = document.getElementById('purTotalAmountBadge');

    if (!tbody) return;

    if (purchaseBatchItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:24px 12px; color:var(--text-muted); font-size:12.5px;">
                    No hay repuestos agregados a esta compra.<br>
                    <span style="font-size:11.5px;">Seleccione el repuesto arriba, coloque el costo unitario y cantidad, y pulse <b>Agregar a Lista</b>.</span>
                </td>
            </tr>`;
        if (countEl) countEl.innerText = '0';
        if (totalUnitsBadge) totalUnitsBadge.innerText = '0 Unidades Totales';
        if (totalAmountBadge) totalAmountBadge.innerText = 'Total Compra: $0.00 USD';
        return;
    }

    let totalUnits = 0;
    let totalUSD = 0;
    const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : { tasaBCV: 917.78 };
    const bcvRate = settings.tasaBCV || 917.78;
    let html = '';

    purchaseBatchItems.forEach(item => {
        const subtotal = item.costoCompra * item.cantidad;
        totalUnits += item.cantidad;
        totalUSD += subtotal;

        html += `
            <tr id="pur-row-${item.id}">
                <td><span class="code-badge">${item.id}</span></td>
                <td>
                    <div style="font-weight:700; line-height:1.25; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${item.name}">
                        ${item.name}
                    </div>
                </td>
                <td style="text-align:right;">
                    <b style="color:#0f172a; font-size:12.5px;">$${item.costoCompra.toFixed(2)}</b>
                </td>
                <td style="text-align:center;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                        <button type="button" class="ticket-btn-sm" onclick="updatePurchaseItemQty('${item.id}', -1)" style="font-weight:800; width:22px; height:22px; padding:0;">-</button>
                        <input type="number" min="1" step="1" value="${item.cantidad}" onchange="setPurchaseItemQtyDirect('${item.id}', this.value)" style="width:48px; text-align:center; font-weight:800; font-size:12.5px; padding:2px 2px; border:1px solid #cbd5e1; border-radius:4px;">
                        <button type="button" class="ticket-btn-sm" onclick="updatePurchaseItemQty('${item.id}', 1)" style="font-weight:800; width:22px; height:22px; padding:0;">+</button>
                    </div>
                </td>
                <td style="text-align:right;">
                    <b style="color:var(--primary); font-size:12.5px;">$${subtotal.toFixed(2)}</b>
                </td>
                <td style="text-align:center;">
                    <button type="button" class="ticket-btn-sm" onclick="removePurchaseItem('${item.id}')" style="color:var(--danger); padding:3px 6px;" title="Quitar de la compra">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            </tr>`;
    });

    tbody.innerHTML = html;
    if (countEl) countEl.innerText = purchaseBatchItems.length;
    if (totalUnitsBadge) totalUnitsBadge.innerText = `${totalUnits} ${totalUnits === 1 ? 'Unidad Total' : 'Unidades Totales'}`;
    if (totalAmountBadge) {
        const totalBs = totalUSD * bcvRate;
        totalAmountBadge.innerHTML = `Total Compra: <b>$${totalUSD.toFixed(2)} USD</b> <span style="font-size:10.5px; opacity:0.85;">(Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>`;
    }
}

function updatePurchaseItemQty(id, diff) {
    const item = purchaseBatchItems.find(i => i.id === id);
    if (item) {
        item.cantidad = Math.max(1, item.cantidad + diff);
        renderPurchaseItemsTable();
    }
}

function setPurchaseItemQtyDirect(id, val) {
    const item = purchaseBatchItems.find(i => i.id === id);
    if (item) {
        const qty = parseInt(val);
        item.cantidad = (!isNaN(qty) && qty > 0) ? qty : 1;
        renderPurchaseItemsTable();
    }
}

function removePurchaseItem(id) {
    purchaseBatchItems = purchaseBatchItems.filter(i => i.id !== id);
    renderPurchaseItemsTable();
}

function clearPurchaseList() {
    if (purchaseBatchItems.length === 0) return;
    purchaseBatchItems = [];
    renderPurchaseItemsTable();
}

function submitNewPurchase() {
    const provSelect = document.getElementById('purSupplierSelect');
    const provId = provSelect ? provSelect.value : '';
    const provs = NovaDB.getSuppliers();
    const provObj = provs.find(p => p.id === provId);

    if (!provId || !provObj) {
        showNovaAlert({
            title: "Proveedor Requerido",
            message: "Por favor seleccione un Proveedor Distribuidor o presione el botón '+' para registrar uno nuevo.",
            type: "warning"
        });
        if (provSelect) provSelect.focus();
        return;
    }

    if (purchaseBatchItems.length === 0) {
        showNovaAlert({
            title: "Lista de Compra Vacía",
            message: "Debe agregar al menos un repuesto a la lista de compra para registrar la entrada de mercancía.",
            type: "warning"
        });
        return;
    }

    const invoiceNum = (document.getElementById('purInvoiceNumber')?.value || '').trim();
    const totalUSD = purchaseBatchItems.reduce((acc, it) => acc + (it.costoCompra * it.cantidad), 0);
    const totalUnits = purchaseBatchItems.reduce((acc, it) => acc + it.cantidad, 0);

    const record = NovaDB.registerPurchase({
        proveedorId: provId,
        proveedorNombre: provObj.razonSocial,
        facturaNumero: invoiceNum || 'N/A',
        items: purchaseBatchItems.map(it => ({
            id: it.id,
            nombre: it.name,
            cantidad: it.cantidad,
            costoCompra: it.costoCompra
        })),
        totalUSD: totalUSD
    });

    closeModal('addPurchaseModal');
    renderPurchasesView();
    if (currentView === 'inventory' && typeof renderInventoryView === 'function') renderInventoryView();
    if (typeof renderPOSCatalog === 'function') renderPOSCatalog();

    showNovaAlert({
        title: "¡Mercancía Registrada con Éxito!",
        message: `Se registraron <b>${totalUnits} unidades</b> de <b>${purchaseBatchItems.length} repuesto(s)</b> comprados a <b>${provObj.razonSocial}</b>.<br><div style="margin-top:8px; font-size:12px; color:var(--text-muted); background:#f8fafc; padding:8px 12px; border-radius:6px; border:1px solid #e2e8f0; line-height:1.4;"><b>N° Compra:</b> ${record.id}<br><b>Documento:</b> ${invoiceNum || 'N/A'}<br><b>Total Facturado:</b> $${totalUSD.toFixed(2)} USD</div>`,
        type: "success"
    });

    purchaseBatchItems = [];
}

let currentViewingPurchaseId = null;

function viewPurchaseDetails(purchaseId) {
    if (!purchaseId) return;
    const purchases = NovaDB.getPurchases();
    const p = purchases.find(x => x.id === purchaseId);
    if (!p) {
        showNovaAlert({
            title: "Compra no encontrada",
            message: `No se encontró el registro de la compra ${purchaseId}.`,
            type: "warning"
        });
        return;
    }

    currentViewingPurchaseId = purchaseId;

    // Header info
    const idEl = document.getElementById('purDetailId');
    if (idEl) idEl.innerText = p.id;

    const invEl = document.getElementById('purDetailInvoiceNum');
    if (invEl) {
        const hasDoc = p.facturaNumero && p.facturaNumero !== 'N/A' && p.facturaNumero.trim() !== '';
        invEl.innerText = hasDoc ? p.facturaNumero : 'Sin Documento Físico';
    }

    const dateEl = document.getElementById('purDetailDate');
    if (dateEl) dateEl.innerText = p.fechaHoraStr || p.fechaStr || new Date(p.timestamp || Date.now()).toLocaleString('es-VE');

    const nameEl = document.getElementById('purDetailSupplierName');
    if (nameEl) nameEl.innerText = p.proveedorNombre || 'Proveedor Distribuidor';

    const extraEl = document.getElementById('purDetailSupplierExtra');
    if (extraEl) extraEl.innerHTML = '';

    // Populate items table
    const tbody = document.getElementById('purDetailTableBody');
    let totalUnits = 0;
    let html = '';
    const items = Array.isArray(p.items) ? p.items : [];

    items.forEach(it => {
        const qty = parseInt(it.cantidad) || 0;
        const cost = parseFloat(it.costoCompra) || 0;
        const subtotal = cost * qty;
        totalUnits += qty;
        const itemCode = it.id || 'N/A';
        const itemName = it.nombre || it.name || it.id || 'Repuesto sin descripción';

        html += `
            <tr>
                <td><span class="code-badge" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; font-weight:800;">${itemCode}</span></td>
                <td><div style="font-weight:700; color:#0f172a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${itemName}">${itemName}</div></td>
                <td style="text-align:right; font-weight:700; color:#334155;">$${cost.toFixed(2)}</td>
                <td style="text-align:center;"><span style="display:inline-block; font-weight:800; background:#f1f5f9; padding:2px 8px; border-radius:12px; font-size:11.5px; color:#1e293b;">${qty} unids.</span></td>
                <td style="text-align:right; font-weight:800; color:var(--primary);">$${subtotal.toFixed(2)}</td>
            </tr>`;
    });

    if (items.length === 0) {
        html = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No se registraron detalles de ítems para esta compra.</td></tr>`;
    }

    if (tbody) tbody.innerHTML = html;

    const countEl = document.getElementById('purDetailItemCount');
    if (countEl) countEl.innerText = items.length;

    const unitsEl = document.getElementById('purDetailTotalUnitsBadge');
    if (unitsEl) unitsEl.innerText = `${totalUnits} ${totalUnits === 1 ? 'Unidad Total' : 'Unidades Totales'}`;

    const totalUSD = Number(p.totalUSD) || items.reduce((acc, it) => acc + ((parseFloat(it.costoCompra) || 0) * (parseInt(it.cantidad) || 0)), 0);
    const settings = NovaDB.getSettings();
    const bcvRate = settings.tasaBCV || 917.78;
    const totalBs = totalUSD * bcvRate;

    const usdEl = document.getElementById('purDetailTotalUSD');
    if (usdEl) usdEl.innerText = `$${totalUSD.toFixed(2)} USD`;

    const bsEl = document.getElementById('purDetailTotalBs');
    if (bsEl) {
        bsEl.innerText = `Equivalente BCV: Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa: Bs. ${bcvRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }

    const notesEl = document.getElementById('purDetailNotes');
    if (notesEl) {
        if (p.notas && p.notas.trim() !== '') {
            notesEl.style.display = 'block';
            notesEl.innerHTML = `<b>Observaciones / Justificativo:</b> ${p.notas}`;
        } else {
            notesEl.style.display = 'none';
        }
    }

    openModal('viewPurchaseDetailModal');
}

function printCurrentPurchaseVoucher() {
    if (currentViewingPurchaseId) {
        printPurchaseVoucher(currentViewingPurchaseId);
    }
}

function printPurchaseVoucher(purchaseId) {
    const purchases = NovaDB.getPurchases();
    const p = purchases.find(x => x.id === purchaseId);
    if (!p) return;

    const settings = NovaDB.getSettings();
    const bcvRate = settings.tasaBCV || 917.78;
    const totalUSD = Number(p.totalUSD) || 0;
    const totalBs = totalUSD * bcvRate;
    const supps = NovaDB.getSuppliers();
    const supp = supps.find(s => s.id === p.proveedorId || s.razonSocial === p.proveedorNombre);

    let rowsHtml = '';
    let totalUnits = 0;
    (p.items || []).forEach(it => {
        const qty = parseInt(it.cantidad) || 0;
        const cost = parseFloat(it.costoCompra) || 0;
        const sub = qty * cost;
        totalUnits += qty;
        rowsHtml += `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:8px 10px; font-family:monospace; font-weight:700;">${it.id}</td>
                <td style="padding:8px 10px;">${it.nombre || it.name || it.id}</td>
                <td style="padding:8px 10px; text-align:right;">$${cost.toFixed(2)}</td>
                <td style="padding:8px 10px; text-align:center; font-weight:700;">${qty}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:700;">$${sub.toFixed(2)}</td>
            </tr>`;
    });

    const printHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Comprobante de Recepción de Mercancía - ${p.id}</title>
    <style>
        @page { size: letter; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 13px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 18px; }
        .logo-title { font-size: 20px; font-weight: 900; color: #1e3a8a; }
        .doc-badge { text-align: right; }
        .doc-id { font-size: 18px; font-weight: 800; color: #2563eb; font-family: monospace; }
        .info-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 12px; }
        th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1; }
        .totals-card { display: flex; justify-content: space-between; align-items: center; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 12px 16px; margin-bottom: 30px; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; text-align: center; }
        .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-weight: 600; font-size: 12px; color: #475569; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="logo-title">NOVA REFRI MOTORS C.A.</div>
            <div style="font-size:11.5px; color:#475569;">Comprobante de Recepción de Mercancía e Ingreso a Almacén</div>
        </div>
        <div class="doc-badge">
            <div class="doc-id">${p.id}</div>
            <div style="font-size:11.5px; color:#64748b;">${p.fechaHoraStr || p.fechaStr}</div>
        </div>
    </div>

    <div class="info-grid">
        <div>
            <div style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase;">Proveedor Distribuidor</div>
            <div style="font-size:14px; font-weight:800; color:#0f172a; margin-top:2px;">${p.proveedorNombre || 'Proveedor'}</div>
            <div style="margin-top:4px; color:#475569;">
                ${supp?.rif ? `RIF: ${supp.rif} &nbsp; ` : ''}
                ${supp?.telefono ? `Telf: ${supp.telefono} &nbsp; ` : ''}
                ${supp?.rubro ? `Rubro: ${supp.rubro}` : ''}
            </div>
        </div>
        <div>
            <div><b>Factura / Control Proveedor:</b> ${p.facturaNumero || 'N/A'}</div>
            <div style="margin-top:4px;"><b>Fecha de Emisión / Carga:</b> ${p.fechaHoraStr || p.fechaStr}</div>
            <div style="margin-top:4px;"><b>Total Ítems:</b> ${(p.items || []).length} repuestos (${totalUnits} unidades)</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width:110px;">Código</th>
                <th>Descripción del Repuesto</th>
                <th style="width:100px; text-align:right;">Costo Unit. ($)</th>
                <th style="width:80px; text-align:center;">Cant.</th>
                <th style="width:110px; text-align:right;">Subtotal ($)</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <div class="totals-card">
        <div>
            <div style="font-size:11px; font-weight:700; color:#166534; text-transform:uppercase;">Monto Total Facturado:</div>
            <div style="font-size:12px; color:#15803d; font-weight:700; margin-top:2px;">
                Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV: Bs. ${bcvRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </div>
        </div>
        <div style="font-size:22px; font-weight:900; color:#15803d;">
            $${totalUSD.toFixed(2)} USD
        </div>
    </div>

    <div class="signatures">
        <div>
            <div style="height:40px;"></div>
            <div class="sig-line">Almacén / Recepción de Mercancía</div>
        </div>
        <div>
            <div style="height:40px;"></div>
            <div class="sig-line">Administración / Verificación Fiscal</div>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 250);
        };
    </script>
</body>
</html>`;

    let iframe = document.getElementById('purchasePrintHiddenIframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'purchasePrintHiddenIframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();
}

// Exportar funciones de compras y proveedores globalmente
window.renderPurchasesView = renderPurchasesView;
window.viewPurchaseDetails = viewPurchaseDetails;
window.printCurrentPurchaseVoucher = printCurrentPurchaseVoucher;
window.printPurchaseVoucher = printPurchaseVoucher;
window.openAddPurchaseModal = openAddPurchaseModal;
window.refreshSupplierSelect = refreshSupplierSelect;
window.openAddSupplierModal = openAddSupplierModal;
window.submitNewSupplier = submitNewSupplier;
window.onPurCodeInput = onPurCodeInput;
window.onPurCodeKeyDown = onPurCodeKeyDown;
window.onPurDescInput = onPurDescInput;
window.onPurDescKeyDown = onPurDescKeyDown;
window.onPurCostKeyDown = onPurCostKeyDown;
window.openPurDropdown = openPurDropdown;
window.closePurDropdown = closePurDropdown;
window.selectPurProductByIndex = selectPurProductByIndex;
window.selectPurProduct = selectPurProduct;
window.addSelectedProductToPurchaseList = addSelectedProductToPurchaseList;
window.renderPurchaseItemsTable = renderPurchaseItemsTable;
window.updatePurchaseItemQty = updatePurchaseItemQty;
window.setPurchaseItemQtyDirect = setPurchaseItemQtyDirect;
window.removePurchaseItem = removePurchaseItem;
window.clearPurchaseList = clearPurchaseList;
window.submitNewPurchase = submitNewPurchase;

// ==============================================================================
// 6. MÓDULO: CLIENTES (CRM)
// ==============================================================================
function renderCustomersView() {
    const customers = NovaDB.getCustomers();
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;

    if (customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No se encontraron clientes registrados en el directorio.</td></tr>`;
        return;
    }

    let html = '';
    customers.forEach(c => {
        let actionHtml = '';
        const reportBtn = `
            <button class="ticket-btn-sm" onclick="viewCustomerPurchasesReport('${c.rif}')" title="Ver historial de compras y repuestos adquiridos por este cliente" style="padding:4px 9px; font-size:11px; display:inline-flex; align-items:center; gap:4px; font-weight:700;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                Compras
            </button>
        `;

        if (c.id === 'CLI-001') {
            actionHtml = `
                <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                    ${reportBtn}
                    <span style="font-size:11px; font-weight:700; color:var(--text-muted); background:var(--bg-card-subtle, rgba(0,0,0,0.04)); padding:3px 8px; border-radius:4px;" title="Cliente predeterminado de mostrador">Principal</span>
                </div>
            `;
        } else {
            actionHtml = `
                <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                    ${reportBtn}
                    <button class="ticket-btn-sm btn-danger-sm" onclick="confirmDeleteCustomer('${c.id}')" title="Eliminar cliente del directorio">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            `;
        }

        html += `
            <tr>
                <td><span class="code-badge">${c.id}</span></td>
                <td><b>${c.nombre}</b></td>
                <td><span style="font-weight:700; color:#003366;">${c.rif}</span></td>
                <td>${c.telefono || 'N/A'}</td>
                <td><span style="font-size:12px; color:var(--text-muted);">${c.direccion || 'Cabimas, Edo. Zulia'}</span></td>
                <td><span style="font-size:12px; color:var(--text-muted);">${c.notas || 'Sin notas'}</span></td>
                <td style="text-align:right;">${actionHtml}</td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

function viewCustomerPurchasesReport(clientRifOrName) {
    if (typeof NovaReports !== 'undefined' && NovaReports.openReportModal) {
        NovaReports.openReportModal('compras_cliente', clientRifOrName);
    } else {
        navigateTo('reports');
    }
}

function confirmDeleteCustomer(customerId) {
    if (!customerId || customerId === 'CLI-001') {
        showNovaAlert({
            title: "Acción Protegida",
            message: "El Cliente Mostrador principal no puede ser eliminado ya que es requerido para el funcionamiento del mostrador.",
            type: "warning"
        });
        return;
    }

    const customers = NovaDB.getCustomers();
    const cust = customers.find(c => c.id === customerId);
    const clientName = cust ? cust.nombre : customerId;

    if (confirm(`¿Estás seguro de que deseas eliminar al cliente [${customerId}] "${clientName}" del directorio?\nEsta acción no se puede deshacer.`)) {
        const deleted = NovaDB.deleteCustomer(customerId);
        if (deleted) {
            renderCustomersView();
            renderPOSCustomerSelect();
            showNovaAlert({
                title: "Cliente Eliminado",
                message: `El registro de "${clientName}" fue eliminado correctamente de la base de datos.`,
                type: "info"
            });
        }
    }
}

function openAddCustomerModal() {
    openModal('addCustomerModal');
}

function submitNewCustomer() {
    const nombre = document.getElementById('custNombre').value.trim();
    const rif = document.getElementById('custRif').value.trim();
    const telefono = document.getElementById('custTelefono').value.trim();
    const direccion = document.getElementById('custDireccion') ? document.getElementById('custDireccion').value.trim() : '';

    if (!nombre || !rif) {
        showNovaAlert({ title: "Datos Requeridos", message: "El nombre y el RIF/Cédula son obligatorios.", type: "warning" });
        return;
    }

    // Todos los clientes se califican de manera estándar y uniforme en la base de datos
    const saved = NovaDB.saveCustomer({ nombre, rif, telefono, direccion, tipo: 'cliente' });
    closeModal('addCustomerModal');

    // Limpiar campos
    document.getElementById('custNombre').value = '';
    document.getElementById('custRif').value = '';
    document.getElementById('custTelefono').value = '';
    if (document.getElementById('custDireccion')) document.getElementById('custDireccion').value = '';

    renderCustomersView();
    renderPOSCustomerSelect();

    // Si estamos en POS, asignar inmediatamente como cliente seleccionado
    if (saved) {
        posSelectedCustomer = saved;
        const sel = document.getElementById('posCustomerSelect');
        if (sel) sel.value = saved.id;
    }

    showNovaAlert({ title: "Cliente Guardado", message: `Se registró a "${nombre}" (${rif}) correctamente en la base de datos.`, type: "success" });
}

// ==============================================================================
// BÚSQUEDA RÁPIDA Y SELECCIÓN DE CLIENTES EXISTENTES (LUPA POS)
// ==============================================================================
function openSearchCustomerModal() {
    openModal('searchCustomerModal');
    const input = document.getElementById('posCustomerSearchQuickInput');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 80);
    }
    filterQuickCustomerSearch('');
}

function filterQuickCustomerSearch(query) {
    const listContainer = document.getElementById('quickCustomerSearchResults');
    if (!listContainer) return;

    const customers = NovaDB.getCustomers();
    const q = (query || '').toLowerCase().trim();

    const filtered = customers.filter(c => {
        if (!q) return true;
        const nombre = (c.nombre || '').toLowerCase();
        const rif = (c.rif || '').toLowerCase();
        const tel = (c.telefono || '').toLowerCase();
        return nombre.includes(q) || rif.includes(q) || tel.includes(q);
    });

    if (filtered.length === 0) {
        const safeQuery = String(query || '').replace(/[&<>"']/g, "");
        listContainer.innerHTML = `
            <div style="text-align:center; padding:24px 12px; color:var(--text-muted);">
                <p style="margin:0 0 12px 0; font-size:13px;">No se encontró ningún cliente registrado que coincida con <b>"${safeQuery}"</b>.</p>
                <button type="button" class="btn-quick-export" onclick="closeModal('searchCustomerModal'); openAddCustomerModal();" style="display:inline-flex; align-items:center; gap:6px; margin:0 auto; padding:7px 14px; font-weight:700;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Registrar Nuevo Cliente
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    filtered.forEach(c => {
        const isCurrent = (posSelectedCustomer && posSelectedCustomer.id === c.id);
        const activeBorder = isCurrent ? 'border-color:#003366; background:#e8f0fe;' : '';
        html += `
            <div class="quick-customer-item" style="${activeBorder}" onclick="selectCustomerFromSearch('${c.id}')" title="Seleccionar este cliente para la venta actual">
                <div class="quick-customer-info">
                    <span class="quick-customer-name">${c.nombre}</span>
                    <div class="quick-customer-meta">
                        <span style="font-weight:700; color:#003366;">${c.rif}</span>
                        ${c.telefono ? `<span>• Telf: ${c.telefono}</span>` : ''}
                        ${c.direccion ? `<span>• ${c.direccion}</span>` : ''}
                    </div>
                </div>
                <div>
                    <button type="button" class="btn-select-customer-pill" onclick="event.stopPropagation(); selectCustomerFromSearch('${c.id}')">
                        ${isCurrent ? 'Activo en Ticket' : 'Seleccionar'}
                    </button>
                </div>
            </div>
        `;
    });
    listContainer.innerHTML = html;
}

function selectCustomerFromSearch(customerId) {
    const customers = NovaDB.getCustomers();
    const found = customers.find(c => c.id === customerId);
    if (!found) return;

    posSelectedCustomer = found;
    const sel = document.getElementById('posCustomerSelect');
    if (sel) {
        sel.value = found.id;
    }
    closeModal('searchCustomerModal');
    showNovaAlert({
        title: "Cliente Seleccionado",
        message: `Cliente cargado en ticket: <b>${found.nombre}</b> (${found.rif}).`,
        type: "success"
    });
}

// ==============================================================================
// 7. MÓDULO: MARKETING Y PROMO WHATSAPP
// ==============================================================================
function renderMarketingView() {
    // Inicializar plantillas de WhatsApp
}

function sendMarketingWhatsApp(tipo) {
    const phone = "584246192394";
    let msg = "";

    if (tipo === 'gas') {
        msg = `¡Hola! Saludos del equipo de *NOVA RefriMotors*. Te informamos que ya tenemos disponibilidad inmediata de Recargas de Gas Refrigerante *R134a, R410a, R22 y R507* por kilo al mejor precio para técnicos. ¡Visítanos en Av. Carabobo o escríbenos para apartar el tuyo!`;
    } else if (tipo === 'capacitores') {
        msg = `¡Estimado técnico! En *NOVA RefriMotors* tenemos stock completo en capacitores de marcha y arranque Maxwell y Gold (20uF hasta 80uF) con precios especiales de descuento NovaCliente.`;
    } else {
        msg = `¡Hola! Aprovecha las promociones de la semana en *NOVA RefriMotors* en repuestos de refrigeración, motores y herramientas con delivery disponible en Cabimas.`;
    }

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// ==============================================================================
// 8. MÓDULO: CONFIGURACIÓN Y RESPALDOS
// ==============================================================================
function renderSettingsView() {
    const s = NovaDB.getSettings();
    document.getElementById('cfgTasaBCV').value = s.tasaBCV;
    document.getElementById('cfgTasaInterna').value = s.tasaInterna;
    document.getElementById('cfgNombreEmpresa').value = s.empresa.nombre;
    document.getElementById('cfgRifEmpresa').value = s.empresa.rif;
    document.getElementById('cfgTelefonoEmpresa').value = s.empresa.telefono;
    document.getElementById('cfgDireccionEmpresa').value = s.empresa.direccion;
}

function saveCompanySettings() {
    const tasaBCV = parseFloat(document.getElementById('cfgTasaBCV').value) || 897.54;
    const tasaInterna = parseFloat(document.getElementById('cfgTasaInterna').value) || 1050;
    const nombre = document.getElementById('cfgNombreEmpresa').value.trim();
    const rif = document.getElementById('cfgRifEmpresa').value.trim();
    const telefono = document.getElementById('cfgTelefonoEmpresa').value.trim();
    const direccion = document.getElementById('cfgDireccionEmpresa').value.trim();

    NovaDB.updateSettings({
        tasaBCV,
        tasaInterna,
        empresa: { nombre, rif, telefono, direccion }
    });

    updateBCVDisplay();
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('nova_pos_channel');
            bc.postMessage({ type: 'BCV_RATE_UPDATED', rate: tasaBCV });
        }
    } catch (e) { }
    showNovaAlert({ title: "Configuración Guardada", message: "Los parámetros del sistema y la tasa oficial han sido actualizados en la red.", type: "success" });
}

function exportERPBackup() {
    const jsonStr = NovaDB.exportFullBackupJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `Backup-Nova-ERP-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNovaAlert({ title: "Copia Descargada", message: "Se ha guardado el archivo de respaldo completo en tu carpeta de descargas.", type: "success" });
}

function triggerImportBackup() {
    document.getElementById('backupFileInput').click();
}

function handleBackupFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const res = NovaDB.importFullBackupJSON(e.target.result);
        if (res.success) {
            showNovaAlert({
                title: "Restauración Exitosa",
                message: "La base de datos del ERP ha sido restaurada con éxito. La página se actualizará.",
                type: "success",
                onConfirm: () => location.reload()
            });
        } else {
            showNovaAlert({ title: "Error al Restaurar", message: res.message, type: "error" });
        }
    };
    reader.readAsText(file);
}

// ==========================================
// INTEGRACIÓN NUBE SUPABASE (CONTROLADORES)
// ==========================================
async function triggerManualSync() {
    if (typeof NovaSupabase === 'undefined') return;
    await NovaSupabase.processQueue();
    const queue = NovaSupabase.getQueue();
    if (queue.length === 0) {
        if (typeof NovaSupabase.pullCloudUpdates === 'function') {
            await NovaSupabase.pullCloudUpdates();
        }
        showNovaAlert({
            title: "Nube Actualizada",
            message: "Todos los datos locales y de la nube están 100% sincronizados con Supabase.",
            type: "success"
        });
    } else {
        const lastErr = NovaSupabase.getLastError() || "Error de respuesta del servidor Supabase";
        showNovaAlert({
            title: "Sincronización Parcial",
            message: `Quedan ${queue.length} registro(s) pendiente(s) por enviar.\n\nDetalle del error:\n${lastErr}\n\nPuedes pulsar 'Limpiar Cola' si se trata de un registro huérfano.`,
            type: "warning"
        });
    }
}

function triggerClearQueue() {
    if (typeof NovaSupabase === 'undefined') return;
    const q = NovaSupabase.getQueue();
    if (q.length === 0) {
        showNovaAlert({
            title: "Cola al Día",
            message: "No hay registros pendientes en la cola.",
            type: "info"
        });
        return;
    }

    if (confirm(`Hay ${q.length} registro(s) pendiente(s) en la cola.\n¿Deseas descartar los registros pendientes atascados para restablecer la sincronización con la nube?`)) {
        NovaSupabase.clearQueue();
        showNovaAlert({
            title: "Cola Limpiada",
            message: "Se vació la cola de pendientes. El estado del sistema ahora es 'Nube Conectada'.",
            type: "success"
        });
    }
}

async function triggerSeedCatalog() {
    if (typeof NovaSupabase === 'undefined') return;
    const confirmSeed = confirm("¿Deseas sincronizar los 460 repuestos y existencias hacia la base de datos de Supabase?");
    if (!confirmSeed) return;

    showNovaAlert({
        title: "Subiendo Catálogo...",
        message: "Subiendo los 460 repuestos y especificaciones a la nube de Supabase. Esto tomará solo unos segundos...",
        type: "success"
    });

    try {
        const res = await NovaSupabase.seedFullCatalog((inserted, total) => {
            console.log(`Progreso: ${inserted}/${total}`);
        });
        showNovaAlert({
            title: "¡Catálogo en la Nube!",
            message: `Se han sincronizado ${res.count} repuestos y sus existencias en Supabase exitosamente.`,
            type: "success"
        });
    } catch (err) {
        showNovaAlert({
            title: "Error al Cargar",
            message: "No se pudo completar la carga: " + (err.message || err),
            type: "error"
        });
    }
}

async function triggerPurgeTestData() {
    const confirm1 = confirm("⚠️ ATENCIÓN: LIMPIEZA TOTAL DE REGISTROS DE PRUEBA ⚠️\n\n¿Estás seguro de que deseas purgar los registros de prueba?\n\n• Se borrarán todas las ventas y facturas demo\n• Se borrarán todos los egresos y compras de prueba\n• Se borrarán todos los proveedores de prueba\n• Se borrarán todos los clientes demo (dejando únicamente Cliente Mostrador CLI-001)\n• Se reiniciará el turno de caja a 0\n\n🔒 EL INVENTARIO DE PRODUCTOS Y EXISTENCIAS NO SE TOCARÁ NI SE BORRARÁ.\n\n¿Deseas continuar?");
    if (!confirm1) return;

    const confirm2 = confirm("CONFIRMACIÓN FINAL:\n\nEsta acción dejará la base de datos totalmente limpia y pura para iniciar operaciones reales.\n\n¿Proceder con la purga?");
    if (!confirm2) return;

    try {
        // 1. Purga local en NovaDB
        if (typeof NovaDB !== 'undefined' && typeof NovaDB.purgeTestData === 'function') {
            NovaDB.purgeTestData();
        }

        // 2. Purga en Supabase (si hay conexión)
        if (typeof NovaSupabase !== 'undefined' && typeof NovaSupabase.purgeCloudTestData === 'function') {
            await NovaSupabase.purgeCloudTestData();
        }

        showNovaAlert({
            title: "Limpieza Completada",
            message: "La base de datos ha sido purgada con éxito. Se eliminaron todos los registros de prueba y se conservó el inventario completo. El sistema se recargará ahora.",
            type: "success",
            onConfirm: () => location.reload()
        });
    } catch (err) {
        showNovaAlert({
            title: "Error en Limpieza",
            message: "Ocurrió un error al purgar: " + (err.message || err),
            type: "error"
        });
    }
}

// ==========================================
// UTILIDADES GENERALES DE MODALES
// ==========================================
function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('active');
}

function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('active');
    if (modalId === 'invoiceDocModal') {
        const fbCanvas = document.getElementById('invoiceDocCanvasFallback');
        if (fbCanvas) fbCanvas.remove();
        const imgEl = document.getElementById('invoiceDocImg');
        if (imgEl) imgEl.style.display = 'block';
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.erp-modal-overlay.active').forEach(m => m.classList.remove('active'));
        const alertModal = document.getElementById('novaAlertModal');
        if (alertModal && alertModal.classList.contains('active')) alertModal.classList.remove('active');
    }
});

// ==========================================
// SISTEMA DE ALERTAS Y AVISOS MODALES NOVA
// ==========================================
let _localAlertCallback = null;
function showNovaAlert({ title, message, type = 'info', confirmText = 'Entendido', onConfirm = null }) {
    _localAlertCallback = onConfirm;
    const modal = document.getElementById('novaAlertModal');
    const titleEl = document.getElementById('novaAlertTitle');
    const msgEl = document.getElementById('novaAlertMessage');
    const iconEl = document.getElementById('novaAlertIcon');
    const btnEl = document.getElementById('novaAlertConfirmBtn');

    if (!modal) {
        alert(message);
        if (onConfirm) onConfirm();
        return;
    }

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerHTML = message;
    if (btnEl) btnEl.innerText = confirmText;

    if (iconEl) {
        iconEl.className = 'nova-alert-icon ' + type;
        if (type === 'warning') {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        } else if (type === 'success') {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2.6"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (type === 'error') {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        } else {
            iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }
    }

    modal.classList.add('active');
    if (btnEl) btnEl.focus();
}

function closeNovaAlert(event) {
    if (event && event.target !== event.currentTarget && !event.target.classList.contains('nova-alert-btn')) {
        return;
    }
    const modal = document.getElementById('novaAlertModal');
    if (modal) modal.classList.remove('active');
    if (_localAlertCallback) {
        const cb = _localAlertCallback;
        _localAlertCallback = null;
        try { cb(); } catch (err) { console.error(err); }
    }
}

if (typeof window !== 'undefined') {
    window.openReprintModal = openReprintModal;
    window.filterReprintSales = filterReprintSales;
    window.reprintLastSaleDirectly = reprintLastSaleDirectly;
    window.reprintSaleDirectly = reprintSaleDirectly;
    window.reprintViewDocument = reprintViewDocument;
}

