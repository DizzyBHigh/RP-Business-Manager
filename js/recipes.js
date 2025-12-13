// NEW: Helper to force Proper Case (CamelCase) for recipe names
function toProperCase(str) {
    return str
        .toLowerCase()
        .replace(/(^|\s|-)\w/g, letter => letter.toUpperCase())
        .replace(/#/g, ' #'); // Preserve # in "Christmas #1"
}

// ==========================
// Recipe Manager / Editor — NOW WITH WEIGHT PER FINISHED ITEM
// ==========================
const RecipeEditor = {
    addRow(mode) {
        const cont = document.getElementById(mode + "Ingredients");
        const row = document.createElement("div");
        row.className = "ingredient-row";
        row.innerHTML = `
            <div class="searchable-select">
                <input type="text" placeholder="Ingredient" oninput="RecipeEditor.filterIng(this)">
                <div class="options"></div>
            </div>
            <input type="number" value="1" min="1" style="width:80px;">
            <button class="danger small" onclick="this.parentNode.remove()">Remove</button>`;
        cont.appendChild(row);
    },

    filterRecipes(val) {
        val = val.toLowerCase().trim();
        const tbody = document.getElementById("recipeTableBody");
        if (!tbody) return;

        const recipes = App.state.recipes || {};
        const items = Object.keys(recipes).sort();

        let visible = 0;
        const fragment = document.createDocumentFragment();

        items.forEach(item => {
            if (val && !item.toLowerCase().includes(val)) return;

            visible++;

            const recipe = recipes[item];
            const yieldAmt = Number(recipe.y) || 1;
            const weight = Number(recipe.weight) || 0;
            const costPrice = Calculator.cost(item) || 0;

            // BUILD INGREDIENTS LIST WITH COSTS
            let ingredientsList = "—";
            if (recipe.i && Object.keys(recipe.i).length > 0) {
                ingredientsList = Object.entries(recipe.i)
                    .map(([ing, qty]) => {
                        const ingCost = Calculator.cost(ing) || 0;
                        const totalCost = (ingCost * qty).toFixed(2);
                        return `${qty}× ${ing} ($${totalCost})`;
                    })
                    .join("<br>");
            }

            const row = document.createElement("tr");
            row.innerHTML = `
                <td style="padding:12px; text-align:left;">${item}</td>
                <td style="padding:12px; text-align:center;">${yieldAmt}</td>
                <td style="padding:12px; text-align:center;">${weight.toFixed(2)}</td>      
                <td style="padding:12px; font-size:13px; line-height:1.6;">${ingredientsList}</td>
                <td style="padding:12px; text-align:center;">$${costPrice.toFixed(2)}</td>
                <td style="padding:12px; text-align:center;">
                    <div style="display:flex; gap:8px; align-items:center; justify-content:center;">
                        <input type="number" min="1" value="1" style="width:60px; padding:6px;" id="qty_${item.replace(/ /g, '_')}">
                        <button onclick="Inventory.addToOrder('${item}', document.getElementById('qty_${item.replace(/ /g, '_')}').value)" 
                                style="padding:8px 16px; background:#0f8; color:black; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
                            Add to Order
                        </button>
                        <button onclick="RecipeEditor.load('${item}')" 
                                style="padding:8px 16px; background:#0af; color:black; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
                            Edit
                        </button>
                        <button onclick="RecipeEditor.load('${item}', true)" 
                                style="padding:8px 16px; background:#fa5; color:black; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
                            Duplicate
                        </button>
                    </div>
                </td>
            `;
            fragment.appendChild(row);
        });

        tbody.innerHTML = "";
        tbody.appendChild(fragment);

        // Show/hide "no results" message
        const noRecipes = document.getElementById("noRecipes");
        if (noRecipes) {
            noRecipes.style.display = visible === 0 ? "block" : "none";
            noRecipes.textContent = val ? "No recipes match your search" : "No recipes yet";
        }
    },

    filterIng(input) {
        const val = String(input.value || "").toLowerCase().trim();
        const results = input.parentNode.querySelector(".options");
        if (!results) return; // safety

        results.innerHTML = "";
        results.style.display = val ? "block" : "none";
        if (!val) return;

        App.allItems()
            .filter(i => i.toLowerCase().includes(val))
            .slice(0, 15)
            .forEach(i => {
                const div = document.createElement("div");
                div.className = "category-item";
                div.textContent = i;
                div.onclick = () => {
                    input.value = i;
                    results.style.display = "none";
                    input.focus(); // nice touch
                };
                results.appendChild(div);
            });
    },

    create() {
        const name = sanitizeItemName(document.getElementById("newItemName").value.trim());
        if (!name || App.state.recipes[name]) return showToast("fail", "Invalid or duplicate name!");

        // NEW: Force Proper Case for new recipe name
        const properName = toProperCase(name);
        document.getElementById("newItemName").value = properName; // Update UI

        const ingredients = {};
        document.querySelectorAll("#newIngredients .ingredient-row").forEach(r => {
            const ing = r.querySelector("input[type=text]").value.trim();
            const qty = parseInt(r.querySelector("input[type=number]").value) || 1;
            if (ing) ingredients[ing] = qty;
        });

        const yield = parseInt(document.getElementById("newItemYield").value) || 1;
        const weightInput = document.getElementById("newItemWeight");
        const weight = weightInput ? parseFloat(weightInput.value) : 0;
        const safeWeight = isNaN(weight) ? 0 : weight;

        App.state.recipes[properName] = {
            i: ingredients,
            y: yield,
            weight: safeWeight
        };

        App.save("recipes");
        App.refresh();
        debouncedCalcRun();

        showToast("success", `"${properName}" created with ${safeWeight.toFixed(2)} kg weight!`);

        // Reset
        document.getElementById("newItemName").value = "";
        document.getElementById("newItemYield").value = "1";
        if (weightInput) weightInput.value = "0.00";
        document.getElementById("newIngredients").innerHTML = "";
        this.addRow("new");
        //safeRender();
        RecipeEditor.renderRecipeTable();
    },

    load(name, isDuplicating = false) {
        if (!name || !App.state.recipes[name]) return;

        const r = App.state.recipes[name];
        const editArea = document.getElementById("editArea");
        editArea.style.display = "block";

        // Clone the create form
        editArea.innerHTML = document.getElementById("createRecipeForm").outerHTML
            .replace(/createRecipeForm/g, "editRecipeForm")
            .replace(/Create New Recipe/g, isDuplicating
                ? `Duplicating: <span style="color:#ff0; font-weight:bold;">${name}</span>`
                : `Editing: <span style="color:#ff0; font-weight:bold;">${name}</span>`)
            .replace(/newItemName/g, "editItemName")
            .replace(/newItemYield/g, "editYield")
            .replace(/newItemWeight/g, "editWeight")
            .replace(/newIngredients/g, "editIngredients")
            .replace(/RecipeEditor\.addRow\('new'\)/g, "RecipeEditor.addRow('edit')");

        // REMOVE CREATE BUTTON
        const createBtn = editArea.querySelector('button[onclick*="RecipeEditor.create()"]');
        if (createBtn) createBtn.closest('div').remove();

        // INSERT ACTION BUTTONS — HIDE DELETE & DUPLICATE WHEN DUPLICATING
        const ingredientsBox = editArea.querySelector("div[style*='background:#000814']");
        if (ingredientsBox) {
            const buttonRow = document.createElement("div");
            buttonRow.style.cssText = "margin-top:28px; display:flex; gap:16px; justify-content:center; flex-wrap:wrap;";

            const deleteBtn = isDuplicating ? '' : `
                <button onclick="RecipeEditor.del()" style="flex:1; min-width:220px; padding:16px 24px; background:#aa0000; color:white; font-weight:bold; font-size:19px; border:none; border-radius:12px; cursor:pointer;">
                    DELETE RECIPE
                </button>`;

            const duplicateBtn = isDuplicating ? '' : `
                <button onclick="RecipeEditor.duplicate()" style="flex:1; min-width:220px; padding:16px 24px; background:#cc7700; color:white; font-weight:bold; font-size:19px; border:none; border-radius:12px; cursor:pointer;">
                    DUPLICATE RECIPE
                </button>`;

            buttonRow.innerHTML = `
                <button onclick="RecipeEditor.save()" style="flex:1; min-width:220px; padding:16px 24px; background:#00aa00; color:white; font-weight:bold; font-size:19px; border:none; border-radius:12px; cursor:pointer;">
                    ${isDuplicating ? 'CREATE NEW RECIPE' : 'SAVE CHANGES'}
                </button>
                <button onclick="RecipeEditor.cancel()" style="padding:16px 40px; background:#666; color:white; font-weight:bold; font-size:18px; border:none; border-radius:12px;">
                    CANCEL
                </button>
                ${deleteBtn}
                ${duplicateBtn}
            `;
            ingredientsBox.after(buttonRow);
        }

        // POPULATE FIELDS
        const nameField = document.getElementById("editItemName");
        nameField.value = isDuplicating ? name + " (Copy)" : name;
        if (isDuplicating) {
            nameField.focus();
            nameField.select();
        }

        document.getElementById("editYield").value = r.y || 1;
        document.getElementById("editWeight").value = (r.weight || 0).toFixed(2);

        // Populate ingredients
        const container = document.getElementById("editIngredients");
        container.innerHTML = "";
        Object.entries(r.i || {}).forEach(([ing, qty]) => {
            RecipeEditor.addRow("edit");
            const rows = container.querySelectorAll(".ingredient-row");
            const last = rows[rows.length - 1];
            last.querySelector("input[type=text]").value = ing;
            last.querySelector("input[type=number]").value = qty;
        });
        document.getElementById("editArea").scrollIntoView({ behavior: "instant", block: "start" });
        refreshAllStockLists();
    },

    duplicate() {
        // Get the current recipe name from the edit form
        const nameField = document.getElementById("editItemName");
        if (!nameField || !nameField.value.trim()) {
            return showToast("fail", "No recipe loaded to duplicate!");
        }

        const currentName = nameField.value.trim();

        if (!App.state.recipes[currentName]) {
            return showToast("fail", "Recipe not found!");
        }

        // Change title to show we're duplicating
        const title = document.querySelector("#editArea h2") || document.querySelector("#editArea strong");
        if (title) {
            title.innerHTML = `Duplicating: <span style="color:#ff0; font-weight:bold;">${currentName}</span> → Edit and Save as New`;
        }

        // Pre-fill name with "(Copy)" and select it
        nameField.value = currentName + " (Copy)";
        nameField.focus();
        nameField.select(); // highlights the text so user can type new name immediately

        // Hide Delete button (doesn't exist yet)
        const deleteBtn = document.querySelector('#editArea button[onclick*="RecipeEditor.del()"]');
        if (deleteBtn) deleteBtn.style.display = "none";

        // Change Save button text
        const saveBtn = document.querySelector('#editArea button[onclick="RecipeEditor.save()"]');
        if (saveBtn) saveBtn.textContent = "CREATE NEW RECIPE";
        document.getElementById("editArea").scrollIntoView({ behavior: "instant", block: "start" });
        showToast("success", `"${currentName}" loaded for duplication — edit and click CREATE NEW RECIPE`);
    },

    duplicateFromList(itemName) {
        // Exactly the same as clicking "Edit" — just loads the recipe into the form
        this.load(itemName);

        // Pre-fill the name with "(Copy)" so it's ready to rename
        const nameField = document.getElementById("editItemName");
        if (nameField) {
            nameField.value = itemName + " (Copy)";
            nameField.focus();
            nameField.select(); // highlights the text so user can type new name immediately
        }

        showToast("success", `"${itemName}" loaded for duplication — edit and save as new recipe`);
    },

    save() {
        const originalName = document.getElementById("recipeSearch")?.value.trim() || "";
        const newNameRaw = document.getElementById("editItemName")?.value.trim();
        if (!newNameRaw) return showToast("fail", "Recipe name required!");

        const properNewName = toProperCase(sanitizeItemName(newNameRaw));
        if (!properNewName) return showToast("fail", "Invalid recipe name!");

        // === CHECK FOR DUPLICATE NAME (but allow same name when editing) ===
        const nameExists = App.state.recipes[properNewName] && properNewName !== originalName;

        if (nameExists) {
            // Ask for confirmation before overwriting
            showConfirm(`A recipe named "${properNewName}" already exists.<br><br>Overwrite it?`,
                () => this.performSave(properNewName, originalName),
                () => showToast("info", "Save cancelled – no changes made")
            );
            return;
        }

        // No conflict – save immediately
        this.performSave(properNewName, originalName);
    },

    // Helper method to do the actual save (keeps code clean and avoids duplication)
    performSave(properNewName, originalName) {
        // Build recipe
        const ingredients = {};
        document.querySelectorAll("#editIngredients .ingredient-row").forEach(r => {
            const ing = r.querySelector("input[type=text]").value.trim();
            const qty = parseInt(r.querySelector("input[type=number]").value) || 1;
            if (ing) ingredients[ing] = qty;
        });

        const recipe = {
            i: ingredients,
            y: parseInt(document.getElementById("editYield").value) || 1,
            weight: parseFloat(document.getElementById("editWeight").value) || 0
        };

        // Only delete old name if it's different and valid
        if (originalName && originalName !== properNewName) {
            SHARED_DOC_REF.update({
                [`recipes.${originalName}`]: firebase.firestore.FieldValue.delete()
            }).catch(err => console.warn("Failed to delete old recipe name:", err));
        }

        // Save new/updated recipe
        App.state.recipes[properNewName] = recipe;
        App.save("recipes");

        // Clean up UI
        document.getElementById("editArea").style.display = "none";
        document.getElementById("recipeSearch").value = properNewName;

        showToast("success", `"${properNewName}" saved!`);
        RecipeEditor.renderRecipeTable();
    },

    async del() {
        const nameField = document.getElementById("editItemName");
        if (!nameField) return showToast("fail", "No recipe loaded!");

        const name = nameField.value.trim();
        if (!name) return showToast("fail", "No recipe name to delete!");

        const ok = await showConfirm(`Permanently delete "${name}"? This cannot be undone.`);
        if (!ok) return;

        // Remove from local state
        delete App.state.recipes[name];

        // Safe delete from Firestore (only if name exists)
        try {
            await SHARED_DOC_REF.update({
                [`recipes.${name}`]: firebase.firestore.FieldValue.delete()
            });
            console.log("Recipe deleted:", name);
        } catch (err) {
            console.warn("Failed to delete from Firestore (may already be gone):", err);
        }

        App.refresh();
        debouncedCalcRun();

        document.getElementById("editArea").style.display = "none";
        document.getElementById("recipeSearch").value = "";

        showToast("success", `"${name}" deleted`);
        RecipeEditor.renderRecipeTable();
    },

    cancel() {
        // Clear the form
        document.getElementById("editArea").innerHTML = "";
        document.getElementById("editArea").style.display = "none";

        // Clear any current editing state
        this.currentEditing = null;

        // Refresh the table to show we're back to list view
        RecipeEditor.render();

        showToast("info", "Edit cancelled");
    },

    showCreateForm() {
        const section = document.getElementById("createRecipeSection");
        if (section) {
            section.style.display = "block";

            // Scroll to it
            section.scrollIntoView({ behavior: "smooth", block: "start" });

            // Focus the name field
            document.getElementById("newItemName")?.focus();
        }
    },

    cancelCreate() {
        const section = document.getElementById("createRecipeSection");
        if (section) {
            section.style.display = "none";
        }
        // Clear all fields in the Create New form
        document.getElementById("newItemName").value = "";
        document.getElementById("newItemYield").value = "1";
        const weightInput = document.getElementById("newItemWeight");
        if (weightInput) weightInput.value = "0.00";

        // Clear ingredients
        document.getElementById("newIngredients").innerHTML = "";
        this.addRow("new"); // add one empty row back

        showToast("info", "Create cancelled — form cleared");
    },

    renderRecipeTable() {
        const tbody = document.getElementById("recipeTableBody");
        const noRecipes = document.getElementById("noRecipes");
        if (!tbody || !noRecipes) return;

        const recipes = App.state.recipes || {};
        const items = Object.keys(recipes).sort();

        if (items.length === 0) {
            tbody.innerHTML = "";
            noRecipes.style.display = "block";
            return;
        }

        noRecipes.style.display = "none";

        const fragment = document.createDocumentFragment();

        items.forEach(item => {
            const recipe = recipes[item];
            const yieldAmt = Number(recipe.y) || 1;
            const weight = Number(recipe.weight) || 0;

            // CALCULATE TOTAL COST PRICE
            const costPrice = Calculator.cost(item) || 0;

            // BUILD INGREDIENTS LIST WITH COSTS
            let ingredientsList = "—";
            if (recipe.i && Object.keys(recipe.i).length > 0) {
                ingredientsList = Object.entries(recipe.i)
                    .map(([ing, qty]) => {
                        const ingCost = Calculator.cost(ing) || 0;
                        const totalCost = (ingCost * qty).toFixed(2);
                        return `${qty}× ${ing} ($${totalCost})`;
                    })
                    .join("<br>");
            }

            const row = document.createElement("tr");
            // === DARKER ROW IF NO WEIGHT SET ===
            if (weight === 0) {

                row.style.background = "#0d1117";
                row.style.borderLeft = "4px solid #0af";

            } else {
                row.style.background = "rgba(0, 170, 255, 0.08)";
            }

            row.innerHTML = `
                <td style="padding:12px; text-align:left;">${item}</td>
                <td style="padding:12px; text-align:center;">${yieldAmt}</td>
                <td style="padding:12px; text-align:center;">${weight.toFixed(2)}</td>      
                <td style="padding:12px; font-size:13px; line-height:1.6;">${ingredientsList}</td>
                <td style="padding:12px; text-align:center; font-weight:bold;">$${costPrice.toFixed(2)}</td>
                <td style="padding:12px; text-align:center;">
                    <div style="display:flex; gap:8px; align-items:center; justify-content:center;">
                        <input type="number" min="1" value="1" style="width:60px; padding:6px;" id="qty_${item.replace(/ /g, '_')}">
                        <button onclick="Inventory.addToOrder('${item}', document.getElementById('qty_${item.replace(/ /g, '_')}').value)" 
                                style="padding:8px 16px; background:#0f8; color:black; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
                            Add to Order
                        </button>
                        <button onclick="RecipeEditor.load('${item}')" 
                                style="padding:8px 16px; background:#0af; color:black; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
                            Edit
                        </button>
                        <button onclick="RecipeEditor.load('${item}', true)" 
                                style="padding:8px 16px; background:#fa5; color:black; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
                            Duplicate
                        </button>
                    </div>
                </td>
            `;
            fragment.appendChild(row);
        });

        tbody.innerHTML = "";
        tbody.appendChild(fragment);
    },

    // Auto-fix ledger entries to match proper-cased recipe names
    fixLedgerCases() {
        const toProperCase = (str) => str
            .toLowerCase()
            .replace(/(^|\s|-)\w/g, l => l.toUpperCase())
            .replace(/#/g, ' #');

        let fixed = 0;
        App.state.ledger = App.state.ledger.map(entry => {
            if (entry.type !== "shop_sale_item") return entry;

            const properName = toProperCase(entry.item);
            if (properName !== entry.item) {
                entry.item = properName;
                fixed++;
            }
            return entry;
        });

        if (fixed > 0) {
            App.save("ledger").then(() => {
                console.log(`Auto-fixed ${fixed} ledger entries`);
                showToast("info", `Auto-fixed ${fixed} sales entries`);
                ShopSales.render();
                Ledger.render?.();
            });
        }
    }
};

// AUTO-FIX: Proper Case for Recipe Names — SAFE & RELIABLE
(function safeAutoFixRecipeNames() {
    const toProperCase = (str) => str
        .toLowerCase()
        .replace(/(^|\s|-)\w/g, l => l.toUpperCase())
        .replace(/#/g, ' #');

    // Wait for App to be ready
    const tryFix = () => {
        if (typeof App === 'undefined' || !App.state || !App.state.recipes) {
            // App not ready yet — try again in 200ms
            setTimeout(tryFix, 200);
            return;
        }

        let fixed = 0;
        const newRecipes = {};

        Object.keys(App.state.recipes).forEach(oldName => {
            const properName = toProperCase(oldName);
            if (properName !== oldName) {
                console.log(`Auto-fixed recipe: "${oldName}" → "${properName}"`);
                fixed++;
            }
            newRecipes[properName] = App.state.recipes[oldName];
        });

        if (fixed > 0) {
            App.state.recipes = newRecipes;
            App.save("recipes").then(() => {
                console.log(`Auto-fixed ${fixed} recipe names!`);
                showToast("info", `Auto-fixed ${fixed} recipe names`);
                if (typeof RecipeEditor !== 'undefined' && RecipeEditor.renderRecipeTable) {
                    RecipeEditor.renderRecipeTable();
                }
                if (typeof RecipeEditor !== 'undefined' && RecipeEditor.fixLedgerCases) {
                    RecipeEditor.fixLedgerCases();
                }
            });
        }
    };

    // Start checking
    tryFix();
})();