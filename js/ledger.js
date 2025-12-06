// ========================
// Ledger — NOW WITH LIVE FILTERS!
// ========================
const Ledger = {
    render() {
        const tbody = document.getElementById("ledgerBody");
        const balanceEl = document.getElementById("currentBalance");
        if (!tbody) return;

        // === FILTERS ===
        const from = document.getElementById("ledgerFrom")?.value || "";
        const to = document.getElementById("ledgerTo")?.value || "";
        const employee = document.getElementById("ledgerEmployee")?.value || "";
        const search = document.getElementById("ledgerSearch")?.value?.toLowerCase().trim() || "";

        let entries = [...App.state.ledger];

        if (from || to) {
            entries = entries.filter(e => {
                const d = e.date || "";
                return (!from || d >= from) && (!to || d <= to);
            });
        }

        if (employee) {
            entries = entries.filter(e => (e.employee || "").toLowerCase() === employee.toLowerCase());
        }

        if (search) {
            entries = entries.filter(e =>
                (e.description || "").toLowerCase().includes(search) ||
                (e.itemSummary || "").toLowerCase().includes(search) ||
                (e.customer || "").toLowerCase().includes(search) ||
                (e.id || "").toLowerCase().includes(search)
            );
        }

        // SORT: NEWEST FIRST (this is the key line)
        entries.sort((a, b) => {
            const timeA = b.timestamp || b.date + (b.id || "");
            const timeB = a.timestamp || a.date + (a.id || "");
            return timeA.localeCompare(timeB);
        });

        let runningBalance = 0;
        let totalIn = 0, totalOut = 0;

        // Build all rows first (fast & correct order)
        const rowsHTML = entries.map(e => {
            let amount = 0;
            let weight = e.totalWeight || 0;
            let desc = e.description || e.type || "—";
            let customerInfo = "";

            if (e.type === "sale") {
                amount = e.totalSale || e.amount || 0;
                customerInfo = e.customer && e.customer !== "Walk-in" ? ` → ${e.customer}` : "";
                desc = `Customer Sale${customerInfo}`;
                totalOut += weight;
            }
            else if (e.type === "restock_shop" || e.type === "restock_warehouse") {
                amount = 0;
                desc = `Restock (${e.type === "restock_shop" ? "Shop" : "Warehouse"})`;
                totalOut += weight;
            }
            else if (e.type === "raw_purchase" || e.type === "purchase") {
                amount = -(e.totalPaid || e.totalCost || (e.qty * e.unitPrice) || 0);
                desc = `Bought ${e.qty || "?"}× ${e.item || "items"}`;
                totalIn += weight;
            }
            else if (e.type === "deposit" || e.type === "manual") {
                amount = Math.abs(e.amount || 0);
                desc = e.description || "Cash In";
            }
            else if (e.type === "withdrawal" || e.type === "expense") {
                amount = -(Math.abs(e.amount || 0));
                desc = e.description || "Cash Out";
            }
            else if (typeof e.amount === "number") {
                amount = e.amount;
                desc = e.description || e.type || "Transaction";
            }

            runningBalance += amount;

            const weightText = weight > 0
                ? `<br><small style="color:#0af;font-weight:bold;">${weight.toFixed(1)}kg</small>`
                : "";

            return `
        <tr style="border-bottom:1px solid #333;">
            <td style="white-space:nowrap;">${e.date || "—"}</td>
            <td><code style="background:#333;padding:2px 6px;border-radius:4px;">${e.id}</code></td>
            <td>${e.employee || "—"}</td>
            <td>
                <div><strong>${desc}</strong></div>
                <small style="color:#888;">
                    ${e.itemSummary || ""}
                    ${customerInfo}
                </small>
                ${weightText}
            </td>
            <td style="text-align:right;font-weight:bold;color:${amount > 0 ? 'var(--green)' : 'var(--red)'}">
                ${amount > 0 ? "+" : ""}$${Math.abs(amount).toFixed(2)}
            </td>
            <td style="text-align:right;font-weight:bold;color:${runningBalance >= 0 ? 'var(--green)' : 'var(--red)'};font-size:18px;">
                $${runningBalance.toFixed(2)}
            </td>
        </tr>`;
        });

        // Inject all at once (fast + correct order)
        tbody.innerHTML = rowsHTML.length
            ? rowsHTML.join("")
            : `<tr><td colspan="6" style="text-align:center;padding:80px;color:#888;">No transactions match filters</td></tr>`;

        // Update balance
        if (balanceEl) {
            balanceEl.textContent = "$" + runningBalance.toFixed(2);
            balanceEl.style.color = runningBalance >= 0 ? "var(--green)" : "var(--red)";
        }

        // Weight summary
        const netWeight = (totalIn - totalOut).toFixed(1);
        const summary = document.getElementById("ledgerWeightSummary");
        if (summary) {
            summary.innerHTML = `
            <div style="text-align:center;margin-top:15px;font-size:15px;">
                <span style="color:#0ff;">+${totalIn.toFixed(1)}kg received</span> • 
                <span style="color:#0af;">-${totalOut.toFixed(1)}kg sold/moved</span> • 
                <strong style="color:#0f8;">NET: ${netWeight}kg</strong>
            </div>`;
        }
    },
    // Clear all filter
    clearFilters() {
        document.getElementById("ledgerFrom").value = "";
        document.getElementById("ledgerTo").value = "";
        document.getElementById("ledgerEmployee").value = "";
        document.getElementById("ledgerSearch").value = "";
        this.render();
    },

    // Auto-populate employee dropdown
    populateEmployeeFilter() {
        const select = document.getElementById("ledgerEmployee");
        if (!select) return;

        const employees = new Set();
        App.state.ledger.forEach(e => {
            if (e.employee) employees.add(e.employee);
        });

        select.innerHTML = `<option value="">All Employees</option>`;
        [...employees].sort().forEach(emp => {
            const opt = document.createElement("option");
            opt.value = emp;
            opt.textContent = emp;
            select.appendChild(opt);
        });
    },
    render() {
        const tbody = document.getElementById("ledgerBody");
        const balanceEl = document.getElementById("currentBalance");
        if (!tbody) return;

        // === FILTERS ===
        const from = document.getElementById("ledgerFrom")?.value || "";
        const to = document.getElementById("ledgerTo")?.value || "";
        const employee = document.getElementById("ledgerEmployee")?.value || "";
        const search = document.getElementById("ledgerSearch")?.value?.toLowerCase().trim() || "";

        let entries = [...App.state.ledger];

        // Date filter
        if (from || to) {
            entries = entries.filter(e => {
                const d = e.date || "";
                return (!from || d >= from) && (!to || d <= to);
            });
        }

        // Employee filter
        if (employee) {
            entries = entries.filter(e => (e.employee || "").toLowerCase() === employee.toLowerCase());
        }

        // Search filter
        if (search) {
            entries = entries.filter(e =>
                (e.description || "").toLowerCase().includes(search) ||
                (e.itemSummary || "").toLowerCase().includes(search) ||
                (e.customer || "").toLowerCase().includes(search) ||
                (e.id || "").toLowerCase().includes(search)
            );
        }

        // SORT: NEWEST FIRST
        entries.sort((a, b) => {
            const timeA = b.timestamp || b.date + (b.id || "");
            const timeB = a.timestamp || a.date + (a.id || "");
            return timeA.localeCompare(timeB);
        });

        let runningBalance = 0;
        let totalIn = 0, totalOut = 0;

        // Check if current user is manager
        const isMgr = (() => {
            const user = window.playerName || App.state.loggedInUser || "";
            const role = App.state.roles?.[user];
            return role && role.toLowerCase().includes("manager");
        })();

        tbody.innerHTML = entries.length ? "" : `<tr><td colspan="${isMgr ? "7" : "6"}" style="text-align:center;padding:80px;color:#888;">No transactions match filters</td></tr>`;

        entries.forEach((e, index) => {
            let amount = 0;
            let weight = e.totalWeight || 0;
            let desc = e.description || e.type || "—";
            let customerInfo = "";

            if (e.type === "sale") {
                amount = e.totalSale || e.amount || 0;
                customerInfo = e.customer && e.customer !== "Walk-in" ? ` → ${e.customer}` : "";
                desc = `Customer Sale${customerInfo}`;
                totalOut += weight;
            }
            else if (e.type === "restock_shop" || e.type === "restock_warehouse") {
                amount = 0;
                desc = `Restock (${e.type === "restock_shop" ? "Shop" : "Warehouse"})`;
                totalOut += weight;
            }
            else if (e.type === "raw_purchase" || e.type === "purchase") {
                amount = -(e.totalPaid || e.totalCost || (e.qty * e.unitPrice) || 0);
                desc = `Bought ${e.qty || "?"}× ${e.item || "items"}`;
                totalIn += weight;
            }
            else if (e.type === "deposit" || e.type === "manual") {
                amount = Math.abs(e.amount || 0);
                desc = e.description || "Cash In";
            }
            else if (e.type === "withdrawal" || e.type === "expense") {
                amount = -(Math.abs(e.amount || 0));
                desc = e.description || "Cash Out";
            }
            else if (typeof e.amount === "number") {
                amount = e.amount;
                desc = e.description || e.type || "Transaction";
            }

            runningBalance += amount;

            const weightText = weight > 0
                ? `<br><small style="color:#0af;font-weight:bold;">${weight.toFixed(1)}kg</small>`
                : "";

            const deleteBtn = isMgr ? `
            <button class="danger small" style="padding:4px 8px;margin-left:8px;"
                    onclick="Ledger.deleteTransaction('${e.id}', ${index})"
                    title="Delete transaction (Manager only)">
                ×
            </button>` : "";

            const row = document.createElement("tr");
            row.innerHTML = `
            <td style="white-space:nowrap;">${e.date || "—"}</td>
            <td><code style="background:#333;padding:2px 6px;border-radius:4px;">${e.id}</code></td>
            <td>${e.employee || "—"}</td>
            <td>
                <div><strong>${desc}</strong>${deleteBtn}</div>
                <small style="color:#888;">
                    ${e.itemSummary || ""}
                    ${customerInfo}
                </small>
                ${weightText}
            </td>
            <td style="text-align:right;font-weight:bold;color:${amount > 0 ? 'var(--green)' : 'var(--red)'}">
                ${amount > 0 ? "+" : ""}$${Math.abs(amount).toFixed(2)}
            </td>
            <td style="text-align:right;font-weight:bold;color:${runningBalance >= 0 ? 'var(--green)' : 'var(--red)'};font-size:18px;">
                $${runningBalance.toFixed(2)}
            </td>
        `;
            tbody.appendChild(row);
        });

        // Update balance
        if (balanceEl) {
            balanceEl.textContent = "$" + runningBalance.toFixed(2);
            balanceEl.style.color = runningBalance >= 0 ? "var(--green)" : "var(--red)";
        }

        // Weight summary
        const netWeight = (totalIn - totalOut).toFixed(1);
        const summary = document.getElementById("ledgerWeightSummary");
        if (summary) {
            summary.innerHTML = `
            <div style="text-align:center;margin-top:15px;font-size:15px;">
                <span style="color:#0ff;">+${totalIn.toFixed(1)}kg received</span> • 
                <span style="color:#0af;">-${totalOut.toFixed(1)}kg sold/moved</span> • 
                <strong style="color:#0f8;">NET: ${netWeight}kg</strong>
            </div>`;
        }
    },

    // ADD THIS METHOD TO Ledger OBJECT
    async deleteTransaction(id, index) {
        if (!await showConfirm("Permanently delete this transaction?\nThis cannot be undone.")) return;

        // Remove from state
        App.state.ledger = App.state.ledger.filter(e => e.id !== id);

        // Save to Firebase
        await App.save("ledger");

        // Re-render
        Ledger.render();

        showToast("success", "Transaction deleted");
    }
};

