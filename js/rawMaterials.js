// =================================
// Raw Materials Manager / Editor
// =================================
const RawMaterials = {
    // PURCHASE RAW MATERIALS — FULLY WORKING + WEIGHT
    async purchase() {
        const name = document.getElementById("purchaseItemSearch").value.trim();
        const qty = parseInt(document.getElementById("purchaseQty").value) || 0;
        const totalPaid = document.getElementById("purchasePrice").value !== ""
            ? parseFloat(document.getElementById("purchasePrice").value)
            : null;
        const supplier = document.getElementById("purchaseSupplier").value.trim() || "Unknown";
        const employee = document.getElementById("purchaseEmployee").value || App.state.currentEmployee || "Manager";

        if (!name) return showToast("fail", "Please select or enter a raw material.");
        if (qty <= 0) return showToast("fail", "Quantity must be at least 1.");

        const rawData = App.state.rawPrice[name];
        if (!rawData || typeof rawData !== 'object') {
            return showToast("fail", `"${name}" is not in Raw Prices!\nAdd it first in the Raw Prices tab.`);
        }

        const basePrice = rawData.price ?? 0;
        const weightPerUnit = rawData.weight ?? 0;
        const unitPrice = totalPaid !== null ? (totalPaid / qty) : basePrice;
        const totalCost = totalPaid !== null ? totalPaid : (basePrice * qty);
        const totalWeight = qty * weightPerUnit;

        if (basePrice === 0 && totalPaid === null) {
            return showToast("fail", `No price set for "${name}"!\nEnter Total Paid or set a default price first.`);
        }

        let preview = `PURCHASE CONFIRMATION\n\n`;
        preview += `${qty} × ${name}\n`;
        if (weightPerUnit > 0) preview += `Weight: ${weightPerUnit}kg each → ${totalWeight.toFixed(2)}kg total\n`;
        preview += `Price: $${unitPrice.toFixed(2)}/unit → Total: $${totalCost.toFixed(2)}\n`;
        preview += `Supplier: ${supplier}\n`;
        preview += `Employee: ${employee}`;

        const ok = await showConfirm(preview);
        if (!ok) return;

        // THIS WAS THE MISSING LINE — ADD TO WAREHOUSE STOCK!
        App.state.warehouseStock[name] = (App.state.warehouseStock[name] || 0) + qty;

        const now = new Date();
        const record = {
            id: "RAW-" + now.getTime().toString().slice(-6),
            date: now.toISOString().slice(0, 10),
            timestamp: now.toISOString(),
            type: "raw_purchase",
            employee,
            item: name,
            qty,
            unitPrice,
            totalCost,
            weightPerUnit,
            totalWeight: parseFloat(totalWeight.toFixed(2)),
            supplier,
            description: `Purchased ${qty}× ${name} from ${supplier}\n${totalWeight.toFixed(2)}kg @ $${unitPrice.toFixed(2)}/ea = $${totalCost.toFixed(2)}`
        };

        App.state.ledger.push(record);

        // Save BOTH ledger AND warehouse stock
        await Promise.all([
            App.save("ledger"),
            App.save("warehouseStock")
        ]);

        // Success message
        const successMsg = document.getElementById("purchaseSuccess");
        successMsg.innerHTML = `
          <div style="text-align:center;padding:20px;background:#001a00;border:2px solid #0f0;border-radius:8px;">
            <h3 style="color:#0f8;margin:0;">PURCHASE COMPLETE</h3>
            <div style="margin:10px 0;font-size:18px;">
              <strong>${qty} × ${name}</strong>
            </div>
            <div style="color:#0af;">
              Total Weight: <strong>${totalWeight.toFixed(2)} kg</strong>
            </div>
            <div style="color:#ff0;">
              Total Cost: <strong>$${totalCost.toFixed(2)}</strong>
            </div>
            <div style="margin-top:8px;color:#888;">
              Added to warehouse • Ledger updated
            </div>
          </div>
        `;
        successMsg.style.display = "block";
        setTimeout(() => successMsg.style.display = "none", 5000);

        // Clear form
        document.getElementById("purchaseItemSearch").value = "";
        document.getElementById("purchaseQty").value = "1";
        document.getElementById("purchasePrice").value = "";
        document.getElementById("purchaseSupplier").value = "";

        // Refresh displays
        Inventory.render();
        Ledger.render();
        debouncedCalcRun();
    },

    // ADD NEW RAW MATERIAL — BULLETPROOF
    add() {
        const name = sanitizeItemName(document.getElementById("newRawName").value.trim());
        const priceRaw = document.getElementById("newRawPrice").value.trim();
        const weightRaw = document.getElementById("newRawWeight").value.trim();

        if (!name) return showToast("fail", "Enter a name for the raw material!");
        if (App.state.rawPrice[name]) return showToast("fail", `"${name}" already exists!`);

        const price = parseFloat(priceRaw) || 0;
        const weight = parseFloat(weightRaw) || 0;

        App.state.rawPrice[name] = { price, weight };
        App.save("rawPrice");

        showToast("success", `"${name}" added!\nPrice: $${price.toFixed(2)}/unit\nWeight: ${weight.toFixed(2)} kg/unit`);

        document.getElementById("newRawName").value = "";
        document.getElementById("newRawPrice").value = "1.00";
        document.getElementById("newRawWeight").value = "0.00";

        this.renderPrices();
        //safeRender();
        debouncedCalcRun();
    },

    // RENDER RAW PRICES — NOW 100% RELIABLE
    renderPrices(filter = "") {
        const tbody = document.querySelector("#rawTable tbody");
        if (!tbody) return;

        const rawPrice = App.state.rawPrice || {};
        let items = Object.keys(rawPrice);

        // Apply filter
        if (filter) {
            const lower = filter.toLowerCase().trim();
            items = items.filter(name => name.toLowerCase().includes(lower));
        }

        items.sort((a, b) => a.localeCompare(b));

        tbody.innerHTML = "";

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:#888;font-size:16px;">
                ${filter ? `No raw materials match "${filter}"` : "No raw materials defined yet."}<br>
                <strong>Add your first one below!</strong>
            </td></tr>`;
            return;
        }

        const fragment = document.createDocumentFragment();

        for (const m of items) {
            const data = rawPrice[m];
            const price = (data?.price !== undefined) ? data.price : 0;
            const weight = (data?.weight !== undefined) ? data.weight : 0;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:bold;color:var(--accent);padding:10px;">${m}</td>
                <td style="padding:8px;">
                  <input type="number" step="0.01" value="${price.toFixed(2)}" 
                         class="priceInput auto-save-input"
                         data-item="${m}"
                         style="width:110px;background:#111;color:white;border:1px solid #444;padding:8px;border-radius:4px;font-size:14px;">
                  <small style="color:#888;margin-left:6px;">$/unit</small>
                </td>
                <td style="padding:8px;">
                  <input type="number" step="0.01" value="${weight.toFixed(2)}" 
                         class="weightInput auto-save-input"
                         data-item="${m}"
                         style="width:100px;background:#001122;color:#0af;border:2px solid #00aaff;padding:8px;border-radius:4px;font-weight:bold;font-size:14px;">
                  <strong style="color:#0af;margin-left:8px;">kg/unit</strong>
                </td>
                <td style="text-align:center;padding:8px;">
                  <button class="danger small" onclick="RawMaterials.remove('${m}')"
                          style="padding:8px 12px;font-size:13px;border-radius:6px;">Remove</button>
                </td>
            `;

            // Highlight items with weight
            if (weight > 0) {
                tr.style.background = "rgba(0, 170, 255, 0.08)";
                tr.style.borderLeft = "4px solid #0af";
            }

            fragment.appendChild(tr);
        }

        tbody.appendChild(fragment);
    },

    // SAVE PRICE + WEIGHT — BULLETPROOF
    savePrice(item, button) {
        const row = button.closest("tr");
        const priceInput = row.querySelector(".priceInput");
        const price = parseFloat(priceInput.value) || 0;

        // Update state
        if (!App.state.rawPrice[item]) App.state.rawPrice[item] = {};
        App.state.rawPrice[item].price = price;

        // Save to Firebase
        App.save("rawPrice");

        // Visual feedback
        button.style.background = "#2a2";
        setTimeout(() => button.style.background = "", 300);

        debouncedCalcRun();
    },
    saveWeight(item, button) {
        const row = button.closest("tr");
        const weightInput = row.querySelector(".weightInput");
        const weight = parseFloat(weightInput.value) || 0;

        // Update state
        if (!App.state.rawPrice[item]) App.state.rawPrice[item] = {};
        App.state.rawPrice[item].weight = weight;

        // Save to Firebase
        App.save("rawPrice");

        // Visual feedback
        button.style.background = "#2a2";
        setTimeout(() => button.style.background = "", 300);

        // Update weight highlight instantly
        if (weight > 0) {
            row.style.background = "rgba(0, 170, 255, 0.08)";
            row.style.borderLeft = "4px solid #0af";
        } else {
            row.style.background = "";
            row.style.borderLeft = "none";
        }

        debouncedCalcRun();
    },

    // REMOVE RAW MATERIAL
    async remove(name) {
        const ok = await showConfirm(`Permanently delete "${name}" from raw materials?\nThis removes price & weight data.`);
        if (!ok) return;

        // 2. FORCE DELETE IN FIRESTORE
        try {
            await firebase.firestore().collection('business').doc('main').update({
                [`rawPrice.${name}`]: firebase.firestore.FieldValue.delete()
            });
            console.log(`Deleted rawPrice.${name} from Firebase`);
        } catch (err) {
            console.error("Failed to delete from Firebase:", err);
            showToast("fail", "Failed to delete from server — check console");
            return;
        }


        await App.save("rawPrice");
        this.renderPrices();
        debouncedCalcRun();
        PriceList.render();
        Inventory.render();

        showToast("success", `"${name}" removed.`);
    },

    renderEmployeeList() {
        const select = document.getElementById("purchaseEmployee");
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">Current User</option>';
        Object.keys(App.state.employees || {}).sort().forEach(emp => {
            const opt = document.createElement("option");
            opt.value = opt.textContent = emp;
            select.appendChild(opt);
        });
        select.value = current || App.state.currentEmployee || "";
    }
};

