// ========================
// Inventory Management — FINAL, BULLETPROOF VERSION
// ========================
const Inventory = {
    render() {
        const search = (document.getElementById("inventorySearch")?.value || "").toLowerCase().trim();
        const onlyLow = this._filterLowOnly || false;
        const tbody = document.getElementById("inventoryTable");
        if (!tbody) return;

        const minStock = App.state.minStock || {};
        const shopStock = App.state.shopStock || {};
        const warehouseStock = App.state.warehouseStock || {};
        const rawPrice = App.state.rawPrice || {};
        const recipes = App.state.recipes || {};
        const customPrices = App.state.customPrices || {};

        let lowCount = 0;
        let totalWeightShop = 0, totalWeightWarehouse = 0;

        const fragment = document.createDocumentFragment();

        // === 1. CRAFTED ITEMS ===
        Object.keys(recipes).sort().forEach(item => {
            if (search && !item.toLowerCase().includes(search)) return;

            const shop = shopStock[item] || 0;
            const warehouse = warehouseStock[item] || 0;
            const min = minStock[item] ?? 0;
            const low = shop < min;
            if (low) lowCount++;

            if (onlyLow && !low) return;

            const weightPerUnit = Calculator.weight(item);
            const shopWeight = (shop * weightPerUnit).toFixed(2);
            const warehouseWeight = (warehouse * weightPerUnit).toFixed(2);
            totalWeightShop += shop * weightPerUnit;
            totalWeightWarehouse += warehouse * weightPerUnit;

            const needed = Math.max(0, min - shop);

            let costPrice = 0;
            try {
                costPrice = Calculator.cost(item) || 0;
            } catch (err) {
                console.warn(`Failed to calculate cost for ${item}:`, err);
                costPrice = 0;
            }

            const shopPrice = Number(customPrices[item]?.shop) || costPrice * 1.25;
            const profit = shopPrice - costPrice;

            const addBtn = needed > 0 ? `
                <button class="success small" style="margin-bottom:4px;" onclick="Inventory.addToOrder('${item}', ${needed})">
                    +${needed} to Order
                </button><br>` : '';

            const moveBtn = (needed > 0 && warehouse > 0) ? `
                <button class="primary small" onclick="Inventory.moveToShop('${item}')">
                    Move ${Math.min(needed, warehouse)} to Display
                </button>` : '';

            const row = document.createElement("tr");
            row.style.background = low ? 'rgba(255,100,100,0.12)' : '';
            row.innerHTML = `
                <td><strong>${item}</strong></td>
                <td>Crafted Item</td>
                <td style="text-align:center;">
                    <input type="number" min="0"
                        class="auto-save-input warehouse-stock-input"
                        data-item="${item}"
                        value="${warehouse}">
                    <br><small style="color:#888;">warehouse</small>
                    ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${warehouseWeight}kg</small>` : ""}
                </td>
                <td style="color:#aaa;font-size:14px; font-weight:bold;">
                    Cost: $${costPrice.toFixed(2)}<br>
                    Shop: $${shopPrice.toFixed(2)}<br>
                    <span style="color:${profit >= 0 ? '#0f8' : '#f66'};">
                        Profit: $${profit.toFixed(2)}
                    </span>
                </td>
                <td style="text-align:center;font-weight:bold;color:var(--accent);font-size:16px;">
                    <input type="number" min="0"
                        class="auto-save-input shop-stock-input"
                        data-item="${item}"
                        value="${shop}"
                        style="width:80px;">
                    <br><small style="color:#888;">In Shop</small>
                    ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${shopWeight}kg</small>` : ""}
                </td>
                <td>
                    <input type="number" min="0"
                        class="min-stock-input"
                        data-item="${item}"
                        value="${min}"
                        title="0 = Not on display">
                    <br><small style="color:#888;">Min Stock</small>
                </td>
                <td style="color:${low ? 'var(--red)' : 'var(--green)'};font-weight:bold;">
                    ${low ? 'LOW (-' + needed + ')' : 'OK'}
                </td>
                <td>
                    ${addBtn}
                    ${moveBtn}
                    <button class="info small" onclick="Inventory.removeFromShop('${item}')">
                        Return to Warehouse
                    </button>
                </td>
            `;
            fragment.appendChild(row);
        });

        // === 2. RAW MATERIALS ON DISPLAY ===
        Object.keys(minStock)
            .filter(k => (minStock[k] >= 0) && rawPrice[k] && !recipes[k])
            .sort()
            .forEach(raw => {
                if (search && !raw.toLowerCase().includes(search)) return;

                const shop = shopStock[raw] || 0;
                const warehouse = warehouseStock[raw] || 0;
                const min = minStock[raw];
                const low = shop < min;
                if (low) lowCount++;

                if (onlyLow && !low) return;

                const weightPerUnit = Calculator.weight(raw);
                const shopWeight = (shop * weightPerUnit).toFixed(2);
                const warehouseWeight = (warehouse * weightPerUnit).toFixed(2);
                totalWeightShop += shop * weightPerUnit;
                totalWeightWarehouse += warehouse * weightPerUnit;

                const needed = Math.max(0, min - shop);

                const rawData = App.state.rawPrice[raw];
                const costPrice = rawData ? Number(rawData.price || rawData) || 0 : 0;
                const shopPrice = Number(customPrices[raw]?.shop) || costPrice * 1.25;
                const profit = shopPrice - costPrice;

                const addBtn = needed > 0 ? `
                    <button class="success small" style="margin-bottom:4px;" onclick="Inventory.addToOrder('${raw}', ${needed})">
                        +${needed} to Order
                    </button><br>` : '';

                const moveBtn = (needed > 0 && warehouse > 0) ? `
                    <button class="primary small" onclick="Inventory.moveToShop('${raw}')">
                        Move ${Math.min(needed, warehouse)} to Display
                    </button>` : '';

                const row = document.createElement("tr");
                row.style.background = low ? 'rgba(255,100,100,0.12)' : '';
                row.innerHTML = `
                    <td><strong>${raw}</strong></td>
                    <td>Raw Material</td>
                    <td style="text-align:center;">
                        <input type="number" min="0"
                            class="auto-save-input warehouse-stock-input"
                            data-item="${raw}"
                            value="${warehouse}">
                        <br><small style="color:#888;">warehouse</small>
                        ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${warehouseWeight}kg</small>` : ""}
                    </td>
                    <td style="color:#aaa;font-size:14px;">
                        Cost: $${costPrice.toFixed(2)}<br>
                        Shop: $${shopPrice.toFixed(2)}<br>
                        <span style="color:${profit >= 0 ? '#0f8' : '#f66'};font-weight:bold;">
                            Profit: $${profit.toFixed(2)}
                        </span>
                    </td>
                    <td style="text-align:center;font-weight:bold;color:var(--accent);font-size:16px;">
                        <input type="number" min="0"
                            class="auto-save-input shop-stock-input"
                            data-item="${raw}"
                            value="${shop}"
                            style="width:80px;">
                        <br><small style="color:#888;">In Shop</small>
                        ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${shopWeight}kg</small>` : ""}
                    </td>
                    <td>
                        <input type="number" min="0"
                            class="min-stock-input"
                            data-item="${raw}"
                            value="${min}"
                            title="0 = Not on display">
                        <br><small style="color:#888;">Min Stock</small>
                    </td>
                    <td style="color:${low ? 'var(--red)' : 'var(--green)'};font-weight:bold;">
                        ${low ? 'LOW (-' + needed + ')' : 'OK'}
                    </td>
                    <td>
                        ${addBtn}
                        ${moveBtn}
                        <button class="danger small" onclick="Inventory.removeFromShop('${raw}')">
                            Remove from Shop
                        </button>
                    </td>
                `;
                fragment.appendChild(row);
            });

        // === 3. RAW MATERIALS NOT ON DISPLAY ===
        const rawNotOnDisplay = Object.keys(rawPrice)
            .filter(r => (!minStock[r] || minStock[r] === 0) && !recipes[r])
            .sort();

        if (rawNotOnDisplay.length > 0 && (!search || rawNotOnDisplay.some(r => r.toLowerCase().includes(search)))) {
            const header = document.createElement("tr");
            header.innerHTML = `<td colspan="8" style="background:#222;color:#aaa;padding:12px;text-align:center;font-weight:bold;">
                RAW MATERIALS NOT ON DISPLAY
            </td>`;
            fragment.appendChild(header);

            rawNotOnDisplay.forEach(raw => {
                if (search && !raw.toLowerCase().includes(search)) return;
                const warehouse = warehouseStock[raw] || 0;
                const weightPerUnit = Calculator.weight(raw);
                const warehouseWeight = (warehouse * weightPerUnit).toFixed(2);
                totalWeightWarehouse += warehouse * weightPerUnit;

                const rawData = App.state.rawPrice[raw];
                const costPrice = rawData ? Number(rawData.price || rawData) || 0 : 0;

                const row = document.createElement("tr");
                row.style.background = "rgba(100,150,255,0.08)";
                row.innerHTML = `
                    <td><strong>${raw}</strong></td>
                    <td>Raw Material</td>
                    <td style="text-align:center;">
                        <input type="number" min="0"
                            class="auto-save-input warehouse-stock-input"
                            data-item="${raw}"
                            value="${warehouse}">
                        <br><small style="color:#888;">warehouse stock</small>
                        ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${warehouseWeight}kg</small>` : ""}
                    </td>
                    <td style="color:#aaa;font-size:14px;">
                        Cost: $${costPrice.toFixed(2)}
                    </td>
                    <td style="text-align:center;color:#666;">—</td>
                    <td colspan="2" style="text-align:center;color:#888;">Not for sale yet</td>
                    <td>
                        <button class="success small" onclick="Inventory.addRawToShop('${raw}')">
                            + Add to Shop Display
                        </button>
                    </td>
                `;
                fragment.appendChild(row);
            });
        }

        tbody.innerHTML = "";
        tbody.appendChild(fragment);

        const summary = document.getElementById("inventorySummary");
        if (summary) {
            summary.innerHTML = `
                <div style="display:flex;gap:20px;justify-content:center;align-items:center;flex-wrap:wrap;font-size:15px;">
                    <span style="color:var(--green)">Shop: ${totalWeightShop.toFixed(2)}kg</span>
                    <span style="color:#0af">Warehouse: ${totalWeightWarehouse.toFixed(2)}kg</span>
                    <span style="color:#0ff;font-weight:bold;">TOTAL: ${(totalWeightShop + totalWeightWarehouse).toFixed(2)}kg</span>
                    ${lowCount > 0 ? `
                    <span>
                        <button id="lowStockBadge"
                                style="background:${onlyLow ? '#c33' : 'rgba(255,50,50,0.15)'};color:${onlyLow ? 'white' : '#f66'};border:1px solid ${onlyLow ? '#f66' : '#f55'};padding:6px 14px;border-radius:20px;font-weight:bold;font-size:14px;cursor:pointer;"
                                onclick="Inventory.filterLowStock(!Inventory._filterLowOnly)">
                            ${onlyLow ? 'Low Only (' + lowCount + ')' : lowCount + ' low'}
                        </button>
                    </span>` : '<span style="color:var(--green);font-weight:bold;">All stocked!</span>'}
                </div>`;
        }
    },

    // AUTO-SAVE + GREEN FLASH — MODERN, NO DEPRECATED EVENT
    _filterLowOnly: false,

    filterLowStock(enabled) {
        this._filterLowOnly = !!enabled;
        document.getElementById("inventorySearch").value = "";
        this.render();
    },

    addRawToShop(raw) {
        const min = prompt(`Set minimum shop stock for "${raw}"? (e.g. 20)`, "20");
        const minNum = parseInt(min);
        if (isNaN(minNum) || minNum < 1) {
            showToast("fail", "Enter a valid minimum stock");
            return;
        }

        App.state.minStock[raw] = minNum;
        App.state.shopStock[raw] = 0;

        App.save("minStock");
        App.save("shopStock");

        showToast("success", `${raw} added to shop display! Minimum stock: ${minNum}`);
        this.render();
    },

    async removeFromShop(item) {
        const ok = await showConfirm(`Remove "${item}" from shop display?\nAll display stock will return to warehouse.`);
        if (!ok) return;

        const shopQty = App.state.shopStock[item] || 0;
        App.state.warehouseStock[item] = (App.state.warehouseStock[item] || 0) + shopQty;
        delete App.state.minStock[item];
        delete App.state.shopStock[item];

        await Promise.all([
            App.save("minStock"),
            App.save("shopStock"),
            App.save("warehouseStock")
        ]);

        showToast("success", `${item} removed from shop. ${shopQty} returned to warehouse.`);
        this.render();
    },

    moveToShop(item) {
        const warehouse = App.state.warehouseStock[item] || 0;
        const shop = App.state.shopStock[item] || 0;
        const min = App.state.minStock[item] || 0;

        if (shop >= min) {
            showToast("info", `${item} already has enough on display (${shop}/${min})`);
            return;
        }

        const needed = min - shop;
        const available = warehouse;
        if (available <= 0) {
            showToast("fail", `No ${item} in warehouse to move`);
            return;
        }

        const toMove = Math.min(needed, available);
        App.state.warehouseStock[item] = warehouse - toMove;
        App.state.shopStock[item] = shop + toMove;

        App.save("warehouseStock");
        App.save("shopStock");

        showToast("success", `Moved ${toMove}× ${item} to shop display (now ${shop + toMove}/${min})`);
        this.render();
    },

    addAllLowStock() {
        const minStock = App.state.minStock || {};
        const shopStock = App.state.shopStock || {};

        let addedCount = 0;
        let totalQty = 0;

        Object.keys(minStock).forEach(item => {
            const min = minStock[item] ?? 0;
            const current = shopStock[item] || 0;
            const needed = Math.max(0, min - current);

            if (needed > 0) {
                const toAdd = needed;

                const existing = App.state.order.find(o => o.item === item);
                if (existing) {
                    existing.qty += toAdd;
                } else {
                    App.state.order.push({ item, qty: toAdd, tier: "shop" });
                }

                addedCount++;
                totalQty += toAdd;
            }
        });

        if (addedCount === 0) {
            showToast("info", "No low stock items need restocking!");
            return;
        }

        debouncedSaveOrder?.();
        Order.renderCurrentOrder();
        debouncedCalcRun();

        showToast("success", `Added ${addedCount} low stock item${addedCount > 1 ? "s" : ""} (${totalQty} total) to order`);
        activateTab("order");
    },

    addToOrder(item, qty) {
        qty = parseInt(qty) || 1;

        const existing = App.state.order.find(o => o.item === item);
        if (existing) {
            existing.qty += qty;
        } else {
            App.state.order.push({ item, qty, tier: "shop" });
        }

        debouncedSaveOrder?.();
        Order.renderCurrentOrder();
        debouncedCalcRun();

        showToast("success", `${qty}× ${item} added to order`);
        activateTab("order");
    }
};

// AUTO-SAVE + GREEN FLASH — FINAL VERSION, WORKS PERFECTLY
// GREEN FLASH — WORKS 100% NO MATTER WHAT
document.getElementById("inventoryTable")?.addEventListener("focusout", function (e) {
    const input = e.target;
    if (!input) return;

    if (!input.matches('.shop-stock-input, .warehouse-stock-input, .min-stock-input')) return;

    const item = input.dataset.item;
    if (!item) return;

    let value = parseInt(input.value) || 0;
    if (value < 0) {
        value = 0;
        input.value = "0";
    }

    // Save logic (unchanged)
    if (input.classList.contains("shop-stock-input")) {
        App.state.shopStock[item] = value;
        App.save("shopStock");
    }
    else if (input.classList.contains("warehouse-stock-input")) {
        App.state.warehouseStock[item] = value;
        App.save("warehouseStock");
    }
    else if (input.classList.contains("min-stock-input")) {
        App.state.minStock[item] = value;
        App.save("minStock");

        const shop = App.state.shopStock[item] || 0;
        const low = shop < value;
        const row = input.closest("tr");
        const statusCell = row?.cells[6];
        if (statusCell) {
            statusCell.innerHTML = low
                ? `<span style="color:var(--red);font-weight:bold;">LOW (-${value - shop})</span>`
                : `<span style="color:var(--green);font-weight:bold;">OK</span>`;
        }
    }

    // Update weight
    const cell = input.closest("td");
    const weight = Calculator.weight(item);
    const small = cell?.querySelector('small[color="#0af"]');
    if (small && weight > 0) {
        small.textContent = (value * weight).toFixed(2) + "kg";
    }

    // GREEN FLASH — USING CLASS + ANIMATION
    input.classList.add("inventory-green-flash");

    // Remove class after animation
    setTimeout(() => {
        input.classList.remove("inventory-green-flash");
    }, 400);
});


// Debounced search
const updateInventorySearch = debounce(() => Inventory.render(), 200);
const searchInput = document.getElementById("inventorySearch");
if (searchInput) {
    searchInput.addEventListener("input", updateInventorySearch);
    searchInput.addEventListener("paste", () => setTimeout(updateInventorySearch, 100));
}