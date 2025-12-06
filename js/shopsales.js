// ====================================
// Sales Import - Uses Tesseract OCR
// ====================================
let worker = null;

async function ensureWorker() {
    if (worker) return worker;

    document.getElementById('parsedSalesResult').innerHTML = `
    <h3 style="color:var(--accent)">Loading OCR Engine... (first time ~8–15s)</h3>
    <p style="text-align:center;margin:40px;">Please wait — this only happens once per session</p>
  `;

    worker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
            if (m.status === 'recognizing text') {
                document.getElementById('parsedSalesResult').innerHTML = `
          <h3 style="color:var(--accent)">Reading screenshot... ${Math.round(m.progress * 100)}%</h3>
          <div style="margin:40px auto;width:80px;height:80px;border:12px solid #333;border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;"></div>
          <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
        `;
            }
        }
    });

    document.getElementById('parsedSalesResult').innerHTML = `<p style="color:var(--green);text-align:center;">OCR Ready!</p>`;
    return worker;
}

document.getElementById('salesImageUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const worker = await ensureWorker();

    // Only update the result area — editor stays untouched!
    const resultDiv = document.getElementById('parsedSalesResult');
    resultDiv.innerHTML = `<h3 style="color:var(--accent)">Processing image...</h3><div style="text-align:center;margin:60px;"><div class="spinner"></div></div>`;

    const img = new Image();
    img.onload = async () => {
        // === 1. Load & binarize (your proven threshold) ===
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const val = gray > 100 ? 255 : 0;
            data[i] = data[i + 1] = data[i + 2] = val;
        }
        ctx.putImageData(imageData, 0, 0);

        // === 2. Upscale 4× (critical) ===
        const big = document.createElement('canvas');
        big.width = canvas.width * 4;
        big.height = canvas.height * 4;
        const bctx = big.getContext('2d');
        bctx.imageSmoothingEnabled = false;
        bctx.drawImage(canvas, 0, 0, big.width, big.height);

        // === 3. OCR ===
        const result = await worker.recognize(big, {
            tessedit_pageseg_mode: '4',
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz $.,-:()',
            preserve_interword_spaces: '1',
            user_defined_dpi: '300',
        });

        // === 4. THE FINAL CLEANER THAT FIXES EVERYTHING ===
        const perfectLines = result.data.text.split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .map(line => applyCorrections(line));  // ← THIS LINE WAS MISSING OR WEAK


        const perfectText = perfectLines.join('\n');

        // === 5. Show beautiful clean result ===
        resultDiv.innerHTML = `
      <h3 style="color:#0f8; margin-bottom:15px;">Ready — ${perfectLines.length} lines cleaned</h3>
      <textarea id="extractedTextArea" style="width:100%; height:620px; background:#000; color:#0f0; font-family:monospace; font-size:20px; padding:18px; border:4px solid #0f8; border-radius:12px; resize:vertical;">${perfectText}</textarea>
      <div style="margin-top:20px; text-align:center;">
        <button onclick="navigator.clipboard.writeText(document.getElementById('extractedTextArea').value)" 
                style="padding:14px 40px; margin:10px; font-size:20px; background:#333; color:#fff; border:none; border-radius:10px; cursor:pointer;">
          Copy Clean Text
        </button>
        <button onclick="importFromTextarea()" 
                style="padding:18px 80px; margin:10px; font-size:26px; background:#0f8; color:#000; border:none; border-radius:12px; cursor:pointer; font-weight:bold;">
          IMPORT SALES NOW
        </button>
      </div>
    `;
        showReapplyButton();
    };
    img.src = URL.createObjectURL(file);
});

