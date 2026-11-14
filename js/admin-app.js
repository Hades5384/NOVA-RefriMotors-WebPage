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
 * - Marketing, promociones WhatsApp y enlace a Motion Graphics
 * - Configuración de tasas y respaldos JSON
 * ==============================================================================
 */

let currentView = 'pos';
let posCart = [];
let posSelectedCustomer = null;
let posPriceTier = 'publico'; // 'publico' | 'novacliente'
let posCurrentCategory = 'Todos';

// ==========================================
// 1. INICIALIZACIÓN Y NAVEGACIÓN SPA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initBCVWidget();
    initPOS();
    setupKeyboardShortcuts();
});

function navigateTo(viewName) {
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
    else if (viewName === 'settings') renderSettingsView();
}

function updateHeaderTitles(viewName) {
    const titles = {
        pos: { title: "Punto de Venta y Facturación", subtitle: "Mostrador rápido multimoneda, emisión de tickets y presupuestos" },
        inventory: { title: "Gestión de Inventario y Almacén", subtitle: "Control de existencias, stock mínimo, alertas y valorización" },
        purchases: { title: "Compras y Proveedores", subtitle: "Recepción de mercancía, órdenes de compra y costos" },
        cash: { title: "Caja y Finanzas Operativas", subtitle: "Arqueo diario, control de métodos de pago y egresos" },
        customers: { title: "Directorio de Clientes (CRM)", subtitle: "Fichas de técnicos, talleres e historial de compras" },
        marketing: { title: "Marketing y Promociones", subtitle: "Campañas WhatsApp, combos y suite de motion graphics" },
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

function initClock() {
    function update() {
        const now = new Date();
        const timeEl = document.getElementById('liveClockTime');
        const dateEl = document.getElementById('liveClockDate');
        if (timeEl) timeEl.innerText = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        if (dateEl) dateEl.innerText = now.toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    }
    update();
    setInterval(update, 1000);
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
        // F4: Cobrar POS
        if (e.key === 'F4') {
            e.preventDefault();
            if (currentView === 'pos' && posCart.length > 0) {
                openCheckoutModal();
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
    document.querySelectorAll('.pos-cat-pill').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderPOSCatalog();
}

function renderPOSCustomerSelect() {
    const customers = NovaDB.getCustomers();
    const sel = document.getElementById('posCustomerSelect');
    if (!sel) return;

    let html = '';
    customers.forEach(c => {
        html += `<option value="${c.id}">${c.nombre} (${c.rif}) - [${c.tipo === 'novacliente' ? 'NovaCliente' : 'Público'}]</option>`;
    });
    sel.innerHTML = html;

    // Asignar primer cliente por defecto
    if (customers.length > 0) {
        onPOSCustomerChange(customers[0].id);
    }
}

function onPOSCustomerChange(custId) {
    const customers = NovaDB.getCustomers();
    const found = customers.find(c => c.id === custId);
    if (found) {
        posSelectedCustomer = found;
        setPOSTier(found.tipo, false);
    }
}

function setPOSTier(tier, reRender = true) {
    posPriceTier = tier;
    const btnPub = document.getElementById('btnTierPublic');
    const btnNova = document.getElementById('btnTierNova');
    if (btnPub && btnNova) {
        if (tier === 'publico') {
            btnPub.classList.add('active');
            btnNova.classList.remove('active');
        } else {
            btnNova.classList.add('active');
            btnPub.classList.remove('active');
        }
    }
    if (reRender) {
        renderPOSCatalog();
        renderPOSCart();
    }
}

function filterPOS() {
    renderPOSCatalog();
}

function renderPOSCatalog() {
    const container = document.getElementById('posItemsGrid');
    if (!container) return;

    const queryInput = document.getElementById('posSearchInput');
    const query = queryInput ? queryInput.value.toLowerCase().trim() : '';

    const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
    const inv = NovaDB.getInventory();
    const settings = NovaDB.getSettings();

    // Expandir productos planos y variantes
    let displayList = [];
    prods.forEach(p => {
        const matchesCategory = (posCurrentCategory === 'Todos') || (p.category === posCurrentCategory);
        if (!matchesCategory) return;

        if (p.variants && Array.isArray(p.variants)) {
            p.variants.forEach(v => {
                const fullName = `${p.name} (${v.name})`;
                const matchesQuery = !query ||
                    fullName.toLowerCase().includes(query) ||
                    v.id.toLowerCase().includes(query) ||
                    p.id.toLowerCase().includes(query);

                if (matchesQuery) {
                    displayList.push({
                        id: v.id,
                        parentId: p.id,
                        name: fullName,
                        category: p.category,
                        costoCompra: v.costoCompra,
                        images: p.images || [],
                        stock: inv[v.id] ? inv[v.id].stock : 0
                    });
                }
            });
        } else {
            const matchesQuery = !query ||
                p.name.toLowerCase().includes(query) ||
                p.id.toLowerCase().includes(query) ||
                (p.model && p.model.toLowerCase().includes(query));

            if (matchesQuery) {
                displayList.push({
                    id: p.id,
                    parentId: null,
                    name: p.name,
                    category: p.category,
                    costoCompra: p.costoCompra,
                    images: p.images || [],
                    stock: inv[p.id] ? inv[p.id].stock : 0
                });
            }
        }
    });

    if (displayList.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                <p style="font-weight: 700; font-size: 15px;">No se encontraron repuestos con los filtros actuales.</p>
                <p style="font-size: 12px; margin-top: 6px;">Intenta con otra palabra clave o selecciona 'Todos'.</p>
            </div>`;
        return;
    }

    let html = '';
    // Limitar renderizado a los primeros 60 ítems para máxima fluidez
    const slice = displayList.slice(0, 60);

    slice.forEach(item => {
        const precios = calcularPreciosSegunAjustes(item.costoCompra, settings);
        const priceUSD = (posPriceTier === 'novacliente') ? precios.novaClientesUSD : precios.publicoUSD;
        const priceBs = (posPriceTier === 'novacliente') ? (precios.novaClientesUSD * settings.tasaBCV) : precios.publicoBs;

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
                <img src="${imgUrl}" alt="${item.name}" class="pos-card-thumb" onerror="this.src='productos/NO_PHOTO.webp'" loading="lazy">
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
}

function addToPOSCart(itemId) {
    const prods = (typeof products !== 'undefined' && Array.isArray(products)) ? products : [];
    let found = null;

    for (let p of prods) {
        if (p.id === itemId) {
            found = { id: p.id, name: p.name, costoCompra: p.costoCompra, images: p.images };
            break;
        }
        if (p.variants) {
            let v = p.variants.find(x => x.id === itemId);
            if (v) {
                found = { id: v.id, name: `${p.name} (${v.name})`, costoCompra: v.costoCompra, images: p.images };
                break;
            }
        }
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
        const precios = calcularPreciosSegunAjustes(item.costoCompra, settings);
        const unitPrice = (posPriceTier === 'novacliente') ? precios.novaClientesUSD : precios.publicoUSD;
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

    if (usdEl) usdEl.innerText = `$${totalUSD.toFixed(2)}`;
    if (bsEl) bsEl.innerText = `Bs. ${totalBs.toFixed(2)}`;
    if (subEl) subEl.innerText = `$${totalUSD.toFixed(2)}`;
    if (btn) btn.disabled = (itemCount === 0);
}

function calcularPreciosSegunAjustes(costoCompra, settings) {
    const util = settings.porcentajeUtilidad || 1.30;
    const iva = settings.porcentajeIva || 1.16;
    const tasaInt = settings.tasaInterna || 1050;
    const tasaBCV = settings.tasaBCV || 897.54;

    const novaClientesUSD = costoCompra * util * iva;
    const publicoBs = novaClientesUSD * tasaInt;
    const publicoUSD = publicoBs / tasaBCV;

    return { novaClientesUSD, publicoBs, publicoUSD };
}

// ==========================================
// VENTAS EN ESPERA (PAUSAR Y REANUDAR)
// ==========================================
function holdPOSSale() {
    if (posCart.length === 0) return;
    const title = prompt("Identificador para esta venta en espera (ej: Técnico taller azul / Nombre):", posSelectedCustomer ? posSelectedCustomer.nombre : "");
    if (title !== null) {
        NovaDB.holdCurrentSale(posCart, posSelectedCustomer, title);
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

function renderHeldSalesList() {
    const held = NovaDB.getHeldSales();
    const btn = document.getElementById('btnHeldSales');
    if (btn) {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> En Espera (${held.length})`;
    }
}

function openHeldSalesModal() {
    const held = NovaDB.getHeldSales();
    if (held.length === 0) {
        showNovaAlert({ title: "Sin Ventas en Espera", message: "No hay tickets retenidos actualmente.", type: "info" });
        return;
    }

    let listHtml = '';
    held.forEach(h => {
        const time = new Date(h.timestamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
        listHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid var(--border-color); border-radius:var(--radius-md); background:#ffffff;">
                <div>
                    <b style="font-size:14px; color:var(--primary);">${h.title}</b>
                    <p style="font-size:12px; color:var(--text-muted);">${h.cart.length} productos | Hora: ${time}</p>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="header-action-btn btn-primary-action" onclick="resumeHeldSale('${h.id}')" style="padding:6px 12px; font-size:12px;">Reanudar</button>
                    <button class="ticket-btn-sm" onclick="deleteHeldSale('${h.id}')" style="color:var(--danger);">Descartar</button>
                </div>
            </div>`;
    });

    const modal = document.getElementById('heldSalesModal');
    const container = document.getElementById('heldSalesListContainer');
    if (container) container.innerHTML = listHtml;
    if (modal) modal.classList.add('active');
}

function resumeHeldSale(holdId) {
    const resumed = NovaDB.releaseHeldSale(holdId);
    if (resumed) {
        posCart = resumed.cart;
        if (resumed.customer) posSelectedCustomer = resumed.customer;
        renderPOSCart();
        renderHeldSalesList();
        closeModal('heldSalesModal');
        showNovaAlert({ title: "Venta Reanudada", message: `Ticket "${resumed.title}" listo para cobrar.`, type: "success" });
    }
}

function deleteHeldSale(holdId) {
    if (confirm("¿Deseas descartar definitivamente esta venta en espera?")) {
        NovaDB.deleteHeldSale(holdId);
        openHeldSalesModal();
        renderHeldSalesList();
    }
}

// ==========================================
// MODAL DE COBRO Y EMISIÓN DE FACTURA/TICKET
// ==========================================
function openCheckoutModal() {
    if (posCart.length === 0) return;

    const settings = NovaDB.getSettings();
    let totalUSD = 0;
    posCart.forEach(item => {
        const p = calcularPreciosSegunAjustes(item.costoCompra, settings);
        totalUSD += (posPriceTier === 'novacliente' ? p.novaClientesUSD : p.publicoUSD) * item.quantity;
    });
    const totalBs = totalUSD * settings.tasaBCV;

    document.getElementById('checkoutTotalUSD').innerText = `$${totalUSD.toFixed(2)}`;
    document.getElementById('checkoutTotalBs').innerText = `Bs. ${totalBs.toFixed(2)}`;

    // Precargar cliente en el modal
    if (posSelectedCustomer) {
        document.getElementById('coCustName').value = posSelectedCustomer.nombre;
        document.getElementById('coCustRif').value = posSelectedCustomer.rif;
        document.getElementById('coCustPhone').value = posSelectedCustomer.telefono;
    }

    // Inicializar montos de cobro por defecto en Efectivo USD
    document.getElementById('payAmountUSD').value = totalUSD.toFixed(2);
    document.getElementById('payAmountBs').value = "0.00";
    calculateChange();

    openModal('checkoutModal');
}

function calculateChange() {
    const settings = NovaDB.getSettings();
    const totalUSDStr = document.getElementById('checkoutTotalUSD').innerText.replace('$', '');
    const totalUSD = parseFloat(totalUSDStr) || 0;

    const paidUSD = parseFloat(document.getElementById('payAmountUSD').value) || 0;
    const paidBs = parseFloat(document.getElementById('payAmountBs').value) || 0;

    const totalPaidInUSD = paidUSD + (paidBs / settings.tasaBCV);
    const diffUSD = totalPaidInUSD - totalUSD;

    const changeUSDBox = document.getElementById('changeUSDDisplay');
    const changeBsBox = document.getElementById('changeBsDisplay');

    if (diffUSD >= 0) {
        if (changeUSDBox) changeUSDBox.innerText = `$${diffUSD.toFixed(2)}`;
        if (changeBsBox) changeBsBox.innerText = `Bs. ${(diffUSD * settings.tasaBCV).toFixed(2)}`;
        changeUSDBox.style.color = "var(--success)";
    } else {
        if (changeUSDBox) changeUSDBox.innerText = `Falta: $${Math.abs(diffUSD).toFixed(2)}`;
        if (changeBsBox) changeBsBox.innerText = `Falta: Bs. ${(Math.abs(diffUSD) * settings.tasaBCV).toFixed(2)}`;
        changeUSDBox.style.color = "var(--danger)";
    }
}

async function finalizeSale() {
    const custName = document.getElementById('coCustName').value.trim() || 'Cliente Mostrador';
    const custRif = document.getElementById('coCustRif').value.trim() || 'V-00000000';
    const custPhone = document.getElementById('coCustPhone').value.trim() || '';
    const docType = document.getElementById('coDocType').value;
    const payMethod = document.getElementById('coPaymentMethod').value;
    const refNum = document.getElementById('coPaymentRef').value.trim();

    const settings = NovaDB.getSettings();
    let totalUSD = 0;
    posCart.forEach(item => {
        const p = calcularPreciosSegunAjustes(item.costoCompra, settings);
        totalUSD += (posPriceTier === 'novacliente' ? p.novaClientesUSD : p.publicoUSD) * item.quantity;
    });
    const totalBs = totalUSD * settings.tasaBCV;

    const saleRecord = {
        cliente: { nombre: custName, rif: custRif, telefono: custPhone, tipo: posPriceTier },
        items: posCart,
        tipoPrecio: posPriceTier,
        tipoDocumento: docType,
        tasaBCV: settings.tasaBCV,
        totalUSD,
        totalBs,
        metodosPago: [{ metodo: payMethod, montoUSD: totalUSD, referencia: refNum }]
    };

    const saved = NovaDB.registerSale(saleRecord);
    closeModal('checkoutModal');

    // Generar documento visual listo para imprimir / compartir
    await generateInvoiceDocument(saved);

    // Limpiar carrito de mostrador
    posCart = [];
    renderPOSCart();
    renderPOSCatalog();
    showNovaAlert({
        title: "¡Venta Procesada!",
        message: `Venta registrada con éxito con el código ${saved.id}. El ticket está listo para imprimir o enviar.`,
        type: "success"
    });
}

// ==========================================
// GENERACIÓN DE DOCUMENTOS (CANVAS TÉRMICO / COTIZACIÓN)
// ==========================================
async function generateInvoiceDocument(sale) {
    const modal = document.getElementById('invoiceDocModal');
    const titleEl = document.getElementById('docModalBadge');
    if (titleEl) {
        titleEl.innerText = (sale.tipoDocumento === 'presupuesto') ? 'PRESUPUESTO / COTIZACIÓN' :
            (sale.tipoDocumento === 'nota_entrega') ? 'NOTA DE ENTREGA' : 'TICKET DE VENTA';
    }

    // Renderizar Canvas 2D
    const canvas = document.createElement('canvas');
    const SCALE = 2;
    const WIDTH = 320 * SCALE;
    const PAD = 14 * SCALE;
    const CONTENT_W = WIDTH - (PAD * 2);

    let curY = PAD;
    const ctx = canvas.getContext('2d');

    // Estimación de altura
    const estimatedH = (460 + (sale.items.length * 36)) * SCALE;
    canvas.width = WIDTH;
    canvas.height = estimatedH;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, estimatedH);
    ctx.textBaseline = 'top';

    // Encabezado
    ctx.fillStyle = '#00458a';
    ctx.font = `bold ${16 * SCALE}px 'Inter', sans-serif`;
    const brandName = "NOVA REFRIMOTORS";
    ctx.fillText(brandName, PAD + (CONTENT_W - ctx.measureText(brandName).width) / 2, curY);
    curY += 22 * SCALE;

    ctx.fillStyle = '#334155';
    ctx.font = `bold ${11 * SCALE}px 'Inter', sans-serif`;
    const rif = "RIF: J-504401994";
    ctx.fillText(rif, PAD + (CONTENT_W - ctx.measureText(rif).width) / 2, curY);
    curY += 15 * SCALE;

    ctx.font = `${9.5 * SCALE}px 'Inter', sans-serif`;
    const dir = "Av. Carabobo, Cabimas - Zulia";
    ctx.fillText(dir, PAD + (CONTENT_W - ctx.measureText(dir).width) / 2, curY);
    curY += 14 * SCALE;

    const tlf = "WhatsApp: +58 424-6192394";
    ctx.fillText(tlf, PAD + (CONTENT_W - ctx.measureText(tlf).width) / 2, curY);
    curY += 20 * SCALE;

    // Divisor
    drawDashed(ctx, curY, WIDTH, PAD);
    curY += 10 * SCALE;

    // Tipo y Folio
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${12 * SCALE}px 'Inter', sans-serif`;
    const docTitle = `${sale.tipoDocumento.toUpperCase()}: ${sale.id}`;
    ctx.fillText(docTitle, PAD, curY);
    curY += 16 * SCALE;

    ctx.font = `${10 * SCALE}px 'Inter', sans-serif`;
    ctx.fillText(`Fecha: ${sale.fechaStr}  ${sale.horaStr}`, PAD, curY);
    curY += 14 * SCALE;
    ctx.fillText(`Cliente: ${sale.cliente.nombre}`, PAD, curY);
    curY += 14 * SCALE;
    ctx.fillText(`RIF/CI: ${sale.cliente.rif}   Tlf: ${sale.cliente.telefono || 'N/A'}`, PAD, curY);
    curY += 14 * SCALE;
    ctx.fillText(`Tasa BCV: Bs. ${sale.tasaBCV.toFixed(2)}`, PAD, curY);
    curY += 18 * SCALE;

    drawDashed(ctx, curY, WIDTH, PAD);
    curY += 10 * SCALE;

    // Tabla de ítems
    ctx.font = `bold ${10 * SCALE}px 'Inter', sans-serif`;
    ctx.fillText("DESCRIPCIÓN", PAD, curY);
    const totHeader = "TOTAL";
    ctx.fillText(totHeader, WIDTH - PAD - ctx.measureText(totHeader).width, curY);
    curY += 16 * SCALE;

    ctx.font = `${9.5 * SCALE}px 'Inter', sans-serif`;
    sale.items.forEach(it => {
        const lineVal = `$${(it.costoCompra * (sale.tipoPrecio === 'novacliente' ? 1.508 : 1.77) * it.quantity).toFixed(2)}`;
        const lineTxt = `${it.quantity}x [${it.id}] ${it.name}`;

        ctx.fillText(lineTxt.length > 28 ? lineTxt.substring(0, 26) + '..' : lineTxt, PAD, curY);
        ctx.fillText(lineVal, WIDTH - PAD - ctx.measureText(lineVal).width, curY);
        curY += 16 * SCALE;
    });

    curY += 6 * SCALE;
    drawDashed(ctx, curY, WIDTH, PAD);
    curY += 10 * SCALE;

    // Totales
    ctx.font = `bold ${13 * SCALE}px 'Inter', sans-serif`;
    const totUsdStr = `TOTAL USD: $${sale.totalUSD.toFixed(2)}`;
    ctx.fillText(totUsdStr, PAD, curY);
    curY += 18 * SCALE;

    const totBsStr = `TOTAL BS: Bs. ${sale.totalBs.toFixed(2)}`;
    ctx.fillText(totBsStr, PAD, curY);
    curY += 22 * SCALE;

    // Pie de página legal
    ctx.font = `${8.5 * SCALE}px 'Inter', sans-serif`;
    ctx.fillStyle = '#64748b';
    const pie1 = "*** CONSERVE SU RECIBO PARA GARANTÍA ***";
    const pie2 = "* LAS PIEZAS ELÉCTRICAS NO TIENEN GARANTÍA *";
    ctx.fillText(pie1, PAD + (CONTENT_W - ctx.measureText(pie1).width) / 2, curY);
    curY += 13 * SCALE;
    ctx.fillText(pie2, PAD + (CONTENT_W - ctx.measureText(pie2).width) / 2, curY);
    curY += 16 * SCALE;

    // Asignar imagen a la vista previa
    const imgEl = document.getElementById('invoiceDocImg');
    const dataUrl = canvas.toDataURL('image/png');
    if (imgEl) imgEl.src = dataUrl;

    window._lastGeneratedDocUrl = dataUrl;
    window._lastGeneratedDocName = `${sale.tipoDocumento}-${sale.id}.png`;

    if (modal) modal.classList.add('active');
}

function drawDashed(ctx, y, w, pad) {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
    ctx.setLineDash([]);
}

function printCurrentDocument() {
    const w = window.open('');
    w.document.write(`<img src="${window._lastGeneratedDocUrl}" style="max-width:320px; width:100%;" onload="window.print();window.close();">`);
    w.document.close();
}

function downloadCurrentDocument() {
    if (!window._lastGeneratedDocUrl) return;
    const a = document.createElement('a');
    a.href = window._lastGeneratedDocUrl;
    a.download = window._lastGeneratedDocName || 'Ticket-Nova.png';
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
        const cost = getProductCost(item.id, prods);
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

function getProductCost(code, prods) {
    for (let p of prods) {
        if (p.id === code) return p.costoCompra;
        if (p.variants) {
            let v = p.variants.find(x => x.id === code);
            if (v) return v.costoCompra;
        }
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
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No se encontraron repuestos en el inventario con los criterios seleccionados.</td></tr>`;
        return;
    }

    let html = '';
    // Paginación virtual ligera
    filtered.slice(0, 100).forEach(item => {
        const cost = getProductCost(item.id, prods);
        const precios = calcularPreciosSegunAjustes(cost, settings);

        let statusBadge = '<span class="status-badge status-optimal">● Óptimo</span>';
        if (item.stock === 0) statusBadge = '<span class="status-badge status-out">● Agotado</span>';
        else if (item.stock <= item.stockMinimo) statusBadge = '<span class="status-badge status-low">● Stock Bajo</span>';

        html += `
            <tr>
                <td><span class="code-badge">${item.id}</span></td>
                <td><b>${item.name}</b></td>
                <td><span style="font-size:12px; color:var(--text-muted);">${item.category || 'General'}</span></td>
                <td>$${cost.toFixed(2)}</td>
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

    let html = '';
    customers.forEach(c => {
        const tierBadge = c.tipo === 'novacliente' ?
            '<span class="status-badge" style="background:#e0f2fe; color:#0369a1;">★ NovaCliente</span>' :
            '<span class="status-badge" style="background:#f1f5f9; color:#475569;">Público General</span>';

        html += `
            <tr>
                <td><span class="code-badge">${c.id}</span></td>
                <td><b>${c.nombre}</b></td>
                <td>${c.rif}</td>
                <td>${c.telefono || 'N/A'}</td>
                <td>${tierBadge}</td>
                <td><span style="font-size:12px; color:var(--text-muted);">${c.notas || 'Sin notas'}</span></td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

function openAddCustomerModal() {
    openModal('addCustomerModal');
}

function submitNewCustomer() {
    const nombre = document.getElementById('custNombre').value.trim();
    const rif = document.getElementById('custRif').value.trim();
    const telefono = document.getElementById('custTelefono').value.trim();
    const tipo = document.getElementById('custTipo').value;

    if (!nombre || !rif) {
        showNovaAlert({ title: "Datos Requeridos", message: "El nombre y el RIF/Cédula son obligatorios.", type: "warning" });
        return;
    }

    NovaDB.saveCustomer({ nombre, rif, telefono, tipo });
    closeModal('addCustomerModal');
    renderCustomersView();
    renderPOSCustomerSelect();
    showNovaAlert({ title: "Cliente Guardado", message: `Se registró a ${nombre} correctamente.`, type: "success" });
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
    showNovaAlert({
        title: "Sincronizando...",
        message: "Enviando registros locales a la base de datos en la nube.",
        type: "success"
    });
    await NovaSupabase.processQueue();
    const queue = NovaSupabase.getQueue();
    if (queue.length === 0) {
        showNovaAlert({
            title: "Nube Actualizada",
            message: "Todos los datos locales están 100% sincronizados con Supabase.",
            type: "success"
        });
    } else {
        showNovaAlert({
            title: "Sincronización Parcial",
            message: `Quedan ${queue.length} registros pendientes por enviar.`,
            type: "warning"
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
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.erp-modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
});

