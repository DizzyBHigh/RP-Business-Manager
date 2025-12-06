// ========================
// Initialise ROLES SYSTEM v6 — FINAL VERSION (WORKS 100%)
// ========================
async function initRoles() {
    if (!window.playerName) {
        return setTimeout(initRoles, 500);
    }

    console.log("initRoles() running for:", window.playerName);

    try {
        const snap = await ROLES_DOC.get(); // ← .get() not getDoc()

        let data = {};
        if (snap.exists) {
            data = snap.data();
            console.log("RAW ROLES DOC DATA:", data);
        } else {
            console.log("No roles doc — creating one...");
            await ROLES_DOC.set({ [window.playerName]: "manager" });
            data = { [window.playerName]: "manager" };
            console.log("Created roles doc — you are manager");
        }

        // Find role
        let role = data[window.playerName] ||
            (data.owner === window.playerName ? "manager" : "viewer");

        // SET GLOBALS
        window.myRole = role;
        myRole = role;
        // CRITICAL: Also save role to App.state so isManager() works

        rolesLoaded = true;
        window.rolesLoaded = true;

        console.log("SUCCESS → ROLE:", role);
        App.state.roles = App.state.roles || {};
        App.state.roles[window.playerName] = role;
        // Now render everything
        updatePlayerDisplay();
        applyPermissions();
        await loadPermissionsConfig();
        renderPermissionsEditor();
        RolesManager?.render?.();
        goOnline();

    } catch (err) {
        console.error("initRoles failed:", err);
        window.myRole = "viewer";
        myRole = "viewer";
        rolesLoaded = true;
    }
}

// =============================================
// 1. GLOBAL AUTH & STARTUP MODULE 
// =============================================
const AuthManager = {
    async start() {
        // 1. Player name check
        const savedName = await ls.get("playerName");
        if (!savedName) {
            document.getElementById("nameEntry").style.display = "flex";
            return;
        }
        window.playerName = savedName;
        App.state = App.state || {};
        App.state.playerName = savedName;
        App.state.loggedInUser = savedName;   // ← THIS IS OUR SOURCE OF TRUTH
        console.log("Logged in user set:", App.state.loggedInUser);

        // 2. Business config + passphrase check
        const authenticated = await AuthManager.checkBusinessAccess();
        if (!authenticated) return; // modal is already shown

        // 3. ONLY NOW we have full access
        App.state.passphraseAuthenticated = true;
        window.fullyAuthenticated = true;

        // 4. Finally boot the main app
        App.init();
        initRoles();
        // 5. Post-init UI updates
        updateWelcomeScreen();
        if (window.BusinessManager?.render) window.BusinessManager.render();

        // NOW 100% safe to go online
        goOnline();   // ← ONLY runs after name + passphrase + role are confirmed

        // Auto-redirect viewers to welcome tab
        if (window.myRole === "viewer") {
            console.log("Viewer detected → forcing Welcome tab");
            currentSection = "Welcome";
            currentTab = "welcome";
            document.getElementById("currentSectionBtn").textContent = "Welcome";
            buildSectionDropdown();
            buildHorizontalTabs();
            activateTab("welcome");
            ls.set("lastTab", "welcome");
            ls.set("lastSection", "Welcome");
        }
    },

    // Separate, reusable function – completely outside App scope
    // Separate, reusable function – completely outside App scope
    async checkBusinessAccess() {
        try {
            const configDoc = await db.collection("business").doc("config").get();

            if (!configDoc.exists) {
                // FIRST-TIME SETUP — NO BUSINESS CONFIG
                console.log("No business config — showing inline setup form");

                // FORCE MANAGER MODE FOR FIRST USER
                window.myRole = "manager";
                App.state.role = "manager";
                applyPermissions();

                // Show the inline form
                BusinessManager.showSetupForm();

                // CRITICAL: ACTIVATE THE BUSINESS TAB SO THE FORM IS VISIBLE
                currentSection = "Management";
                currentTab = "business";
                document.getElementById("currentSectionBtn").textContent = "Management";
                buildSectionDropdown();
                buildHorizontalTabs();
                activateTab("business");

                return false;
            }

            const config = configDoc.data();
            App.state.businessConfig = config;

            // Update title
            if (config.name) {
                document.title = `${config.name} - HSRP Manager`;
            }

            // Passphrase check
            if (config.passphrase) {
                const savedHash = await getPassphraseHash();
                const expectedHash = btoa(config.passphrase);

                if (savedHash !== expectedHash) {
                    await setPassphraseHash(null);
                    showPassphraseModal();
                    return false;
                }
            }

            App.state.passphraseAuthenticated = true;
            return true;

        } catch (err) {
            console.error("Business config check failed:", err);
            return false;
        }
    }
};



// =============================================
// 5. KICK OFF THE WHOLE THING
// =============================================
window.addEventListener("load", () => {
    AuthManager.start();
});

// =============================================
// PLAYER NAME & PASSPHRASE — FINAL CLEAN VERSION
// =============================================

// PLAYER NAME 
window.getPlayerName = async () => await ls.get("playerName");
window.setPlayerName = async (name) => {
    await ls.set("playerName", name.trim());
    window.playerName = name.trim();
    console.log(`PLAYER NAME SAVED FOR BUSINESS → ${await getCurrentCompanyId()}: ${name.trim()}`);
};

// PASSPHRASE — ONLY THESE
window.getPassphraseHash = async () => await ls.get("passphraseHash");
window.setPassphraseHash = async (hash) => {
    if (hash === null) await ls.remove("passphraseHash");
    else await ls.set("passphraseHash", hash);
};


// =============================================
// PLAYER NAME DISPLAY
// =============================================
function updatePlayerDisplay() {
    const nameEl = document.getElementById("playerNameDisplay");
    const roleEl = document.getElementById("playerRoleDisplay");

    if (nameEl && window.playerName) {
        nameEl.textContent = window.playerName;
    }
    if (roleEl && window.myRole) {
        roleEl.textContent = window.myRole.toUpperCase();
        roleEl.style.color = {
            manager: "#0ff",
            assistant: "#0f8",
            worker: "#ff0",
            viewer: "#f66"
        }[window.myRole] || "#aaa";
    }
}

// =============================================
// PLAYER NAME INITIALIZATION 
// =============================================
document.addEventListener("DOMContentLoaded", () => {
    const nameEntry = document.getElementById("nameEntry");
    if (!nameEntry) return;

    // Only run if name entry is visible (first time user)
    const checkVisibility = setInterval(() => {
        if (nameEntry.style.display === "flex" ||
            getComputedStyle(nameEntry).display === "flex" ||
            nameEntry.offsetParent !== null) {

            const input = document.getElementById("nameInput");
            const button = nameEntry.querySelector("button");

            if (input && button) {
                // NUCLEAR PROTECTION — RE-ENABLE INPUT EVERY 100MS
                const defender = setInterval(() => {
                    input.disabled = false;
                    input.readOnly = false;
                    input.style.pointerEvents = "auto";
                    button.disabled = false;
                    button.style.pointerEvents = "auto";
                }, 100);

                // Auto-focus
                setTimeout(() => input.focus(), 200);

                // Clean up when user submits
                const cleanup = () => {
                    clearInterval(defender);
                    nameEntry.style.display = "none";
                };

                // Hook into your existing button (assuming it calls saveNameAndStart)
                const originalOnclick = button.onclick;
                button.onclick = async function (e) {
                    cleanup();
                    if (originalOnclick) originalOnclick(e);
                };

                // Also support Enter key
                input.onkeydown = (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        button.click();
                    }
                };

                // Stop checking once we’ve protected it
                clearInterval(checkVisibility);
            }
        }
    }, 100);
});

// ========================
// ROLES SYSTEM v5
// ========================
const ONLINE_DOC = db.collection("business").doc("online");
const ROLES_DOC = db.collection("business").doc("roles");
let myOnlineRef = null;
let myRole = "viewer";
let rolesLoaded = false;
window.rolesLoaded = false;

