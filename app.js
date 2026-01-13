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
            if (event.target == this.cardDetailsModal) this.closeCardDetailsModal(); // New
        };

        this.render();
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
        }
    }

    getFilteredTransactions() {
        const selectedMonth = this.monthYearInput.value;
        // Exclude card transactions from the main list
        return this.transactions.filter(t => t.date.startsWith(selectedMonth) && !t.cardId);
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
        const filtered = this.getFilteredTransactions();

        // Month Calculations
        const income = filtered.filter(t => t.type === 'income').reduce((acc, t) => acc + t.value, 0);
        const expense = filtered.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
        const monthlyBalance = income - expense;

        // Global Calculations (also exclude card transactions for cash flow)
        const globalTransactions = this.transactions.filter(t => !t.cardId);
        const globalIncome = globalTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.value, 0);
        const globalExpense = globalTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
        const globalFinalBalance = this.initialBalance + globalIncome - globalExpense;

        // Update Cards
        document.getElementById('incomeDisplay').textContent = this.formatCurrency(income);
        document.getElementById('expenseDisplay').textContent = this.formatCurrency(expense);
        document.getElementById('monthlyBalanceDisplay').textContent = this.formatCurrency(monthlyBalance);
        document.getElementById('finalBalanceDisplay').textContent = this.formatCurrency(globalFinalBalance);

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
                <td><span style="background: var(--bg-primary); padding: 2px 8px; border-radius: 12px; font-size: 0.85em; border: 1px solid var(--border-color);">${t.category}</span></td>
                <td>${t.type === 'income' ? 'Receita' : 'Despesa'}</td>
                <td class="${colorClass}">${valuePrefix}${this.formatCurrency(t.value).replace('R$', '').trim()}</td>
                <td>
                    <button class="btn-icon" onclick="window.app.deleteTransaction('${t.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
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
                <span>${c}</span>
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
        if (confirm(`Excluir categoria "${name}"?`)) {
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
        const expense = {
            id: Date.now().toString(),
            day: document.getElementById('fixedDay').value,
            description: document.getElementById('fixedDesc').value,
            category: document.getElementById('fixedCategory').value,
            value: parseFloat(document.getElementById('fixedValue').value)
        };
        this.fixedExpenses.push(expense);
        this.saveAll();
        this.closeFixedModal();
        this.renderFixedExpenses();
    }

    renderFixedExpenses() {
        const tbody = document.getElementById('fixedExpensesBody');
        tbody.innerHTML = this.fixedExpenses.sort((a, b) => a.day - b.day).map(e => `
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
    }

    deleteFixedExpense(id) {
        this.fixedExpenses = this.fixedExpenses.filter(e => e.id !== id);
        this.saveAll();
        this.renderFixedExpenses();
    }

    generateFixedExpenses() {
        const currentMonth = this.monthYearInput.value; // YYYY-MM
        let count = 0;

        this.fixedExpenses.forEach(fix => {
            const dateStr = `${currentMonth}-${String(fix.day).padStart(2, '0')}`;

            // Check if already exists roughly (optional check, skip for now to allow duplicates if needed)
            this.addTransaction({
                date: dateStr,
                description: fix.description,
                category: fix.category,
                type: 'expense',
                value: fix.value
            });
            count++;
        });

        alert(`${count} despesas geradas para ${currentMonth}!`);
        this.switchTab(document.querySelector('[data-tab="resume"]'));
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
        alert('Para editar, exclua e crie novamente por enquanto.');
    }

    // --- Cards Logic (NEW) ---

    openCardModal() { this.cardModal.classList.add('active'); }
    closeCardModal() { this.cardModal.classList.remove('active'); this.cardForm.reset(); }

    handleCardSubmit(e) {
        e.preventDefault();
        const card = {
            id: Date.now().toString(),
            name: document.getElementById('cardName').value,
            limit: parseFloat(document.getElementById('cardLimit').value),
            closingDay: document.getElementById('cardClosingDay').value,
            dueDay: document.getElementById('cardDueDay').value,
            color: document.getElementById('cardColor').value
        };
        this.cards.push(card);
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
        // Filter transactions linked to this card and current month (or all unpaid? simplifying to all linked)
        // Ideally should filter by month if showing invoice. Let's show ALL linked for now or filter by selected global month.
        // Let's filter by selected global month to match context.
        const month = this.monthYearInput.value;
        const cardTrans = this.transactions.filter(t => t.cardId === this.currentCardId && t.date.startsWith(month));

        const totalInvoice = cardTrans.reduce((acc, t) => acc + t.value, 0);
        const availableLimit = card.limit - totalInvoice;

        document.getElementById('detailCardInvoice').textContent = this.formatCurrency(totalInvoice);
        document.getElementById('detailCardLimit').textContent = this.formatCurrency(availableLimit);

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

    // --- Projection Logic (Chart.js) ---

    renderProjection() {
        const ctx = document.getElementById('projectionChart');
        if (!ctx) return;

        // Calculate last 6 months data
        const labels = [];
        const incomeData = [];
        const expenseData = [];

        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            labels.push(d.toLocaleDateString('pt-BR', { month: 'short' }));

            // Filter
            const monthTrans = this.transactions.filter(t => t.date.startsWith(mStr));
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
    }

    updateChartTheme() {
        if (this.chartInstance && document.getElementById('tab-projection').classList.contains('active')) {
            this.renderProjection();
        }
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

        const formData = {
            date: document.getElementById('transDate').value,
            description: document.getElementById('transDesc').value,
            category: document.getElementById('transCategory').value,
            type: document.querySelector('input[name="transType"]:checked').value,
            value: parseFloat(document.getElementById('transValue').value),
            cardId: this.currentCardId
        };
        this.addTransaction(formData);

        this.closeModal();

        // Logic to restore the card details modal if we were in that context
        if (this.currentCardId) {
            this.openCardDetails(this.currentCardId);
        } else {
            this.currentCardId = null;
        }
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
                    alert('Dados importados com sucesso!');
                    location.reload(); // Reload to refresh all components cleanly
                } else {
                    alert('Formato de arquivo inválido.');
                }
            } catch (err) { console.error(err); alert('Erro ao ler JSON.'); }
            inputElement.value = '';
        };
        reader.readAsText(file);
    }
}

window.app = new FinanceApp();
