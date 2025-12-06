// =============================================
// FINAL — 100% NAMESPACED — NO RAW localStorage EVER AGAIN
// =============================================

let CACHED_COMPANY_ID = null;

async function getCurrentCompanyId() {
    if (CACHED_COMPANY_ID) return CACHED_COMPANY_ID;

    try {
        const snap = await db.collection("business").doc("config").get();
        if (!snap.exists) {
            CACHED_COMPANY_ID = "default-business";
            return CACHED_COMPANY_ID;
        }

        const data = snap.data();
        if (data.companyId && data.companyId.trim()) {
            CACHED_COMPANY_ID = data.companyId.trim();
            return CACHED_COMPANY_ID;
        }

        const generated = (data.name || "Business")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .substring(0, 40) || "business";

        await db.collection("business").doc("config").update({ companyId: generated });
        CACHED_COMPANY_ID = generated;
        return generated;
    } catch (e) {
        CACHED_COMPANY_ID = "fallback-business";
        return CACHED_COMPANY_ID;
    }
}







// =============================================
// 2. Name entry → continue startup
// =============================================
window.savePlayerName = async function () {
    const name = document.getElementById("nameInput")?.value.trim();
    if (!name) return showToast("fail", "Enter your name!");

    await ls.set("playerName", name);
    window.playerName = name;
    App.state = App.state || {};
    App.state.playerName = name;

    document.getElementById("nameEntry").style.display = "none";
    updatePlayerDisplay();

    showToast("success", `Welcome, ${name}!`);

    // THIS IS THE ONLY THING THAT WAS MISSING FOREVER
    AuthManager.start();
};

// =============================================
// 3. Passphrase modal 
// =============================================
async function showPassphraseModal() {
    // Remove any old one
    document.getElementById("passphraseModal")?.remove();

    // Inject modal
    document.body.insertAdjacentHTML('beforeend', `
                <div id="passphraseModal" class="passphrase-modal-backdrop">
                    <div class="passphrase-modal-content">
                        <div class="lock-icon">Locked</div>
                        <h2 class="modal-title">Access Restricted</h2>
                        <p class="modal-subtitle">Enter the business passphrase</p>
                        <input id="passphraseInput" type="password" placeholder="Passphrase" autocomplete="off">
                        <button id="submitPassphrase">Unlock</button>
                        <p class="modal-hint">Ask a manager for the passphrase</p>
                    </div>
                </div>
            `);

    const input = document.getElementById("passphraseInput");
    const btn = document.getElementById("submitPassphrase");

    // Nuclear protection
    const defender = setInterval(() => {
        input.disabled = false;
        btn.disabled = false;
    }, 100);

    const submit = async () => {
        clearInterval(defender);
        const pw = input.value.trim();
        if (!pw) return;

        btn.disabled = true;
        btn.textContent = "Checking…";

        try {
            const snap = await db.collection("business").doc("config").get();
            if (!snap.exists || snap.data().passphrase !== pw) {
                showToast("fail", "Incorrect passphrase");
                btn.disabled = false;
                btn.textContent = "Unlock";
                input.value = "";
                input.focus();
                return;
            }

            // SUCCESS → save hash and continue
            await setPassphraseHash(btoa(pw));
            document.getElementById("passphraseModal").remove();
            AuthManager.start(); // restart full flow now authenticated
        } catch (e) {
            showToast("fail", "Error — try again");
            btn.disabled = false;
            btn.textContent = "Unlock";
        }
    };

    btn.onclick = submit;
    input.onkeydown = e => e.key === "Enter" && submit();
    setTimeout(() => input.focus(), 100);
}

