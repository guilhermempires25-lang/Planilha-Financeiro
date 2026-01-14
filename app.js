const CATEGORY_ICONS = {
    'Alimentação': '🍔',
    'Transporte': '🚗',
    'Moradia': '🏠',
    'Lazer': '🎉',
    'Saúde': '💊',
    'Educação': '📚',
    'Investimentos': '📈',
    'Salário': '💰',
    'Serviços': '💡',
    'Outros': '🏷️'
};

class FinanceApp {
    constructor() {
        this.transactions = JSON.parse(localStorage.getItem('finance_transactions')) || [];
        this.categories = JSON.parse(localStorage.getItem('finance_categories')) || ['Salário', 'Investimentos', 'Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Outros'];
        this.fixedExpenses = JSON.parse(localStorage.getItem('finance_fixed')) || [];
        this.goals = JSON.parse(localStorage.getItem('finance_goals')) || [];
        this.cards = JSON.parse(localStorage.getItem('finance_cards')) || [];

        this.currentDate = new Date();
        this.initialBalance = parseFloat(localStorage.getItem('finance_initial_balance')) || 0;

        this.chartInstance = null;

        this.currentCardId = null; // New state for tracking active card context

        this.init();
    }

    init() {
        // Elements
        this.monthYearInput = document.getElementById('monthYear');
        this.initialBalanceInput = document.getElementById('initialBalance');

        // Modals
        this.transactionModal = document.getElementById('transactionModal');
        this.fixedModal = document.getElementById('fixedModal');
        this.goalModal = document.getElementById('goalModal');
        this.goalModal = document.getElementById('goalModal');
        this.cardModal = document.getElementById('cardModal');
        this.cardDetailsModal = document.getElementById('cardDetailsModal'); // New

        // Forms
        this.transactionForm = document.getElementById('transactionForm');
        this.fixedForm = document.getElementById('fixedForm');
        this.goalForm = document.getElementById('goalForm');
        this.cardForm = document.getElementById('cardForm'); // New

        // Set initial values
        this.monthYearInput.value = this.getCurrentMonthStr();
        this.initialBalanceInput.value = this.initialBalance;

        // Theme Init
        this.initTheme();

        // Event Listeners
        this.monthYearInput.addEventListener('change', () => this.render());
        document.getElementById('tagFilter').addEventListener('change', () => this.render());
        this.initialBalanceInput.addEventListener('change', (e) => {
            this.initialBalance = parseFloat(e.target.value) || 0;
            this.saveAll();
            this.render();
        });

        // Form Submits
        this.transactionForm.addEventListener('submit', (e) => this.handleTransactionSubmit(e));
        this.fixedForm.addEventListener('submit', (e) => this.handleFixedSubmit(e));
        this.goalForm.addEventListener('submit', (e) => this.handleGoalSubmit(e));
        this.cardForm.addEventListener('submit', (e) => this.handleCardSubmit(e)); // New

        // Tab Navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn));
        });

        // Close Modals on Outside Click
        window.onclick = (event) => {
            if (event.target == this.transactionModal) this.closeModal();
            if (event.target == this.fixedModal) this.closeFixedModal();
            if (event.target == this.goalModal) this.closeGoalModal();
            if (event.target == this.cardModal) this.closeCardModal();
            if (event.target == this.cardDetailsModal) this.closeCardDetailsModal();
            if (event.target == document.getElementById('installmentsModal')) this.closeInstallmentsModal();
        };

        this.render();
        this.checkAlerts(); // Initial check
    }

    toggleNotifications() {
        const drop = document.getElementById('notifDropdown');
        drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
    }

    checkAlerts() {
        const alerts = [];
        const today = new Date();
        const currentMonthStr = this.getCurrentMonthStr();

        // 1. Fixed Expenses Due Soon (next 5 days)
        this.fixedExpenses.forEach(fix => {
            // Assume fixed expense for CURRENT month match
            // Day comparison
            const dueDay = fix.day;
            const currentDay = today.getDate();
            const daysDiff = dueDay - currentDay;

            if (daysDiff >= 0 && daysDiff <= 5) {
                alerts.push({ msg: `Conta "${fix.description}" vence em ${daysDiff === 0 ? 'hoje' : daysDiff + ' dias'}!`, type: 'warning' });
            }
        });

        // 2. High Spending (80% of Income)
        const filtered = this.getFilteredTransactions();
        const income = filtered.filter(t => t.type === 'income').reduce((a, b) => a + b.value, 0);
        const expense = filtered.filter(t => t.type === 'expense').reduce((a, b) => a + b.value, 0);

        if (income > 0 && expense > (income * 0.8)) {
            alerts.push({ msg: `Cuidado! Você já gastou ${Math.round((expense / income) * 100)}% da sua renda este mês.`, type: 'danger' });
        }

        // 3. Savings Goal logic (Phase 2 - will impl later, placeholder)
        // const savings = income - expense;
        // if (savings > 0) alerts.push({ msg: `Você economizou R$ ${savings.toFixed(2)} este mês!`, type: 'success' });

        this.updateNotifications(alerts);
    }

    // --- Toast & Icon Helpers ---
    showToast(message, type = 'success') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-times-circle';
        if (type === 'warning') icon = 'fa-exclamation-triangle';
        if (type === 'info') icon = 'fa-info-circle';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

        container.appendChild(toast);

        // Remove after 3s
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    getCategoryWithIcon(name) {
        return `${CATEGORY_ICONS[name] || '🏷️'} ${name}`;
    }

    updateNotifications(alerts) {
        const badge = document.getElementById('notifBadge');
        const list = document.getElementById('notifList');

        badge.textContent = alerts.length;
        badge.style.display = alerts.length > 0 ? 'flex' : 'none';

        if (alerts.length === 0) {
            list.innerHTML = '<p style="color: var(--text-secondary);">Sem novas notificações.</p>';
        } else {
            list.innerHTML = alerts.map(a => `
                <div style="padding: 8px; border-bottom: 1px solid var(--border-color); color: ${a.type === 'danger' ? '#ef4444' : a.type === 'warning' ? '#f59e0b' : '#22c55e'}">
                    <i class="fa-solid fa-circle-exclamation"></i> ${a.msg}
                </div>
            `).join('');
        }
    }

    initTheme() {
        const isDark = localStorage.getItem('finance_theme') === 'dark';
        if (isDark) document.body.classList.add('dark-mode');

        document.getElementById('themeToggle').addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const newMode = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
            localStorage.setItem('finance_theme', newMode);
            this.updateChartTheme();
        });
    }

    switchTab(clickedBtn) {
        // Remove active class from all buttons and pages
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.remove('active');
            c.style.display = 'none';
        });

        // Activate clicked
        clickedBtn.classList.add('active');
        const tabId = clickedBtn.getAttribute('data-tab');
        const content = document.getElementById(`tab-${tabId}`);
        content.classList.add('active');
        content.style.display = 'block';

        if (tabId === 'categories') this.renderCategories();
        if (tabId === 'fixed') this.renderFixedExpenses();
        if (tabId === 'goals') this.renderGoals();
        if (tabId === 'cards') this.renderCards(); // New
        if (tabId === 'projection') this.renderProjection();
    }

    getCurrentMonthStr() {
        const y = this.currentDate.getFullYear();
        const m = String(this.currentDate.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }

    saveAll() {
        localStorage.setItem('finance_transactions', JSON.stringify(this.transactions));
        localStorage.setItem('finance_categories', JSON.stringify(this.categories));
        localStorage.setItem('finance_fixed', JSON.stringify(this.fixedExpenses));
        localStorage.setItem('finance_goals', JSON.stringify(this.goals));
        localStorage.setItem('finance_cards', JSON.stringify(this.cards)); // New
        localStorage.setItem('finance_initial_balance', this.initialBalance);
    }

    // --- Transactions Logic ---

    addTransaction(transaction) {
        this.transactions.push({
            id: Date.now().toString() + Math.random(),
            ...transaction
        });
        this.saveAll();
        this.render();
    }

    deleteTransaction(id) {
        if (confirm('Tem certeza?')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this.saveAll();
            this.render();

            // Refresh card details if open
            if (this.currentCardId && this.cardDetailsModal.classList.contains('active')) {
                this.renderCardDetails();
            }
        }
    }

    getFilteredTransactions() {
        const selectedMonth = this.monthYearInput.value;
        const tag = document.getElementById('tagFilter').value?.toLowerCase();

        // 1. Get real transactions
        let filtered = this.transactions.filter(t => t.date.startsWith(selectedMonth) && !t.cardId);

        // 2. Inject Virtual Fixed Expenses
        // Only inject if it doesn't already exist (duplicate check by desc + val + day)
        const [yStr, mStr] = selectedMonth.split('-');

        this.fixedExpenses.forEach(fix => {
            // Fix day handling (if day 31 doesn't exist in month?) -> JS handles overflow, but let's be safe later.
            // For now simple string concat.
            const targetDate = `${selectedMonth}-${String(fix.day).padStart(2, '0')}`;

            // Correct type handling
            const isExpense = (fix.type !== 'income');

            // Duplicate check
            const exists = filtered.find(t =>
                t.description === fix.description &&
                Math.abs(t.value - fix.value) < 0.01 &&
                t.date === targetDate
            );

            if (!exists) {
                filtered.push({
                    id: `virtual-${fix.id}`,
                    date: targetDate, // YYYY-MM-DD
                    description: fix.description,
                    category: fix.category,
                    type: isExpense ? 'expense' : 'income', // NEW
                    value: fix.value,
                    isVirtual: true
                });
            }
        });

        if (tag) {
            filtered = filtered.filter(t => t.tags && t.tags.includes(tag));
        }

        return filtered;
    }

    updateTagOptions() {
        // Collect all unique tags
        const allTags = new Set();
        this.transactions.forEach(t => {
            if (t.tags) t.tags.forEach(tag => allTags.add(tag));
        });

        const select = document.getElementById('tagFilter');
        const current = select.value;

        let html = '<option value="">Todas as Tags</option>';
        allTags.forEach(tag => {
            html += `<option value="${tag}">${tag}</option>`;
        });
        select.innerHTML = html;
        select.value = current;
    }

    // --- Render Logic ---

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    formatDate(dateStr) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }

    render() {
        this.updateTagOptions(); // Update tags list
        const filtered = this.getFilteredTransactions();

        this.checkAlerts(); // Re-check alerts on render


        // Month Calculations
        const income = filtered.filter(t => t.type === 'income').reduce((acc, t) => acc + t.value, 0);
        const expense = filtered.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
        const monthlyBalance = income - expense;

        // Global Calculations (also exclude card transactions for cash flow)
        const globalTransactions = this.transactions.filter(t => !t.cardId);
        const globalIncome = globalTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.value, 0);
        const globalExpense = globalTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
        const globalFinalBalance = this.initialBalance + globalIncome - globalExpense;

        // NEW: Adjust Final Balance by subtracting Virtual Fixed Expenses AND adding Virtual Fixed Income
        const currentVirtualExpense = filtered.filter(t => t.isVirtual && t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
        const currentVirtualIncome = filtered.filter(t => t.isVirtual && t.type === 'income').reduce((acc, t) => acc + t.value, 0);

        const projectedFinalBalance = globalFinalBalance - currentVirtualExpense + currentVirtualIncome;

        // Update Cards
        document.getElementById('incomeDisplay').textContent = this.formatCurrency(income);
        document.getElementById('expenseDisplay').textContent = this.formatCurrency(expense);
        document.getElementById('monthlyBalanceDisplay').textContent = this.formatCurrency(monthlyBalance);
        document.getElementById('finalBalanceDisplay').textContent = this.formatCurrency(projectedFinalBalance);

        // Update Table
        const tbody = document.getElementById('transactionsBody');
        tbody.innerHTML = '';
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        filtered.forEach(t => {
            const tr = document.createElement('tr');
            const colorClass = t.type === 'income' ? 'text-green' : 'text-red';
            const valuePrefix = t.type === 'income' ? '+ ' : '- ';

            tr.innerHTML = `
                <td>${this.formatDate(t.date)}</td>
                <td>${t.description}</td>
                <td><span style="background: var(--bg-primary); padding: 2px 8px; border-radius: 12px; font-size: 0.85em; border: 1px solid var(--border-color);">${this.getCategoryWithIcon(t.category)}</span></td>
                <td>${t.type === 'income' ? 'Receita' : 'Despesa'}</td>
                <td class="${colorClass}">${valuePrefix}${this.formatCurrency(t.value).replace('R$', '').trim()}</td>
                <td>
                    ${t.isVirtual ?
                    `<button class="btn-icon" onclick="alert('Esta é uma despesa fixa automática. Para removê-la, vá até a aba Despesas Fixas.')" style="opacity: 0.5;">
                            <i class="fa-solid fa-lock"></i>
                        </button>`
                    :
                    `<button class="btn-icon" onclick="window.app.deleteTransaction('${t.id}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>`
                }
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Refresh other tabs if active
        if (document.getElementById('tab-projection').classList.contains('active')) this.renderProjection();
    }

    // --- Categories Logic ---

    renderCategoryOptions() {
        const selects = document.querySelectorAll('.category-select');
        selects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = this.categories.map(c => `<option value="${c}">${c}</option>`).join('');
            if (currentVal && this.categories.includes(currentVal)) select.value = currentVal;
        });
    }

    renderCategories() {
        const list = document.getElementById('categoriesList');
        list.innerHTML = this.categories.map(c => `
            <div class="category-tag">
                <span>${this.getCategoryWithIcon(c)}</span>
                <button class="btn-icon" onclick="window.app.deleteCategory('${c}')">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    addCategory() {
        const input = document.getElementById('newCatName');
        const name = input.value.trim();
        if (name && !this.categories.includes(name)) {
            this.categories.push(name);
            this.saveAll();
            this.renderCategories();
            input.value = '';
        }
    }

    deleteCategory(name) {
        if (confirm(`Excluir categoria "${name}" ? `)) {
            this.categories = this.categories.filter(c => c !== name);
            this.saveAll();
            this.renderCategories();
        }
    }

    // --- Fixed Expenses Logic ---

    openFixedModal() {
        this.renderCategoryOptions();
        this.fixedModal.classList.add('active');
    }
    closeFixedModal() { this.fixedModal.classList.remove('active'); this.fixedForm.reset(); }

    handleFixedSubmit(e) {
        e.preventDefault();
        const day = parseInt(document.getElementById('fixedDay').value);
        const desc = document.getElementById('fixedDesc').value;
        const cat = document.getElementById('fixedCategory').value;
        const val = parseFloat(document.getElementById('fixedValue').value);
        // NEW: Capture Type
        const type = document.querySelector('input[name="fixedType"]:checked').value;

        const expense = {
            id: Date.now().toString(),
            day: day,
            description: desc,
            category: cat,
            value: val,
            type: type // Persist type
        };
        this.fixedExpenses.push(expense);


        this.saveAll();
        this.closeFixedModal();
        this.renderFixedExpenses();
        this.render(); // Update transactions list
        this.showToast('Despesa fixa salva!', 'success');
    }

    renderFixedExpenses() {
        const incomeBody = document.getElementById('fixedIncomeBody');
        const expenseBody = document.getElementById('fixedExpensesBody');

        // Render Incomes
        incomeBody.innerHTML = this.fixedExpenses.filter(e => e.type === 'income').sort((a, b) => a.day - b.day).map(e => `
            <tr>
                <td>Dia ${e.day}</td>
                <td>${e.description}</td>
                <td>${e.category}</td>
                <td class="text-green">R$ ${e.value.toFixed(2)}</td>
                <td>
                    <button class="btn-icon" onclick="window.app.deleteFixedExpense('${e.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        if (this.fixedExpenses.filter(e => e.type === 'income').length === 0) {
            incomeBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">Nenhuma receita fixa cadastrada.</td></tr>';
        }

        // Render Expenses (Default or explicit type expense)
        expenseBody.innerHTML = this.fixedExpenses.filter(e => e.type !== 'income').sort((a, b) => a.day - b.day).map(e => `
            <tr>
                <td>Dia ${e.day}</td>
                <td>${e.description}</td>
                <td>${e.category}</td>
                <td class="text-red">R$ ${e.value.toFixed(2)}</td>
                <td>
                    <button class="btn-icon" onclick="window.app.deleteFixedExpense('${e.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        if (this.fixedExpenses.filter(e => e.type !== 'income').length === 0) {
            expenseBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">Nenhuma despesa fixa cadastrada.</td></tr>';
        }
    }

    deleteFixedExpense(id) {
        this.fixedExpenses = this.fixedExpenses.filter(e => e.id !== id);
        this.saveAll();
        this.renderFixedExpenses();
        this.showToast('Despesa fixa removida.');
    }

    generateFixedExpenses() {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const lockKey = `fixed_generated_${y}_${m}`;

        if (localStorage.getItem(lockKey)) {
            this.showToast('As despesas fixas deste mês já foram geradas!', 'warning');
            return;
        }

        let count = 0;
        this.fixedExpenses.forEach(fix => {
            // Check if already exists in this month (double safety)
            const exists = this.transactions.find(t =>
                t.description === fix.description &&
                t.value === fix.value &&
                t.date.startsWith(`${y}-${m}`)
            );

            if (!exists) {
                this.transactions.push({
                    id: Date.now().toString() + Math.random(),
                    date: `${y}-${m}-${String(fix.day).padStart(2, '0')}`,
                    description: fix.description,
                    category: fix.category,
                    type: 'expense',
                    value: fix.value
                });
                count++;
            }
        });

        if (count > 0) {
            this.saveAll();
            this.render();
            localStorage.setItem(lockKey, 'true');
            this.showToast(`${count} despesas fixas geradas para este mês!`, 'success');
            this.switchTab(document.querySelector('[data-tab="resume"]'));
        } else {
            this.showToast('Nenhuma despesa fixa nova para gerar.', 'info');
        }
    }

    // --- Goals Logic ---

    openGoalModal() { this.goalModal.classList.add('active'); }
    closeGoalModal() { this.goalModal.classList.remove('active'); this.goalForm.reset(); }

    handleGoalSubmit(e) {
        e.preventDefault();
        const goal = {
            id: Date.now().toString(),
            name: document.getElementById('goalName').value,
            target: parseFloat(document.getElementById('goalTarget').value),
            current: parseFloat(document.getElementById('goalCurrent').value),
            color: document.getElementById('goalColor').value
        };
        this.goals.push(goal);
        this.saveAll();
        this.closeGoalModal();
        this.renderGoals();
    }

    renderGoals() {
        const grid = document.getElementById('goalsList');
        grid.innerHTML = this.goals.map(g => {
            const pct = Math.min((g.current / g.target) * 100, 100).toFixed(1);
            return `
            <div class="goal-card">
                <div class="goal-header">
                    <span>${g.name}</span>
                    <button class="btn-icon" onclick="window.app.editGoal('${g.id}')"><i class="fa-solid fa-pen"></i></button>
                </div>
                <div class="goal-progress-container">
                    <div class="goal-progress-bar" style="width: ${pct}%; background-color: ${g.color}"></div>
                </div>
                <div class="goal-details">
                    <span>${this.formatCurrency(g.current)}</span>
                    <span>${pct}% de ${this.formatCurrency(g.target)}</span>
                </div>
                <div class="goal-actions">
                    <button class="btn btn-outline" style="font-size: 0.8rem;" onclick="window.app.addLinkGoal('${g.id}', 100)">+ Adds</button>
                    <button class="btn-icon" onclick="window.app.deleteGoal('${g.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        }).join(''); // Simplified "Adds" button logic for now
    }

    deleteGoal(id) {
        if (confirm('Excluir meta?')) {
            this.goals = this.goals.filter(g => g.id !== id);
            this.saveAll();
            this.renderGoals();
        }
    }

    // Simplistic edit: Just prompt for new current value
    addLinkGoal(id) {
        const g = this.goals.find(x => x.id === id);
        const val = prompt('Atualizar valor atual para:', g.current);
        if (val !== null) {
            g.current = parseFloat(val) || g.current;
            this.saveAll();
            this.renderGoals();
        }
    }

    editGoal(id) {
        // Find goal and repopulate modal? Or just delete/re-add?
        // Let's simple delete/re-add logic for MVP or just alert user.
        this.showToast('Para editar, exclua e crie novamente por enquanto.', 'info');
    }

    // --- Cards Logic (NEW) ---

    openCardModal() {
        this.cardModal.classList.add('active');
    }
    closeCardModal() {
        this.cardModal.classList.remove('active');
        this.cardForm.reset();
        document.getElementById('cardId').value = ''; // Clear ID for new add
    }

    handleCardSubmit(e) {
        e.preventDefault();
        const cardData = {
            id: Date.now().toString(),
            name: document.getElementById('cardName').value,
            limit: parseFloat(document.getElementById('cardLimit').value),
            closingDay: document.getElementById('cardClosingDay').value,
            dueDay: document.getElementById('cardDueDay').value,
            color: document.getElementById('cardColor').value
        };

        if (document.getElementById('cardId').value) {
            // Edit
            const id = document.getElementById('cardId').value;
            const idx = this.cards.findIndex(c => c.id === id);
            cardData.id = id; // Preserve ID
            if (idx >= 0) this.cards[idx] = cardData;
            this.showToast('Cartão atualizado com sucesso!');
        } else {
            // New
            this.cards.push(cardData);
            this.showToast('Cartão criado com sucesso!');
        }

        this.saveAll();
        this.closeCardModal();
        this.renderCards();
    }

    renderCards() {
        const grid = document.getElementById('cardsList');
        grid.innerHTML = this.cards.map(c => `
            <div class="credit-card" onclick="window.app.openCardDetails('${c.id}')" style="background: linear-gradient(135deg, ${c.color}, rgba(0,0,0,0.8));">
                <div class="card-top">
                    <div class="chip-icon"></div>
                    <button class="card-actions-btn" onclick="event.stopPropagation(); window.app.deleteCard('${c.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="card-number">•••• •••• •••• ${c.name.substring(0, 4).toUpperCase()}</div>
                <div class="card-details">
                    <div class="card-holder">
                        <span class="card-label">Titular</span>
                        <span class="card-value-text">${c.name}</span>
                    </div>
                    <div class="card-limit">
                        <span class="card-label">Limite</span>
                        <div class="card-value-text">${this.formatCurrency(c.limit)}</div>
                    </div>
                </div>
                <div style="font-size: 0.7rem; display: flex; justify-content: space-between; margin-top: 0.5rem; opacity: 0.8;">
                    <span>Fecha dia ${c.closingDay}</span>
                    <span>Vence dia ${c.dueDay}</span>
                </div>
            </div>
        `).join('');
    }

    deleteCard(id) {
        if (confirm('Excluir cartão?')) {
            this.cards = this.cards.filter(c => c.id !== id);
            this.saveAll();
            this.renderCards();
        }
    }

    //Helper to determine invoice range based on reference month (due date month)
    getInvoiceDates(year, month, closingDay, dueDay) {
        // month is 0-indexed here if coming from Date, but let's assume 1-indexed integers or handle string parsing? 
        // Input: year (number), month (number 0-11, derived from input value)

        const dueDate = new Date(year, month, dueDay);

        let closingDate = new Date(year, month, closingDay);
        // If closing date is after due date, it must be from the previous month relative to the due date
        // E.g. Due 5th, Closing 25th. If we are in May, Due May 5. Closing May 25 is AFTER. So correct closing was Apr 25.
        if (closingDate >= dueDate) {
            closingDate.setMonth(closingDate.getMonth() - 1);
        }

        // Start date is 1 month before closing date + 1 day
        const startDate = new Date(closingDate);
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setDate(startDate.getDate() + 1);

        // Reset hours to ensure comparison is clean
        startDate.setHours(0, 0, 0, 0);
        closingDate.setHours(23, 59, 59, 999);

        return { start: startDate, end: closingDate, due: dueDate };
    }

    // --- Installments Management Logic ---
    openInstallmentsModal() {
        document.getElementById('installmentsModal').classList.add('active');
        this.renderInstallmentsHelper();
    }
    closeInstallmentsModal() { document.getElementById('installmentsModal').classList.remove('active'); }

    renderInstallmentsHelper() {
        const groups = {};

        // Group by installmentGroupId
        this.transactions.forEach(t => {
            if (t.installmentGroupId) {
                if (!groups[t.installmentGroupId]) {
                    groups[t.installmentGroupId] = {
                        description: t.description.replace(/\s\(\d+\/\d+\)$/, ''), // Remove (1/3) suffix
                        totalValue: 0,
                        paidValue: 0,
                        totalCount: t.installmentTotal || 0,
                        paidCount: 0,
                        cardId: t.cardId,
                        transactions: []
                    };
                }
                groups[t.installmentGroupId].transactions.push(t);
                groups[t.installmentGroupId].totalValue += t.value;

                // Determine if paid: based on if date < today? Or if it appeared in a paid invoice? 
                // Simple logic: If date <= today, it's "processed/paid" (or at least posted). 
                // Better: If we have a status, use it. Taking date <= current date (approx for now).
                // Determine if paid: Use explicit 'paid' flag set by invoice payment
                if (t.paid) {
                    groups[t.installmentGroupId].paidValue += t.value;
                    groups[t.installmentGroupId].paidCount++;
                } else if (new Date(t.date) <= new Date() && !t.cardId) {
                    // Fallback for non-card installments or old logic, but strictly speaking card installments depend on invoice payment
                }
            }
        });

        const tbody = document.getElementById('installmentsBody');
        tbody.innerHTML = Object.values(groups).map(g => {
            const cardName = this.cards.find(c => c.id === g.cardId)?.name || 'N/A';
            const remaining = g.totalValue - g.paidValue;
            const progress = (g.paidCount / g.totalCount) * 100;
            const groupId = g.transactions[0].installmentGroupId;

            return `
                <tr>
                    <td>${g.description}</td>
                    <td>${cardName}</td>
                    <td>${this.formatCurrency(g.totalValue)}</td>
                    <td>
                        <div style="font-size: 0.8rem; margin-bottom: 2px;">${g.paidCount}/${g.totalCount}</div>
                        <div style="width: 100%; height: 6px; background: var(--bg-secondary); border-radius: 3px;">
                            <div style="width: ${progress}%; height: 100%; background: var(--green-color); border-radius: 3px;"></div>
                        </div>
                    </td>
                    <td>${this.formatCurrency(remaining)}</td>
                    <td>
                         <button class="btn-icon" onclick="window.app.deleteInstallmentGroup('${groupId}')" title="Excluir Parcelamento">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (Object.keys(groups).length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">Nenhum parcelamento encontrado.</td></tr>';
        }
    }

    deleteInstallmentGroup(groupId) {
        if (confirm('Atenção: Isso excluirá TODAS as parcelas deste lançamento, inclusive as já pagas. Deseja continuar?')) {
            const initialCount = this.transactions.length;
            this.transactions = this.transactions.filter(t => t.installmentGroupId !== groupId);

            if (this.transactions.length < initialCount) {
                this.saveAll();
                this.render(); // Update main view if needed
                this.renderInstallmentsHelper(); // Refresh modal
                this.showToast('Parcelamento excluído com sucesso.');
            } else {
                this.showToast('Erro ao excluir parcelamento.', 'error');
            }
        }
    }

    // --- Card Details Logic ---
    openCardDetails(cardId) {
        this.currentCardId = cardId;
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        document.getElementById('detailCardName').textContent = card.name;

        // Render transactions for this card
        this.renderCardDetails();

        this.cardDetailsModal.classList.add('active');
    }

    closeCardDetailsModal() {
        this.cardDetailsModal.classList.remove('active');
        this.currentCardId = null;
    }

    renderCardDetails() {
        if (!this.currentCardId) return;

        const card = this.cards.find(c => c.id === this.currentCardId);

        // Parse selected global month as the Reference Month (Due Date Month)
        const [yStr, mStr] = this.monthYearInput.value.split('-');
        const year = parseInt(yStr);
        const month = parseInt(mStr) - 1; // 0-indexed

        const { start, end, due } = this.getInvoiceDates(year, month, parseInt(card.closingDay), parseInt(card.dueDay));

        // Filter transactions within range
        const cardTrans = this.transactions.filter(t => {
            if (t.cardId !== this.currentCardId) return false;
            const tDate = new Date(t.date + 'T00:00:00'); // appended time to force local zone processing or avoid UTC issues if string is YYYY-MM-DD
            // Actually YYYY-MM-DD string construction usually sets UTC.
            // Let's ensure comparable types.
            // Simplest: String comparison if ISO? No, ranges cross months.
            // Let's use Date objects.
            const tDateObj = new Date(t.date);
            // Fix timezone offset issue: t.date is YYYY-MM-DD. new Date('2024-05-01') is UTC. 
            // We want local calendar date comparisons.
            // Hack: Append split parts to create date in local time
            const [ty, tm, td] = t.date.split('-').map(Number);
            const tLocal = new Date(ty, tm - 1, td);

            return tLocal >= start && tLocal <= end;
        });

        const totalInvoice = cardTrans.reduce((acc, t) => acc + t.value, 0);
        const availableLimit = card.limit - totalInvoice; // Note: This is simplified. Real limit subtracts ALL unpaid, not just this month. But for MVP this is OK.

        document.getElementById('detailCardInvoice').textContent = this.formatCurrency(totalInvoice);
        document.getElementById('detailCardLimit').textContent = this.formatCurrency(availableLimit);

        // Show Period in UI
        const dateOpt = { day: '2-digit', month: '2-digit' };
        const periodStr = `${start.toLocaleDateString('pt-BR', dateOpt)} a ${end.toLocaleDateString('pt-BR', dateOpt)} `;
        document.getElementById('detailCardPeriod').textContent = periodStr; // Needs HTML element

        const tbody = document.getElementById('cardTransactionsBody');
        tbody.innerHTML = cardTrans.map(t => `
            <tr>
                <td>${this.formatDate(t.date)}</td>
                <td>${t.description}</td>
                <td>${this.formatCurrency(t.value)}</td>
                <td>
                    <button class="btn-icon" onclick="window.app.deleteTransaction('${t.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    payInvoice() {
        if (!this.currentCardId) return;
        const card = this.cards.find(c => c.id === this.currentCardId);

        // Calculate amount again or grab from DOM text? Safer to calculate.
        const [yStr, mStr] = this.monthYearInput.value.split('-');
        const year = parseInt(yStr);
        const month = parseInt(mStr) - 1;
        const { start, end, due } = this.getInvoiceDates(year, month, parseInt(card.closingDay), parseInt(card.dueDay));

        const cardTrans = this.transactions.filter(t => {
            if (t.cardId !== this.currentCardId) return false;
            const [ty, tm, td] = t.date.split('-').map(Number);
            const tLocal = new Date(ty, tm - 1, td);
            return tLocal >= start && tLocal <= end;
        });

        const total = cardTrans.reduce((acc, t) => acc + t.value, 0);

        if (total <= 0) {
            this.showToast('Fatura zerada ou negativa, nada a pagar.', 'info');
            return;
        }

        if (confirm(`Confirmar pagamento da fatura de ${this.formatCurrency(total)}?`)) {
            // Add expense to main account
            this.addTransaction({
                date: new Date().toISOString().split('T')[0], // Paid today
                description: `Fatura ${card.name} (${mStr}/${yStr})`,
                category: 'Cartão de Crédito',
                type: 'expense',
                value: total,
                cardId: null // Explicitly null so it affects main balance
            });

            // NEW: Mark card transactions as paid to update Installment Progress
            // Safe update by ID
            cardTrans.forEach(ct => {
                const realT = this.transactions.find(t => t.id === ct.id);
                if (realT) realT.paid = true;
            });

            this.showToast('Pagamento registrado!');
            this.saveAll(); // Save the 'paid' status updates
            this.render(); // Ensure UI reflects changes (though card details modal closes)
            this.closeCardDetailsModal();
        }
    }

    // --- Projection Logic (Chart.js) ---

    renderProjection() {
        this.renderCategoryChart(); // Render Category Chart alongside projection

        const ctx = document.getElementById('projectionChart');
        if (!ctx) return;

        // Calculate last 6 months data
        const labels = [];
        const incomeData = [];
        const expenseData = [];

        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const mStr = `${d.getFullYear()} -${String(d.getMonth() + 1).padStart(2, '0')} `;
            labels.push(d.toLocaleDateString('pt-BR', { month: 'short' }));

            // Filter
            const monthTrans = this.transactions.filter(t => t.date.startsWith(mStr) && !t.cardId); // Exclude card items from cash flow chart roughly
            incomeData.push(monthTrans.filter(t => t.type === 'income').reduce((a, b) => a + b.value, 0));
            expenseData.push(monthTrans.filter(t => t.type === 'expense').reduce((a, b) => a + b.value, 0));
        }

        if (this.chartInstance) this.chartInstance.destroy();

        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#9ca3af' : '#6b7280';

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Receitas', data: incomeData, backgroundColor: '#22c55e' },
                    { label: 'Despesas', data: expenseData, backgroundColor: '#ef4444' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { ticks: { color: textColor }, grid: { color: isDark ? '#374151' : '#e5e7eb' } },
                    x: { ticks: { color: textColor }, grid: { display: false } }
                },
                plugins: {
                    legend: { labels: { color: textColor } }
                }
            }
        });

        // Forecast Logic
        // Avg of last 3 months expenses
        const last3Expenses = expenseData.slice(-3); // Get last 3
        const avgExpense = last3Expenses.reduce((a, b) => a + b, 0) / (last3Expenses.length || 1);

        const forecastEl = document.getElementById('forecastDisplay');
        if (forecastEl) {
            forecastEl.innerHTML = `
                <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius-md); text-align: center;">
                    <h4 style="margin-bottom: 0.5rem; color: var(--text-primary);">Previsão para Próximo Mês</h4>
                    <p style="font-size: 1.2rem; color: var(--text-secondary);">
                        Baseado na média dos últimos 3 meses, você gastará aproximadamente 
                        <strong style="color: var(--red-color);">${this.formatCurrency(avgExpense)}</strong>.
                    </p>
                </div>
            `;
        }
    }

    renderCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;

        // Get Current Month Transactions
        const filtered = this.getFilteredTransactions();

        // Group Expenses by Category
        const expenses = filtered.filter(t => t.type === 'expense');
        const catTotals = {};

        expenses.forEach(t => {
            if (!catTotals[t.category]) catTotals[t.category] = 0;
            catTotals[t.category] += t.value;
        });

        const labels = Object.keys(catTotals);
        const data = Object.values(catTotals);

        // Colors
        const backgroundColors = [
            '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
            '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'
        ];

        if (this.catChartInstance) this.catChartInstance.destroy();

        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#d1d5db' : '#374151';

        this.catChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 1,
                    borderColor: isDark ? '#1f2937' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: textColor }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    updateChartTheme() {
        if (this.chartInstance && document.getElementById('tab-projection').classList.contains('active')) {
            this.renderProjection();
        }
    }

    // --- Savings Goal Logic ---
    // Minimal implementation for now: Store in Generic Settings (localStorage)
    setSavingsGoal() {
        const current = localStorage.getItem('finance_savings_goal') || '20';
        const val = prompt('Defina sua meta de economia (% da renda):', current);
        if (val !== null) {
            localStorage.setItem('finance_savings_goal', val);
            this.render(); // Re-render to update alerts/dashboard
        }
    }

    renderSavingsWidget() {
        // Find place to insert? Or just use alerts?
        // Let's add a small widget in Dashboard Cards section dynamically if needed?
        // Or better, just inside the 'Resumo' tab header.
    }

    // --- Common Handlers ---

    openModal(cardId = null) {
        this.currentCardId = cardId;
        this.renderCategoryOptions();

        // If coming from card details, hide the details modal temporarily for a better UX
        if (this.currentCardId) {
            this.cardDetailsModal.classList.remove('active');
            document.querySelector('input[name="transType"][value="expense"]').checked = true;
        }

        this.transactionModal.classList.add('active');
        document.getElementById('transDate').value = new Date().toISOString().split('T')[0];
    }
    closeModal() {
        this.transactionModal.classList.remove('active');
        this.transactionForm.reset();
        // Do NOT reset currentCardId here immediately if we want to return to card detail? 
        // Actually we do want to clear it if we cancel.
        // But if we submit, we handle it.
        // If we cancel, we might stay in card detail view.
        // The currentCardId used for 'openModal' context might interact with 'openCardDetails' context.
        // Issue: 'currentCardId' is used for BOTH identifying the open card details AND the card being added to.
        // If I openModal(cardId), I am modifying the SAME currentCardId state.
        // Correct.
        // But 'closeModal' shouldn't clear 'currentCardId' if we are still viewing the card details!
        // We only clear it if we close the DETAILS modal.
        // So let's NOT clear currentCardId in closeModal, UNLESS we are closing the details modal.
        // Actually, 'openModal' is called FROM 'cardDetailsModal'. 
        // So 'currentCardId' is ALREADY set.
        // We just need to make sure we don't null it out here.
    }

    handleTransactionSubmit(e) {
        e.preventDefault();

        // Use the persisted this.currentCardId
        // We do NOT check for DOM visibility here because we may have hidden the card modal to show the transaction modal

        const rawDate = document.getElementById('transDate').value;
        const description = document.getElementById('transDesc').value;
        const category = document.getElementById('transCategory').value;
        const type = document.querySelector('input[name="transType"]:checked').value;
        const totalValue = parseFloat(document.getElementById('transValue').value);
        const installments = parseInt(document.getElementById('transInstallments').value) || 1;

        // Tags handling
        const rawTags = document.getElementById('transTags').value;
        const tags = rawTags ? rawTags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];

        let addedInCurrentView = false;
        // Logic to check if (at least the first) transaction appears in the current card view
        // Only checking first installment for simplicity of notification
        let firstTransDate = null;

        const groupId = Date.now().toString(); // ID for grouping installments

        if (installments > 1) {
            const valuePerInstallment = totalValue / installments;
            for (let i = 0; i < installments; i++) {
                const dateObj = new Date(rawDate + 'T12:00:00');
                dateObj.setMonth(dateObj.getMonth() + i);

                const y = dateObj.getFullYear();
                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                const d = String(dateObj.getDate()).padStart(2, '0');
                const dateStr = `${y} -${m} -${d} `;

                if (i === 0) firstTransDate = { y: y, m: dateObj.getMonth() }; // used for checking

                this.transactions.push({
                    id: Date.now().toString() + Math.random(),
                    date: dateStr,
                    description: `${description} (${i + 1}/${installments})`,
                    category: category,
                    type: type,
                    value: valuePerInstallment,
                    cardId: this.currentCardId,
                    tags: tags,
                    installmentGroupId: groupId,
                    installmentIndex: i + 1,
                    installmentTotal: installments
                });
            }
            this.saveAll();
            this.render();
        } else {
            const formData = {
                date: rawDate,
                description: description,
                category: category,
                type: type,
                value: totalValue,
                cardId: this.currentCardId,
                tags: tags
            };
            // Manually add to avoid double render call structure conflict (though addTransaction is fine)
            // But we want to capture the date for checking
            this.addTransaction(formData);
            const d = new Date(rawDate + 'T12:00:00');
            firstTransDate = { y: d.getFullYear(), m: d.getMonth() };
        }

        this.closeModal();

        // Check if the transaction is visible in the CURRENT card invoice view
        if (this.currentCardId && firstTransDate) {
            this.openCardDetails(this.currentCardId); // Re-open logic handles the filtering

            // Check based on current filter
            // Note: openCardDetails -> renderCardDetails calculates the range
            // We can re-calculate range here to compare
            const [yStr, mStr] = this.monthYearInput.value.split('-');
            const year = parseInt(yStr);
            const month = parseInt(mStr) - 1;
            const card = this.cards.find(c => c.id === this.currentCardId);

            const { start, end } = this.getInvoiceDates(year, month, parseInt(card.closingDay), parseInt(card.dueDay));

            // Use rawDate which was captured BEFORE closeModal()
            const noteDate = new Date(rawDate + 'T12:00:00');

            // Fix timezone for comparison
            const tLocal = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());

            if (tLocal < start || tLocal > end) {
                this.showToast(`Transação salva! Porém, ela cairá na fatura seguinte e não aparece na visualização atual.`, 'warning');
            }
        } else {
            this.currentCardId = null;
        }
    }


    // --- CSV Import Features ---
    handleCSVImport(input) {
        const file = input.files[0];
        if (!file) return;

        if (!this.currentCardId) {
            this.showToast('Erro: Nenhum cartão selecionado.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            this.parseCSV(text);
        };
        reader.readAsText(file);

        // Reset input so same file can be selected again if needed
        input.value = '';
    }

    parseCSV(text) {
        const lines = text.split('\n');
        let transactionsAdded = 0;

        // --- Header Detection ---
        if (lines.length < 2) {
            this.showToast('Arquivo CSV vazio ou inválido.', 'error');
            return;
        }

        // Potential column synonyms
        const colMap = {
            date: ['data', 'date', 'dt', 'd', 'lancamento', 'lançamento'],
            desc: ['descricao', 'descrição', 'desc', 'description', 'title', 'historico', 'histórico', 'memo', 'estabelecimento', 'loja'],
            val: ['valor', 'value', 'amount', 'val', 'mn', 'total', 'quantia']
        };

        // Find header line: The first line that contains at least one keyword from EACH group? 
        // Or just leniently the first line with ANY date/val keywords?
        // Let's iterate lines until we find a match for at least 2 categories (e.g. Date and Value)
        let headerIndex = -1;
        let idxDate = -1, idxDesc = -1, idxVal = -1;

        for (let i = 0; i < Math.min(lines.length, 10); i++) { // Check first 10 lines max
            const l = lines[i].toLowerCase();
            const cols = l.split(',').map(c => c.trim());

            // Check matches
            const d = cols.findIndex(c => colMap.date.some(k => c.includes(k)));
            const de = cols.findIndex(c => colMap.desc.some(k => c.includes(k)));
            const v = cols.findIndex(c => colMap.val.some(k => c.includes(k)));

            if (d !== -1 && v !== -1) { // If we found at least Date and Value, it's likely the header
                headerIndex = i;
                idxDate = d;
                idxDesc = de; // Might be -1 if not found, logic below handles fallback
                idxVal = v;
                break;
            }
        }

        if (headerIndex === -1) {
            this.showToast('Cabeçalho não identificado. Verifique se há colunas de Data e Valor.', 'warning');
            return;
        }

        // Fallback for Description if not found in header
        // If csv has 3 cols and we matched Date and Value, take the remaining one as Description?
        if (idxDesc === -1) {
            // Find a column that isn't Date or Val
            const l = lines[headerIndex].toLowerCase();
            const cols = l.split(',').map(c => c.trim());
            for (let k = 0; k < cols.length; k++) {
                if (k !== idxDate && k !== idxVal) {
                    idxDesc = k;
                    break;
                }
            }
        }

        // --- Row Parsing ---
        for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Regex to ignore commas inside quotes (simple version)
            // const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); 
            // Stick to simple split for now unless user complains about comma in description
            const cols = line.split(',');

            if (cols.length < 2) continue; // Need at least date and val

            let rawDate = cols[idxDate] || '';
            let rawDesc = (idxDesc !== -1 ? cols[idxDesc] : 'Sem descrição') || 'Sem descrição';
            let rawVal = cols[idxVal] || '0';

            // --- Cleaning Data ---

            // Date Normalization
            // Supported: YYYY-MM-DD or DD/MM/YYYY
            let dateFinal = '';
            rawDate = rawDate.replace(/"/g, '').trim();

            // Logic requested by User: 
            // 1. Force split by "/" or "-"
            // 2. Index 0 = Day, Index 1 = Month, Index 2 = Year
            // 3. Construct ISO YYYY-MM-DD manually

            if (rawDate.includes('/') || rawDate.includes('-')) {
                const parts = rawDate.split(/[\/-]/);
                if (parts.length === 3) {
                    // Check if it's ISO (Year first: 2026-05-15)
                    if (parts[0].length === 4) {
                        dateFinal = rawDate; // Already ISO
                    } else {
                        // Assume DD/MM/YYYY
                        const day = parts[0].padStart(2, '0');
                        const month = parts[1].padStart(2, '0');
                        let year = parts[2];

                        // Handle 2-digit year (e.g., 26 -> 2026)
                        if (year.length === 2) year = '20' + year;

                        dateFinal = `${year}-${month}-${day}`;
                    }
                }
            } else if (rawDate.match(/^\d{8}$/)) {
                // Fallback for YYYYMMDD if needed, but sticking to requested logic mostly
            }

            // Value Cleaning
            // Remove 'R$', 'US$', space, etc. Keep digits, comma, dot, minus.
            // Replace logic: 
            // 1. Remove non-numeric/separators: [^0-9,.-]
            // 2. Detect locale (PT-BR vs US)
            //    If comma appears AFTER dot (1.200,50), or comma exists but no dot (1200,50) -> PT-BR
            //    If dot appears AFTER comma (1,200.50), or dot exists but no comma (1200.50) -> US

            let valClean = rawVal.replace(/"/g, '').replace(/[^\d.,-]/g, '');

            // Heuristic: Last separator decides
            const lastDot = valClean.lastIndexOf('.');
            const lastComma = valClean.lastIndexOf(',');

            if (lastComma > lastDot) {
                // Comma is decimal separator (PT-BR)
                // Remove all dots, replace comma with dot
                valClean = valClean.replace(/\./g, '').replace(',', '.');
            } else if (lastDot > lastComma) {
                // Dot is decimal separator (US)
                // Remove all commas
                valClean = valClean.replace(/,/g, '');
            } else {
                // No separators or just one type?
                // If just comma: '1200,50' -> PT-BR handled above (comma > -1)
                // If just dot: '1200.50'   -> US handled above (dot > -1)
                // If neither, integer.
            }

            const valNum = parseFloat(valClean);

            if (!dateFinal || isNaN(valNum)) continue;

            const category = this.getCategoryFromDescription(rawDesc);

            // Add Transaction
            this.transactions.push({
                id: Date.now().toString() + Math.random(),
                date: dateFinal,
                description: rawDesc.replace(/"/g, '').trim(),
                category: category,
                type: 'expense',
                value: Math.abs(valNum),
                cardId: this.currentCardId
            });
            transactionsAdded++;
        }

        if (transactionsAdded > 0) {
            this.saveAll();
            this.renderCardDetails();
            this.showToast(`${transactionsAdded} transações importadas!`, 'success');
        } else {
            this.showToast('Nenhuma transação válida encontrada. Verifique o formato.', 'warning');
        }
    }

    getCategoryFromDescription(desc) {
        const d = desc.toLowerCase();

        // Simple Auto-Categorization Rules
        if (d.includes('uber') || d.includes('99') || d.includes('posto') || d.includes('combustivel')) return 'Transporte';
        if (d.includes('ifood') || d.includes('rappi') || d.includes('restaurante') || d.includes('mc donalds') || d.includes('burger')) return 'Alimentação';
        if (d.includes('netflix') || d.includes('spotify') || d.includes('amazon') || d.includes('cinema') || d.includes('steam')) return 'Lazer';
        if (d.includes('farmacia') || d.includes('drogasil') || d.includes('saude') || d.includes('medico')) return 'Saúde';
        if (d.includes('mercado') || d.includes('atacad') || d.includes('carrefour') || d.includes('pao de acucar')) return 'Mercado';

        return 'Outros'; // Default
    }

    exportData() {
        const data = {
            transactions: this.transactions,
            categories: this.categories,
            fixedExpenses: this.fixedExpenses,
            goals: this.goals,
            cards: this.cards,
            initialBalance: this.initialBalance,
            exportedAt: new Date().toISOString()
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "financas_" + new Date().toISOString().split('T')[0] + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    importData(inputElement) {
        const file = inputElement.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.transactions) {
                    this.transactions = data.transactions || [];
                    this.categories = data.categories || this.categories;
                    this.fixedExpenses = data.fixedExpenses || [];
                    this.goals = data.goals || [];
                    this.cards = data.cards || [];
                    if (data.initialBalance !== undefined) this.initialBalance = data.initialBalance;

                    this.saveAll();
                    this.monthYearInput.value = this.getCurrentMonthStr();
                    this.render();
                    this.monthYearInput.value = this.getCurrentMonthStr();
                    this.render();
                    this.showToast('Dados importados com sucesso!');
                    setTimeout(() => location.reload(), 1500); // Reload to refresh all components cleanly
                } else {
                    this.showToast('Formato de arquivo inválido.', 'error');
                }
            } catch (err) { console.error(err); this.showToast('Erro ao ler JSON.', 'error'); }
            inputElement.value = '';
        };
        reader.readAsText(file);
    }
}

window.app = new FinanceApp();
