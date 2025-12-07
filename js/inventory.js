// ========================
// Inventory Managmement
// ========================
const Inventory = {
    render() {
        const search = (document.getElementById("inventorySearch")?.value || "").toLowerCase().trim();
        const onlyLow = this._filterLowOnly || false;  // ← Our filter state
        const tbody = document.getElementById("inventoryTable");
        if (!tbody) return;
        tbody.innerHTML = "";

        const minStock = App.state.minStock || {};
        const shopStock = App.state.shopStock || {};
        const warehouseStock = App.state.warehouseStock || {};
        const rawPrice = App.state.rawPrice || {};
        const recipes = App.state.recipes || {};

        let lowCount = 0;
        let totalWeightShop = 0, totalWeightWarehouse = 0;

        // === 1. CRAFTED ITEMS ===
        Object.keys(recipes).sort().forEach(item => {
            if (search && !item.toLowerCase().includes(search)) return;

            const shop = shopStock[item] || 0;
            const warehouse = warehouseStock[item] || 0;
            const min = minStock[item] || 0;
            const low = shop < min;
            if (low) lowCount++;

            // FILTER: Hide non-low items when onlyLow is active
            if (onlyLow && !low) return;

            const weightPerUnit = Calculator.weight(item);
            const shopWeight = (shop * weightPerUnit).toFixed(2);
            const warehouseWeight = (warehouse * weightPerUnit).toFixed(2);
            totalWeightShop += shop * weightPerUnit;
            totalWeightWarehouse += warehouse * weightPerUnit;

            tbody.innerHTML += `
                <tr style="${low ? 'background:rgba(255,100,100,0.12);' : ''}">
                <td><strong>${item}</strong></td>
                <td>Crafted Item</td>
                <td style="text-align:center;font-weight:bold;color:var(--accent);font-size:16px;">
                    ${shop}
                    ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${shopWeight}kg</small>` : ""}
                </td>
                <td style="text-align:center;">
                    <input type="number" min="0"
                        id="setwarehouse_${item.replace(/ /g, '_')}"
                        value="${warehouse}"
                        class="auto-save-input"
                        onblur="Inventory.setWarehouseStock('${item}', this.value)"
                        onkeypress="if(event.key==='Enter') this.blur()">
                    <br><small style="color:#888;">warehouse</small>
                    ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${warehouseWeight}kg</small>` : ""}
                </td>
                <td>
                    <input type="number" min="0" value="${min}" 
                        class="minstock-input" style="width:70px;font-weight:bold;"
                        onkeypress="if(event.key==='Enter') this.onchange()"
                        onchange="Inventory.setMin('${item}', this.value)">
                    <br><small style="color:#888;">min stock</small>
                </td>
                <td style="color:${low ? 'var(--red)' : 'var(--green)'};font-weight:bold;">
                    ${low ? 'LOW (-' + (min - shop) + ')' : 'OK'}
                </td>
                <td>
                    <input type="number" min="0" 
                        id="setshop_${item.replace(/ /g, '_')}" 
                        value="${shop}"
                        class="auto-save-input"
                        onblur="Inventory.setShopStock('${item}', this.value)"
                        onkeypress="if(event.key==='Enter') this.blur()">
                    <br><small style="color:#888;">shop display</small>
                </td>
                <td>
                    ${(() => {
                    const sh = shopStock[item] || 0;
                    const mn = minStock[item] || 0;
                    const needed = Math.max(0, mn - sh);

                    // ALWAYS show "Add to Order" if low — even if warehouse is 0 (will be crafted)
                    const addBtn = needed > 0 ? `
                            <button class="success small" style="margin-bottom:4px;" onclick="Inventory.addToOrder('${item}', ${needed})">
                                +${needed} to Order
                            </button><br>` : '';

                    // Move to Display only if warehouse has stock
                    const moveBtn = (needed > 0 && (warehouseStock[item] || 0) > 0) ? `
                            <button class="primary small" onclick="Inventory.moveToShop('${item}')">
                                Move ${Math.min(needed, warehouseStock[item] || 0)} to Display
                            </button>` : '';

                    return addBtn + moveBtn + `
                            <button class="info small" onclick="Inventory.removeFromShop('${item}')">
                                Return to Warehouse
                            </button>`;
                })()}
                </td>
            </tr>`;
        });

        // === 2. RAW MATERIALS ON DISPLAY ===
        Object.keys(minStock)
            .filter(k => minStock[k] > 0 && rawPrice[k] && !recipes[k])
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

                tbody.innerHTML += `
                <tr style="${low ? 'background:rgba(255,100,100,0.12);' : ''}">
                    <td><strong>${raw}</strong></td>
                    <td>Raw Material</td>
                    <td style="text-align:center;font-weight:bold;color:var(--accent);font-size:16px;">
                    ${shop}
                    ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${shopWeight}kg</small>` : ""}
                    </td>
                    <td style="text-align:center;">
                    <input type="number" min="0"
                            id="setwarehouse_${raw.replace(/ /g, '_')}"
                            value="${warehouse}"
                            class="auto-save-input"
                            onblur="Inventory.setWarehouseStock('${raw}', this.value)"
                            onkeypress="if(event.key==='Enter') this.blur()">
                    <br><small style="color:#888;">warehouse</small>
                    ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${warehouseWeight}kg</small>` : ""}
                    </td>
                    <td>
                    <input type="number" min="0" value="${min}" 
                            class="minstock-input" style="width:70px;font-weight:bold;"
                            onkeypress="if(event.key==='Enter') this.onchange()"
                            onchange="Inventory.setMin('${raw}', this.value)">
                    <br><small style="color:#888;">min stock</small>
                    </td>
                    <td style="color:${low ? 'var(--red)' : 'var(--green)'};font-weight:bold;">
                    ${low ? 'LOW (-' + (min - shop) + ')' : 'OK'}
                    </td>
                    <td>
                    <input type="number" min="0" 
                            id="setshop_${raw.replace(/ /g, '_')}" 
                            value="${shop}"
                            class="auto-save-input"
                            onblur="Inventory.setShopStock('${raw}', this.value)"
                            onkeypress="if(event.key==='Enter') this.blur()">
                    <br><small style="color:#888;">shop display</small>
                    </td>
                    <td>
                        ${low ? (() => {
                        const needed = Math.max(0, min - shop);
                        const addBtn = needed > 0 ? `
                                <button class="success small" style="margin-bottom:4px;" onclick="Inventory.addToOrder('${raw}', ${needed})">
                                    +${needed} to Order
                                </button><br>` : '';

                        const moveBtn = (needed > 0 && warehouse > 0) ? `
                                <button class="primary small" onclick="Inventory.moveToShop('${raw}')">
                                    Move ${Math.min(needed, warehouse)} to Display
                                </button>` : '';

                        return addBtn + moveBtn;
                    })() : ''}
                        <button class="danger small" onclick="Inventory.removeFromShop('${raw}')">
                            Remove from Shop
                        </button>
                    </td>
                </tr>`;
            });

        // === 3. RAW MATERIALS NOT ON DISPLAY ===
        const rawNotOnDisplay = Object.keys(rawPrice)
            .filter(r => (!minStock[r] || minStock[r] === 0) && !recipes[r])
            .sort();

        if (rawNotOnDisplay.length > 0 && (!search || rawNotOnDisplay.some(r => r.toLowerCase().includes(search)))) {
            tbody.innerHTML += `<tr><td colspan="8" style="background:#222;color:#aaa;padding:12px;text-align:center;font-weight:bold;">
                    RAW MATERIALS NOT ON DISPLAY
                </td></tr>`;

            rawNotOnDisplay.forEach(raw => {
                if (search && !raw.toLowerCase().includes(search)) return;
                const warehouse = warehouseStock[raw] || 0;
                const weightPerUnit = Calculator.weight(raw);
                const warehouseWeight = (warehouse * weightPerUnit).toFixed(2);
                totalWeightWarehouse += warehouse * weightPerUnit;

                tbody.innerHTML += `
                    <tr style="background:rgba(100,150,255,0.08);">
                        <td><strong>${raw}</strong></td>
                        <td>Raw Material</td>
                        <td style="text-align:center;color:#666;">—</td>
                        <td style="text-align:center;">
                        <input type="number" min="0"
                                id="setwarehouse_${raw.replace(/ /g, '_')}"
                                value="${warehouse}"
                                class="auto-save-input"
                                onblur="Inventory.setWarehouseStock('${raw}', this.value)"
                                onkeypress="if(event.key==='Enter') this.blur()">
                        <br><small style="color:#888;">warehouse stock</small>
                        ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${warehouseWeight}kg</small>` : ""}
                        </td>
                        <td colspan="2" style="text-align:center;color:#888;">Not for sale yet</td>
                        <td colspan="2">
                            <button class="success small" onclick="Inventory.addRawToShop('${raw}')">
                                + Add to Shop Display
                            </button>
                        </td>
                    </tr>`;
            });
        }

        // === TOTAL WEIGHT SUMMARY + BEAUTIFUL CLICKABLE LOW-STOCK BADGE ===
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
                                    style="
                                    background: ${onlyLow ? '#c33' : 'rgba(255,50,50,0.15)'};
                                    color: ${onlyLow ? 'white' : '#f66'};
                                    border: 1px solid ${onlyLow ? '#f66' : '#f55'};
                                    padding: 6px 14px;
                                    border-radius: 20px;
                                    font-weight: bold;
                                    font-size: 14px;
                                    cursor: pointer;
                                    transition: all 0.2s ease;
                                    box-shadow: ${onlyLow ? '0 2px 8px rgba(255,0,0,0.3)' : 'none'};
                                    min-width: 80px;
                                    text-shadow: ${onlyLow ? '0 1px 2px rgba(0,0,0,0.5)' : 'none'};
                                    "
                                    onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='${onlyLow ? '0 4px 12px rgba(255,0,0,0.4)' : '0 2px 8px rgba(255,100,100,0.3)'}'"
                                    onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='${onlyLow ? '0 2px 8px rgba(255,0,0,0.3)' : 'none'}'"
                                    onclick="Inventory.filterLowStock(!Inventory._filterLowOnly)">
                            ${onlyLow ? 'Low Only (' + lowCount + ')' : lowCount + ' low'}
                            </button>
                        </span>
                        ` : '<span style="color:var(--green);font-weight:bold;">All stocked!</span>'}

                        <span id="showAllBtn" style="display:${onlyLow ? 'inline' : 'none'};">
                        <td colspan="2">
                            <button class="success small" onclick="Inventory.addRawToShop('${raw}')">
                                + Add to Shop Display
                            </button>
                        </td>
                        </span>
                    </div>
                    `;
        }
    },

    // AUTO-SAVE SHOP STOCK
    setShopStock(item, value) {
        const qty = parseInt(value) || 0;
        if (qty < 0) qty = 0;
        const previous = App.state.shopStock[item] || 0;
        App.state.shopStock[item] = qty;
        App.save("shopStock");
        if (qty !== previous) {
            const el = document.getElementById("setshop_" + item.replace(/ /g, '_'));
            if (el) {
                el.style.background = "#2a2";
                setTimeout(() => el.style.background = "", 300);
            }
        }
        this.render();
    },
    _filterLowOnly: false,

    filterLowStock(enabled) {
        this._filterLowOnly = !!enabled;
        document.getElementById("inventorySearch").value = ""; // Clear search when filtering
        this.render();
    },
    // AUTO-SAVE WAREHOUSE STOCK
    setWarehouseStock(item, value) {
        const qty = parseInt(value) || 0;
        if (qty < 0) qty = 0;
        const previous = App.state.warehouseStock[item] || 0;
        App.state.warehouseStock[item] = qty;
        App.save("warehouseStock");
        if (qty !== previous) {
            const el = document.getElementById("setwarehouse_" + item.replace(/ /g, '_'));
            if (el) {
                el.style.background = "#2a2";
                setTimeout(() => el.style.background = "", 300);
            }
        }
        this.render();
    },

    addRawToShop(raw) {
        const min = prompt(`Set minimum shop stock for "${raw}"? (e.g. 20)`, "20");
        const minNum = parseInt(min);
        if (isNaN(minNum) || minNum < 1) {
            showToast("fail", "Enter a valid minimum stock");
            return;
        }

        // Initialize properly
        App.state.minStock[raw] = minNum;
        App.state.shopStock[raw] = 0;

        App.save("minStock");
        App.save("shopStock");

        showToast("success", `${raw} added to shop display! Minimum stock: ${minNum}`);
        this.render();
    },

    async removeFromShop(item) {
        const ok = await showConfirm(`Remove "${item}" from shop display?\nAll display stock will return to warehouse.`); if (!ok) return;
        const shopQty = App.state.shopStock[item] || 0;
        App.state.warehouseStock[item] = (App.state.warehouseStock[item] || 0) + shopQty;
        delete App.state.minStock[item];
        delete App.state.shopStock[item];
        App.save("minStock"); App.save("shopStock"); App.save("warehouseStock");
        showToast("success", `${item} removed from shop. ${shopQty} returned to warehouse.`);
        this.render();
    },

    setMin(item, val) {
        const num = parseInt(val) || 0;
        if (num === 0) {
            delete App.state.minStock[item];
            delete App.state.shopStock[item];
        } else {
            App.state.minStock[item] = num;
            if (App.state.shopStock[item] === undefined) App.state.shopStock[item] = 0;
        }
        App.save("minStock"); App.save("shopStock");
        this.render();
    },

    moveToShop(item) {
        const warehouse = App.state.warehouseStock[item] || 0;
        const shop = App.state.shopStock[item] || 0;  // ← Explicitly default to 0
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
        Inventory.render();
    },
    // Add this method to your Inventory object
    addAllLowStock() {
        const minStock = App.state.minStock || {};
        const shopStock = App.state.shopStock || {};
        const warehouseStock = App.state.warehouseStock || {};

        let addedCount = 0;
        let totalQty = 0;

        Object.keys(minStock).forEach(item => {
            const min = minStock[item] || 0;
            const current = shopStock[item] || 0;
            const needed = Math.max(0, min - current);

            if (needed > 0 && warehouseStock[item] > 0) {
                const toAdd = Math.min(needed, warehouseStock[item]);

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
        activateTab("order"); // Switch to order tab
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
    },
};



// Debounced search — smooth even with huge lists
const updateInventorySearch = debounce(() => {
    Inventory.render();
}, 200);

// Attach listener once (safe even if called multiple times)
const searchInput = document.getElementById("inventorySearch");
if (searchInput) {
    searchInput.addEventListener("input", updateInventorySearch);
    // Optional: also trigger on paste/cut
    searchInput.addEventListener("paste", () => setTimeout(updateInventorySearch, 100));
}