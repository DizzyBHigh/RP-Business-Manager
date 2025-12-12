console.log("Crops module loaded");

const Crops = {
    // Temp state for form
    currentIngredients: [],

    // Render Seeds Table
    renderSeeds() {
        const tbody = document.getElementById('seedsTableBody');
        if (!tbody) return;

        let html = '';
        const seeds = App.state.seeds || {};
        const warehouse = App.state.warehouseStock || {};
        const shop = App.state.shopStock || {};

        Object.entries(seeds).sort(([a], [b]) => a.localeCompare(b)).forEach(([seedName, data]) => {
            const seedInWarehouse = warehouse[seedName] || 0;
            const seedInShop = shop[seedName] || 0;
            const seedTotal = seedInWarehouse + seedInShop;

            const productInWarehouse = warehouse[data.finalProduct] || 0;
            const productInShop = shop[data.finalProduct] || 0;
            const productTotal = productInWarehouse + productInShop;

            html += `
            <tr style="border-bottom:1px solid #333;">
                <td style="padding:12px;"><strong>${seedName}</strong></td>
                <td style="padding:12px; text-align:center;">${data.weight.toFixed(2)}kg</td>
                <td style="padding:12px; text-align:center; font-weight:bold;">
                    <div style="color:${seedTotal > 0 ? '#0f8' : '#f66'};">
                        ${seedTotal}
                    </div>
                    <small style="color:#888;">
                        ${seedInWarehouse} wh | ${seedInShop} shop
                    </small>
                </td>
                <td style="padding:12px; text-align:center;">$${data.price.toFixed(2)}</td>
                <td style="padding:12px;"><strong>${data.finalProduct}</strong></td>
                <td style="padding:12px; text-align:center;">${data.finalWeight.toFixed(2)}kg</td>
                <td style="padding:12px; text-align:center; font-weight:bold;">
                    <div style="color:${productTotal > 0 ? '#0f8' : '#f66'};">
                        ${productTotal}
                    </div>
                    <small style="color:#888;">
                        ${productInWarehouse} wh | ${productInShop} shop
                    </small>
                </td>
                <td style="padding:12px; text-align:center;">
                    <button class="primary small" onclick="Crops.editSeed('${seedName}')" 
                            style="margin:0 4px; padding:6px 12px;">
                        Edit
                    </button>
                    <button class="danger small" onclick="Crops.deleteSeed('${seedName}')" 
                            style="margin:0 4px; padding:6px 12px;">
                        Delete
                    </button>
                </td>
            </tr>
        `;
        });

        tbody.innerHTML = html || `
        <tr>
            <td colspan="8" style="text-align:center; color:#888; padding:50px; font-size:16px;">
                No seeds defined yet<br>
                <small>Add seeds above to get started</small>
            </td>
        </tr>
    `;
    },

    // Add/Update Seed
    async addSeed() {
        const rawSeedName = document.getElementById('seedName')?.value.trim();
        const rawProductName = document.getElementById('finalProduct')?.value.trim();

        if (!rawSeedName || !rawProductName) {
            return showToast("fail", "Both Seed Name and Final Product are required");
        }

        // Normalize to Title Case
        const formatName = (str) => str
            .toLowerCase()
            .split(/[\s_-]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        const seedName = formatName(rawSeedName);
        const productName = formatName(rawProductName);

        const price = parseFloat(document.getElementById('seedPrice').value) || 0;
        const weight = parseFloat(document.getElementById('seedWeight').value) || 0;
        const finalWeight = parseFloat(document.getElementById('finalWeight').value) || 0;

        // === CHECK IF WE'RE EDITING (seedName already exists) ===
        const isEditing = App.state.seeds?.[seedName] !== undefined;
        const oldData = isEditing ? App.state.seeds[seedName] : null;

        // === DUPLICATE CHECKS (skip current seed when editing) ===
        if (!isEditing && App.state.seeds?.[seedName]) {
            return showToast("fail", `Seed "${seedName}" already exists!`);
        }

        // Check if product name is used by another seed
        const productConflict = Object.entries(App.state.seeds || {}).some(([name, data]) => {
            return name !== seedName && data.finalProduct === productName;
        });
        if (productConflict) {
            return showToast("fail", `Product "${productName}" is already produced by another seed!`);
        }

        // === SAVE SEED ===
        App.state.seeds[seedName] = {
            price,
            weight,
            finalProduct: productName,
            finalWeight
        };

        // === UPDATE rawPrice SAFELY ===
        if (!App.state.rawPrice) App.state.rawPrice = {};
        App.state.rawPrice[seedName] = price;
        App.state.rawPrice[productName] = 0;

        // Initialize stock
        if (!App.state.warehouseStock) App.state.warehouseStock = {};
        App.state.warehouseStock[seedName] = App.state.warehouseStock[seedName] || 0;
        App.state.warehouseStock[productName] = App.state.warehouseStock[productName] || 0;

        // === SAVE TO FIREBASE ===
        try {
            await Promise.all([
                App.save("seeds"),
                App.save("rawPrice"),
                App.save("warehouseStock")
            ]);

            document.getElementById('seedForm')?.reset();
            Crops.renderSeeds();
            Inventory.render?.();

            const action = isEditing ? "updated" : "added";
            showToast("success",
                `Seed <strong>${seedName}</strong> ${action}!<br>
             Produces: <strong>${productName}</strong>`
            );
        } catch (err) {
            console.error("Save failed:", err);
            showToast("fail", "Failed to save — check internet");
        }
    },

    // Edit Seed (populate form)
    editSeed(name) {
        Crops.showAddForm(name);
        const data = App.state.seeds[name];
        if (!data) return showToast("fail", "Seed not found");

        // Set form values
        document.getElementById('seedName').value = name;
        document.getElementById('seedPrice').value = data.price;
        document.getElementById('seedWeight').value = data.weight;
        document.getElementById('finalProduct').value = data.finalProduct;
        document.getElementById('finalWeight').value = data.finalWeight;

        showToast("info", `Editing <strong>${name}</strong> — change values and click "Add / Update Seed"`);
    },

    // Delete Seed
    deleteSeed(name) {
        if (!confirm(`Delete seed "${name}"? This removes all data.`)) return;
        delete App.state.seeds[name];
        App.save("seeds");
        this.renderSeeds();
        showToast("success", "Seed deleted");
    },
    showAddForm(seedName = null) {
        const container = document.getElementById('seedFormContainer');
        const title = document.getElementById('seedFormTitle');

        if (!container || !title) return;

        if (seedName) {
            const data = App.state.seeds[seedName];
            if (!data) return showToast("fail", "Seed not found");

            document.getElementById('seedName').value = seedName;
            document.getElementById('seedPrice').value = data.price;
            document.getElementById('seedWeight').value = data.weight;
            document.getElementById('finalProduct').value = data.finalProduct;
            document.getElementById('finalWeight').value = data.finalWeight;

            title.textContent = `Edit Seed: ${seedName}`;
        } else {
            document.getElementById('seedForm')?.reset();
            title.textContent = "Add New Seed";
        }

        container.style.display = "block";
        container.scrollIntoView({ behavior: "smooth" });
    },

    hideAddForm() {
        const container = document.getElementById('seedFormContainer');
        if (container) {
            container.style.display = "none";
            document.getElementById('seedForm')?.reset();
        }
    },

    setupIngredientSearch() {
        const searchInput = document.getElementById('ingredientSearch');
        const dropdown = document.getElementById('ingredientDropdown');
        if (!searchInput || !dropdown) return;

        // GET ALL POSSIBLE INGREDIENTS — INCLUDING WOOL, FERTILIZER, ETC.
        const rawItems = Object.keys(App.state.rawPrice || {});
        const craftedItems = Object.keys(App.state.recipes || {});
        const warehouseItems = Object.keys(App.state.warehouseStock || {});

        // Merge and dedupe — this includes Wool, Fertilizer, Water, etc.
        const allItems = [...new Set([...rawItems, ...craftedItems, ...warehouseItems])].sort();

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            if (query.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            const matches = allItems
                .filter(item => item.toLowerCase().includes(query))
                .slice(0, 15);

            if (matches.length === 0) {
                dropdown.innerHTML = '<div style="padding:12px; color:#888;">No items found</div>';
            } else {
                dropdown.innerHTML = matches.map(item => `
                    <div onclick="Crops.selectIngredient('${item}')" 
                         style="padding:12px; cursor:pointer; border-bottom:1px solid #333; background:#1a1a1a;"
                         onmouseover="this.style.background='#333'" 
                         onmouseout="this.style.background='#1a1a1a'">
                        ${item}
                    </div>
                `).join('');
            }
            dropdown.style.display = 'block';
        });

        // Hide on click outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    },

    selectIngredient(name) {
        document.getElementById('ingredientSearch').value = name;
        document.getElementById('ingredientDropdown').style.display = 'none';
        document.getElementById('ingredientQty').focus();
    },



    // Populate dropdowns for Harvests tab
    populateDropdowns() {
        // Seed select
        const seedSelect = document.getElementById('harvestSeed');
        if (seedSelect) {
            seedSelect.innerHTML = '<option value="">Select Seed</option>' +
                Object.keys(App.state.seeds || {}).map(name => `<option value="${name}">${name} → ${App.state.seeds[name].finalProduct}</option>`).join('');
        }

        // Ingredient select (all items: raw + recipes)
        const ingSelect = document.getElementById('ingredientName');
        if (ingSelect) {
            const allItems = App.allItems();  // Assuming this exists from your app
            ingSelect.innerHTML = '<option value="">Select Ingredient</option>' +
                allItems.map(item => `<option value="${item}">${item}</option>`).join('');
        }
        Crops.setupIngredientSearch();
    },

    // Add Ingredient to Harvest
    addIngredient() {
        // GET VALUE FROM THE SEARCH INPUT (not the hidden select!)
        const searchValue = document.getElementById('ingredientSearch')?.value.trim();
        const qtyInput = document.getElementById('ingredientQty');
        const qty = parseInt(qtyInput?.value) || 0;

        if (!searchValue) {
            showToast("fail", "Please select or type an ingredient");
            return;
        }
        if (qty <= 0) {
            showToast("fail", "Quantity must be greater than 0");
            qtyInput?.focus();
            return;
        }

        // Check if ingredient already exists
        const exists = this.currentIngredients.some(i => i.name === searchValue);
        if (exists) {
            showToast("fail", `${searchValue} already added`);
            return;
        }

        // Add it
        this.currentIngredients.push({ name: searchValue, qty });

        // Update list
        const list = document.getElementById('ingredientsList');
        if (list) {
            list.innerHTML = this.currentIngredients.map((ing, idx) => `
            <li style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#222; margin:6px 0; border-radius:8px; border:1px solid #444;">
                <span><strong>${ing.qty}× ${ing.name}</strong></span>
                <button class="danger small" onclick="Crops.removeIngredient(${idx})" style="margin-left:10px;">Remove</button>
            </li>
        `).join('') || '<em style="color:#666;">No ingredients added yet</em>';
        }

        // Clear inputs
        document.getElementById('ingredientSearch').value = '';
        document.getElementById('ingredientQty').value = '';
        document.getElementById('ingredientSearch').focus();

        showToast("success", `${qty}× ${searchValue} added`);
    },

    // Remove Ingredient
    removeIngredient(idx) {
        this.currentIngredients.splice(idx, 1);
        this.addIngredient();  // Re-render list
    },

    // Complete Harvest
    async completeHarvest() {
        const seedName = document.getElementById('harvestSeed')?.value.trim();
        const seedsUsed = parseInt(document.getElementById('seedsToPlant').value) || 0;
        const yieldQty = parseInt(document.getElementById('harvestYield').value) || 0;

        if (!seedName || seedsUsed <= 0 || yieldQty <= 0 || this.currentIngredients.length === 0) {
            return showToast("fail", "All fields required");
        }

        const seedData = App.state.seeds[seedName];
        if (!seedData) return showToast("fail", "Seed not found");

        const currentSeeds = App.state.warehouseStock[seedName] || 0;
        if (currentSeeds < seedsUsed) return showToast("fail", `Only ${currentSeeds} ${seedName} available`);

        // === TOTAL COST CALCULATION — THIS IS THE FIX ===
        let totalCost = 0;

        // Add seed cost
        totalCost += seedsUsed * (seedData.price || 0);

        // Add ingredient costs — handles both formats
        this.currentIngredients.forEach(ing => {
            let price = 0;
            const rawItem = App.state.rawPrice?.[ing.name];

            if (rawItem) {
                // Handle both { price: 0.40 } and 0.40
                price = typeof rawItem === 'object' ? (rawItem.price || 0) : rawItem;
            } else {
                // Fallback to Calculator.cost() for crafted items
                price = Calculator.cost(ing.name) || 0;
            }

            totalCost += ing.qty * price;

            // Deduct from warehouse
            App.state.warehouseStock[ing.name] = Math.max(0,
                (App.state.warehouseStock[ing.name] || 0) - ing.qty
            );
        });

        const costPerUnit = yieldQty > 0 ? totalCost / yieldQty : 0;

        // Update real stock
        App.state.warehouseStock[seedName] -= seedsUsed;
        App.state.warehouseStock[seedData.finalProduct] =
            (App.state.warehouseStock[seedData.finalProduct] || 0) + yieldQty;

        // Save harvest
        const harvest = {
            id: `HARV-${Date.now()}`,
            date: new Date().toISOString().slice(0, 10),
            seed: seedName,
            seedsUsed,
            ingredients: [...this.currentIngredients],
            yield: yieldQty,
            product: seedData.finalProduct,
            totalCost: Number(totalCost.toFixed(2)),
            costPerUnit: Number(costPerUnit.toFixed(4))
        };

        App.state.harvests.unshift(harvest);
        App.save("harvests");
        App.save("warehouseStock");

        // Reset form
        this.currentIngredients = [];
        document.getElementById('ingredientsList').innerHTML = '<em style="color:#666;">No ingredients added yet</em>';
        document.getElementById('harvestForm')?.reset();

        // === HARVEST COST — SUBTRACTS FROM BALANCE ===
        const now = new Date();
        const harvestId = `HARV-${now.getTime()}`;
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 8);

        const harvestExpense = {
            id: harvestId,
            date: dateStr,
            time: timeStr,
            type: "harvest_cost",
            item: `${seedData.finalProduct} Harvest`,
            qty: yieldQty,
            unitPrice: Number(costPerUnit.toFixed(4)),
            total: -Number(totalCost.toFixed(2)),     // NEGATIVE = EXPENSE
            amount: -Number(totalCost.toFixed(2)),    // This is what your balance uses
            taxAmount: 0,
            profit: -Number(totalCost.toFixed(2)),    // Reduces profit
            employee: App.state.currentEmployee || "Harvest",
            description: `Harvest Expense: ${yieldQty}×${seedData.finalProduct} | ` +
                `Cost: $${totalCost.toFixed(2)} (${costPerUnit.toFixed(4)}/unit) | ` +
                `${seedsUsed}×${seedName} + ${this.currentIngredients.map(i => `${i.qty}×${i.name}`).join(', ')}`
        };

        App.state.ledger.push(harvestExpense);
        await App.save("ledger");

        Crops.renderHarvests();
        Inventory.render?.();

        showToast("success",
            `Harvest Complete!<br>
         ${yieldQty}× ${seedData.finalProduct}<br>
         Total Cost: <strong>$${totalCost.toFixed(2)}</strong><br>
         Cost/Unit: <strong>$${costPerUnit.toFixed(4)}</strong>`
        );
    },
    getAverageCostPerUnit(productName) {
        const harvests = App.state.harvests || [];
        const relevant = harvests
            .filter(h => h.product === productName && h.costPerUnit > 0);

        if (relevant.length === 0) return 0;

        const sum = relevant.reduce((total, h) => total + h.costPerUnit, 0);
        return sum / relevant.length;
    },

    // Render Harvests History
    renderHarvests() {
        const tbody = document.getElementById('harvestsTableBody');
        if (!tbody) return;

        const harvests = (App.state.harvests || []).sort((a, b) => b.date.localeCompare(a.date));
        let html = '';
        harvests.forEach(h => {
            html += `
                <tr style="border-bottom:1px solid #333;">
                    <td style="color:#888;">${h.date}</td>
                    <td><strong>${h.seed}</strong></td>
                    <td style="text-align:center;">${h.seedsUsed}</td>
                    <td style="font-size:12px;">${h.ingredients.map(i => `${i.qty}×${i.name}`).join('<br>')}</td>
                    <td style="text-align:center; font-weight:bold;">${h.yield}</td>
                    <td style="text-align:right; color:var(--green);">$${h.totalCost.toFixed(2)}</td>
                    <td style="text-align:right; color:#ff9800;">$${h.costPerUnit.toFixed(2)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center; color:#888; padding:40px;">No harvests recorded yet</td></tr>';
    }
};



// Expose globally (matching your pattern)
window.Crops = Crops;
Crops.renderSeeds