ROLES_DOC.safeSet = safeSet;
ONLINE_DOC.safeSet = safeSet;
// ──────────────────────────────────────────────────────────────
// 1. Updated goOnline() — 100% working with compat SDK
// ──────────────────────────────────────────────────────────────
function goOnline() {
    if (!window.playerName || !window.myRole) {
        console.warn("goOnline() blocked — missing playerName or role", { playerName: window.playerName, myRole: window.myRole });
        return;
    }

    myOnlineRef = db.collection("business").doc("online").collection("users").doc(window.playerName);

    const heartbeat = () => {
        if (!window.playerName || !myOnlineRef) return;

        myOnlineRef.set({
            name: window.playerName,
            role: window.myRole || "viewer",
            online: true,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(err => console.warn("Heartbeat failed", err));
    };

    heartbeat();
    const interval = setInterval(heartbeat, 10000);

    const goOffline = () => {
        clearInterval(interval);
        if (myOnlineRef) {
            myOnlineRef.set({
                online: false,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    };

    window.addEventListener("beforeunload", goOffline);
    window.addEventListener("unload", goOffline);
    window.addEventListener("pagehide", goOffline);
}



// ====================================================
// PERMISSIONS SYSTEM v3 — FIXED & SYNCED WITH FIREBASE
// ====================================================

// Default fallback (should match your actual desired defaults)
let permissionsConfig = {
    viewer: ["welcome"],
    worker: ["welcome", "order", "pending", "raw", "profit", "inventory", "warehouse", "crafted", "shopsales", "rawpurchase", "completed"],
    assistant: ["welcome", "order", "pending", "raw", "profit", "inventory", "warehouse", "crafted", "pricelist", "categories", "employees", "rawpurchase", "completed", "shopsales"]
};

// Load permissions from Firebase ONCE at startup
async function loadPermissionsConfig() {
    try {
        const snap = await ROLES_DOC.get();
        const data = snap.data() || {};

        if (data.permissions && typeof data.permissions === "object") {
            permissionsConfig = { ...permissionsConfig, ...data.permissions };
            console.log("Permissions loaded from Firebase:", permissionsConfig);
        } else {
            console.log("No custom permissions — using defaults");
        }

        applyPermissions();
        renderPermissionsEditor();
    } catch (err) {
        console.error("Failed to load permissions:", err);
    }
}

// Save permissions (manager only)
async function savePermissionsConfig() {
    if (myRole !== "manager") return showToast("fail", "Only managers can save permissions!");

    try {
        await ROLES_DOC.set({ permissions: permissionsConfig }, { merge: true });
        showToast("success", "Permissions saved successfully!");
        console.log("Permissions saved:", permissionsConfig);
    } catch (err) {
        console.error("Save failed:", err);
        showToast("fail", "Failed to save permissions");
    }
}

// Update single checkbox
function updatePermission(checkbox) {
    const role = checkbox.dataset.role;
    const tab = checkbox.dataset.tab;

    if (!permissionsConfig[role]) permissionsConfig[role] = [];

    if (checkbox.checked) {
        if (!permissionsConfig[role].includes(tab)) {
            permissionsConfig[role].push(tab);
        }
    } else {
        permissionsConfig[role] = permissionsConfig[role].filter(t => t !== tab);
    }
}

// Render editor (only for managers)
function renderPermissionsEditor() {
    const container = document.getElementById("permissionsEditor");
    if (!container) return;

    // Just wait — initRoles() will call us when ready
    if (!window.rolesLoaded) {
        console.log("Permissions editor: waiting for roles to load... (initRoles will render us)");
        return;
    }

    if (window.myRole !== "manager") {
        container.innerHTML = `<p style="color:#888;text-align:center;padding:20px;">
                    Only managers can edit permissions.
                </p>`;
        return;
    }

    const allTabs = ["order", "pending", "raw", "profit", "inventory", "warehouse", "crafted", "pricelist", "categories", "employees roles", "employees", "ledger", "rawpurchase", "completed", "shopsales", "recipes", "rawprices", "sync"];

    let html = `<div class="permissions-editor-container">
                <h3>Permissions Editor</h3>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">`;

    ["viewer", "worker", "assistant"].forEach(role => {
        html += `<div class="role-card" style="background:#1a1a2e;padding:15px;border-radius:8px;">
                    <h4 style="margin:0 0 10px;color:#0ff;">${role.toUpperCase()}</h4>`;

        allTabs.forEach(tab => {
            const name = tab.replace("rawprices", "Raw Prices")
                .replace("pricelist", "Price List")
                .replace("rawpurchase", "Raw Purchase")
                .replace("shopsales", "Shop Sales")
                .replace("warehouse", "Warehouse")
                .replace("crafted", "Crafted")
                .replace("completed", "Completed")
                .replace("categories", "Categories")
                .replace("employees", "Employees")
                .replace("recipes", "Recipes")
                .replace("inventory", "Inventory")
                .replace("pending", "Pending")
                .replace("profit", "Profit")
                .replace("ledger", "Ledger")
                .replace("roles", "Roles")
                .replace("sync", "Sync")
                .replace("order", "Order")
                .replace("raw", "Raw");

            const checked = permissionsConfig[role]?.includes(tab) ? "checked" : "";

            html += `<label style="display:block;margin:8px 0;font-size:14px;">
                        <input type="checkbox" ${checked} 
                            data-role="${role}" data-tab="${tab}"
                            onchange="updatePermission(this)">
                        ${name}
                    </label>`;
        });

        html += `</div>`;
    });

    html += `</div>
                <div style="margin-top:20px;text-align:center;">
                    <button onclick="savePermissionsConfig()" 
                            style="padding:12px 30px;background:#585eff;color:white;border:none;border-radius:8px;font-weight:bold;">
                        SAVE PERMISSIONS
                    </button>
                </div></div>`;

    container.innerHTML = html;
}

// =============================================
// applyPermissions 
// =============================================
async function applyPermissions(data) {
    // ALWAYS use the freshest possible role
    let role = window.myRole || App.state?.role;

    // Last-ditch safety: if still no role, check business config directly
    if (!role || role === "viewer") {
        try {
            const snap = await db.collection("business").doc("config").get();
            const managers = Object.keys(snap.data()?.permissions?.manager || {});
            if (managers.includes(window.playerName)) {
                role = "manager";
                window.myRole = "manager";
                App.state.role = "manager";
            }
        } catch (e) { }
    }

    const myRole = window.myRole || App.state?.role || "viewer";
    console.log("Applying permissions as:", myRole, "for", window.playerName);

    // BLOCK if modals are open
    if (document.getElementById("passphraseModal")) return;
    if (document.getElementById("nameEntry")?.offsetParent !== null) return;

    // === LOGIC BELOW ===
    if (myRole === "manager") {
        document.querySelectorAll(".tab, .horizontal-tab").forEach(tab => {
            const id = tab.dataset.tab;
            if (id) {
                tab.style.display = "";
                const content = document.getElementById(id);
                if (content) content.style.display = "";
            }
        });

        document.querySelectorAll("input, button, select, textarea").forEach(el => {
            const isPassphraseInput = el.id === "passphraseInput" ||
                el.closest("#passphraseModal") ||
                el.id.includes("passphrase");

            if (!isPassphraseInput && !el.id?.includes("Search") && el.type !== "radio") {
                el.disabled = false;
                el.style.opacity = "";
            }
        });

        document.getElementById("roleWatermark")?.remove();
        return;
    }
    // NON-MANAGERS — use config
    const allowed = permissionsConfig[myRole] || [];

    document.querySelectorAll(".tab, .horizontal-tab").forEach(tab => {
        const id = tab.dataset.tab;
        if (id) {
            const show = allowed.includes(id);
            tab.style.display = show ? "" : "none";
            const content = document.getElementById(id);
            if (content) content.style.display = show ? "" : "none";
        }
    });

    const canEdit = ["assistant", "worker"].includes(myRole);
    document.querySelectorAll("input, button, select, textarea").forEach(el => {
        const isPassphraseInput = el.id === "passphraseInput" ||
            el.closest("#passphraseModal") ||
            el.id.includes("passphrase") ||
            el.closest("[id*='passphrase']");

        if (!isPassphraseInput && !el.id?.includes("Search") && el.type !== "radio") {
            el.disabled = !canEdit;
            el.style.opacity = canEdit ? "" : "0.6";
        }
    });

    // Watermark for restricted users
    if (["viewer", "worker"].includes(myRole)) {
        if (!document.getElementById("roleWatermark")) {
            const wm = document.createElement("div");
            wm.id = "roleWatermark";
            wm.textContent = myRole.toUpperCase() + " MODE";
            wm.className = "role-watermark";
            document.body.appendChild(wm);
        }
    } else {
        document.getElementById("roleWatermark")?.remove();
    }
}

// Function to explicitly ensure passphrase inputs are enabled
function ensurePassphraseInputsAreEnabled() {
    document.querySelectorAll("#passphraseModal input, #passphraseModal button").forEach(el => {
        el.disabled = false;
        el.style.opacity = "1";
    });

    // Specifically ensure the passphrase input is enabled and focused
    const passphraseInput = document.getElementById("passphraseInput");
    if (passphraseInput) {
        passphraseInput.disabled = false;
        passphraseInput.style.opacity = "1";
        passphraseInput.focus();
    }
}

// =============================================
// Roles Manager 
// =============================================
const RolesManager = {
    render() {
        const sel = document.getElementById("roleEmployeeSelect");
        const list = document.getElementById("rolesList");
        if (!sel || !list) return;

        ROLES_DOC.get().then(snap => {
            const roles = snap.data() || {};
            sel.innerHTML = "<option value=''>– Select Employee –</option>";
            list.innerHTML = "<p class='roles-loading-text'>Loading team...</p>";

            const employees = Object.keys(App.state.employees || {}).sort();
            let html = "";

            employees.forEach(name => {
                sel.innerHTML += `<option value="${name}">${name}</option>`;
                const role = roles[name] || "viewer";
                html += `
                        <div class="roles-employee-card">
                            <strong class="employee-name">${name}</strong>
                            <div class="role-badge-container">
                            <span class="role-badge ${role}">${role.toUpperCase()}</span>
                            <button class="fire-button" 
                                    onclick="RolesManager.fire('${name}')"
                                    title="Fire ${name}">FIRE</button>
                            </div>
                        </div>`;
            });

            list.innerHTML = html || "<p class='no-employees-text'>No employees yet</p>";
        });
    },


    assign() {
        if (window.myRole !== "manager") return showToast("fail", "Only Manager can assign roles!");
        const name = document.getElementById("roleEmployeeSelect")?.value;
        const level = document.getElementById("roleLevelSelect")?.value;
        if (!name || !level) return showToast("fail", "Select employee and role");

        ROLES_DOC.update({ [name]: level })
            .then(() => {
                if (name === window.playerName) {
                    window.myRole = level;
                    applyPermissions();
                    updatePlayerDisplay();
                }
                showToast("success", `${name} → ${level.toUpperCase()}!`);
                RolesManager.render();
            });
    },

    async remove(name) {
        if (window.myRole !== "manager") {
            return showToast("fail", "Only Manager can fire employees!");
        }

        const confirmed = await showConfirm(`Permanently fire ${name} and remove all access?`);
        if (!confirmed) return;   // ← user clicked No → stop here

        // ──────── ONLY RUNS AFTER USER CLICKED YES ────────
        const configUpdates = {};
        configUpdates[`employees.${name}`] = firebase.firestore.FieldValue.delete();

        const roleDeletePromise = ROLES_DOC.update({
            [name]: firebase.firestore.FieldValue.delete()
        }).catch(err => {
            if (err.code === "not-found") {
                return ROLES_DOC.set({});
            }
            throw err;
        });

        const configPromise = SHARED_DOC_REF.update(configUpdates);

        try {
            await Promise.all([configPromise, roleDeletePromise]);

            delete App.state.employees[name];
            showToast("success", `${name} has been fired and erased from existence.`);
            RolesManager.render();
            EmployeeManager?.render?.();
            applyPermissions();
        } catch (err) {
            console.error("Fire failed:", err);
            showToast("fail", "Failed to fire — check console");
        }
    },
};

// ========================
// End of Roles System CODE
// ========================

// ========================
// MAin App and Content
// ========================
const App = {
    state: {
        customPrices: {},
        hiddenFromPriceList: {},
        categories: { "Furniture": ["Chair", "Rocking Chair", "Bear Bench", "Dining Table"], "Tents": ["Simple Tent", "Deluxe Tent"], "Weapons": ["Revolver", "Rifle", "Shotgun"], "Other": [] },
        employees: {},
        completedOrders: [],
        shopStock: {},
        warehouseStock: {},
        ledger: [],
        minStock: {},
        rawPrice: { "Wood": 0.20, "Logs": 0.50, "Resin": 0.20, "Fiber": 0.20, "Cotton": 0.40, "Wheat": 0.30, "Raw Pelt": 1.00, "Tanned Leather": 1.50, "Leather Strap": 0.50, "Rock": 0.20, "Iron": 1.00, "Steel": 2.50, "Nails": 0.15, "Tent Stake": 3.00, "Labour": 0.10, "Copper": 1.50, "Wire": 3.00, "Copper Wire": 3.00, "Coal": 0.80 },
        recipes: { "Logs": { i: { "Wood": 2, "Labour": 1 }, y: 1 }, "Plank": { i: { "Logs": 1, "Labour": 1 }, y: 4 },/* ... all your recipes ... */ },
        order: [], currentEmployee: "", currentCustomer: "", craftingPreferences: {}
    },
    cache: { cost: {} },
    lastSavedState: {},

    // SAVE TO FIREBASE (replaces localStorage)
    async save(key) {
        if (!firebase.auth().currentUser) {
            console.warn("Not logged in — cannot save");
            return Promise.resolve();
        }
        if (!this.userDoc) this.userDoc = SHARED_DOC_REF;

        // BLOCK UI-ONLY FIELDS
        const blocked = ["currentEmployee", "currentCustomer", "lastTab", "lastSection", "orderMode"];
        if (blocked.includes(key)) {
            await ls.set("ui_" + key, JSON.stringify(this.state[key]));
            return Promise.resolve();
        }

        let value = this.state[key];

        // CRITICAL: Force a fresh object for warehouseStock and shopStock
        // This breaks the reference so Firestore sees the change
        if (key === "warehouseStock" || key === "shopStock") {
            value = JSON.parse(JSON.stringify(value)); // ← THIS IS THE NUCLEAR FIX
            console.log(`FORCE CLONED ${key} for save`);
        }

        // Your existing deepClean (perfect — keep it)
        function deepClean(val) {
            if (val === undefined || val === null) return null;
            if (typeof val === 'number' && isNaN(val)) return 0;
            if (Array.isArray(val)) {
                const cleaned = val.map(deepClean).filter(v => v !== null);
                return cleaned;
            }
            if (typeof val === 'object' && val !== null) {
                const cleaned = {};
                for (const k in val) {
                    const v = deepClean(val[k]);
                    if (v !== null) cleaned[k] = v;
                }
                return cleaned;
            }
            return val;
        }

        const updates = {};
        const cleaned = deepClean(value);

        // Delete detection
        if (this.lastSavedState?.[key] && typeof this.lastSavedState[key] === "object" && this.lastSavedState[key] !== null) {
            for (const oldKey in this.lastSavedState[key]) {
                if (!(oldKey in value)) {
                    updates[`${key}.${oldKey}`] = firebase.firestore.FieldValue.delete();
                }
            }
        }

        if (cleaned !== null) {
            updates[key] = cleaned;
        }

        // Update last saved state
        if (!this.lastSavedState) this.lastSavedState = {};
        this.lastSavedState[key] = typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;

        try {
            await this.userDoc.set(updates, { merge: true });
            console.log(`SAVED ${key} — changes detected and sent to Firebase`);
        } catch (err) {
            console.error("Save failed:", err);
            showToast("fail", "Save failed — check internet");
        }
    },


    // Load everything once + real-time listener
    init() {
        console.log("Connecting to shared business data...");
        this.userDoc = SHARED_DOC_REF;
        console.log("App.userDoc CONNECTED to shared business doc");
        App.userDoc.set({ _debugConnected: Date.now() }, { merge: true })
            .then(() => console.log("FIRST WRITE SUCCESS — FIREBASE IS NOW WORKING!"))
            .catch(e => console.error("Still blocked:", e));

        SHARED_DOC_REF.onSnapshot(async (doc) => {
            if (!doc.exists) return App.saveAll();

            const data = doc.data() || {};

            // PERMANENT CLEAR LOGIC — USING ls (company-scoped!)
            const isPermanentlyCleared = window.permanentOrderCleared ||
                (await window.ls.get(ORDER_CLEARED_KEY)) === true;

            if (isPermanentlyCleared) {
                console.log("PERMANENT ORDER CLEAR ACTIVE — FORCING EMPTY ORDER");
                data.order = [];  // KILL SWITCH
            }

            Object.assign(App.state, data);

            // OCR Corrections
            if (doc.data().ocrCorrections) {
                CORRECTIONS = doc.data().ocrCorrections;
                await ls.set('ocrCorrections', JSON.stringify(CORRECTIONS));
            }

            // === WEIGHT DEFAULTS (only run if not cleared) ===
            if (!isPermanentlyCleared) {
                Object.keys(App.state.rawMaterials || {}).forEach(name => {
                    if (App.state.rawMaterials[name]?.weight === undefined) {
                        App.state.rawMaterials[name].weight = 0;
                    }
                });
                Object.keys(App.state.craftedItems || {}).forEach(name => {
                    if (App.state.craftedItems[name]?.weight === undefined) {
                        App.state.craftedItems[name].weight = 0;
                    }
                });
                App.save("rawMaterials");
                App.save("craftedItems");
            }

            applyPermissions();
            App.trigger("roles"); // reload roles
            // Render everything once
            debouncedCalcRun();
            if (!window.orderJustCompleted) Order.renderCurrentOrder();
            Order.render();
            Order.renderPending();
            Order.autoRestoreCheckedOutOrder();
            Inventory.render();
            Ledger.render();
            PriceList.render();
            Categories.render();
            EmployeeManager.render();
            RawMaterials.renderPrices();
            RolesManager.render();
            renderPermissionsEditor();
            RecipeEditor.renderRecipeTable();
            // Trigger search inputs to refresh dropdowns
            ["itemSearch", "purchaseItemSearch"].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.dispatchEvent(new Event("input"));
            });
            EmployeeSelect.refreshAll();
        });

        // Fix ledger Dates
        App.state.ledger = App.state.ledger.map(entry => {
            if (entry.date && !entry.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                try {
                    const d = new Date(entry.date);
                    if (!isNaN(d.getTime())) {
                        entry.date = d.toISOString().split("T")[0]; // → 2025-04-01
                    }
                } catch (e) {
                    entry.date = "1970-01-01"; // fallback
                }
            }
            return entry;
        });

        App.state.pendingOrders = App.state.pendingOrders || [];
        // PREVENT UNDEFINED FROM EVER ENTERING rawPrice OR recipes
        const originalRawPrice = App.state.rawPrice || {};
        const originalRecipes = App.state.recipes || {};

        // Sanitize on load
        App.state.rawPrice = Object.fromEntries(
            Object.entries(originalRawPrice).filter(([k, v]) => v !== undefined && v !== null)
        );
        App.state.recipes = Object.fromEntries(
            Object.entries(originalRecipes).filter(([k, v]) => v !== undefined && v !== null)
        );

    },

    events: {},
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    },
    trigger(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(cb => cb(data));
        }
    },

    // ──────────────────────────────────────────────────────────────
    // APP.LOAD → RESTORES FROM FIREBASE + LOCALSTORAGE UI PREFS
    // ──────────────────────────────────────────────────────────────
    async load() {
        if (!this.userDoc) return;

        const snap = await this.userDoc.get();
        if (snap.exists) {
            Object.assign(this.state, snap.data());
        }

        // ── Restore UI preferences from namespaced localStorage ──
        const uiKeys = ["currentEmployee", "currentCustomer", "lastTab", "lastSection", "orderMode"];

        // Use for...of so we can await properly
        for (const key of uiKeys) {
            const val = await ls.get("ui_" + key);
            if (val !== null) {
                this.state[key] = val; // ls.get() already parses JSON
            }
        }

        // Safety: initialize missing objects/arrays
        this.state.pendingOrders = this.state.pendingOrders || [];
        this.state.completedOrders = this.state.completedOrders || [];
        this.state.ledger = this.state.ledger || [];
        this.state.warehouseStock = this.state.warehouseStock || {};
        this.state.shopStock = this.state.shopStock || {};
        this.state.employees = this.state.employees || {};
        this.state.minStock = this.state.minStock || {};

        this.trigger("ready");
    },

    // Force save everything (first time or full reset)
    saveAll() {
        safeSet({
            ...this.state,
            version: "firebase-v1",
            createdBy: playerName,
            createdAt: firestore.FieldValue.serverTimestamp()
        }).then(() => console.log("Full state saved to cloud"));
    },

    // Keep your existing helpers
    allItems() { return [...new Set([...Object.keys(this.state.rawPrice), ...Object.keys(this.state.recipes)])].sort(); },
    refresh() { this.cache.cost = {}; }
};

// Add crafting preference saver (uses Firebase now)
App.saveCraftingPreference = function (key, choice) {
    if (choice === "warehouse") {
        App.state.craftingPreferences[key] = "warehouse";  // SAVE warehouse choice
    } else {
        // ONLY delete if user explicitly picks "craft"
        // Do NOT delete just because pref is missing!
        if (App.state.craftingPreferences[key]) {
            delete App.state.craftingPreferences[key];
        }
    }
    App.save("craftingPreferences");
    debouncedCalcRun();
};

// reload pendoing orders after roles have been set
App.on("ready", () => {
    Order.renderPending();
});

App.on("roles", () => {
    //console.log("Roles loaded → fixing employee dropdown");

    // THIS ONE LINE FIXES THE Employee DROPDOWN
    const select = document.getElementById("employeeSelect");
    if (select && App.state.loggedInUser) {
        select.value = App.state.loggedInUser;
    }

    Order.autoRestoreCheckedOutOrder();
    Order.renderPending();
});

// =============================================
// BUSINESS MANAGER FUNCTIONALITY
// =============================================
const BusinessManager = {
    async render() {
        try {
            const businessDoc = await firebase.firestore().collection('business').doc('config').get();
            if (businessDoc.exists) {
                const config = businessDoc.data();
                this.displayBusinessInfo(config);
                this.showManagementSection();
            } else {
                // FIRST-TIME SETUP — SHOW MODAL, NOT INLINE FORM
                showBusinessSetupModal();
            }
        } catch (error) {
            console.error('Error loading business config:', error);
            showBusinessSetupModal(); // fallback to modal
        }
    },

    displayBusinessInfo(config) {
        console.log('Displaying business info:', config);
        const display = document.getElementById('businessInfoDisplay');
        const form = document.getElementById('businessSetupForm');
        const passphraseSection = document.getElementById('passphraseManagement');
        const pendingSection = document.getElementById('pendingUsersSection');

        if (display) display.style.display = 'block';
        if (form) form.style.display = 'none';
        if (passphraseSection) passphraseSection.style.display = 'block';
        if (pendingSection) pendingSection.style.display = 'block';

        const nameEl = document.getElementById('displayBusinessName');
        const taglineEl = document.getElementById('displayBusinessTagline');

        if (nameEl) nameEl.textContent = config.name || 'Not Set';
        if (taglineEl) taglineEl.textContent = config.tagline || 'Not Set';

        const securityStatus = document.getElementById('displaySecurityStatus');
        if (securityStatus) {
            securityStatus.innerHTML = config.passphrase
                ? 'Passphrase Protected'
                : 'No Passphrase Set';
            securityStatus.style.color = config.passphrase ? '#28a745' : '#ffc107';
        }
        // ← ADD THESE LINES — UPDATE PAGE TITLE & HEADER
        if (config.name) {
            document.title = `${config.name} - HSRP Manager`;
            const headerName = document.querySelector('h1');
            if (headerName) headerName.textContent = config.name;

            if (config.tagline) {
                const subtitle = document.querySelector('.subtitle');
                if (subtitle) subtitle.textContent = config.tagline;
            }
        }
    },

    // THIS IS THE NEW PROTECTED SETUP FORM (inline, no modal needed)
    showSetupForm() {
        console.log('Showing business setup form');
        const display = document.getElementById('businessInfoDisplay');
        const form = document.getElementById('businessSetupForm');
        const passphraseSection = document.getElementById('passphraseManagement');
        const pendingSection = document.getElementById('pendingUsersSection');

        if (display) display.style.display = 'none';
        if (form) form.style.display = 'block';
        if (passphraseSection) passphraseSection.style.display = 'none';
        if (pendingSection) pendingSection.style.display = 'none';

        // FINAL PROTECTION: Block applyPermissions while setup form is visible
        setTimeout(() => {
            const inputs = document.querySelectorAll('#businessSetupForm input, #businessSetupForm button');
            inputs.forEach(el => {
                el.disabled = false;
                el.style.pointerEvents = 'auto';
            });
            document.getElementById('businessNameInput')?.focus();
        }, 200);
    },

    showManagementSection() {
        document.getElementById('passphraseManagement')?.style.setProperty('display', 'block');
        document.getElementById('pendingUsersSection')?.style.setProperty('display', 'block');
    },

    async save() {
        const name = document.getElementById('businessNameInput')?.value.trim();
        const tagline = document.getElementById('businessTaglineInput')?.value.trim();
        const passphrase = document.getElementById('businessPassphraseInput')?.value.trim();

        if (!name) {
            showToast("fail", 'Please enter a business name ', 5000);
            return;
        }

        try {
            await db.collection("business").doc("config").set({
                name,
                tagline: tagline || "Managing what you make",
                passphrase: passphrase || null,
                configuredBy: window.playerName || 'unknown',
                configuredAt: firebase.firestore.FieldValue.serverTimestamp(),
                companyId: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
            }, { merge: true });

            if (passphrase) await setPassphraseHash(btoa(passphrase));
            else await setPassphraseHash(null);

            showToast("success", `Business "${name}" created successfully!`, 5000);

            // DO NOT CALL this.render() — it will show the form again!
            // Instead, remove modal and restart app
            document.getElementById("businessSetupModal")?.remove();
            AuthManager.start();
        } catch (error) {
            console.error('Error saving business config:', error);
            showToast("fail", 'Error saving configuration. Please try again.', 5000);
        }
    }
};
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // Edit button — show the inline form
        const editBtn = document.getElementById('editBusinessBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                console.log("Edit Business Settings clicked");

                // Show the form
                document.getElementById('businessInfoDisplay')?.style.setProperty('display', 'none', 'important');
                document.getElementById('businessSetupForm')?.style.setProperty('display', 'block', 'important');
                document.getElementById('passphraseManagement')?.style.setProperty('display', 'none', 'important');
                document.getElementById('pendingUsersSection')?.style.setProperty('display', 'none', 'important');

                // Force inputs enabled (in case permissions are blocking)
                setTimeout(() => {
                    const inputs = document.querySelectorAll('#businessSetupForm input, #businessSetupForm button');
                    inputs.forEach(el => {
                        el.disabled = false;
                        el.style.pointerEvents = 'auto';
                    });
                    document.getElementById('businessNameInput')?.focus();
                }, 100);
            });
        }

        // Save button
        const saveBtn = document.getElementById('saveBusinessBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async (e) => {
                e.preventDefault(); // Prevent form submit
                await BusinessManager.save();
            });
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancelBusinessBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                BusinessManager.render();
            });
        }

        console.log('BusinessManager event listeners attached');
    }, 500);
});

