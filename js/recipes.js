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
                        <button onclick="RecipeEditor.duplicateFromList('${item}')" 
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
        const opts = input.parentNode.querySelector(".options");
        opts.innerHTML = "";
        opts.style.display = val ? "block" : "none";
        if (!val) return;

        App.allItems()
            .filter(i => i.toLowerCase().includes(val))
            .slice(0, 15)
            .forEach(i => {
                const d = document.createElement("div");
                d.className = "category-item";
                d.textContent = i;
                d.onclick = () => {
                    input.value = i;
                    opts.style.display = "none";
                    input.focus(); // nice touch
                };
                opts.appendChild(d);
            });
    },
    create() {
        const name = sanitizeItemName(document.getElementById("newItemName").value.trim());
        if (!name || App.state.recipes[name]) return showToast("fail,", "Invalid or duplicate name!");

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

        App.state.recipes[name] = {
            i: ingredients,
            y: yield,
            weight: safeWeight
        };

        App.save("recipes");
        App.refresh();
        debouncedCalcRun();

        showToast("success", `"${name}" created with ${safeWeight.toFixed(2)} kg weight!`);

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
        nameField.select();

        // Hide Delete button (doesn't exist yet)
        const deleteBtn = document.querySelector('#editArea button[onclick*="RecipeEditor.del()"]');
        if (deleteBtn) deleteBtn.style.display = "none";

        // Change Save button text
        const saveBtn = document.querySelector('#editArea button[onclick="RecipeEditor.save()"]');
        if (saveBtn) saveBtn.textContent = "CREATE NEW RECIPE";

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

    async del() {
        // Get the recipe name from the edit form (not the search box!)
        const nameField = document.getElementById("editItemName");
        if (!nameField || !nameField.value.trim()) {
            return showToast("fail", "No recipe loaded to delete!");
        }

        const name = nameField.value.trim();

        const ok = await showConfirm(`Delete "${name}" forever? This cannot be undone.`);
        if (!ok) return;

        // Remove from local state first
        delete App.state.recipes[name];

        // Direct Firestore delete — bypasses App.save() completely
        const deletePath = `recipes.${name}`;

        try {
            await SHARED_DOC_REF.update({
                [deletePath]: firebase.firestore.FieldValue.delete()
            });

            console.log("SUCCESS: Recipe deleted from Firestore:", name);

            // Force refresh everything
            App.refresh();
            debouncedCalcRun();
            refreshAllStockLists();

            // Close edit form
            document.getElementById("editArea").style.display = "none";
            document.getElementById("recipeSearch").value = "";

            showToast("success", `"${name}" has been obliterated from existence.`);
        } catch (err) {
            console.error("DELETE FAILED:", err);
            if (err.code === "permission-denied") {
                showToast("fail", "PERMISSION DENIED — Check Firestore rules");
            } else {
                showToast("fail", "Delete failed — check console (F12)");
            }
        }

        RecipeEditor.renderRecipeTable();
    },
    save() {
        const originalName = document.getElementById("recipeSearch").value.trim();
        const newName = sanitizeItemName(document.getElementById("editItemName").value.trim());
        if (!newName) return showToast("fail", "Name required!");

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

        // If renamed → delete old key first
        if (newName !== originalName) {
            SHARED_DOC_REF.update({
                [`recipes.${originalName}`]: firebase.firestore.FieldValue.delete()
            }).catch(() => { });
        }

        // Save new/updated recipe
        App.state.recipes[newName] = recipe;

        // Use App.save() for the actual save (it works for adding/updating)
        App.save("recipes");

        // UI cleanup
        document.getElementById("editArea").style.display = "none";
        document.getElementById("recipeSearch").value = newName;
        showToast("success", `"${newName}" saved!`);
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
    },
};