// Ledger onload functions
document.addEventListener("DOMContentLoaded", () => {
    Ledger.populateEmployeeFilter();
    Ledger.render();
});

// Refresh when clicking Ledger tab
document.querySelectorAll('[onclick*="ledger"]').forEach(el => {
    el.addEventListener("click", () => setTimeout(Ledger.render, 100));
});


// ================================================
// MANUAL LEDGER TRANSACTIONS (Add/Remove money)
// ================================================
const LedgerManual = {
    // Helper to generate nice IDs
    generateId(prefix = "MANUAL") {
        const now = new Date();
        return `${prefix}-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    },

    // Fill employee dropdowns once (call on init and when employees change)
    populateEmployeeSelects() {
        const employees = Object.keys(App.state.employees).sort();
        const addSel = document.getElementById("addEmployee");
        const removeSel = document.getElementById("removeEmployee");
        [addSel, removeSel].forEach(sel => {
            const current = sel.value;
            sel.innerHTML = '<option value="">Select Employee (optional)</option>';
            employees.forEach(name => {
                const opt = document.createElement("option");
                opt.value = name; opt.textContent = name;
                sel.appendChild(opt);
            });
            if (employees.includes(current)) sel.value = current;
        });
    },

    add(entry) {
        // Generate a deterministic ID based on content + timestamp
        const contentKey = [
            entry.type,
            entry.date,
            entry.employee,
            entry.customer,
            entry.description || entry.itemSummary || "",
            entry.amount || entry.totalSale || entry.totalCost || 0,
            entry.totalWeight || 0
        ].join("|");

        const hash = btoa(encodeURIComponent(contentKey)).slice(0, 20); // short stable ID
        const proposedId = `${entry.date}_${hash}`;

        // CHECK FOR EXACT DUPLICATE (same content + same date)
        const isDuplicate = App.state.ledger.some(e =>
            e.id === proposedId ||
            (e.date === entry.date &&
                e.type === entry.type &&
                e.employee === entry.employee &&
                Math.abs((e.amount || e.totalSale || e.totalCost || 0) - (entry.amount || entry.totalSale || entry.totalCost || 0)) < 0.01)
        );

        if (isDuplicate) {
            console.log("Duplicate ledger entry blocked:", entry);
            showToast("info", "Duplicate transaction blocked");
            return false;
        }

        // SAFE TO ADD
        entry.id = proposedId;
        entry.timestamp = new Date().toISOString();

        App.state.ledger.push(entry);
        App.save("ledger");

        // Auto-re-render
        Ledger.render();
        return true;
    },

    remove() {
        const amount = parseFloat(document.getElementById("removeAmount").value) || 0;
        if (amount <= 0) return showToast("fail", "Enter a positive amount");
        const employee = document.getElementById("removeEmployee").value.trim() || "Cash expense";
        const desc = document.getElementById("removeDesc").value.trim() || "Cash expense";
        this.record(-amount, employee, desc);
        this.clearForms("remove");
    },

    record(amount, employee, description) {
        const now = new Date();
        const record = {
            id: this.generateId("MANUAL"),
            date: now.toISOString().slice(0, 10),
            timestamp: now.toISOString(),
            type: "manual_adjustment",
            employee: employee,
            description: description,
            amount: amount,
        };
        App.state.ledger.push(record);
        App.save("ledger");
        Ledger.render();
        showToast("success", `$${Math.abs(amount).toFixed(2)} ${amount > 0 ? "added to" : "removed from"} ledger`);
    },

    clearForms(which = "both") {
        if (which === "add" || which === "both") {
            document.getElementById("addAmount").value = "";
            document.getElementById("addDesc").value = "";
        }
        if (which === "remove" || which === "both") {
            document.getElementById("removeAmount").value = "";
            document.getElementById("removeDesc").value = "";
        }
    }
};