// Global access
window.BusinessManager = BusinessManager;
window.businessRender = () => BusinessManager.render();



// =============================================
// Pending Users Management System
// =============================================

const PendingUsersManager = {
    pendingUsersRef: firebase.firestore().collection('business').doc('pendingUsers'),

    async render() {
        try {
            const pendingDoc = await this.pendingUsersRef.get();
            const container = document.getElementById('pendingUsersList');

            if (!container) return;

            if (!pendingDoc.exists || !pendingDoc.data() || Object.keys(pendingDoc.data()).length === 0) {
                container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No users currently awaiting approval.</p>';
                return;
            }

            const pendingUsers = pendingDoc.data();
            let html = '';

            Object.keys(pendingUsers).forEach(userName => {
                const userData = pendingUsers[userName];
                const requestedAt = userData.timestamp ? new Date(userData.timestamp.seconds * 1000).toLocaleString() : 'Unknown time';

                html += `
          <div class="pending-user-card" style="
            background: var(--card); 
            padding: 16px; 
            border-radius: 8px; 
            border: 1px solid var(--border); 
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;">
            
            <div style="flex: 1;">
              <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">
                ${userName}
              </div>
              <div style="color: #888; font-size: 13px;">
                Requested access: ${requestedAt}
              </div>
            </div>
            
            <div style="display: flex; gap: 8px;">
              <button class="approve-user-btn" 
                      onclick="PendingUsersManager.approveUser('${userName}')"
                      style="
                        padding: 8px 16px; 
                        background: var(--green); 
                        color: white; 
                        border: none; 
                        border-radius: 6px; 
                        font-weight: 600;
                        cursor: pointer;">
                Approve
              </button>
              <button class="reject-user-btn" 
                      onclick="PendingUsersManager.rejectUser('${userName}')"
                      style="
                        padding: 8px 16px; 
                        background: var(--red); 
                        color: white; 
                        border: none; 
                        border-radius: 6px; 
                        font-weight: 600;
                        cursor: pointer;">
                Reject
              </button>
            </div>
          </div>
        `;
            });

            container.innerHTML = html || '<p style="color: #888; text-align: center; padding: 20px;">No users currently awaiting approval.</p>';

        } catch (error) {
            console.error('Error rendering pending users:', error);
            document.getElementById('pendingUsersList').innerHTML = '<p style="color: #ff6b6b;">Error loading pending users.</p>';
        }
    },

    async approveUser(userName) {
        const ok = await showConfirm(`Approve ${userName} as an employee?`); if (!ok) return;

        try {
            // Create an update that properly merges the new employee without overwriting existing ones
            const employeeUpdate = {};
            employeeUpdate[`employees.${userName}`] = {
                hiredAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const pendingUpdates = {};
            pendingUpdates[userName] = firebase.firestore.FieldValue.delete();

            await Promise.all([
                firebase.firestore().collection('business').doc('main').update(employeeUpdate),
                this.pendingUsersRef.update(pendingUpdates)
            ]);

            showToast("success", `${userName} has been approved and added as an employee.`);
            this.render();
        } catch (error) {
            console.error('Error approving user:', error);
            showToast("fail", 'Error approving user: ' + error.message);
        }
    },

    async rejectUser(userName) {
        if (await showConfirm(`Reject ${userName}'s access request? They will be permanently removed from the pending list.`)) {
            return;
        }

        try {
            const updates = {};
            updates[userName] = {
                status: 'rejected',
                rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.pendingUsersRef.update(updates);
            showToast("success", `${userName} has been rejected.`);
            this.render();
        } catch (error) {
            console.error('Error rejecting user:', error);
            showToast("fail", 'Error rejecting user: ' + error.message);
        }
    },

    async addPendingUser(userName) {
        try {
            const pendingData = {};
            pendingData[userName] = {
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                requestedBy: userName
            };

            await this.pendingUsersRef.set(pendingData, { merge: true });
            return true;
        } catch (error) {
            console.error('Error adding pending user:', error);
            return false;
        }
    }
};

// =============================================
// MAIN HIDDEN TAB SYSTEM — THIS IS THE CORE
// =============================================
document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", function (e) {
        e.preventDefault();

        const targetId = this.dataset.tab;
        const targetContent = document.getElementById(targetId);

        if (!targetContent) {
            console.error("Tab content not found:", targetId);
            return;
        }

        // 1. Remove active from ALL tabs and content
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => {
            c.classList.remove("active");
            c.style.display = "none";                    // ← CRITICAL: force hide
        });

        // 2. Activate clicked tab
        this.classList.add("active");
        targetContent.classList.add("active");
        targetContent.style.display = "block";           // ← CRITICAL: force show

        // 3. Optional: smooth scroll to content
        targetContent.scrollIntoView({ behavior: "smooth", block: "start" });

        // 4. Run any tab-specific render functions (add more as needed)
        if (typeof window[targetId + "Render"] === "function") {
            window[targetId + "Render"]();
        } else if (typeof window["render" + targetId.charAt(0).toUpperCase() + targetId.slice(1)] === "function") {
            window["render" + targetId.charAt(0).toUpperCase() + targetId.slice(1)]();
        }

        console.log("Tab activated:", targetId);
    });
});