// SEARCHABLE RAW MATERIAL SELECT FOR PURCHASES — NOW INCLUDES CRAFTED ITEMS
document.getElementById('purchaseItemSearch')?.addEventListener('input', function (e) {
    const val = e.target.value.toLowerCase().trim();
    const opts = document.getElementById('purchaseItemOptions');
    opts.innerHTML = '';
    opts.style.display = val ? 'block' : 'none';
    if (!val) return;

    // COMBINE RAW MATERIALS + CRAFTED ITEMS
    const allItems = [
        ...Object.keys(App.state.rawPrice || {}),
        ...Object.keys(App.state.recipes || {})
    ].filter(name => name.toLowerCase().includes(val))
        .sort();

    allItems.slice(0, 20).forEach(name => {
        const isCrafted = App.state.recipes[name];
        const price = isCrafted
            ? Calculator.cost(name) || 0
            : (App.state.rawPrice[name]?.price || 0);

        const div = document.createElement('div');
        div.className = 'category-item';
        div.style.paddingLeft = "20px";
        div.style.position = "relative";

        // Add icon for crafted items
        if (isCrafted) {
            div.style.paddingLeft = "28px";
            div.style.color = "#0af";
            div.innerHTML = `✦ ${name} (Crafted) ($${price.toFixed(2)} ea)`;
        } else {
            div.textContent = `${name} ($${price.toFixed(2)} ea)`;
        }

        div.onclick = () => {
            document.getElementById('purchaseItemSearch').value = name;
            opts.style.display = 'none';
            document.getElementById('purchaseQty')?.focus();
        };
        opts.appendChild(div);
    });
});

