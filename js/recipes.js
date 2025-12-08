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
        val = val.toLowerCase();
        const opts = document.getElementById("recipeOptions");
        opts.innerHTML = "";
        opts.style.display = val ? "block" : "none";
        if (!val) return;

        Object.keys(App.state.recipes)
            .filter(n => n.toLowerCase().includes(val))
            .slice(0, 30)
            .forEach(name => {
                const div = document.createElement("div");
                div.className = "category-item";
                div.textContent = name;
                div.onclick = () => {
                    this.load(name);
                    document.getElementById("recipeSearch").value = name;
                    opts.style.display = "none";
                };
                opts.appendChild(div);
            });
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

    load(name) {
        if (!name || !App.state.recipes[name]) return;

        const r = App.state.recipes[name];
        const editArea = document.getElementById("editArea");
        editArea.style.display = "block";

        // Clone the create form
        editArea.innerHTML = document.getElementById("createRecipeForm").outerHTML
            .replace(/createRecipeForm/g, "editRecipeForm")
            .replace(/Create New Recipe/g, `Editing: <span style="color:#ff0; font-weight:bold;">${name}</span>`)
            .replace(/newItemName/g, "editItemName")
            .replace(/newItemYield/g, "editYield")
            .replace(/newItemWeight/g, "editWeight")
            .replace(/newIngredients/g, "editIngredients")
            .replace(/RecipeEditor\.addRow\('new'\)/g, "RecipeEditor.addRow('edit')");

        // REMOVE CREATE BUTTON
        const createBtn = editArea.querySelector('button[onclick*="RecipeEditor.create()"]');
        if (createBtn) createBtn.closest('div').remove();

        // INSERT 3 ACTION BUTTONS BELOW INGREDIENTS
        const ingredientsBox = editArea.querySelector("div[style*='background:#000814']");
        if (ingredientsBox) {
            const buttonRow = document.createElement("div");
            buttonRow.style.cssText = "margin-top:28px; display:flex; gap:16px; justify-content:center; flex-wrap:wrap;";
            buttonRow.innerHTML = `
      <button onclick="RecipeEditor.save()" style="flex:1; min-width:220px; padding:16px 24px; background:#00aa00; color:white; font-weight:bold; font-size:19px; border:none; border-radius:12px; cursor:pointer;">
        SAVE CHANGES
      </button>
      <button onclick="RecipeEditor.duplicate()" style="flex:1; min-width:220px; padding:16px 24px; background:#cc7700; color:white; font-weight:bold; font-size:19px; border:none; border-radius:12px; cursor:pointer;">
        DUPLICATE RECIPE
      </button>
      <button onclick="RecipeEditor.del()" style="flex:1; min-width:220px; padding:16px 24px; background:#aa0000; color:white; font-weight:bold; font-size:19px; border:none; border-radius:12px; cursor:pointer;">
        DELETE RECIPE
      </button>
    `;
            ingredientsBox.after(buttonRow);
        }

        // POPULATE ALL FIELDS — INCLUDING RECIPE NAME
        document.getElementById("editItemName").value = name;           // THIS WAS MISSING
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
        const currentName = document.getElementById("recipeSearch").value.trim();
        if (!currentName || !App.state.recipes[currentName]) {
            return showToast("fail,", "No recipe selected to duplicate!");
        }

        const original = App.state.recipes[currentName];

        // Clear the "Create New" form
        document.getElementById("newItemName").value = currentName + " (Copy)";
        document.getElementById("newItemYield").value = original.y || 1;

        // Set weight if it exists
        const weightInput = document.getElementById("newItemWeight");
        if (weightInput) {
            weightInput.value = (original.weight || 0).toFixed(2);
        }

        // Clear old ingredients
        const newContainer = document.getElementById("newIngredients");
        newContainer.innerHTML = "";

        // Copy all ingredients
        for (const [ing, qty] of Object.entries(original.i || {})) {
            const row = document.createElement("div");
            row.className = "ingredient-row";
            row.innerHTML = `
      <div class="searchable-select">
        <input type="text" value="${ing}" oninput="RecipeEditor.filterIng(this)">
        <div class="options"></div>
      </div>
      <input type="number" value="${qty}" min="1" style="width:80px;">
      <button class="danger small" onclick="this.parentNode.remove()">Remove</button>`;
            newContainer.appendChild(row);
        }

        // Auto-focus name field and highlight "(Copy)" so user can rename easily
        const nameField = document.getElementById("newItemName");
        nameField.focus();
        nameField.setSelectionRange(0, currentName.length);

        showToast("success", `"${currentName}" duplicated!\nReady to create as "${currentName} (Copy)"\nJust rename and hit Create!`);

        // Optional: Auto-scroll to create section
        document.querySelector("#newItemName")?.scrollIntoView({ behavior: "smooth", block: "center" });
    },

    async del() {
        const name = document.getElementById("recipeSearch").value.trim();
        if (!name) return;
        const ok = await showConfirm(`Delete "${name}" forever? This cannot be undone.`); if (!ok) return;

        // Remove from local state first
        delete App.state.recipes[name];

        // THIS IS THE ONLY WAY THAT WORKS WITH YOUR APP
        const deletePath = `recipes.${name}`;

        // Direct Firestore delete — bypasses App.save() completely
        SHARED_DOC_REF.update({
            [deletePath]: firebase.firestore.FieldValue.delete()
        })
            .then(() => {
                console.log("SUCCESS: Recipe deleted from Firestore:", name);

                // Force refresh everything
                App.refresh();
                debouncedCalcRun();
                refreshAllStockLists();

                document.getElementById("editArea").style.display = "none";
                document.getElementById("recipeSearch").value = "";
                showToast("success", `"${name}" has been obliterated from existence.`);
            })
            .catch(err => {
                console.error("DELETE FAILED:", err);
                if (err.code === "permission-denied") {
                    showToast("fail", "PERMISSION DENIED — Check Firestore rules");
                } else {
                    showToast("fail", "Delete failed — check console (F12)");
                }
            });
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
    renderRecipeTable() {
        const tbody = document.getElementById("recipeTableBody");
        const noRecipes = document.getElementById("noRecipes");
        const recipes = Object.keys(App.state.recipes || {}).sort((a, b) => a.localeCompare(b));

        if (recipes.length === 0) {
            document.getElementById("recipeTableContainer").style.display = "none";
            noRecipes.style.display = "block";
            return;
        }

        document.getElementById("recipeTableContainer").style.display = "block";
        noRecipes.style.display = "none";

        tbody.innerHTML = recipes.map(name => {
            const r = App.state.recipes[name];
            const ingCount = Object.keys(r.i || {}).length;
            const weight = typeof r.weight === "number" ? r.weight.toFixed(3) : "0.000";

            return `
      <tr style="border-bottom: 1px solid #003366; transition: background 0.2s;">
        <td style="padding:12px; font-weight:bold; color:#ff0;">${name}</td>
        <td style="padding:12px; text-align:center;">${r.y || 1}</td>
        <td style="padding:12px; text-align:center;">${weight}</td>
        <td style="padding:12px; text-align:center;">${ingCount}</td>
        <td style="padding:12px; text-align:center;">
          <button onclick="RecipeEditor.load('${name}'); document.getElementById('recipeSearch').value = '${name}'; window.scrollTo({top: 0, behavior: 'smooth'});"
                  style="background:#00aa00; color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:bold;">
            Load
          </button>
        </td>
      </tr>
    `;
        }).join("");
    }
};