// =============================================
// 4. Business setup modal (first-time manager)
// =============================================
function showBusinessSetupModal() {
    const modal = document.createElement("div");
    modal.id = "businessSetupModal";
    modal.innerHTML = `
                <div style="position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:999999;display:flex;align-items:center;justify-content:center;">
                    <div style="background:#1a1a2e;padding:50px;border-radius:20px;border:3px solid #585eff;max-width:600px;width:90%;text-align:center;">
                        <h2 style="color:#585eff;font-size:28px;margin:0 0 20px;">Business Setup Required</h2>
                        <p style="color:#ccc;line-height:1.6;margin-bottom:30px;">A manager must configure the business name and optional passphrase first.</p>
                        <button id="gotoBusinessBtn" style="padding:18px 50px;font-size:20px;background:#585eff;color:white;border:none;border-radius:16px;cursor:pointer;">
                            Go to Business Manager
                        </button>
                        <p style="margin-top:25px;color:#888;font-size:14px;">Auto-redirect in 8 seconds...</p>
                    </div>
                </div>`;
    document.body.appendChild(modal);

    document.getElementById("gotoBusinessBtn").onclick = () => {
        modal.remove();
        activateTab("business");
    };

    setTimeout(() => {
        if (document.getElementById("businessSetupModal")) {
            modal.remove();
            activateTab("business");
        }
    }, 8000);
}