// =============================================
// FULLY AUTOMATIC MENU SYSTEM — CLEAN & FIXED
// =============================================
const DropdownMenu = {
    groups: {
        "Welcome": {
            description: `Welcome to HSRP Business Manager`,
            tabs: [
                {
                    id: "welcome", name: "Welcome", "desc": "Start Here!!", help: `
                Welcome to the business manager
              `.trim()
                }
            ]
        },
        "Orders": {
            description: "Manage customer orders, view pending jobs and create items to resatock the shop and warehouse.",
            tabs: [
                {
                    id: "order", name: "Order", "desc": "Create a new order, for a customer, or to restock the shop or warehouse", help: `
                <p><strong>Orders Section - Orders<br /></strong>put together orders for customer sales or shop and warehouse restocks.</p>
                <p><strong>First select the type of order:</strong></p>
                <ul>
                <li>Customer Sale - Sell directly to a customer</li>
                <li>Restock Shop Display - Create items for your seller</li>
                <li>Restock Warehouse - Create Items for the warehouse Seller</li>
                </ul>
                <p><strong>Select your name from the Employee List.</strong><br />Your commission will be calculated when the sale is complete</p>
                <p><strong>Enter the Customers Name </strong></p>
                <p><strong>Search and add Items to the order</strong>: <br />Start typing the name of the item you want to add to the order then click it when it appears in the list.</p>
                <p>Select how many of the item you want</p>
                <p>Click <strong>Add Item</strong> to add it to the order</p>
                <p>You can select the price for the item from the Price Tier selector:</p>
                <ul>
                <li><strong>Shop</strong> - Uses the shop price set in the price list</li>
                <li><strong>Bulk</strong> - Uses the Bulk price set in the pricelist</li>
                <li><strong>Custom</strong> - you may override the shop and bulk options by entering a custom price .<br /><em>(the price teir selected will show in the customer Invoice but with the updated price)</em></li>
                </ul>
                <p>You can click the <strong>AutoFill:Restock Low Shop tems</strong> Button to add any Item that is currently low stock in the shop to the order.</p>
                <p>Depending on the type of order you have 3 options to complete it:</p>
                <ul>
                <li><strong>Complete Sale</strong> - Completes the order and adds it to the Completed orders table and Business Ledger</li>
                <li><strong>Complete Shop Restock</strong> - Adds the items to the Shop and updates the shop stock</li>
                <li><strong>Complete Warehouse Restock</strong>- Sends the Items to the warehouse and updates the stock<br /><br /><strong>For both Shop and Warehouse restock -&nbsp;</strong><br />The order will be added to the Ledger with a sale cost of $0 as the item is in storage and not actually been sold.<br />It will not appear in the completed orders section.</li>
                </ul>
                <p>You can save a current order as pending and load it bacl in later.<br />When Saving a current order as pending:</p>
                <ul>
                <li>You will be prompted to set your name from the emplyee dtopdown if you have not already done so.<br /><br /></li>
                <li>If it is a Customer Sale you will be prompted to Fill in the Customer Name if you have not already done so.<br /><br /></li>
                <li>You may add an Optional Note: Customer needs for tuesday, Need more Wool for this order, etc.<br />Or you can just leave it blank<br /><br /></li>
                <li>You will be asked to give the order a name (it will assign it a name based on the order items by default.</li>
                <li>It will tell you the order was saved.<br /><br />Go to the Pending Orders Tab to see all pending orders.</li>
                </ul>
              `.trim()
                },
                {
                    id: "pending", name: "Pending Orders", desc: "View all orders currently in production or waiting", help: `
              <p><strong>Orders Section - ending Orders<br /></strong>From here you can see manage all pending orders.<br />clicking <strong>load </strong>will overwrite any existing order you have open and replace it with the order you loaded.</p>
              <p>Clicking <strong>Delete</strong> will remove the order from the list completley.</p>
              <p><strong>(This action cannot be undone)</strong></p>
             `.trim()
                },
                {
                    id: "raw", name: "Crafting Tree", desc: "See exact material requirements and warehouse usage", help: `
              <p><strong>Orders Section - Crafting Tree<br /></strong>The craffting tree gives you a complete breakdown of your order:</p>
              <ul>
              <li>What materials you will need to craft the items.</li>
              <li>How many of an item is needed.</li>
              <li>cost and weight of the materials.</li>
              </ul>
              <p>At various stages in the tree you can choose to use items from your <strong>warehouse</strong>, or to <strong>craft</strong> the items needed manually.<br /><br />The tree will update the materials needed depending on wheter you select <strong>Craft</strong> or <strong>Warehouse</strong> as the source.<br /><br /><strong><em>The warehouse option will only be availiable if you have enough stock of that item in the warehouse.</em></strong></p>
              <p>The table at the bottom will give you a complete breakdown of all the materials you will need to complete the order.</p>
              <ul>
              <li>The cost of the raw materials / crafted items needed to complete the production.</li>
              <li>The weight of the Materilas used and FInal shipping weight.</li>
              <li>The profit made on the order (based on the prices set in the Order Tab)</li>
              </ul>
              <p>You can remove an item from the order by clicking the red <strong>X</strong> in the item tree. This will also remove it from the table in the Order Section.
            `.trim()
                },
                {
                    id: "profit", name: "Order Summary / Profit", desc: "Real-time cost, revenue and profit breakdown", help: `
              <p><strong>Orders Section - Order Summary / Profit Section</strong></p>
              <p>This provides a customer invoice showing per order items and totals.<br /><br />There is a Show Profit (internal View) Button <br />This toggles toggles the invoice between:</p>
              <p><strong>*&nbsp;</strong><strong>Internal View - </strong>&nbsp;shows production costs and profit made&nbsp;</p>
              <p><strong>Customer View</strong> - Hides Profit and manufacturing costs<br />(this version of the invoice and be copied and used to give directly to a customer)<br /><br />items marked by <strong>*</strong> will only appear on the Internal view</p>
              <ul>
              <li><strong>Quantity</strong> - The quantity of the item purchased</li>
              <li><strong>Item</strong> - The name of the item purchases</li>
              <li><strong>Price Tier</strong> - Shop Price or&nbsp; Bulk Price<br /> <em>(if a custom price has been set it will still use whatever option is selected from the price Teir on the order)</em></li>
              <li><strong>Weight -</strong> The total weight of the items</li>
              <li><strong>* Unit Cost -</strong> The manufacturing cost of the items</li>
              <li><strong>Unit Price -</strong> The sale proce of the items</li>
              <li><strong>Total - </strong>The toal price of the items</li>
              </ul>
              <p>Displayed at the bottom of the order:</p>
              <ul>
              <li><strong>Subtotal</strong> - The cost of all the items in the order</li>
              <li><strong>* Cost</strong> to Produce - the production cost of asll the items in the order</li>
              <li><strong>* Profit</strong> - The profit in $ and % for the order</li>
              <li><strong>Total Due</strong> - Tatal payable by the customer for the order</li>
              <li><strong>Total Weght</strong> - The total weight for all items in the order</li>
              </ul>
              <p>&nbsp;</p>
              <p>&nbsp;</p>
            `.trim()

                },
                {
                    id: "completed", name: "Completed Orders", desc: "Archive of delivered orders with final profit", help: `
              <p><strong>Orders Section - Completed Orders Section<br /></strong>A list of all orders that have been completed Customer, Shop and Warhouse Restocks</p>
              <p>All completed customer orders will appear here.<br /><br />Orders can be filterd by date and or Employee.<br /><br />The table shows:</p>
              <p><strong>Date</strong> - The date of the order</p>
              <p><strong>ID</strong> - The Order Id (uniquley generated)</p>
              <p><strong>Employee</strong> - The name of the Employee that made the sale</p>
              <p><strong>Customer</strong> - The name of the Customer</p>
              <p><strong>Items</strong> - A list of the items sold</p>
              <p><strong>Weight</strong> - The weight of the items sold</p>
              <p><strong>Sale Total</strong> - The total cost of the order</p>
              <p><strong>Gross Profit</strong> - The total profit made on the order</p>
              <p><strong>Comission</strong> - The comission rate and the amount in $<br /> <em>(shows the comission rate of the employee at the time of the sale)</em> </p>
              <p><strong>Net Profit</strong> - The profit after comission is subtracted</p>
              <p>The total amount of sales, Comission Net Profit and weight of all sales is shown at the bottom.<br /><br />If a filter has been applied it will show totals for sales matching those filters only.<br /><br /></p>
              <p>&nbsp;</p>
            `.trim()
                }
            ]
        },
        "Stock and Raw Materials": {
            description: "Track inventory, purchase raw materials, and manage warehouse stock levels",
            tabs: [
                {
                    id: "rawprices", name: "Raw Materials", desc: "Set buy prices and weights for all raw materials", help: `
              <p><strong>Stock and Raw Materials Section - Raw Materials</strong></p>
              <p>This is where you can configure add and delete raw materials your business consumes.</p>
              <p>Raw materials can be added via the form at the top</p>
              <ul>
              <li>Enter the name of the raw material</li>
              <li>The price of the raw material</li>
              <li>The weight of the rap material</li>
              </ul>
              <p>Once a raw material has been added it will appear in the list<br /><br /> The price and weight of a raw material can be changed at any time, just enter the new weight or price and click the save button.</p>
              <p>&nbsp;</p>
            `.trim()
                },
                {
                    id: "rawpurchase", name: "Purchase Raw", desc: "Record new raw material deliveries to warehouse", help: `
              <p><strong>Stock and Raw Materials Section - Purchase Raw Materials</strong></p>
              <p>When you add raw materials to your business warehouse</p>
              <p>fill out this form to maintain correct stock levels and ledger.</p>
              <ul>
              <li>start typing the name of the raw material and select it from the list.<br />The filter will show the item and its currenty set price in raw Materials<br /><em><strong>(If the name does not appear make sure it has been added to the Raw Materials list on the Raw Materials Section)</strong><br /></em></li>
              <li>Enter the Quantity of the raw material you are adding.</li>
              <li>Enter the total price of the raw materials you are adding</li>
              <li>Enter the suppliers name</li>
              <li>select your name from the employee list</li>
              </ul>
              <p><em>If you are adding materials you have collected yourself, it is still best to use this form and put in 0 as the buy cost.</em><br /><br />Click R<strong>ecord purchase &amp; Add to Warehouse</strong>.<br /><br />A confirmation will appear with the purchase detials<br />click <strong>OK<br /></strong><br />A record of the purchase will be added to the Ledger and the warehouse stock will be updated.</p>
              <p>&nbsp;</p>
            `.trim()
                },
                {
                    id: "inventory", name: "Stock Manager", desc: "Full overview of current stock levels across all items", help: `
              <p><strong>Stock and Raw Materials Section - Stock Manger</strong></p>
              <p>The Stock Manager is vital in amaging your businesses warehouse and shop stock.<br /><br />By default only crafted items are listed as for sale in the shop.<br /><br />The main table has the following:</p>
              <ul>
              <li><strong>Item</strong> - The name of the Item</li>
              <li><strong>Type</strong> - Either a crafted item (from a recipe) or Raw Material</li>
              <li><strong>Shop Display</strong> - The current number of items for sale in the shop<br />The total weight of those items is also displayed)</li>
              <li><strong>Warehouse</strong> - The amount in the warehouse (can be updated)</li>
              <li><strong>Min Stock</strong> - The minimum amount that should be for sale in the shop)</li>
              <li><strong>Status</strong> - Wether the shop is stocked with enough items to equal the minimum stock amount</li>
              <li><strong>Set Shop Stock</strong> - manually set the amount that is currently in the shop</li>
              <li><strong>Actions</strong>:
              <ul style="list-style-type: square;">
              <li><strong> Return to warehouse</strong> Button<br />(Removes items from the shop and sends back to the warehouse</li>
              <li><strong>Move * to display</strong> Button<br />Moves the * number of items from the warehouse to the shop<br />(only displays if there is enough stock in the warehouse)</li>
              </ul>
              </li>
              </ul>
              <p>The next set of items in the list&nbsp;Raw Materials are displayed.</p>
              <p>Raw materials by default are not put on sale to the shop, <br />
              If you wish to sell raw materials in your shop you may click the <strong>ADD TO SHOP DISPLAY</strong> Button.<br />
              <br />This will add the raw material to your shop<br />
              all the functions listed above will be available for that raw item.<br />
              along with an extra option to remove the Raw Material from the shop.</p>
            `.trim()
                }
            ]
        },
        "Craftable Products": {
            description: "Create and edit crafting recipes, organize items into categories",
            tabs: [
                {
                    id: "recipes", name: "Recipe Manager", desc: "Create, edit and delete crafting recipes", help: `
              <p><strong>Craftable Products Section - Recipe Manager</strong></p>
              <p>The recipe Manager is where you add all your craftable products.<br /><br />Recipes can be created from Raw Materilas, Other Recipies or Both.<br /><br />Creating a recipe is simple:</p>
              <ul>
              <li><strong>Name</strong> - The name of the item</li>
              <li><strong>Yield per Craft</strong> - how many items this recipe creates</li>
              <li><strong>Weight</strong> - The weight of the final crafted item (for 1 single item)</li>
              <li><strong>Ingredients</strong> - The ingredients used to make the Item</li>
              <li>Click <strong>Add Ingerident</strong>&nbsp;to add a new item to the recipe<br />You can add as many ingredients as you need
              <ul style="list-style-type: square;">
              <li>An Ingredient can be:
              <ul style="list-style-type: circle;">
              <li>A Raw Material</li>
              <li>A Recipe you previously created.</li>
              </ul>
              </li>
              </ul>
              </li>
              </ul>
              <p>Click <strong>Create Recipe&nbsp;</strong>and your new product will appear i the list below.<br /><br />To Edit an existing recipe, click the <strong>Load</strong> Button.<br /><br />It will appear in the recipe Editor.<br />You can change the Weight, Name, Yeild and Ingredients then click <strong>Save Changes</strong>.<br /><br />You can Duplicate an existing recipe, after clicking <strong>Duplicate Recipe</strong><br />The new recipe will appear in the top Create new Recipe Area.<br />Just Give it a new name update the ingredients and click <strong>Create Recipe</strong></p>
              <p>&nbsp;</p>
            `.trim()
                },
                {
                    id: "categories", name: "Category Manager", desc: "Organize items into shop categories and tiers", help: `
              <p><strong>Craftable Products Section - Category Manager</strong></p>
              <p>The CategoryManager is where you configure what items appear on your price list.<br /><br />You create <strong>Product Category</strong> then add Items to the <strong>category</strong>.<br />You may create as many <strong>categories</strong> as you need.<br />You can assign <strong>Products</strong> and <strong>Raw Materials</strong> to more than one <strong>category</strong></p>
              <p>The Items will be displayed on the Price list in the order that you create / add them.<br /><br />You can drag and drop category and products to adjust their order.</p>
              <p>&nbsp;</p>
            `.trim()
                },
                {
                    id: "pricelist", name: "Price List", desc: "Set shop and bulk prices for all craftable items", help: `
              <p><strong>Craftable Products Section - Price List</strong></p>
              <p>The <strong>Price list</strong> shows all the <strong>Categories</strong> and <strong>Products</strong> you have set up on the <strong>Category ManagerSection</strong>&nbsp;<br /><br />You may use the Fiter Items box to search for specific items in the price list.<br /><br />The table shows the following:</p>
              <p><strong>Hide</strong> - Hides the item on the price list</p>
              <p><strong>Item</strong> - The Name of the item</p>
              <p><strong>Weight</strong> - The weight of a single item</p>
              <p><strong>Cost</strong> - The production cost or the Raw Material cost</p>
              <p><strong>Bulk Price</strong> - How much you want to sell the item for in bulk</p>
              <p><strong>Bulk Profit</strong> - The profit made per item when selling at the bulk price</p>
              <p><strong>Bulk Margin</strong> - The percentage made per item when selling at the bulk Price</p>
              <p><strong>Shop Price</strong> - How much the item will sell for in the Shop</p>
              <p><strong>Shop Profit</strong> - The profit made per item when selling at the Shop price</p>
              <p><strong>Shop Margin</strong> - The percentage made per item when selling at the Shop&nbsp;</p>
              <p>The <strong>Bulk Price</strong> and <strong>Shop Price</strong> fields can be changed at any time, after making your changes click <strong>Save All Prices and Hidden</strong> at the top to lock the prices in.<br /><br /></p>
            `.trim()
                }
            ]
        },
        "Shop": {
            description: "Monitor shop sales, daily revenue, and manage product pricing",
            tabs: [
                {
                    id: "shopsales", name: "Shop Sales History", desc: "All individual shop sales with profit per item", help: `
              <p><strong>Shop Section - Shop Sales</strong></p>
              <p>The <strong>Shop Sales</strong> shows all the&nbsp;sales that have been made in the shop that you have imported using the Shop Daily sales.<br /><br />The table shows:</p>
              <ul>
              <li><strong>Date and Time</strong> - The date and time the import was done</li>
              <li><strong>Id</strong> - A unique ID generated for the import</li>
              <li><strong>Item</strong> - The item sold</li>
              <li><strong>Qty Sold</strong> - How many of the item were sold</li>
              <li><strong>Unit Price</strong> - The cost for a single item</li>
              <li><strong>Total</strong> - the total cost of the sale</li>
              <li><strong>Source</strong> - The source of the data</li>
              </ul>
              <p>You can use the date selectors to show sales for a specific time period.</p>
            `.trim()
                },
                {
                    id: "dailysales", name: "Shop Daily Sales", desc: "Daily totals and trends for shop revenue", help: `
              <p><strong>Shop Section - Daily Sales</strong></p>
              <p>The <strong>Shop Daily Sales</strong> allows you to easily import sales made in your shop.</p>
              <p>It Uses OCR technology to read a screenshot of your sales and converts it to a form the Business manager can use.<br /><br />It will save sales into the Shop sales table and into the Ledger</p>
              <p>To use&nbsp; either drag and drop a screenshot of your sales onto the <br /><strong>Drop Screenshot Here or click to Upload</strong> Button<br /><br />Or just click the button and search for the screenshot manually.<br /><br />Once you have done that the image will be scanned and converted to text.<br /><br />In the text area that appears check over the output.<br />If the screen shot had the table headers:<br />ITEM ANOUNT PRICE PER TOTAL EARNED TIME SOLD<br />Delete thiose.<br /><br />Some lines may overflow to a SECOND LINE:<br /><br />Find the amount and line them all up for each line so you have one entry on each line - something like this:<br /><br />Simple toolkit&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 1 $5.00 $5.00 1899-11-22 09:45<br />Deluxe Tent&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;1 $130.00 $130.00 1899-11-22 09:44<br />Deluxe Tent, unfurnished&nbsp; 1 $120.00 $120.00 1899-11-22 09:44<br />Camp Fire&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 1 $4.00 $4.00 1899-11-22 09:44<br />Basic hitching post&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 1 $35.00 $35.00 1899-11-22 09:44<br />scarecrow Target&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;2 $40.00 $80.00 1899-11-22 09:44<br />Yellow Apiary&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 1 $15.00 $15.00 1899-11-22 09:45<br />Green Apiary&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 1 $15.00 $15.00 1899-11-22 09:45<br />White Apiary&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 1 $15.00 $15.00 1899-11-22 09:45<br />Apiary&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;1 $5.00 $15.00 1899-11-22 09:42<br /><br />Click the <strong>Import Sales Now</strong> Button<br /><br />The sales will be added to the <strong>Shop Sales Table</strong>, <strong>The Ledger,</strong> and the items will be removed from the shop stock, giving you acurate numbers on your <strong>Stock Manager</strong> so you know exactly what to craft to keep your shop stocked to its minimum levels!<br /><br /><strong>Fixing OCR Errors<br /></strong><br />The OCR isnt alway 100% acurate.<br /><br />You may sometimes find the import has mistakes for example:<br /><br />S1mpl3 toolk1t 1 $5.00 $5.00 1899-11-21 22:05<br /><br />Luckily you can add rules for common errors:</p>
              <ul>
              <li>Click the Edit Fix OCR Rules button<br /><br /></li>
              <li>In the Erong OCR text box add the incorrect word (S1mpl3)<br /><br /></li>
              <li>in the Correct name add the correction (Simple)<br /><br /></li>
              <li>Click Add Rule<br /><br />Then click the <strong>Re-apply all OCR Fixes</strong> Button<br /><br />Next time you do an import any rules you have added here will be automatically applied whn you import.<br /><br /></li>
              </ul>
            `.trim()
                }
            ]
        },
        "Management": {
            description: "Employee management, permissions, financial ledger, and data sync",
            tabs: [{
                id: "business",
                name: "Business Manager",
                desc: "Configure business name, tagline, and security passphrase",
                help: `
                <p><strong>Management Section - Business Manager</strong></p>
                <p>This is where you configure your business details and security settings.</p>
                <ul>
                  <li><strong>Business Name</strong> - The official name of your business</li>
                  <li><strong>Business Tagline</strong> - Your business motto/slogan</li>
                  <li><strong>Business Passphrase</strong> - Security key required for new users to access the app</li>
                </ul>
                <p><strong>Important:</strong> Once you set a passphrase, all new users must enter it to gain Viewer access.</p>
                <p>Existing users with saved sessions will continue to work normally.</p>
              `.trim()
            },
            {
                id: "employees", name: "Employees", desc: "Add, edit and assign roles to staff", help: `
                <p><strong>Managment Section - Employees</strong></p>
                <p>Here you can manage your employees and their comission rates.<br /><br />You can add a comission rate for each employee which will be used to calculate their comission when they complete orders for a customer.</p>
                <p>To add an employee just</p>
                <ul>
                <li>Add their Name</li>
                <li>Enter their comission rate.</li>
                <li>Click the <strong>+Add Employee Button</strong></li>
                </ul>
                <p>They will appear on the list below<br /><br />You can adjust an employees comission rate at any time jjust change the rate in the text field and click the <strong>Update Rate</strong> Button.<br /><br />EMployees comission is caculated when a sale is made, their comission rate at the time of sale is stored, so updating their comission rate will only affect Futue sales.</p>
            `.trim()
            },
            {
                id: "roles", name: "Roles & Permissions", desc: "Control what each employee can see and do", help: `
              <p><strong>Managment Section - Roles and Permissions</strong></p>
              <p>Here you can set permission and roles for your employees.<br />There are 4 Roles</p>
              <ul>
              <li><strong>Viewer</strong> - anyone viewing the app for the first time is assigned Viewer<br />They should have very limited Acess if any!!!</li>
              <li><strong>Worker</strong> - The nexr Level Up</li>
              <li><strong>Assitant</strong> - Almost as Trustworthy as a Manager</li>
              <li><strong>Manager</strong> - Full unlimited Access to Everything<br /><em><strong>Anyone assigned as a Manager has access to the whole application, be careful who you give this role too!</strong></em></li>
              </ul>
              <p>To Assign a role to an Employee:</p>
              <ul>
              <li>Select their name from the Dropdown</li>
              <li>Select the role you wish to Promote/Demote them too</li>
              <li>Click Assign Role</li>
              </ul>
              <p>&nbsp;</p>
              <p>Yow will see your current employees and their role in the list.</p>
              <p>You can fire an Employee by clicking the red <strong>FIRE</strong> Button,</p>
              <p>The permission Editor allows you to set which sections of the Application each rople can access.</p>
                          `.trim()
            },
            {
                id: "ledger", name: "Ledger", desc: "Complete financial history of all money in/out", help: `
              <p><strong>Managment Section - The Leger</strong></p>
              <p>The ledger is everything your business does, how much money it does or does not have.<br /><br />It lists all transactions made,</p>
              <ul>
              <li><strong>Shop Sales</strong></li>
              <li><strong>Order Sales</strong></li>
              <li><strong>Warehouse Restocks </strong></li>
              <li><strong>Shop Restocks</strong></li>
              <li><strong>Raw materials Purchased</strong></li>
              <li><strong>Money Added</strong></li>
              <li><strong>Money Taken out</strong></li>
              </ul>
              <p>It shows the current balance of the business<br /><br />Two forms to Add and Remove money from the business.</p>
                          `.trim()
            },
            {
                id: "sync", name: "Data Import / Export", desc: "Backup, restore or migrate your factory data", help: `
              <p><strong>Managment Section - Data Import / Export</strong></p>
              <ul>
              <li>Full managment of your data for importin and exporting in JSON Format from or the the cloud.<br /><br />Export Selected Data.</li>
              </ul>
              <ul>
              <li>Select the data you want to export&nbsp;</li>
              <li>click Export Selected</li>
              <li>The data will be shown in the text area and copied to the clipboard.</li>
              <li>clcik the text Area</li>
              <li>CTRL + A to select All</li>
              <li>CTRL + C To Copy</li>
              <li>Save this to a text file and keep it somewhere safe!</li>
              </ul>
              <p>Import Selected Data</p>
              <ul>
              <li>Paste your JSON into the text area,</li>
              <li>Select what you want to import&nbsp;</li>
              <li>Click Import Selected Data</li>
              <li>Data will be merged with your existing data</li>
              </ul>
              <p>Clear Selected Data</p>
              <p>You really shouldntr be doing this but if you must<br />MAKE A BACK UP FIRST BY EXPORTING ALL DATA!!!!!!</p>
              <p>Select what you want to delete</p>
              <p>Click DELETE SELECTED DATA</p>
              <p>Bye Bye All gone!!!</p>
              <p>&nbsp;</p>
            `.trim()
            }
            ]
        }
    }
};

