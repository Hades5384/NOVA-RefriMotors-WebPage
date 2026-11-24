/**
 * ==============================================================================
 * NOVA REFRIMOTORS ERP - GESTOR DE USUARIOS Y ESTACIONES DE TRABAJO (admin-users.js)
 * ==============================================================================
 * Define los 4 usuarios del sistema y gestiona el control de acceso con contraseña obligatoria:
 * - MASTER: Computadora principal (PIN / Contraseña: "1005")
 * - VENTAS01: Mostrador 1 (Contraseña: "VENTAS01")
 * - VENTAS02: Mostrador 2 (Contraseña: "VENTAS02")
 * - VENTAS03: Mostrador 3 (Contraseña: "VENTAS03")
 * ==============================================================================
 */

const NovaUsers = (function () {
    const STORAGE_KEY_USER = 'nova_active_station';
    const STORAGE_KEY_AUTH = 'nova_auth_session';
    const MASTER_DEFAULT_PIN = '1005';

    // Contraseñas predeterminadas del sistema
    const PASSWORDS = {
        'MASTER': '1005',
        'VENTAS01': 'VENTAS01',
        'VENTAS02': 'VENTAS02',
        'VENTAS03': 'VENTAS03'
    };

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
        if (!isAuthenticated()) {
            showLoginGate();
        } else {
            hideLoginGate();
            const current = getCurrentUser();
            console.log(`[NovaUsers] Sesión autenticada en estación [${current.id}] - ${current.title}`);
            applyPermissions();
        }
    }

    function isAuthenticated() {
        try {
            const authData = sessionStorage.getItem(STORAGE_KEY_AUTH);
            if (!authData) return false;
            const parsed = JSON.parse(authData);
            return !!(parsed && parsed.stationId && USERS[parsed.stationId]);
        } catch (e) {
            return false;
        }
    }

    function verifyPassword(stationId, enteredPassword) {
        if (!USERS[stationId]) return false;
        const clean = (enteredPassword || '').trim();
        if (stationId === 'MASTER') {
            const masterPin = getMasterPin();
            return clean === masterPin || clean === '1005';
        }
        const expected = PASSWORDS[stationId] || stationId;
        return clean.toUpperCase() === expected.toUpperCase();
    }

    function login(stationId, enteredPassword) {
        if (!USERS[stationId]) {
            return { success: false, message: "Estación de trabajo no válida." };
        }

        if (!verifyPassword(stationId, enteredPassword)) {
            return {
                success: false,
                message: stationId === 'MASTER'
                    ? "Contraseña incorrecta para Administrador MASTER."
                    : `Contraseña incorrecta para ${USERS[stationId].name}.`
            };
        }

        sessionStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({
            stationId: stationId,
            userName: USERS[stationId].name,
            loginTime: Date.now()
        }));
        localStorage.setItem(STORAGE_KEY_USER, stationId);

        hideLoginGate();
        applyPermissions();

        // Si el vendedor actual estaba en una vista restringida, volver a POS
        const current = USERS[stationId];
        if (current.role === 'seller' && typeof currentView !== 'undefined' && currentView !== 'pos' && currentView !== 'customers') {
            if (typeof navigateTo === 'function') navigateTo('pos');
        }

        return { success: true, user: current };
    }

    function lockTerminal() {
        sessionStorage.removeItem(STORAGE_KEY_AUTH);
        showLoginGate();
    }

    function showLoginGate() {
        document.body.classList.add('erp-locked');
        const gate = document.getElementById('erpLoginGate');
        if (gate) {
            gate.style.display = 'flex';
            gate.classList.add('active');
        }
        const current = getCurrentUser();
        if (typeof window.selectLoginStation === 'function') {
            window.selectLoginStation(current.id);
        }
        const passInp = document.getElementById('loginPasswordInput');
        if (passInp) {
            passInp.value = '';
            setTimeout(() => passInp.focus(), 150);
        }
        const errEl = document.getElementById('loginErrorMsg');
        if (errEl) {
            errEl.style.display = 'none';
            errEl.innerText = '';
        }
    }

    function hideLoginGate() {
        document.body.classList.remove('erp-locked');
        const gate = document.getElementById('erpLoginGate');
        if (gate) {
            gate.style.display = 'none';
            gate.classList.remove('active');
        }
    }

    function getCurrentUser() {
        try {
            const authData = sessionStorage.getItem(STORAGE_KEY_AUTH);
            if (authData) {
                const parsed = JSON.parse(authData);
                if (parsed && parsed.stationId && USERS[parsed.stationId]) {
                    return USERS[parsed.stationId];
                }
            }
            const saved = localStorage.getItem(STORAGE_KEY_USER);
            if (saved && USERS[saved]) {
                return USERS[saved];
            }
        } catch (e) {}
        return USERS['MASTER'];
    }

    function isAdmin() {
        return getCurrentUser().role === 'admin';
    }

    function isSeller() {
        return getCurrentUser().role === 'seller';
    }

    function hasPermission(permissionKey) {
        if (!isAuthenticated()) return false;
        const u = getCurrentUser();
        return !!(u && u.permissions && u.permissions[permissionKey]);
    }

    function switchStation(stationId, enteredPassword = '') {
        if (!USERS[stationId]) {
            return { success: false, message: "Estación de trabajo no válida." };
        }

        if (!verifyPassword(stationId, enteredPassword)) {
            return {
                success: false,
                message: stationId === 'MASTER'
                    ? "Contraseña o PIN de Administrador incorrecto."
                    : `Contraseña incorrecta para ${USERS[stationId].name}.`
            };
        }

        localStorage.setItem(STORAGE_KEY_USER, stationId);
        sessionStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({
            stationId: stationId,
            userName: USERS[stationId].name,
            loginTime: Date.now()
        }));

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

        // 1. Actualizar Pie de Barra Lateral (Sidebar) con Estación Activa y Botón de Bloqueo
        const sidebarFoot = document.getElementById('sidebarUserStatus');
        if (sidebarFoot) {
            sidebarFoot.innerHTML = `
                <div class="sidebar-user-card" onclick="openSwitchStationModal()" title="Estación activa: ${user.name} (${user.title}). Clic para cambiar">
                    <div class="sidebar-user-avatar ${user.badgeClass}">${user.icon}</div>
                    <div class="sidebar-user-info">
                        <span class="sidebar-user-title">${user.name}</span>
                        <span class="sidebar-user-subtitle">${user.role === 'admin' ? 'Caja Principal' : 'Ventas Mostrador'}</span>
                    </div>
                    <div class="sidebar-user-actions">
                        <button type="button" class="sidebar-action-lock-btn" onclick="event.stopPropagation(); NovaUsers.lockTerminal();" title="Bloquear terminal y cerrar sesión">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </button>
                        <div class="sidebar-user-switch-icon" title="Cambiar estación o usuario">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="17 1 21 5 17 9"></polyline>
                                <path d="M3 5h18"></path>
                                <polyline points="7 23 3 19 7 15"></polyline>
                                <path d="M21 19H3"></path>
                            </svg>
                        </div>
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
        PASSWORDS,
        init,
        isAuthenticated,
        verifyPassword,
        login,
        lockTerminal,
        showLoginGate,
        hideLoginGate,
        getCurrentUser,
        isAdmin,
        isSeller,
        hasPermission,
        switchStation,
        applyPermissions,
        getMasterPin
    };
})();

// ==============================================================================
// FUNCIONES GLOBALES DE INTERFAZ PARA LOGIN GATE Y BLOQUEO DE TERMINAL
// ==============================================================================
window.selectLoginStation = function(stationId) {
    const hiddenInp = document.getElementById('loginSelectedStation');
    if (hiddenInp) hiddenInp.value = stationId;

    document.querySelectorAll('.login-station-btn').forEach(btn => {
        if (btn.dataset.station === stationId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const label = document.getElementById('loginSelectedStationLabel');
    const u = NovaUsers.USERS[stationId];
    if (label && u) {
        label.innerText = `Contraseña para ${u.name}:`;
    }

    const hint = document.getElementById('loginPasswordHint');
    if (hint) {
        hint.innerText = "Acceso protegido";
    }

    const passInp = document.getElementById('loginPasswordInput');
    if (passInp) {
        passInp.placeholder = "Ingresa tu contraseña...";
        passInp.focus();
    }

    const err = document.getElementById('loginErrorMsg');
    if (err) {
        err.style.display = 'none';
        err.innerText = '';
    }
};

window.handleLoginGateSubmit = function(event) {
    if (event) event.preventDefault();
    const stationId = document.getElementById('loginSelectedStation') ? document.getElementById('loginSelectedStation').value : 'MASTER';
    const passInp = document.getElementById('loginPasswordInput');
    const entered = passInp ? passInp.value.trim() : '';

    const res = NovaUsers.login(stationId, entered);
    if (res.success) {
        if (typeof showNovaAlert === 'function') {
            showNovaAlert({
                title: `Bienvenido a ${res.user.name}`,
                message: `Terminal desbloqueada con éxito en ${res.user.title}.`,
                type: "success"
            });
        }
    } else {
        const err = document.getElementById('loginErrorMsg');
        if (err) {
            err.innerText = res.message || "Contraseña incorrecta.";
            err.style.display = 'block';
            err.classList.remove('shake-anim');
            void err.offsetWidth;
            err.classList.add('shake-anim');
        }
        if (passInp) {
            passInp.focus();
            passInp.select();
        }
    }
};

window.toggleLoginPasswordVisibility = function() {
    const passInp = document.getElementById('loginPasswordInput');
    const eyeShow = document.getElementById('eyeIconShow');
    const eyeHide = document.getElementById('eyeIconHide');
    if (!passInp) return;

    if (passInp.type === 'password') {
        passInp.type = 'text';
        if (eyeShow) eyeShow.style.display = 'none';
        if (eyeHide) eyeHide.style.display = 'block';
    } else {
        passInp.type = 'password';
        if (eyeShow) eyeShow.style.display = 'block';
        if (eyeHide) eyeHide.style.display = 'none';
    }
};
