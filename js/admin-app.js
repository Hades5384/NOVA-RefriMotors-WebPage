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
        cash: { title: "Caja y Finanzas Operativas", subtitle: "Arqueo diario, control de métodos de pago y egresos" },
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
    const settings = NovaDB.getSettings();
    const valEl = document.getElementById('bcvRateVal');
    if (valEl) valEl.innerText = `Bs. ${settings.tasaBCV.toFixed(2)}`;
}

function promptEditBCV() {
    if (typeof NovaUsers !== 'undefined' && NovaUsers.isSeller()) {
        showNovaAlert({
            title: "Acceso Restringido",
            message: "Solo el usuario MASTER puede modificar la Tasa Oficial BCV.",
            type: "warning"
        });
        return;
    }

    const current = NovaDB.getSettings().tasaBCV;
    const input = prompt("Ingrese la nueva Tasa Oficial BCV (Bs. / USD):", current.toFixed(2));
    if (input !== null) {
        const val = parseFloat(input.replace(',', '.'));
        if (!isNaN(val) && val > 0) {
            NovaDB.setTasaBCV(val);
            updateBCVDisplay();
            if (currentView === 'pos') renderPOSCart();
            showNovaAlert({
                title: "Tasa Actualizada",
                message: `La tasa oficial BCV ha sido fijada en Bs. ${val.toFixed(2)}`,
                type: "success"
            });
        } else {
            showNovaAlert({
                title: "Valor Inválido",
                message: "Por favor ingrese un número válido mayor a cero.",
                type: "warning"
            });
        }
    }
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
        if (item.stock === 0) {
            stockBadgeClass += ' zero';
            stockLabel = 'Agotado';
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
            <div class="pos-item-card" onclick="addToPOSCart('${item.id}')">
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
    const invItem = inv[itemId];
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

    const existingIdx = posCart.findIndex(item => item.id === itemId);
    if (existingIdx !== -1) {
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
        posCart[index].quantity += diff;
        if (posCart[index].quantity <= 0) {
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
        metodosPago: [{ metodo: 'Presupuesto / Cotización', montoUSD: totalUSD }],
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
// MODAL DE COBRO Y EMISIÓN DE FACTURA/TICKET
// ==========================================
function isDivisaPaymentMethod(method) {
    const m = (method || '').toLowerCase();
    return m.includes('usd') || m.includes('dolar') || m.includes('dólar') || m.includes('zelle') || m.includes('binance');
}

function updateCheckoutTotals() {
    if (posCart.length === 0) return;

    const settings = NovaDB.getSettings();
    const payMethod = document.getElementById('coPaymentMethod') ? document.getElementById('coPaymentMethod').value : 'Efectivo USD';
    const isUSD = isDivisaPaymentMethod(payMethod);

    let totalUSD = 0;
    let totalBs = 0;

    posCart.forEach(item => {
        const p = calcularPreciosSegunAjustes(item.costoCompra, settings, item.porcentajeUtilidad, item.iva);
        if (isUSD) {
            // Descuento automático al pagar en divisas (efectivo $, zelle, binance)
            totalUSD += p.novaClientesUSD * item.quantity;
        } else {
            // Precio estándar en Bolívares (tarjeta, debito, pago movil, biopago)
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
    if (isUSD) {
        if (inputUSD) inputUSD.value = totalUSD.toFixed(2);
        if (inputBs) inputBs.value = "0.00";
    } else {
        if (inputUSD) inputUSD.value = "0.00";
        if (inputBs) inputBs.value = totalBs.toFixed(2);
    }

    calculateChange();
}

function onPaymentMethodChange() {
    updateCheckoutTotals();
}

function openCheckoutModal() {
    if (posCart.length === 0) return;

    // Precargar cliente en el modal
    if (posSelectedCustomer) {
        const nameEl = document.getElementById('coCustName');
        const rifEl = document.getElementById('coCustRif');
        const phoneEl = document.getElementById('coCustPhone');
        if (nameEl) nameEl.value = posSelectedCustomer.nombre || '';
        if (rifEl) rifEl.value = posSelectedCustomer.rif || '';
        if (phoneEl) phoneEl.value = posSelectedCustomer.telefono || '';
    }

    // Calcular montos acordes al método de pago seleccionado
    updateCheckoutTotals();

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
    const custName = document.getElementById('coCustName').value.trim() || 'Cliente Mostrador';
    const custRif = document.getElementById('coCustRif').value.trim() || 'V-00000000';
    const custPhone = document.getElementById('coCustPhone').value.trim() || '';
    const docType = document.getElementById('coDocType').value;
    const payMethod = document.getElementById('coPaymentMethod').value;
    const refNum = document.getElementById('coPaymentRef').value.trim();

    const isUSD = isDivisaPaymentMethod(payMethod);
    const settings = NovaDB.getSettings();

    let totalUSD = 0;
    let totalBs = 0;

    posCart.forEach(item => {
        const p = calcularPreciosSegunAjustes(item.costoCompra, settings, item.porcentajeUtilidad, item.iva);
        if (isUSD) {
            totalUSD += p.novaClientesUSD * item.quantity;
        } else {
            totalUSD += p.publicoUSD * item.quantity;
            totalBs += p.publicoBs * item.quantity;
        }
    });

    if (isUSD) {
        totalBs = totalUSD * settings.tasaBCV;
    }

    const activeUser = (typeof NovaUsers !== 'undefined') ? NovaUsers.getCurrentUser() : { id: 'MASTER', name: 'MASTER' };
    const originalOrigin = window._currentHeldSaleOrigin;

    const saleRecord = {
        cliente: { nombre: custName, rif: custRif, telefono: custPhone, tipo: isUSD ? 'divisas' : 'publico' },
        items: posCart,
        tipoPrecio: isUSD ? 'divisas' : 'publico',
        descuentoDivisas: isUSD,
        tipoDocumento: docType,
        tasaBCV: settings.tasaBCV,
        totalUSD,
        totalBs,
        metodosPago: [{ metodo: payMethod, montoUSD: totalUSD, montoBs: totalBs, referencia: refNum }],
        vendedor: originalOrigin ? (originalOrigin.estacion || originalOrigin.vendedor) : activeUser.name,
        cajero: activeUser.name,
        pedIdOriginal: originalOrigin ? originalOrigin.id : null
    };

    window._currentHeldSaleOrigin = null;

    const saved = NovaDB.registerSale(saleRecord);
    closeModal('checkoutModal');

    // Limpiar carrito de mostrador
    posCart = [];
    renderPOSCart();
    renderPOSCatalog();

    // Generar documento visual y abrir modal de comprobante directamente
    await generateInvoiceDocument(saved);
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

        // Determinar método de pago principal y moneda (Dólares vs Bolívares)
        let primaryMethod = 'Efectivo USD';
        let refNum = '';
        if (Array.isArray(sale.metodosPago) && sale.metodosPago.length > 0) {
            primaryMethod = sale.metodosPago[0].metodo || 'Efectivo USD';
            refNum = sale.metodosPago[0].referencia || '';
        }

        const methodLower = primaryMethod.toLowerCase();
        // Métodos en divisas: Efectivo USD, Zelle, Binance Pay
        const isUSD = isDivisaPaymentMethod(primaryMethod);
        const tasa = Number(sale.tasaBCV) || Number(settings.tasaBCV) || 914.02;

        let methodLabel = primaryMethod.toUpperCase();
        if (methodLower.includes('efectivo') && isUSD) methodLabel = "EFECTIVO ($ USD)";
        else if (methodLower.includes('efectivo') && !isUSD) methodLabel = "EFECTIVO (BS)";
        else if (methodLower.includes('punto') || methodLower.includes('débito') || methodLower.includes('debito')) methodLabel = "PUNTO DE VENTA (DEBITO)";
        else if (methodLower.includes('móvil') || methodLower.includes('movil') || methodLower.includes('biopago')) methodLabel = "PAGO MOVIL (BIOPAGO)";
        else if (methodLower.includes('transferencia')) methodLabel = "TRANSFERENCIA BANCARIA";
        else if (methodLower.includes('zelle')) methodLabel = "ZELLE";
        else if (methodLower.includes('binance')) methodLabel = "BINANCE PAY";

        if (refNum) {
            methodLabel += ` [REF: ${refNum}]`;
        }

        const totalProductosVendidos = (sale.items || []).reduce((acc, it) => acc + (parseInt(it.quantity) || 1), 0);

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

        // Estimación dinámica de altura
        const estimatedH = Math.ceil((470 + ((sale.items ? sale.items.length : 0) * 36) + (PAD * 2)) * SCALE);
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

        ctx.fillText("DIRECCION:", PAD, curY);
        ctx.fillText(custDir.length > 25 ? custDir.substring(0, 24) + '..' : custDir, colValX, curY);
        curY += 16 * SCALE;

        if (custPhone) {
            ctx.fillText("%DEL", PAD, curY);
            ctx.fillText(`TLF: ${custPhone}`, colValX, curY);
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
                const prices = (typeof calcularPreciosSegunAjustes === 'function')
                    ? calcularPreciosSegunAjustes(it.costoCompra, settings, it.porcentajeUtilidad, it.iva)
                    : { publicoUSD: (it.costoCompra || 0) * 1.77, novaClientesUSD: (it.costoCompra || 0) * 1.508, publicoBs: (it.costoCompra || 0) * 1.77 * 914.02 };
                // Si el pago es en divisas ($ efectivo, zelle, binance), el precio unitario refleja el descuento en divisas
                const isDivisa = isUSD || sale.tipoPrecio === 'divisas' || sale.descuentoDivisas || sale.tipoPrecio === 'novacliente';
                const unitPriceUSD = isDivisa ? prices.novaClientesUSD : prices.publicoUSD;
                const lineTotalUSD = unitPriceUSD * it.quantity;

                // Renglón 1: Descripción en mayúsculas
                ctx.font = `bold ${11 * SCALE}px ${FONT_MONO}`;
                ctx.textAlign = 'left';
                const itName = it.name.toUpperCase();
                ctx.fillText(itName.length > 34 ? itName.substring(0, 32) + '..' : itName, PAD, curY);
                curY += 14 * SCALE;

                // Renglón 2: Código   Cant x PrecioUnit                    Total
                ctx.font = `bold ${11 * SCALE}px ${FONT_MONO}`;
                ctx.textAlign = 'left';

                if (isUSD) {
                    ctx.fillText(`${it.id}    ${it.quantity} x $${unitPriceUSD.toFixed(2)}`, PAD, curY);
                    ctx.textAlign = 'right';
                    ctx.fillText(`$${lineTotalUSD.toFixed(2)}`, WIDTH - PAD, curY);
                } else {
                    const unitPriceBs = prices.publicoBs || (unitPriceUSD * tasa);
                    const lineTotalBs = unitPriceBs * it.quantity;
                    ctx.fillText(`${it.id}    ${it.quantity} x Bs. ${unitPriceBs.toFixed(2)}`, PAD, curY);
                    ctx.textAlign = 'right';
                    ctx.fillText(`Bs. ${lineTotalBs.toFixed(2)}`, WIDTH - PAD, curY);
                }
                curY += 18 * SCALE;
            });
        }
        curY += 4 * SCALE;

        // 5. LÍNEA DISCONTINUA & TOTAL Y FORMA DE PAGO SELECCIONADA
        drawDashedLine(curY);
        curY += 12 * SCALE;

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

        // ÚNICO SLOT: FORMA DE PAGO UTILIZADA
        ctx.font = `bold ${11.5 * SCALE}px ${FONT_MONO}`;
        ctx.textAlign = 'left';
        ctx.fillText(methodLabel, PAD, curY);
        ctx.textAlign = 'right';
        if (isUSD) {
            ctx.fillText(`$${sale.totalUSD.toFixed(2)}`, WIDTH - PAD, curY);
        } else {
            ctx.fillText(`Bs. ${sale.totalBs.toFixed(2)}`, WIDTH - PAD, curY);
        }
        curY += 18 * SCALE;

        // TOTAL PRODUCTOS VENDIDOS
        ctx.font = `bold ${12 * SCALE}px ${FONT_MONO}`;
        ctx.textAlign = 'left';
        ctx.fillText("TOTAL PRODUCTOS VENDIDOS:", PAD, curY);
        ctx.textAlign = 'right';
        ctx.fillText(String(totalProductosVendidos), WIDTH - PAD, curY);
        curY += 18 * SCALE;

        // 6. LÍNEA DISCONTINUA & DATOS DE CAJERO / VENDEDOR
        drawDashedLine(curY);
        curY += 12 * SCALE;

        ctx.font = `bold ${11 * SCALE}px ${FONT_MONO}`;
        ctx.textAlign = 'left';
        ctx.fillText(`USUARIO: ${(sale.vendedor || '0.11-CAJA PRINCIPAL').toUpperCase()}`, PAD, curY);
        curY += 15 * SCALE;

        ctx.fillText("VENDEDOR: 01 MOSTRADOR", PAD, curY);
        curY += 22 * SCALE;

        // 7. AVISO LEGAL INFERIOR (CENTRALIZADO)
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

function printCurrentDocument() {
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
        @page { margin: 0; size: auto; }
        body { margin: 0; padding: 0; background: #ffffff; display: flex; justify-content: center; }
        img { width: 100%; max-width: 380px; height: auto; image-rendering: crisp-edges; image-rendering: pixelated; }
    </style>
</head>
<body>
    <img src="${docUrl}" onload="setTimeout(()=>{ window.print(); window.close(); }, 250);">
</body>
</html>`);
    w.document.close();
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
            ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px; max-width:340px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.descripcionDetallada.replace(/"/g, '&quot;')}">${item.descripcionDetallada}</div>`
            : '';

        html += `
            <tr>
                <td><span class="code-badge">${item.id}</span></td>
                <td><b>${item.name}</b>${descPreview}</td>
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
                <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button class="ticket-btn-sm" onclick="quickStockAdjust('${item.id}', -1)">-</button>
                        <b style="min-width:24px; text-align:center;">${item.stock}</b>
                        <button class="ticket-btn-sm" onclick="quickStockAdjust('${item.id}', 1)">+</button>
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td style="text-align:right;">
                    <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                        <button class="ticket-btn-sm" onclick="openEditProductModal('${item.id}')" title="Modificar descripción, costo, utilidad e IVA" style="color:var(--primary); font-weight:700; padding:4px 8px; display:inline-flex; align-items:center; gap:4px;">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Editar
                        </button>
                        <button class="ticket-btn-sm" onclick="confirmDeleteProduct('${item.id}')" style="color:var(--danger);" title="Eliminar del catálogo">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
// 4. MÓDULO: CAJA Y FINANZAS
// ==============================================================================
function renderCashView() {
    const activeShift = NovaDB.getActiveShift();
    const sales = NovaDB.getSales();
    const expenses = NovaDB.getExpenses();
    const settings = NovaDB.getSettings();

    const shiftSales = activeShift ? sales.filter(s => activeShift.ventasIds.includes(s.id)) : [];
    const shiftExpenses = activeShift ? expenses.filter(e => activeShift.egresosIds && activeShift.egresosIds.includes(e.id)) : [];

    let totalVentasUSD = shiftSales.reduce((acc, s) => acc + s.totalUSD, 0);
    let totalEgresosUSD = shiftExpenses.reduce((acc, e) => acc + e.montoUSD, 0);
    let gananciaNetaUSD = totalVentasUSD - totalEgresosUSD;

    document.getElementById('cashKpiVentas').innerText = `$${totalVentasUSD.toFixed(2)}`;
    document.getElementById('cashKpiVentasBs').innerText = `Bs. ${(totalVentasUSD * settings.tasaBCV).toFixed(2)}`;
    document.getElementById('cashKpiEgresos').innerText = `$${totalEgresosUSD.toFixed(2)}`;
    document.getElementById('cashKpiNeto').innerText = `$${gananciaNetaUSD.toFixed(2)}`;

    // Renderizar lista de egresos
    const egresosTbody = document.getElementById('expensesTableBody');
    if (egresosTbody) {
        if (shiftExpenses.length === 0) {
            egresosTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px; color:var(--text-muted);">Sin egresos registrados en este turno.</td></tr>`;
        } else {
            let egHtml = '';
            shiftExpenses.forEach(eg => {
                egHtml += `
                    <tr>
                        <td><b>${eg.concepto}</b></td>
                        <td><span style="font-size:12px; color:var(--text-muted);">${eg.categoria}</span></td>
                        <td>${eg.metodoPago}</td>
                        <td><b style="color:var(--danger);">$${eg.montoUSD.toFixed(2)}</b></td>
                    </tr>`;
            });
            egresosTbody.innerHTML = egHtml;
        }
    }
}

function openAddExpenseModal() {
    openModal('addExpenseModal');
}

function submitNewExpense() {
    const concepto = document.getElementById('expConcepto').value.trim();
    const categoria = document.getElementById('expCategoria').value;
    const monto = parseFloat(document.getElementById('expMonto').value) || 0;
    const metodo = document.getElementById('expMetodo').value;

    if (!concepto || monto <= 0) {
        showNovaAlert({ title: "Datos Incompletos", message: "Ingrese el concepto y un monto válido para el gasto.", type: "warning" });
        return;
    }

    NovaDB.addExpense({ concepto, categoria, montoUSD: monto, metodoPago: metodo });
    document.getElementById('expConcepto').value = '';
    document.getElementById('expMonto').value = '';
    closeModal('addExpenseModal');
    renderCashView();
    showNovaAlert({ title: "Egreso Registrado", message: `Se registró el egreso de $${monto.toFixed(2)} con éxito.`, type: "success" });
}

function openCashReconciliationModal() {
    const active = NovaDB.getActiveShift();
    if (!active) return;

    const sales = NovaDB.getSales().filter(s => active.ventasIds.includes(s.id));
    const totalUSD = sales.reduce((acc, s) => acc + s.totalUSD, 0);

    document.getElementById('recExpectedUSD').innerText = `$${totalUSD.toFixed(2)}`;
    openModal('reconciliationModal');
}

function submitCashReconciliation() {
    const countedUSD = parseFloat(document.getElementById('recCountedUSD').value) || 0;
    const nextUSD = parseFloat(document.getElementById('recNextShiftUSD').value) || 50;

    NovaDB.closeActiveShift({
        conteoFisicoUSD: countedUSD,
        montoInicialSiguienteUSD: nextUSD
    });

    closeModal('reconciliationModal');
    renderCashView();
    showNovaAlert({
        title: "¡Arqueo Completado!",
        message: "El turno ha sido cerrado y se ha abierto automáticamente el nuevo ciclo de caja.",
        type: "success"
    });
}

// ==============================================================================
// 5. MÓDULO: COMPRAS Y PROVEEDORES
// ==============================================================================
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
        html += `
            <tr>
                <td><span class="code-badge">${p.id}</span></td>
                <td>${p.fechaStr}</td>
                <td><b>${p.proveedorNombre || 'Distribuidor'}</b></td>
                <td>${p.items.length} repuestos</td>
                <td><b style="color:var(--primary);">$${p.totalUSD.toFixed(2)}</b></td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

function openAddPurchaseModal() {
    const provs = NovaDB.getSuppliers();
    const sel = document.getElementById('purSupplierSelect');
    if (sel) {
        sel.innerHTML = provs.map(p => `<option value="${p.id}">${p.razonSocial} (${p.rubro})</option>`).join('');
    }
    openModal('addPurchaseModal');
}

function submitNewPurchase() {
    const provId = document.getElementById('purSupplierSelect').value;
    const provObj = NovaDB.getSuppliers().find(p => p.id === provId);
    const itemCode = document.getElementById('purItemCode').value.trim().toUpperCase();
    const qty = parseInt(document.getElementById('purItemQty').value) || 0;
    const cost = parseFloat(document.getElementById('purItemCost').value) || 0;

    if (!itemCode || qty <= 0) {
        showNovaAlert({ title: "Datos Incompletos", message: "Ingrese el código del producto y una cantidad válida.", type: "warning" });
        return;
    }

    NovaDB.registerPurchase({
        proveedorId: provId,
        proveedorNombre: provObj ? provObj.razonSocial : "Proveedor",
        items: [{ id: itemCode, cantidad: qty, costoCompra: cost }],
        totalUSD: cost * qty
    });

    document.getElementById('purItemCode').value = '';
    document.getElementById('purItemQty').value = '1';
    document.getElementById('purItemCost').value = '';

    closeModal('addPurchaseModal');
    renderPurchasesView();
    if (currentView === 'inventory') renderInventoryView();
    showNovaAlert({
        title: "¡Mercancía Registrada!",
        message: `Se agregaron ${qty} unidades al repuesto ${itemCode} y se actualizaron los inventarios.`,
        type: "success"
    });
}

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
    showNovaAlert({ title: "Configuración Guardada", message: "Los parámetros del sistema han sido actualizados.", type: "success" });
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