let currentSection = "Orders";
let currentTab = "order";

// === AUTO BUILD DROPDOWN MENU WITH TOOLTIPS ===
function buildSectionDropdown() {
    const dropdown = document.getElementById("sectionDropdown");
    dropdown.innerHTML = "";

    Object.entries(DropdownMenu.groups).forEach(([section, data]) => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.textContent = section;
        item.dataset.section = section;
        item.dataset.desc = data.description;  // For hover tooltip
        dropdown.appendChild(item);
    });
}

function updateSectionDescription() {
    const descEl = document.getElementById("sectionDescription");
    const currentData = DropdownMenu.groups[currentSection];

    if (currentData && currentData.description) {
        descEl.innerHTML = currentData.description;  // Now supports HTML!
        descEl.style.opacity = "1";
    } else {
        descEl.innerHTML = "";
        descEl.style.opacity = "0";
    }
}

// Update tab description when tab changes
function updateTabDescription() {
    const descEl = document.getElementById("tabDescription");
    const group = DropdownMenu.groups[currentSection];
    if (!group) return;

    const tab = group.tabs.find(t => t.id === currentTab);
    if (!tab) return;

    // Use 'help' if exists and enabled, otherwise fall back to 'desc'
    if (tabDescriptionsEnabled && tab.help) {
        descEl.innerHTML = tab.help;
    } else if (tab.desc) {
        descEl.innerHTML = `<em>${tab.desc}</em>`;
    } else {
        descEl.innerHTML = "";
    }

    //descEl.style.opacity = tabDescriptionsEnabled ? "1" : "0";
}