function importFromTextarea() {
    const text = document.getElementById('extractedTextArea')?.value || '';
    if (!text.trim()) return showToast("fail", 'No data!');

    const sales = [];
    const re = /^(.+?)\s+([0-9]+)\s+\$([0-9.,]+)\s+\$([0-9.,]+)\s+/;
    text.split('\n').forEach(line => {
        const m = line.match(re);
        if (!m) return;
        const item = m[1].trim();
        if (!item) return;
        sales.push({
            item,
            qty: parseInt(m[2], 10),
            total: parseFloat(m[4].replace(/,/g, ''))
        });
    });

    if (sales.length === 0) return showToast("fail", 'No valid sales found');

    // Combine same items (already done, but make sure)
    const map = {};
    sales.forEach(s => {
        if (!map[s.item]) map[s.item] = { qty: 0, total: 0 };
        map[s.item].qty += s.qty;
        map[s.item].total += s.total;
    });

    const finalItems = Object.keys(map).map(item => ({
        item,
        qty: map[item].qty,
        total: map[item].total,
        unitPrice: (map[item].total / map[item].qty).toFixed(2)
    }));

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const timeStr = today.toTimeString().slice(0, 8).replace(/:/g, '');

    // UNIQUE BATCH ID — one per import
    const batchId = `SHOP-${dateStr.replace(/-/g, '').slice(2)}-${timeStr}`;

    const grandTotal = finalItems.reduce((a, b) => a + b.total, 0);

    // Create ONE ledger entry per item type
    finalItems.forEach((s, index) => {
        const record = {
            id: `${batchId}-${String(index + 1).padStart(3, '0')}`,  // e.g. SHOP-251124-143512-001
            batchId: batchId,
            date: dateStr,
            time: today.toTimeString().slice(0, 8),
            type: "shop_sale_item",
            item: s.item,
            qty: s.qty,
            unitPrice: parseFloat(s.unitPrice),
            total: s.total,
            amount: s.total,
            employee: "Auto-Import",
            description: `${s.item} × ${s.qty} sold`
        };
        App.state.ledger.push(record);
    });

    // Deduct stock
    finalItems.forEach(s => {
        App.state.shopStock[s.item] = Math.max(0, (App.state.shopStock[s.item] || 0) - s.qty);
    });
    App.save("shopStock");
    App.save("ledger");

    showToast("success", `SUCCESS! Imported ${finalItems.length} item types (${sales.reduce((a, b) => a + b.qty, 0)} units) — $${grandTotal.toFixed(2)} total!`);

    Inventory.render();
    Ledger.render();
    showTodaySales({ items: finalItems, totalSale: grandTotal, date: dateStr, batchId });
}

// Initialise Corrections
let CORRECTIONS = {};

async function loadCorrections() {
    const saved = await ls.get('ocrCorrections');
    if (saved) {
        try { CORRECTIONS = JSON.parse(saved); }
        catch (e) { CORRECTIONS = getDefaultCorrections(); }
    } else {
        CORRECTIONS = getDefaultCorrections();
    }
}

function getDefaultCorrections() {
    return {
        "De1uxe": "Deluxe",
        "81ue": "Blue",
        "R0pe": "Rope",
        "L0g[s:]*": "Logs",
        "W00den": "Wooden",
        "P01e": "Pole",
        "Rif1e": "Rifle",
        ":t0ck": "Stock",
        ":1uice 80x": "Sluice Box",
        "Tasso": "Lasso",
        "CampF1re": "Camp Fire",
        "Fermentation Barrell": "Fermentation Barrel",
        "Drug Mixing Pot": "Drug Mixing Pot"
    };
}

async function saveCorrections() {
    await ls.set('ocrCorrections', JSON.stringify(CORRECTIONS));
    App.state.ocrCorrections = CORRECTIONS;
    App.save("ocrCorrections"); // save to firbase
}

function renderRulesList() {
    const list = document.getElementById('rulesList');
    list.innerHTML = Object.entries(CORRECTIONS)
        .map(([wrong, right]) => `
      <div style="padding:8px; background:#222; margin:5px 0; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
        <code style="color:#ff0;">${wrong}</code> → <strong style="color:#0f0;">${right}</strong>
        <button onclick="deleteRule('${wrong}')" style="margin-left:20px; background:#800; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Delete</button>
      </div>
    `).join('');
}

function deleteRule(wrong) {
    delete CORRECTIONS[wrong];
    saveCorrections();
    renderRulesList();
}

// Event listeners for corrections
document.getElementById('editCorrectionsBtn').onclick = () => {
    document.getElementById('correctionsEditor').style.display = 'block';
    renderRulesList();
};

document.getElementById('closeEditorBtn').onclick = () => {
    document.getElementById('correctionsEditor').style.display = 'none';
};

document.getElementById('addRuleBtn').onclick = () => {
    const wrong = document.getElementById('newWrong').value.trim();
    const right = document.getElementById('newRight').value.trim();
    if (wrong && right) {
        CORRECTIONS[wrong] = right;
        saveCorrections();
        renderRulesList();
        document.getElementById('newWrong').value = '';
        document.getElementById('newRight').value = '';
    }
};

