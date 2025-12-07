// ========================
// Calculator App — NOW WITH LIVE WEIGHT TRACKING
// ========================
let craftingSourceMode = "craft";  // "craft" or "warehouse" — live only
const Calculator = {
    liveToggle: {},
    weights: {},

    // FIXED: Now correctly reads weight from BOTH recipes AND rawPrice
    weight(item) {
        if (this.weights[item] !== undefined) return this.weights[item];

        let w = 0;

        const recipe = App.state.recipes[item];
        const recipeWeight = recipe?.weight;

        // PRIORITY 1: Recipe has explicit weight → use it
        if (recipeWeight !== undefined && recipeWeight !== null) {
            w = recipeWeight;
        }
        // PRIORITY 2: Raw material weight (even if recipe exists!)
        else if (App.state.rawPrice[item]?.weight !== undefined) {
            w = App.state.rawPrice[item].weight;
        }

        this.weights[item] = w;
        return w;
    },

    cost(item) {
        // Fast cache check
        if (App.cache.cost?.[item] !== undefined) return App.cache.cost[item];

        // 1. Direct price on raw material (most common)
        const raw = App.state.rawPrice[item];
        if (raw && typeof raw === 'object' && raw.price !== undefined) {
            return App.cache.cost[item] = raw.price;
        }

        // 2. Direct price on recipe (rare override)
        const recipe = App.state.recipes[item];
        if (recipe && recipe.price !== undefined) {
            return App.cache.cost[item] = recipe.price;
        }

        // 3. Calculate from ingredients
        if (!recipe?.i || Object.keys(recipe.i).length === 0) {
            return App.cache.cost[item] = 0;
        }

        let total = 0;
        for (const [ing, qty] of Object.entries(recipe.i)) {
            total += this.cost(ing) * qty;
        }

        const yieldAmount = recipe.y || 1;
        return App.cache.cost[item] = total / yieldAmount;
    },
    resolve(item, need) {
        const r = App.state.recipes[item];
        if (!r) return { [item]: need };
        const batches = Math.ceil(need / (r.y || 1));
        let mats = {};
        for (const [ing, q] of Object.entries(r.i)) {
            const sub = this.resolve(ing, q * batches);
            for (const [m, a] of Object.entries(sub)) mats[m] = (mats[m] || 0) + a;
        }
        return mats;
    },
    buildTree(item, qty = 1, depth = 0, path = [], orderIndex = null) {
        const key = path.concat(item).join("→");
        const r = App.state.recipes[item];
        const isRaw = !r || !r.i || Object.keys(r.i).length === 0;
        const stock = App.state.warehouseStock[item] || 0;
        const needed = qty;
        const canUseStock = !isRaw && stock >= needed;
        const userChoice = Calculator.liveToggle[key] ?? "craft";  // ← default to craft

        const itemWeight = this.weight(item);
        const totalWeight = (qty * itemWeight).toFixed(3);

        let header = `<div class="tree-item" style="margin-left:${depth * 24}px;display:flex;align-items:center;gap:8px;position:relative;">`;

        // Remove button for top-level order items
        if (depth === 0 && orderIndex !== null) {
            header += `<button onclick="removeOrderItemDirectly(${orderIndex})" style="background:#c00;color:white;border:none;padding:2px 8px;border-radius:4px;font-weight:bold;cursor:pointer;font-size:11px;" title="Remove from order">×</button>`;
        }

        // ────────────────── UNIFIED DROPDOWN (top-level + sub-items) ──────────────────
        if (!isRaw) {
            const stockLabel = depth === 0
                ? `Use Warehouse (${stock} in stock)`
                : `Use Warehouse (${stock})`;

            header += `
                        <select style="font-size:12px;padding:2px;border-radius:4px;background:#000;color:white;border:1px solid #444;"
                                onchange="Calculator.liveToggle['${key}']=this.value; debouncedCalcRun();">
                            <option value="craft"${userChoice !== "warehouse" ? " selected" : ""}>Craft</option>
                            ${canUseStock ? `<option value="warehouse"${userChoice === "warehouse" ? " selected" : ""}>${stockLabel}</option>` : ""}
                        </select>`;
        }
        // ─────────────────────────────────────────────────────────────────────────────

        header += `<strong style="color:var(--accent);">${qty} × ${item}</strong>`;

        const weightColor = itemWeight > 0 ? "#0af" : "#666";
        header += ` <small style="color:${weightColor};font-weight:bold;">(${itemWeight.toFixed(3)}kg each → ${totalWeight}kg)</small>`;

        if (!isRaw) {
            const batches = Math.ceil(qty / (r.y || 1));
            header += ` <small style="color:#888;">(${batches} batch${batches > 1 ? "es" : ""})</small>`;
        }

        const cost = this.cost(item) * qty;
        if (userChoice !== "warehouse" && cost > 0) {
            header += ` <small style="color:#888;">($${cost.toFixed(2)})</small>`;
        }

        header += `</div>`;

        // If user chose warehouse and we have enough → show "using from warehouse"
        if (userChoice === "warehouse" && canUseStock) {
            return header + `<div class="tree" style="margin-left:${(depth + 1) * 24}px;color:#0f8;font-style:italic;padding:4px 0;">
                        Using ${needed} × ${item} from warehouse (${totalWeight}kg)
                    </div>`;
        }

        if (isRaw) return header;

        const batches = Math.ceil(qty / (r.y || 1));
        let html = header + `<div class="tree">`;
        for (const [ing, q] of Object.entries(r.i || {})) {
            html += this.buildTree(ing, q * batches, depth + 1, path.concat(item));
        }
        return html + `</div>`;
    },

    run() {
        console.log("Calculator.run() STARTED");

        // 1. Clear caches once per run
        this.weights = {};
        Calculator.liveToggle = Calculator.liveToggle || {};

        let totalRaw = {}, grandCost = 0, grandSell = 0;
        let finalProductWeight = 0;
        let treeHTML = "", invoiceHTML = "";

        if (App.state.order.length === 0) {
            const empty = "<p style='text-align:center;color:#888;margin:40px;'>Add items to your order</p>";
            updateIfChanged("craftingTree", empty);
            updateIfChanged("rawSummary", "");
            updateIfChanged("invoiceItems", "<tr><td colspan='7' style='text-align:center;color:#888;padding:40px;'>No items in order</td></tr>");
            ["subtotal", "totalCost", "grandTotal", "profitAmount"].forEach(id =>
                safeSetText(id, "$0.00")
            );
            safeSetText("profitPercent", "0%");
            return;
        }

        // ──────── EXPAND TO RAW (respects liveToggle) ────────
        const expandToRaw = (item, qty, path = []) => {
            const key = path.concat(item).join("→");
            const choice = Calculator.liveToggle[key] ?? "craft";
            const recipe = App.state.recipes[item];
            const stock = App.state.warehouseStock[item] || 0;

            if (choice === "warehouse" && stock >= qty) {
                totalRaw[item] = (totalRaw[item] || 0) + qty;
                return;
            }

            if (!recipe?.i) {
                totalRaw[item] = (totalRaw[item] || 0) + qty;
                return;
            }

            const batches = Math.ceil(qty / (recipe.y || 1));
            for (const [ing, q] of Object.entries(recipe.i)) {
                expandToRaw(ing, q * batches, path.concat(item));
            }
        };

        // ──────── BUILD TREE + INVOICE ────────
        App.state.order.forEach((o, idx) => {
            if (idx > 0) treeHTML += "<hr style='border:1px dashed #333;margin:30px 0'>";
            treeHTML += `<h3 style="margin:15px 0 8px;color:#0cf">${o.qty} × ${o.item}</h3>`;
            treeHTML += this.buildTree(o.item, o.qty, 0, [], idx);

            expandToRaw(o.item, o.qty);

            finalProductWeight += o.qty * this.weight(o.item);

            const sellPrice = o.customPrice ?? (App.state.customPrices[o.item]?.[o.tier] ||
                this.cost(o.item) * (o.tier === "bulk" ? 1.10 : 1.25));
            grandSell += sellPrice * o.qty;

            invoiceHTML += `<tr>
                <td>${o.qty}</td>
                <td><strong>${o.item}</strong></td>
                <td>${o.tier === "bulk" ? "Bulk" : "Shop"}</td>
                <td style="color:#0af;font-weight:bold;">${(o.qty * this.weight(o.item)).toFixed(2)}kg</td>
                <td class="profit-only">$${this.cost(o.item).toFixed(2)}</td>
                <td>$${sellPrice.toFixed(2)}</td>
                <td>$${(sellPrice * o.qty).toFixed(2)}</td>
            </tr>`;
        });

        // ──────── RAW MATERIALS TABLE (only if changed) ────────
        for (const [item, qty] of Object.entries(totalRaw)) {
            grandCost += this.cost(item) * qty;
        }

        const rawTableHTML = this.generateRawTableHTML(totalRaw, finalProductWeight, grandSell);

        // === DISCOUNT LOGIC ===
        const discountAmount = parseFloat(App.state.orderDiscount?.amount || 0) || 0;
        const discountReason = App.state.orderDiscount?.reason?.trim() || "Discount";

        const profitBeforeDiscount = grandSell - grandCost;
        const finalTotal = grandSell - discountAmount;
        const profit = profitBeforeDiscount - discountAmount;
        const profitPct = grandCost > 0 ? ((profit + discountAmount) / grandCost * 100).toFixed(1) : 0;

        console.log("DISCOUNT CALCULATION:", { grandSell, grandCost, discountAmount, finalTotal, profit });

        const summaryData = {
            grandCost: grandCost,
            grandSell: grandSell,
            discount: discountAmount,
            discountReason: discountReason,
            finalTotal: finalTotal,
            profit: profit,
            profitPct: profitPct,
            finalProductWeight: finalProductWeight
        };

        console.log("summaryData sent to renderOrderSummary:", summaryData);

        // Render summaries AFTER all calculations
        Calculator.renderOrderSummary(summaryData, "invoiceSummaryContainer");
        Calculator.renderOrderSummary(summaryData, "orderSummaryContainer");

        // Update the big total number at the top
        safeSetText("grandTotal", `$${finalTotal.toFixed(2)}`);

        // ──────── UPDATE DOM ONLY WHEN NEEDED ────────
        updateIfChanged("craftingTree", treeHTML);
        updateIfChanged("rawSummary", rawTableHTML);
        updateIfChanged("invoiceItems", invoiceHTML);
    },


    renderOrderSummary(data, targetId) {
        const { grandCost = 0, grandSell = 0, discount = 0, discountReason = "", finalTotal = 0, profit = 0, profitPct = 0, finalProductWeight = 0 } = data;
        const profitClass = profit >= 0 ? "profit-positive" : "profit-negative";
        const profitSign = profit >= 0 ? "+" : "";

        const html = `
        <div class="invoice-total" style="margin-top:20px; padding:18px 0; border-top:2px solid #0af; border-bottom:2px solid #0af; background:rgba(0,170,255,0.05); font-size:18px; line-height:1.8;">
            
            <div style="display:flex; justify-content:flex-end; align-items:flex-end; flex-wrap:wrap; gap:20px; font-weight:bold;">

                <!-- Left side: Cost & Profit (only visible internally) -->
                <div class="profit-only" style="margin-right:auto; text-align:left; color:#aaa;">
                    <div><strong>Cost to Produce:</strong> $${grandCost.toFixed(2)}</div>
                    <div id="profitLine" style="color:#0f8; font-size:19px;">
                        PROFIT: 
                        <span id="profitAmount" class="${profitClass}">
                            ${profitSign}$${Math.abs(profit).toFixed(2)}
                        </span>
                        <span style="color:#0af;">($${profitPct}%)</span>
                    </div>
                </div>

                <!-- Right side: TOTAL DUE + Weight (always visible) -->
                <div style="text-align:right; min-width:220px;">
                    <div style="font-size:28px; color:#0ff;">
                        TOTAL DUE:
                        <span id="grandTotal" class="grand-total">$${finalTotal.toFixed(2)}</span>
                    </div>

                    ${discount > 0 ? `
                    <div style="font-size:18px; color:#ff6b6b; margin-top:8px;">
                        Discount (${discountReason}): -$${discount.toFixed(2)}
                    </div>` : ''}
                    <div style="color:#0af; font-size:16px; margin-top:4px;">
                        Total Weight: 
                        <span id="invoiceTotalWeight">${finalProductWeight.toFixed(1)}</span>kg
                    </div>
                    <div style="color:#0af; font-size:16px; margin-top:4px;">
                        Thank you for your business! All items handcrafted with love.
                    </div>
                </div>
            </div>

            
        </div>
    `;

        const container = document.getElementById(targetId);
        if (!container) return console.warn(`renderOrderSummary: No element with ID "${targetId}" found`);
        if (container.innerHTML !== html) container.innerHTML = html;
    },

    generateRawTableHTML(totalRaw, finalWeight, grandSell) {
        console.log("totalRaw:", JSON.stringify(totalRaw, null, 2));

        if (Object.keys(totalRaw).length === 0) {
            return "<p style='text-align:center;color:#888;padding:40px'>No materials needed (all from warehouse)</p>";
        }

        let rows = `<table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:14px;">
                    <tr style="background:#003366;color:white;">
                        <th>Raw Material</th><th>Needed</th><th>In Stock</th><th>Weight</th><th>Status</th><th style="text-align:right">Cost</th>
                    </tr>`;

        const sorted = Object.keys(totalRaw).sort((a, b) => a.localeCompare(b));
        let totalWeightUsed = 0;
        let materialsCost = 0;  // ← We calculate this ourselves!

        for (const item of sorted) {
            const needed = totalRaw[item];
            const stock = App.state.warehouseStock[item] || 0;
            const cost = this.cost(item) * needed;
            materialsCost += cost;  // ← Fixed: was broken before

            const weight = needed * this.weight(item);
            totalWeightUsed += weight;

            const fromWH = Object.entries(Calculator.liveToggle).some(
                ([k, v]) => v === "warehouse" && k.endsWith("→" + item)
            );
            const label = fromWH ? `${item} (warehouse)` : item;

            rows += `<tr ${fromWH ? 'style="background:rgba(0,255,150,0.1)"' : ''}>
                        <td style="padding:8px"><strong>${label}</strong></td>
                        <td style="padding:8px">${needed}</td>
                        <td style="padding:8px">${stock}</td>
                        <td style="padding:8px;color:#0af;font-weight:bold">${weight.toFixed(3)}kg</td>
                        <td style="padding:8px;color:${stock >= needed ? "#0f8" : "#f44"};font-weight:bold">
                            ${stock >= needed ? "OK" : "LOW"}
                        </td>
                        <td style="padding:8px;text-align:right">$${cost.toFixed(2)}</td>
                    </tr>`;
        }

        // Now everything is calculated — no DOM scraping!
        const profit = grandSell - materialsCost;
        const profitColor = profit >= 0 ? "#0f8" : "#f44";

        rows += `<tr style="background:#001122;color:#0ff;font-weight:bold;font-size:16px">
                    <td colspan="3" style="padding:14px">
                        Materials Cost: $${materialsCost.toFixed(2)}<br>
                        Profit: <span style="color:${profitColor}">$${profit.toFixed(2)}</span>
                    </td>
                    <td style="padding:14px;color:#0af">${totalWeightUsed.toFixed(1)}kg<br><small>All Materials</small></td>
                    <td colspan="2" style="padding:14px;text-align:right">
                        Final Shippable Weight:<br>
                        <strong style="font-size:20px;color:#0ff">${finalWeight.toFixed(1)}kg</strong>
                    </td>
                </tr></table>`;

        return rows;
    }
};