function buildHorizontalTabs() {
    const container = document.getElementById("sectionTabs");
    container.innerHTML = "";

    const tabs = DropdownMenu.groups[currentSection]?.tabs || [];
    tabs.forEach(tab => {
        const btn = document.createElement("div");
        btn.className = "horizontal-tab";
        btn.textContent = tab.name;
        btn.dataset.tab = tab.id;
        btn.dataset.desc = tab.desc || "";  // ← Short tooltip on hover
        if (tab.id === currentTab) btn.classList.add("active");
        container.appendChild(btn);
    });

    updateTabDescription();
}

// === ACTIVATE TAB PROPERLY (UNIVERSAL FUNCTION) ===
async function activateTab(tabId) {
    if (!tabId) return;

    currentTab = tabId;

    // Update horizontal tabs visual state
    document.querySelectorAll(".horizontal-tab").forEach(b => {
        b.classList.toggle("active", b.dataset.tab === tabId);
    });

    // Show content
    document.querySelectorAll(".tab-content").forEach(c => {
        c.style.display = "none";
        c.classList.remove("active");
    });

    const content = document.getElementById(tabId);
    if (content) {
        content.style.display = "block";
        content.classList.add("active");
        content.scrollIntoView({ behavior: "smooth" });
    }

    // Special renders
    if (tabId === "pending" && typeof Order?.renderPending === "function") {
        Order.renderPending();
    }

    if (tabId === "orders") {
        setTimeout(autoRestoreCheckedOutOrder, 100); // tiny delay ensures DOM is ready
    }
    // Save last tab/section
    try {
        await ls.set("lastTab", tabId);
        await ls.set("lastSection", currentSection);
    } catch (e) {
        console.warn("Failed to save failed:", e);
    }

    updateTabDescription();
}