document.getElementById('exportBtn').onclick = () => {
    const data = JSON.stringify(CORRECTIONS, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocr-corrections.json';
    a.click();
};

document.getElementById('importBtn').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                CORRECTIONS = JSON.parse(ev.target.result);
                saveCorrections();
                renderRulesList();
                showToast("success", 'Rules imported successfully!');
            } catch (err) {
                showToast("fail", 'Invalid JSON file');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

document.getElementById('resetBtn').onclick = () => {
    if (showConfirm('Reset all rules to default?')) {
        CORRECTIONS = getDefaultCorrections();
        saveCorrections();
        renderRulesList();
    }
};

// ====== 4. Use the live corrections in OCR 
function applyCorrections(text) {
    let s = text.trim();

    // === STEP 1: APPLY USER RULES FIRST (BEFORE ANY DESTRUCTIVE CLEANUP) ===
    for (const [wrong, right] of Object.entries(CORRECTIONS)) {
        try {
            const regex = new RegExp(wrong, 'gi');
            s = s.replace(regex, right);
        } catch (e) {
            // ignore invalid regex from user
        }
    }

    // === STEP 2: Smart O/0, l/1, I/1 fixes (context-aware) ===
    // Only replace O → 0 when it's clearly money or number
    s = s.replace(/O(?=\$|\d)/g, '0');
    s = s.replace(/0(?=[A-Za-z]{3,})/g, 'O'); // O in words

    s = s.replace(/[Il](?=\$|\d)/g, '1');
    s = s.replace(/1(?=[A-Za-z]{3,})/g, 'l');

    // Fix common known garbage
    s = s.replace(/ba1/g, 'Bag');
    s = s.replace(/Whee1/g, 'Wheel');
    s = s.replace(/1eather/g, 'Leather');
    s = s.replace(/Tasso/g, 'Lasso');
    s = s.replace(/1TEM/g, 'ITEM');
    s = s.replace(/PR1CE/g, 'PRICE');
    s = s.replace(/T1ME/g, 'TIME');

    // Fix broken times
    s = s.replace(/(\d{2})(\d{2})$/, '$1:$2');
    s = s.replace(/O(\d)/g, '0$1');  // Ok13 → 00:13
    s = s.replace(/OO:/g, '00:');

    // Fix year
    s = s.replace(/1899-11-O(\d)/g, '1899-11-0$1');

    return s.trim();
}

// Re-apply all current rules to the text in the textarea
function reapplyAllFixes() {
    const textarea = document.getElementById('extractedTextArea');
    if (!textarea) return showToast("fail", "No OCR result to fix!");

    const lines = textarea.value.split('\n');
    const fixedLines = lines.map(line => {
        // Keep header line untouched
        if (line.includes('ITEM') || line.includes('AMOUNT') || line.includes('PRICE')) {
            return applyCorrections(line);
        }

        // For data lines: if it has $ signs, it's a valid sale line
        if (line.includes('$')) {
            return applyCorrections(line);
        }

        // If line starts with number but has no item name → try to recover from previous line?
        // Skip empty or garbage lines
        return line.trim() === '' ? '' : applyCorrections(line);
    });

    textarea.value = fixedLines.filter(Boolean).join('\n');
    showToast("success", 'All OCR fixes successfully re-applied! Names are back!');
}

// Show the re-apply button once OCR finishes
function showReapplyButton() {
    document.getElementById('reapplyButton').style.display = 'block';
}
// Load on start
loadCorrections();

// ========================
// Shop Sales
// ========================
const ShopSales = {
    render() {
        const from = document.getElementById("shopSalesFrom")?.value || "";
        const to = document.getElementById("shopSalesTo")?.value || "";
        const table = document.getElementById("shopSalesTable");
        let total = 0;

        const sales = App.state.ledger
            .filter(e => e.type === "shop_sale_item")
            .filter(e => (!from || e.date >= from) && (!to || e.date <= to))
            .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

        if (sales.length === 0) {
            table.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888; padding:40px;">No sales recorded yet</td></tr>`;
            document.getElementById("shopTotalRevenue").textContent = "$0.00";
            return;
        }

        table.innerHTML = sales.map(s => {
            total += s.amount;
            return `<tr>
        <td><strong>${s.date}</strong><br><small>${s.time}</small></td>
        <td><code>${s.id}</code></td>
        <td><strong>${s.item}</strong></td>
        <td style="text-align:center; font-weight:bold;">${s.qty}</td>
        <td>$${parseFloat(s.unitPrice).toFixed(2)}</td>
        <td style="color:var(--green); font-weight:bold;">$${s.amount.toFixed(2)}</td>
        <td><small>Auto-Import</small></td>
      </tr>`;
        }).join("");

        document.getElementById("shopTotalRevenue").textContent = "$" + total.toFixed(2);
    },

    viewDetail(id) {
        const sale = App.state.ledger.find(e => e.id === id);
        if (!sale) return showToast("fail", "Not found");
        showToast("success", `SALE DETAILS
                ID: ${sale.id}
                Batch: ${sale.batchId}
                Date: ${sale.date} ${sale.time}
                Item: ${sale.item}
                Quantity: ${sale.qty}
                Unit Price: $${parseFloat(sale.unitPrice).toFixed(2)}
                Total: $${sale.amount.toFixed(2)}
                Auto-imported`);
    }
};

function showTodaySales(importRecord) {
    const container = document.getElementById('todaySalesDisplay');
    const table = document.getElementById('todaySalesTable');
    const totalEl = document.getElementById('todayTotal');
    const itemsEl = document.getElementById('todayItems');
    const summary = document.getElementById('todaySalesSummary');

    let html = '';
    let grandTotal = 0;
    importRecord.items.forEach(s => {
        html += `<tr><td><strong>${s.item}</strong></td><td style="text-align:center;">${s.qty}</td><td style="text-align:right; color:var(--green); font-weight:bold;">$${s.total.toFixed(2)}</td></tr>`;
        grandTotal += s.total;
    });

    table.innerHTML = html;
    totalEl.textContent = '$' + grandTotal.toFixed(2);
    itemsEl.textContent = importRecord.items.length;
    summary.innerHTML = `Total: <span style="color:var(--green)">$${grandTotal.toFixed(2)}</span> across ${importRecord.items.length} different items`;

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}
// =============================================
// AUTO-REFRESH SHOP SALES — BULLETPROOF
// =============================================
function refreshShopSales() {
    if (document.getElementById("shopSalesTable")) {
        ShopSales?.render?.();
    }

    const todayPanel = document.getElementById("todaySalesDisplay");
    if (todayPanel && todayPanel.style.display !== "none") {
        const today = new Date().toISOString().slice(0, 10);
        const todaySales = (App.state.ledger || [])
            .filter(e => e.type === "shop_sale_item" && e.date === today)
            .reduce((acc, s) => {
                const existing = acc.find(x => x.item === s.item);
                if (existing) {
                    existing.qty += s.qty;
                    existing.total += s.amount;
                } else {
                    acc.push({ item: s.item, qty: s.qty, total: s.amount });
                }
                return acc;
            }, []);

        if (todaySales.length > 0) {
            let html = '';
            let grandTotal = 0;
            todaySales.forEach(s => {
                html += `<tr><td><strong>${s.item}</strong></td><td style="text-align:center;">${s.qty}</td><td style="text-align:right; color:var(--green); font-weight:bold;">$${s.total.toFixed(2)}</td></tr>`;
                grandTotal += s.total;
            });
            document.getElementById("todaySalesTable").innerHTML = html;
            document.getElementById("todayTotal").textContent = "$" + grandTotal.toFixed(2);
            document.getElementById("todayItems").textContent = todaySales.length;
            document.getElementById("todaySalesSummary").innerHTML = `Total: <span style="color:var(--green)">$${grandTotal.toFixed(2)}</span> across ${todaySales.length} items`;
        }
    }
}

// Auto-refresh when Shop Sales tab is opened
document.getElementById("sectionTabs")?.addEventListener("click", e => {
    const tab = e.target.closest(".horizontal-tab");
    if (tab?.dataset.tab === "shopsales") {
        setTimeout(refreshShopSales, 150);
    }
});

/* // Live update when any sale is added
const originalSave = App.save;
App.save = function (key) {
    const result = originalSave.apply(this, arguments);
    if (key === "ledger" || key == null) {
        setTimeout(() => {
            refreshShopSales();
            Ledger?.render?.();
            Ledger?.populateEmployeeFilter?.();
        }, 100);
    }
    return result;
}; */

// Initial load
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(refreshShopSales, 800);
});