//trigger dropdown update when raw material page opens
document.querySelector('[data-tab="rawpurchase"]')?.addEventListener("click", () => {
    setTimeout(EmployeeSelect.refreshAll(), 100);
});
document.getElementById("newRawName")?.addEventListener("input", function (e) {
    const filter = e.target.value;
    RawMaterials.renderPrices(filter);
});

// AUTO-SAVE PRICE & WEIGHT ON BLUR
// AUTO-SAVE PRICE & WEIGHT ON BLUR — GREEN FLASH ON INPUT ONLY
document.getElementById("rawTable")?.addEventListener("focusout", function (e) {
    const input = e.target;
    if (!input.classList.contains("auto-save-input")) return;

    const item = input.dataset.item;
    if (!item) return;

    let value = parseFloat(input.value) || 0;

    // Update the correct field
    if (input.classList.contains("priceInput")) {
        if (!App.state.rawPrice[item]) App.state.rawPrice[item] = {};
        App.state.rawPrice[item].price = value;
    }
    else if (input.classList.contains("weightInput")) {
        if (!App.state.rawPrice[item]) App.state.rawPrice[item] = {};
        App.state.rawPrice[item].weight = value;

        // Only update row highlight (no flash on row)
        const row = input.closest("tr");
        if (value > 0) {
            row.style.background = "rgba(0, 170, 255, 0.08)";
            row.style.borderLeft = "4px solid #0af";
        } else {
            row.style.background = "";
            row.style.borderLeft = "none";
        }
    }

    // Save to Firebase
    App.save("rawPrice");
    debouncedCalcRun();

    // GREEN FLASH ONLY ON THE INPUT FIELD
    input.style.background = "#004400";
    input.style.transition = "background 0.4s ease";
    setTimeout(() => {
        input.style.background = ""; // back to normal
    }, 400);
});