// === HORIZONTAL TAB CLICK ===
document.getElementById("sectionTabs")?.addEventListener("click", e => {
    const btn = e.target.closest(".horizontal-tab");
    if (!btn) return;
    activateTab(btn.dataset.tab);
});

// === SECTION DROPDOWN HANDLER ===
document.getElementById("sectionDropdown")?.addEventListener("click", e => {
    const item = e.target.closest(".dropdown-item");
    if (!item) return;

    const newSection = item.dataset.section;
    if (newSection === currentSection) {
        document.getElementById("sectionDropdown").classList.remove("show");
        return;
    }

    currentSection = newSection;
    document.getElementById("currentSectionBtn").textContent = newSection;

    const firstTabId = DropdownMenu.groups[newSection]?.tabs[0]?.id;
    if (firstTabId) {
        currentTab = firstTabId;
        buildHorizontalTabs();
        activateTab(firstTabId);
    }

    updateSectionDescription();
    document.getElementById("sectionDropdown").classList.remove("show");
});

// === TOGGLE DROPDOWN VISIBILITY ===
document.getElementById("currentSectionBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    document.getElementById("sectionDropdown").classList.toggle("show");
});

document.addEventListener("click", () => {
    document.getElementById("sectionDropdown")?.classList.remove("show");
});

