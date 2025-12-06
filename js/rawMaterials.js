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

        const ok = await showConfirm(preview); if (!ok) return;

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
        App.save("ledger");
        App.save("warehouseStock");

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

        document.getElementById("purchaseItemSearch").value = "";
        document.getElementById("purchaseQty").value = "1";
        document.getElementById("purchasePrice").value = "";
        document.getElementById("purchaseSupplier").value = "";

        Inventory.render();
        Ledger.render();
        debouncedCalcRun();
    },

    // ADD NEW RAW MATERIAL — BULLETPROOF
    add() {
        const name = document.getElementById("newRawName").value.trim();
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
    renderPrices() {
        const tbody = document.querySelector("#rawTable tbody");
        if (!tbody) return;

        tbody.innerHTML = "";

        // Sort alphabetically
        const sorted = Object.keys(App.state.rawPrice).sort((a, b) => a.localeCompare(b));

        for (const m of sorted) {
            const data = App.state.rawPrice[m];
            const price = (data && typeof data === 'object' && data.price !== undefined) ? data.price : 0;
            const weight = (data && typeof data === 'object' && data.weight !== undefined) ? data.weight : 0;

            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td style="font-weight:bold;color:var(--accent);padding:10px;">${m}</td>
        <td style="padding:8px;">
          <input type="number" step="0.01" value="${price.toFixed(2)}" 
                 style="width:110px;background:#111;color:white;border:1px solid #444;padding:8px;border-radius:4px;font-size:14px;"
                 class="priceInput">
          <small style="color:#888;margin-left:6px;">$/unit</small>
        </td>
        <td style="padding:8px;">
          <input type="number" step="0.01" value="${weight.toFixed(2)}" 
                 style="width:100px;background:#001122;color:#0af;border:2px solid #00aaff;padding:8px;border-radius:4px;font-weight:bold;font-size:14px;"
                 class="weightInput">
          <strong style="color:#0af;margin-left:8px;">kg/unit</strong>
        </td>
        <td style="text-align:center;padding:8px;">
          <button class="small success" onclick="RawMaterials.savePrice('${m}', this)"
                  style="padding:8px 16px;font-size:13px;border-radius:6px;">Save</button>
          <button class="danger small" onclick="RawMaterials.remove('${m}')"
                  style="padding:8px 12px;margin-left:6px;font-size:13px;border-radius:6px;">Remove</button>
        </td>
      `;

            // Highlight items with weight
            if (weight > 0) {
                tr.style.background = "rgba(0, 170, 255, 0.08)";
                tr.style.borderLeft = "4px solid #0af";
            }

            tbody.appendChild(tr);
        }

        // Show message if empty
        if (sorted.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:#888;font-size:16px;">
        No raw materials defined yet.<br>
        <strong>Add your first one below!</strong>
      </td></tr>`;
        }
    },

    // SAVE PRICE + WEIGHT — BULLETPROOF
    savePrice(name, button) {
        const row = button.closest("tr");
        const priceInput = row.querySelector(".priceInput");
        const weightInput = row.querySelector(".weightInput");

        const price = parseFloat(priceInput.value) || 0;
        const weight = parseFloat(weightInput.value) || 0;

        App.state.rawPrice[name] = { price, weight };
        App.save("rawPrice");

        row.style.background = "#002200";
        setTimeout(() => {
            row.style.background = weight > 0 ? "rgba(0, 170, 255, 0.08)" : "";
            row.style.borderLeft = weight > 0 ? "4px solid #0af" : "none";
        }, 300);

        debouncedCalcRun();
        //safeRender();
    },

    // REMOVE RAW MATERIAL
    async remove(name) {
        const ok = await showConfirm(`Permanently delete "${name}" from raw materials?\nThis removes price & weight data.`); if (!ok) return;

        delete App.state.rawPrice[name];
        App.save("rawPrice");
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

// SEARCHABLE RAW MATERIAL SELECT FOR PURCHASES
document.getElementById('purchaseItemSearch')?.addEventListener('input', function (e) {
    const val = e.target.value.toLowerCase().trim();
    const opts = document.getElementById('purchaseItemOptions');
    opts.innerHTML = '';
    opts.style.display = val ? 'block' : 'none';
    if (!val) return;

    Object.keys(App.state.rawPrice || {})
        .filter(name => name.toLowerCase().includes(val))
        .sort()
        .slice(0, 20)
        .forEach(name => {
            const data = App.state.rawPrice[name];
            const price = (data && data.price !== undefined) ? data.price : 0;

            const div = document.createElement('div');
            div.className = 'category-item';
            div.textContent = `${name} ($${Number(price).toFixed(2)} ea)`;
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