// =============================================
// PASSPHRASE & BUSINESS SETUP — FINAL FIXED VERSION
// =============================================
async function checkBusinessConfiguration() {
    try {
        const configDoc = await db.collection("business").doc("config").get();

        if (!configDoc.exists) {
            showBusinessSetupModal();
            return false;
        }

        const config = configDoc.data();
        App.state.businessConfig = config;

        // Title update
        if (config.name) {
            document.title = `${config.name} - HSRP Manager`;
        }

        // Passphrase check
        if (config.passphrase) {
            const savedHash = await getPassphraseHash();
            const expectedHash = btoa(config.passphrase);

            if (savedHash !== expectedHash) {
                // Clear invalid hash and force re-auth
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

// Business Setup Modal — Beautiful & Functional
function showBusinessSetupModal() {
    const modal = document.createElement("div");
    modal.id = "businessSetupModal";
    modal.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;">
        <div style="background:#1a1a2e;padding:50px;border-radius:20px;border:3px solid #585eff;max-width:600px;width:90%;text-align:center;box-shadow:0 0 80px rgba(88,94,255,0.5);">
            <div style="font-size:60px;margin-bottom:20px;">Company</div>
            <h2 style="color:#585eff;font-size:28px;margin:0 0 20px;">Business Setup Required</h2>
            <p style="color:#ccc;line-height:1.6;margin-bottom:30px;">This is a brand new business. A manager must configure the name and passphrase before anyone can join.</p>
            <button id="gotoBusinessBtn" style="padding:18px 50px;font-size:20px;background:#585eff;color:white;border:none;border-radius:16px;font-weight:bold;cursor:pointer;">
            Go to Business Manager →
            </button>
            <p style="margin-top:25px;color:#888;font-size:14px;">You will be redirected automatically in 8 seconds...</p>
        </div>
        </div>`;

    document.body.appendChild(modal);

    document.getElementById("gotoBusinessBtn")?.addEventListener("click", () => {
        modal.remove();
        activateTab("business");
    });

    // Auto-redirect
    setTimeout(() => {
        if (document.getElementById("businessSetupModal")) {
            modal.remove();
            activateTab("business");
        }
    }, 8000);
}

// =============================================
// PASSPHRASE MODAL — FINAL CLEAN VERSION (NO INLINE CSS)
// =============================================
async function showPassphraseModal() {
    const playerName = await getPlayerName();
    if (!playerName) {
        document.getElementById("nameEntry")?.style.setProperty("display", "flex", "important");
        return;
    }
    window.playerName = playerName;
    await initRoles();

    document.getElementById("passphraseModal")?.remove();

    document.body.insertAdjacentHTML('beforeend', `
        <div id="passphraseModal" style="all:initial !important; position:fixed !important; top:0 !important; left:0 !important; width:100vw !important; height:100vh !important; background:rgba(0,0,0,0.98) !important; z-index:999999999 !important; display:flex !important; align-items:center !important; justify-content:center !important;">
            <div style="all:initial !important; background:#1a1a2e !important; padding:60px !important; border-radius:20px !important; border:4px solid #ff4444 !important; text-align:center !important; max-width:500px !important; width:90% !important;">
                <div style="font-size:80px !important;">Locked</div>
                <h2 style="color:#ff4444 !important; font-size:28px !important; margin:20px 0 !important;">Access Restricted</h2>
                <p style="color:#ccc !important; margin-bottom:30px !important;">This business requires the security passphrase.</p>
                <input id="passphraseInput" type="password" placeholder="Enter passphrase" autocomplete="off"
                       style="all:revert !important; width:100% !important; padding:20px !important; font-size:22px !important; background:#000 !important; color:white !important; border:3px solid #f44 !important; border-radius:12px !important; margin-bottom:20px !important;">
                <button id="submitPassphrase" style="all:revert !important; width:100% !important; padding:20px !important; font-size:24px !important; background:#585eff !important; color:white !important; border:none !important; border-radius:12px !important;">Unlock Business</button>
            </div>
        </div>
    `);

    const input = document.getElementById("passphraseInput");
    const btn = document.getElementById("submitPassphrase");

    // NUCLEAR DEFENSE — RE-ENABLE EVERY 100MS UNTIL SUCCESS
    const defender = setInterval(() => {
        input.disabled = false;
        input.readOnly = false;
        input.style.pointerEvents = "auto";
        btn.disabled = false;
    }, 100);

    setTimeout(() => input.focus(), 150);

    btn.onclick = input.onkeydown = async (e) => {
        if (e.type === "keydown" && e.key !== "Enter") return;
        clearInterval(defender);

        const pw = input.value.trim();
        if (!pw) return;

        btn.disabled = true;
        btn.textContent = "Verifying...";

        try {
            const config = (await db.collection("business").doc("config").get()).data();
            if (config.passphrase !== pw) {
                showToast("fail", "Incorrect passphrase");
                btn.disabled = false;
                btn.textContent = "Unlock Business";
                input.value = "";
                input.focus();
                return;
            }
            await setPassphraseHash(btoa(pw));
            document.getElementById("passphraseModal").remove();

            // DO NOT RELOAD — JUST RE-RENDER CLEANLY
            if (window.BusinessManager?.render) {
                BusinessManager.render();
            }
            if (window.PendingUsersManager?.render) {
                PendingUsersManager.render();
            }
        } catch (e) {
            showToast("fail", "Error unlocking business");
            btn.disabled = false;
            btn.textContent = "Unlock Business";
        }
    };
}

// =============================================
// ENHANCED PASSPHRASE MANAGEMENT EVENT LISTENERS
// =============================================
document.addEventListener('DOMContentLoaded', function () {
    // Enhanced Change Passphrase functionality
    const changePassphraseBtn = document.getElementById('changePassphraseBtn');
    if (changePassphraseBtn) {
        changePassphraseBtn.addEventListener('click', async function () {
            const newPass = document.getElementById('newPassphraseInput')?.value.trim();
            const confirmPass = document.getElementById('confirmPassphraseInput')?.value.trim();

            // Validation
            if (!newPass) {
                showToast("fail", 'Please enter a new passphrase');
                document.getElementById('newPassphraseInput')?.focus();
                return;
            }

            if (newPass.length < 6) {
                showToast("fail", 'Passphrase must be at least 6 characters long');
                document.getElementById('newPassphraseInput')?.focus();
                return;
            }

            if (newPass !== confirmPass) {
                showToast("fail", '❌ Passphrases do not match');
                document.getElementById('confirmPassphraseInput')?.select();
                return;
            }

            if (await showConfirm(`⚠️ Change Passphrase Confirmation\n\nNew Passphrase: "${newPass}"\n\nAll new users will need this passphrase to access the business.\n\nAre you sure?`)) {
                return;
            }

            // Loading state
            const originalText = this.innerHTML;
            const originalBg = this.style.background;
            this.disabled = true;
            this.innerHTML = '⏳ Updating Passphrase...';

            try {
                const businessDoc = await firebase.firestore().collection('business').doc('config').get();
                if (!businessDoc.exists) throw new Error('Business config not found');

                await firebase.firestore().collection('business').doc('config').update({
                    passphrase: newPass,
                    passphraseUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    passphraseUpdatedBy: App.state.currentUser?.uid || 'unknown',
                    passphraseUpdatedByName: App.state.currentUser?.displayName || 'Unknown'
                });

                // Success feedback
                this.innerHTML = '✅ Passphrase Updated!';
                this.style.background = 'linear-gradient(135deg, #28a745, #20c997)';

                // Clear inputs
                document.getElementById('newPassphraseInput').value = '';
                document.getElementById('confirmPassphraseInput').value = '';

                // Show success message
                const successMsg = document.createElement('div');
                successMsg.id = 'passphraseSuccessMsg';
                successMsg.style.cssText = `
              position:fixed; top:20px; right:20px; 
              background:linear-gradient(135deg, #28a745, #20c997); 
              color:white; padding:15px 20px; border-radius:10px; 
              z-index:10001; box-shadow:0 4px 20px rgba(40,167,69,0.3);
              font-weight:500; max-width:300px;`;
                successMsg.innerHTML = `
              <strong>✅ Success!</strong><br>
              Passphrase updated successfully.<br>
              <small style="opacity:0.9;">New users will need the new passphrase</small>
            `;
                document.body.appendChild(successMsg);

                setTimeout(() => successMsg.remove(), 4000);

                // Refresh Business Manager display
                if (window.BusinessManager && window.BusinessManager.render) {
                    setTimeout(() => window.BusinessManager.render(), 1500);
                }

            } catch (error) {
                console.error('Error changing passphrase:', error);
                showToast("fail", '❌ Error updating passphrase. Please try again.');
                this.innerHTML = originalText;
                this.style.background = originalBg;
                this.disabled = false;
            }
        });

        // Add hover effects
        changePassphraseBtn.addEventListener('mouseenter', function () {
            if (!this.disabled) {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 6px 20px rgba(255,107,107,0.4)';
            }
        });

        changePassphraseBtn.addEventListener('mouseleave', function () {
            if (!this.disabled) {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 4px 15px rgba(255,107,107,0.3)';
            }
        });
    }

    // Enhanced Disable Passphrase functionality
    const disablePassphraseBtn = document.getElementById('disablePassphraseBtn');
    if (disablePassphraseBtn) {
        disablePassphraseBtn.addEventListener('click', async function () {
            if (await showConfirm(`⚠️ Disable Passphrase Protection\n\nThis will remove security from your business!\n\nAnyone with the link will be able to access:\n• All orders\n• Inventory\n• Financial data\n• Employee information\n\nAre you ABSOLUTELY sure?`)) {
                return;
            }

            if (await showConfirm('🔓 FINAL WARNING\n\nThis action cannot be undone easily.\nContinue?')) {
                return;
            }

            // Loading state
            const originalText = this.innerHTML;
            this.disabled = true;
            this.innerHTML = '⏳ Disabling Protection...';

            try {
                await firebase.firestore().collection('business').doc('config').update({
                    passphrase: null,
                    passphraseDisabledAt: firebase.firestore.FieldValue.serverTimestamp(),
                    passphraseDisabledBy: App.state.currentUser?.uid || 'unknown',
                    passphraseDisabledByName: App.state.currentUser?.displayName || 'Unknown'
                });

                // Success feedback
                this.innerHTML = '✅ Protection Disabled!';
                this.style.background = 'linear-gradient(135deg, #6c757d, #5a6268)';

                // Show warning message
                const warningMsg = document.createElement('div');
                warningMsg.id = 'passphraseDisabledMsg';
                warningMsg.style.cssText = `
              position:fixed; top:20px; left:20px; right:20px; 
              background:linear-gradient(135deg, #ffc107, #fd7e14); 
              color:#000; padding:15px 20px; border-radius:10px; 
              z-index:10001; box-shadow:0 4px 20px rgba(255,193,7,0.3);
              font-weight:600; text-align:center; max-width:500px; margin:0 auto;`;
                warningMsg.innerHTML = `
              <strong>🔓 Passphrase Protection DISABLED</strong><br>
              <span style="font-size:14px; font-weight:500;">
                Your business is now accessible to anyone with the link
              </span><br>
              <small style="opacity:0.8; font-size:12px;">
                Consider re-enabling protection in a production environment
              </small>
            `;
                document.body.appendChild(warningMsg);

                setTimeout(() => warningMsg.remove(), 6000);

                // Refresh display
                if (window.BusinessManager && window.BusinessManager.render) {
                    setTimeout(() => window.BusinessManager.render(), 1500);
                }

            } catch (error) {
                console.error('Error disabling passphrase:', error);
                showToast("fail", '❌ Error disabling passphrase protection. Please try again.');
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    }

    console.log('✅ Enhanced passphrase management event listeners attached');
});




// Update page title with business name
function updatePageTitle() {
    if (App.state.businessConfig?.name) {
        document.title = `${App.state.businessConfig.name} - HSRP Manager`;
        document.querySelector('h1').textContent = App.state.businessConfig.name;
        if (App.state.businessConfig.tagline) {
            const subtitle = document.querySelector('.subtitle');
            subtitle.textContent = App.state.businessConfig.tagline;
        }
    }
}

// Call this after business config loads
if (window.BusinessManager) {
    BusinessManager.render().then(updatePageTitle);
}

function updateWelcomeScreen() {
    // CORRECT CONDITION — wait until we have a name AND a real role
    if (!window.playerName || (!window.myRole && !App.state?.role)) {
        // Still loading → try again
        setTimeout(updateWelcomeScreen, 400);
        return;
    }

    const companyEl = document.getElementById("companyNameDisplay");
    const nameEl = document.getElementById("welcomePlayerName");
    const roleEl = document.getElementById("welcomeRoleDisplay");
    const viewerMsg = document.getElementById("viewerMessage");
    const countEl = document.getElementById("onlineCount");

    // Company Name
    if (companyEl) {
        db.collection("business").doc("config").get().then(snap => {
            if (snap.exists && snap.data().name) {
                companyEl.textContent = snap.data().name;
                document.title = snap.data().name + " - HSRP Manager";
            }
        }).catch(() => { });
    }

    // Player Name
    if (nameEl) {
        nameEl.textContent = window.playerName || "Guest";
    }

    // Role — FIXED: use the correct variable
    const currentRole = window.myRole || App.state?.role || "viewer";
    if (roleEl) {
        roleEl.textContent = currentRole.toUpperCase();
        roleEl.style.color = {
            manager: "#0ff",
            assistant: "#0f8",
            worker: "#ff0",
            viewer: "#f66"
        }[currentRole] || "#aaa";   // ← WAS myRole, now currentRole
    }

    // Viewer message
    if (viewerMsg) {
        viewerMsg.style.display = currentRole === "viewer" ? "block" : "none";
    }

    // Online count — real-time
    if (countEl) {
        const onlineRef = db.collection("business").doc("online").collection("users");
        onlineRef.where("online", "==", true).onSnapshot(snap => {
            const count = snap.size;
            countEl.textContent = count;
            countEl.parentElement.querySelector("span")?.remove(); // clean old text if needed
        });
    }

    // Optional: hide loading spinner / refresh button
    document.querySelectorAll(".loading-indicator, #refreshBtn").forEach(el => {
        if (el) el.style.display = "none";
    });
}