/**
 * ==============================================================================
 * NOVA REFRIMOTORS ERP - GESTOR DE USUARIOS Y ESTACIONES DE TRABAJO (admin-users.js)
 * ==============================================================================
 * Define los 4 usuarios del sistema:
 * - MASTER: Computadora principal (Control total, cobro de facturas/despacho, inventario, precios)
 * - VENTAS01, VENTAS02, VENTAS03: Computadoras de mostrador (Agregar clientes, presupuestos, enviar pedidos a caja)
 * ==============================================================================
 */

const NovaUsers = (function () {
    const STORAGE_KEY_USER = 'nova_active_station';
    const MASTER_DEFAULT_PIN = '1234';

    const SELLER_PERMISSIONS = {
        canFinalizeSale: false,      // NO recibe dinero ni emite facturas finales
        canSendOrderToMaster: true,  // Manda pedidos de facturación a MASTER
        canMakeQuotes: true,         // Puede emitir presupuestos (cotizaciones)
        canManageInventory: false,   // NO modifica existencias ni precios
        canManageCash: false,        // NO maneja caja
        canManagePurchases: false,   // NO accede a compras
        canManageCustomers: true,    // Añadir clientes (Nombre, RIF, tlf, dirección)
        canManageSettings: false     // NO accede a configuración
    };

    const USERS = {
        'MASTER': {
            id: 'MASTER',
            name: 'MASTER',
            title: 'Caja Principal / Administrador',
            role: 'admin',
            icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"></path></svg>',
            badgeClass: 'badge-role-master',
            permissions: {
                canFinalizeSale: true,       // Recibe dinero y entrega facturas/despachos
                canSendOrderToMaster: false,  // Es el receptor
                canMakeQuotes: true,         // Puede emitir presupuestos
                canManageInventory: true,    // Modificar existencias, precios, crear/eliminar
                canManageCash: true,         // Arqueo, turnos y egresos
                canManagePurchases: true,    // Compras a proveedores
                canManageCustomers: true,    // CRM completo
                canManageSettings: true      // Modificar tasa BCV, utilidades y usuarios
            }
        },
        'VENTAS01': {
            id: 'VENTAS01',
            name: 'VENTAS 01',
            title: 'Mostrador 1 - Asesor Comercial',
            role: 'seller',
            icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
            badgeClass: 'badge-role-ventas',
            permissions: SELLER_PERMISSIONS
        },
        'VENTAS02': {
            id: 'VENTAS02',
            name: 'VENTAS 02',
            title: 'Mostrador 2 - Asesor Comercial',
            role: 'seller',
            icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
            badgeClass: 'badge-role-ventas',
            permissions: SELLER_PERMISSIONS
        },
        'VENTAS03': {
            id: 'VENTAS03',
            name: 'VENTAS 03',
            title: 'Mostrador 3 - Asesor Comercial',
            role: 'seller',
            icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
            badgeClass: 'badge-role-ventas',
            permissions: SELLER_PERMISSIONS
        }
    };

    function init() {
        const current = getCurrentUser();
        console.log(`[NovaUsers] Estación activa [${current.id}] - ${current.title}`);
        applyPermissions();
    }

    function getCurrentUser() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_USER);
            if (saved && USERS[saved]) {
                return USERS[saved];
            }
        } catch (e) {}
        // Por defecto en la primera carga en este equipo, MASTER
        return USERS['MASTER'];
    }

    function isAdmin() {
        return getCurrentUser().role === 'admin';
    }

    function isSeller() {
        return getCurrentUser().role === 'seller';
    }

    function switchStation(stationId, enteredPin = '') {
        if (!USERS[stationId]) {
            return { success: false, message: "Estación de trabajo no válida." };
        }

        // Si se intenta cambiar a MASTER, solicitar PIN de seguridad
        if (stationId === 'MASTER') {
            const masterPin = getMasterPin();
            if (enteredPin !== masterPin) {
                return { success: false, message: "PIN de Administrador incorrecto." };
            }
        }

        localStorage.setItem(STORAGE_KEY_USER, stationId);
        applyPermissions();

        // Si el vendedor actual estaba en una vista restringida, volver a POS
        const current = USERS[stationId];
        if (current.role === 'seller' && typeof currentView !== 'undefined' && currentView !== 'pos' && currentView !== 'customers') {
            if (typeof navigateTo === 'function') navigateTo('pos');
        }

        return { success: true, user: current };
    }

    function getMasterPin() {
        try {
            const settings = (typeof NovaDB !== 'undefined' && NovaDB.getSettings) ? NovaDB.getSettings() : {};
            return settings.masterPin || MASTER_DEFAULT_PIN;
        } catch (e) {
            return MASTER_DEFAULT_PIN;
        }
    }

    function applyPermissions() {
        const user = getCurrentUser();

        // 1. Actualizar Pie de Barra Lateral (Sidebar) con Estación Activa
        const sidebarFoot = document.getElementById('sidebarUserStatus');
        if (sidebarFoot) {
            sidebarFoot.innerHTML = `
                <div class="sidebar-user-card" onclick="openSwitchStationModal()" title="Estación activa: ${user.name} (${user.title}). Clic para cambiar">
                    <div class="sidebar-user-avatar ${user.badgeClass}">${user.icon}</div>
                    <div class="sidebar-user-info">
                        <span class="sidebar-user-title">${user.name}</span>
                        <span class="sidebar-user-subtitle">${user.role === 'admin' ? 'Caja Principal' : 'Ventas Mostrador'}</span>
                    </div>
                    <div class="sidebar-user-switch-icon" title="Cambiar estación o usuario">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="17 1 21 5 17 9"></polyline>
                            <path d="M3 5h18"></path>
                            <polyline points="7 23 3 19 7 15"></polyline>
                            <path d="M21 19H3"></path>
                        </svg>
                    </div>
                </div>
            `;
        }

        // 2. Control de Menús en el Sidebar (Ocultar módulos restringidos para vendedores)
        const restrictedNavItems = {
            'cash': user.permissions.canManageCash,
            'inventory': user.permissions.canManageInventory,
            'purchases': user.permissions.canManagePurchases,
            'marketing': user.permissions.canManageSettings,
            'reports': user.permissions.canManageSettings,
            'settings': user.permissions.canManageSettings
        };

        Object.keys(restrictedNavItems).forEach(viewKey => {
            const navItem = document.querySelector(`.nav-item[data-view="${viewKey}"]`);
            if (navItem) {
                if (restrictedNavItems[viewKey]) {
                    navItem.style.display = 'flex';
                } else {
                    navItem.style.display = 'none';
                }
            }
        });

        // Ocultar sección comercial en vendedores (solo accesible por MASTER)
        const secComercial = document.querySelectorAll('.nav-section-title')[2];
        if (secComercial) {
            secComercial.style.display = (user.role === 'seller') ? 'none' : 'block';
        }

        // 3. Adaptar Botonera del Punto de Venta (POS)
        const btnCheckoutWrap = document.getElementById('posCheckoutActionsWrap');
        if (btnCheckoutWrap) {
            if (user.role === 'admin') {
                // MASTER: Cobro directo con F4
                btnCheckoutWrap.innerHTML = `
                    <button class="btn-checkout btn-master-checkout" id="btnPOSCheckout" onclick="openCheckoutModal()" disabled>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        COBRAR E IMPRIMIR [F4]
                    </button>
                `;
            } else {
                // VENTAS01 / 02 / 03: Mandar pedido a Caja Principal + Emitir Presupuesto
                btnCheckoutWrap.innerHTML = `
                    <button class="btn-checkout btn-send-order-master" id="btnPOSCheckout" onclick="sendOrderToMaster()" disabled>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        MANDAR A CAJA PRINCIPAL [F4]
                    </button>
                    <button class="btn-secondary-action btn-quote-action" id="btnPOSQuote" onclick="emitPresupuestoFromCart()" disabled title="Generar cotización sin cobrar (F6)">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        Emitir Presupuesto [F6]
                    </button>
                `;
            }
        }

        // 5. Botón de "En Espera" y "Reimprimir" en Header: Solo visible o destacado en MASTER
        const btnHeld = document.getElementById('btnHeldSales');
        if (btnHeld) {
            btnHeld.style.display = (user.role === 'admin') ? 'inline-flex' : 'none';
        }
        const btnReprint = document.getElementById('btnReprintInvoice');
        if (btnReprint) {
            btnReprint.style.display = (user.role === 'admin') ? 'inline-flex' : 'none';
        }

        // Re-evaluar estado del botón según ítems en el carrito
        if (typeof renderPOSCart === 'function') {
            renderPOSCart();
        }
    }

    return {
        USERS,
        init,
        getCurrentUser,
        isAdmin,
        isSeller,
        switchStation,
        applyPermissions,
        getMasterPin
    };
})();