// ──────────────────────── VIRTUAL DOM FOR CRAFTING TREE ───────────────────────
let lastTreeHTML = "";
let lastRawHTML = "";

function updateIfChanged(elementId, newHTML) {
    if (newHTML === document.getElementById(elementId)?.innerHTML) return;
    if (elementId === "craftingTree" && newHTML === lastTreeHTML) return;
    if (elementId === "rawSummary" && newHTML === lastRawHTML) return;

    document.getElementById(elementId).innerHTML = newHTML;
    if (elementId === "craftingTree") lastTreeHTML = newHTML;
    if (elementId === "rawSummary") lastRawHTML = newHTML;
}

// Update Crafting tree material table on dropdown change
function updateMaterialsTableNow() {
    debouncedCalcRun();
    // Force second pass to ensure warehouse usage is reflected
    requestAnimationFrame(() => Calculator.run());
}

// Save discount when changed
document.getElementById("discountAmount")?.addEventListener("input", async (e) => {
    const amount = parseFloat(e.target.value) || 0;
    App.state.orderDiscount.amount = amount;
    await App.save("orderDiscount");
    debouncedCalcRun();
});

document.getElementById("discountReason")?.addEventListener("input", async (e) => {
    App.state.orderDiscount.reason = e.target.value.trim();
    await App.save("orderDiscount");
    debouncedCalcRun();
});