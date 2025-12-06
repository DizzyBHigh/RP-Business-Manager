// THE ONE AND ONLY local Storage functiom — USED BY EVERYTHING
window.ls = {
    async get(key, fallback = null) {
        const prefix = await getCurrentCompanyId();
        try {
            const raw = localStorage.getItem(`${prefix}_${key}`);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (e) {
            console.warn(`ls.get failed [${key}]`, e);
            return fallback;
        }
    },
    async set(key, value) {
        const prefix = await getCurrentCompanyId();
        const storageKey = `${prefix}_${key}`;
        try {
            if (value === null || value === undefined) {
                localStorage.removeItem(storageKey);
            } else {
                localStorage.setItem(storageKey, JSON.stringify(value));
            }
            console.log(`SAVED → ${storageKey} =`, value);
        } catch (e) {
            console.error(`ls.set FAILED [${key}]`, e);
        }
    },
    async remove(key) {
        const prefix = await getCurrentCompanyId();
        localStorage.removeItem(`${prefix}_${key}`);
    }
};

// THE ONE AND ONLY PERMANENT CLEAR KEY — COMPANY-SCOPED
const ORDER_CLEARED_KEY = "orderPermanentlyCleared";

if (window.ls.get(ORDER_CLEARED_KEY) === true) {
    window.permanentOrderCleared = true;
    App.state.order = [];
    console.log("Permanent order clear restored from localStorage");
}

// Restore permanent clear state on page load using ls
(async () => {
    const cleared = await window.ls.get(ORDER_CLEARED_KEY);
    if (cleared === true) {  // ls.get returns parsed boolean
        window.permanentOrderCleared = true;
        console.log("Permanent order clear RESTORED from local Storage");
    }
})();