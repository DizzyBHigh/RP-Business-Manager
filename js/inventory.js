// ========================
// Inventory Managmement
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
            const min = minStock[item] ?? 0; // or just || 0 is fine
            const low = shop < min;
            if (low) lowCount++;

            if (onlyLow && !low) return;

            const weightPerUnit = Calculator.weight(item);
            const shopWeight = (shop * weightPerUnit).toFixed(2);
            const warehouseWeight = (warehouse * weightPerUnit).toFixed(2);
            totalWeightShop += shop * weightPerUnit;
            totalWeightWarehouse += warehouse * weightPerUnit;

            const needed = Math.max(0, min - shop);

            // SAFE COST & SHOP PRICE — FIXES "toFixed is not a function"
            const costPrice = Number(Calculator.cost(item)) || 0;
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
                        id="setwarehouse_${item.replace(/ /g, '_')}"
                        value="${warehouse}"
                        class="auto-save-input"
                        onblur="Inventory.setWarehouseStock('${item}', this.value)"
                        onkeypress="if(event.key==='Enter') this.blur()">
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
                        id="setshop_${item.replace(/ /g, '_')}" 
                        value="${shop}"
                        class="auto-save-input"
                        onblur="Inventory.setShopStock('${item}', this.value)"
                        onkeypress="if(event.key==='Enter') this.blur()"
                        style="width:80px;">
                    <br><small style="color:#888;">In Shop</small>
                    ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${shopWeight}kg</small>` : ""}
                </td>
                <td style="text-align:center;font-weight:bold;color:var(--accent);font-size:16px;">
                    <input type="number" min="0" value="${min}" 
                        class="minstock-input" style="width:70px;font-weight:bold;"
                        onkeypress="if(event.key==='Enter') this.onchange()"
                        onchange="Inventory.setMin('${item}', this.value)">
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
            .filter(k => (minStock[k] >= 0) && rawPrice[k] && !recipes[k])  // Changed > 0 to >= 0
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

                // SAFE COST & SHOP PRICE
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
                                id="setwarehouse_${raw.replace(/ /g, '_')}"
                                value="${warehouse}"
                                class="auto-save-input"
                                onblur="Inventory.setWarehouseStock('${raw}', this.value)"
                                onkeypress="if(event.key==='Enter') this.blur()">
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
                        <input type="number" min="0" value="${min}" 
                        class="minstock-input" style="width:70px;font-weight:bold;"
                        onkeypress="if(event.key==='Enter') this.onchange()"
                        onchange="Inventory.setMin('${item}', this.value)"
                        title="0 = Not on display">
                <br><small style="color:#888;">min stock</small>
                        ${weightPerUnit > 0 ? `<br><small style="color:#0af;">${shopWeight}kg</small>` : ""}
                    </td>
                    <td>
                        <input type="number" min="0" value="${min}" 
                                class="minstock-input" style="width:70px;font-weight:bold;"
                                onkeypress="if(event.key==='Enter') this.onchange()"
                                onchange="Inventory.setMin('${raw}', this.value)">
                        <br><small style="color:#888;">min stock</small>
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
                                id="setwarehouse_${raw.replace(/ /g, '_')}"
                                value="${warehouse}"
                                class="auto-save-input"
                                onblur="Inventory.setWarehouseStock('${raw}', this.value)"
                                onkeypress="if(event.key==='Enter') this.blur()">
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

        // Replace all at once — super fast
        tbody.innerHTML = "";
        tbody.appendChild(fragment);

        // === TOTAL WEIGHT SUMMARY ===
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

    // AUTO-SAVE SHOP STOCK
    setShopStock(item, value) {
        const qty = parseInt(value) || 0;
        if (qty < 0) qty = 0;

        const previous = App.state.shopStock[item] || 0;
        App.state.shopStock[item] = qty;

        // Save to Firebase
        App.save("shopStock");

        // Visual feedback only — NO RENDER CALL!
        if (qty !== previous) {
            const el = event?.target || document.getElementById("setshop_" + item.replace(/ /g, '_'));
            if (el) {
                el.style.background = "#2a2";
                setTimeout(() => el.style.background = "", 300);
            }
        }

        // DON'T CALL this.render() — it overwrites your change!
        // Instead, just update the visual weight display
        const input = document.getElementById("setshop_" + item.replace(/ /g, '_'));
        if (input) {
            const cell = input.closest('td');
            if (cell) {
                const weight = Calculator.weight(item);
                const small = cell.querySelector('small');
                if (small) small.remove();
                if (weight > 0) {
                    const newSmall = document.createElement('small');
                    newSmall.style.color = "#0af";
                    newSmall.textContent = (qty * weight).toFixed(2) + "kg";
                    cell.appendChild(document.createElement('br'));
                    cell.appendChild(newSmall);
                }
            }
        }
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

        // Save to Firebase
        App.save("warehouseStock");

        // Visual feedback only — NO RENDER CALL!
        if (qty !== previous) {
            const el = event?.target || document.getElementById("setwarehouse_" + item.replace(/ /g, '_'));
            if (el) {
                el.style.background = "#2a2";
                setTimeout(() => el.style.background = "", 300);
            }
        }

        // Update weight display instantly without full re-render
        const input = document.getElementById("setwarehouse_" + item.replace(/ /g, '_'));
        if (input) {
            const cell = input.closest('td');
            if (cell) {
                const weight = Calculator.weight(item);
                const small = cell.querySelector('small');
                if (small) small.remove();
                if (weight > 0) {
                    const newSmall = document.createElement('small');
                    newSmall.style.color = "#0af";
                    newSmall.textContent = (qty * weight).toFixed(2) + "kg";
                    cell.appendChild(document.createElement('br'));
                    cell.appendChild(newSmall);
                }
            }
        }
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
        const previous = App.state.minStock[item] || 0;

        // Always keep the entry — set to 0 instead of deleting
        App.state.minStock[item] = num;

        // Only clear shopStock if min = 0 and shopStock is 0 (optional cleanup)
        if (num === 0 && (App.state.shopStock[item] || 0) === 0) {
            delete App.state.shopStock[item];
        }

        App.save("minStock");
        if (num > 0 || previous > 0) {
            App.save("shopStock"); // Save shopStock only if relevant
        }

        // Visual feedback
        if (num !== previous) {
            const el = event?.target || document.querySelector(`input[class="minstock-input"][onchange="Inventory.setMin('${item}', this.value)"]`);
            if (el) {
                el.style.background = "#2a2";
                setTimeout(() => el.style.background = "", 300);
            }
        }

        // Update status cell instantly
        const rows = document.querySelectorAll("#inventoryTable tr");
        for (const row of rows) {
            if (row.textContent.includes(item)) {
                const statusCell = row.cells[5]; // Status column
                if (statusCell) {
                    const shop = App.state.shopStock[item] || 0;
                    const low = shop < num;
                    statusCell.innerHTML = low
                        ? `<span style="color:var(--red);font-weight:bold;">LOW (-${num - shop})</span>`
                        : `<span style="color:var(--green);font-weight:bold;">OK</span>`;
                }
                break;
            }
        }
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

        let addedCount = 0;
        let totalQty = 0;

        Object.keys(minStock).forEach(item => {
            const min = minStock[item] ?? 0; // or just || 0 is fine
            const current = shopStock[item] || 0;
            const needed = Math.max(0, min - current);

            // ADD ALL LOW STOCK ITEMS — even if warehouse is 0 (they will be crafted)
            if (needed > 0) {
                const toAdd = needed; // Add the full amount needed

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