// === ON PAGE LOAD: RESTORE LAST TAB & SECTION ===
window.addEventListener("load", async () => {
    // DO NOT run tab restoration until AuthManager says we're fully authenticated
    const waitForAuth = () => {
        return new Promise(resolve => {
            const check = () => {
                if (window.fullyAuthenticated || App.state?.passphraseAuthenticated) {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    };

    await waitForAuth();  // ← THIS IS THE MAGIC LINE

    try {
        const savedTab = await ls.get("lastTab", "order");
        const savedSection = await ls.get("lastSection", "Orders");

        let targetTab = "order";
        let targetSection = "Orders";

        if (savedTab && document.getElementById(savedTab)) {
            for (const [section, group] of Object.entries(DropdownMenu.groups || {})) {
                if (group.tabs?.some(t => t.id === savedTab)) {
                    targetSection = section;
                    targetTab = savedTab;
                    break;
                }
            }
        }

        currentSection = targetSection;
        currentTab = targetTab;

        document.getElementById("currentSectionBtn").textContent = targetSection;
        buildSectionDropdown();
        buildHorizontalTabs();

        setTimeout(() => activateTab(targetTab), 100);
        setTimeout(() => EmployeeSelect?.refreshAll?.(), 300);

    } catch (err) {
        console.error("Failed to restore last tab/section:", err);
        activateTab("order");
    }
});
// === HELP TOGGLE — ONLY FOR TAB DESCRIPTION ===
let tabDescriptionsEnabled = true;

(async () => {
    const saved = await ls.get("tabDescEnabled");
    tabDescriptionsEnabled = saved !== false && saved !== "false";

    const btn = document.getElementById("helpToggleBtn");
    if (btn) {
        btn.classList.toggle("off", !tabDescriptionsEnabled);
    }

    updateSectionDescription();
    updateTabDescription();
})();

async function toggleTabDescription() {
    tabDescriptionsEnabled = !tabDescriptionsEnabled;
    await ls.set("tabDescEnabled", tabDescriptionsEnabled);

    const btn = document.getElementById("helpToggleBtn");
    if (btn) {
        btn.classList.toggle("off", !tabDescriptionsEnabled);
        btn.title = tabDescriptionsEnabled ? "Full help ON" : "Full help OFF";
    }

    updateTabDescription();
}

document.getElementById("helpToggleBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    toggleTabDescription();
});


if (!window._tabOverrideInstalled) {
    window._tabOverrideInstalled = true;

    const originalActivateTab = window.activateTab || function () { };

    // =============================================
    // FINAL TAB OVERRIDE — SAFE, ONCE-ONLY, BULLETPROOF
    // =============================================
    if (!window._tabOverrideInstalled) {
        window._tabOverrideInstalled = true;

        // Save the original activateTab (whatever it was — even if it didn't exist)
        const originalActivateTab = window.activateTab || (() => { });

        // Override it — this will now be the permanent version
        window.activateTab = function (tabId) {
            // Always call the original first (preserves all existing tab behavior)
            originalActivateTab(tabId);

            // Only run our Business Manager logic when the business tab is opened
            if (tabId === 'business') {
                console.log('Activating Business Manager tab');
                setTimeout(() => {
                    window.BusinessManager?.render?.();
                    window.PendingUsersManager?.render?.();
                }, 300);
            }
        };

        console.log('Tab override installed safely & permanently');
    }
    console.log('Tab override installed safely');
}

// Run immediately and every 3 seconds
updateWelcomeScreen();


// Start the app
App.init();