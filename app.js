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
        this.transactions = [];
        this.categories = ['Salário', 'Investimentos', 'Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Outros'];
        this.fixedExpenses = [];
        this.goals = [];
        this.cards = [];
        this.config = { id: null, saldo_inicial: 0 };

        this.currentCardId = null;
        this.chartInstance = null;

        this.supabase = window.supabaseClient;

        this.init();
    }

    async init() {
        if (!this.supabase) {
            console.error('Supabase Client not found!');
            this.showToast('Erro Critico: Banco de dados offline', 'error');
            return;
        }

        this.cacheElements();
        this.bindEvents();

        if (this.els.monthYear) this.els.monthYear.value = this.getCurrentMonthStr();
        this.initTheme();

        this.showToast('Carregando...', 'info');
        await this.loadData();
        this.render();
    }

    cacheElements() {
        this.els = {
            monthYear: document.getElementById('monthYear'),
            tagFilter: document.getElementById('tagFilter'),
            initialBalance: document.getElementById('initialBalance'),

            income: document.getElementById('incomeDisplay'),
            expense: document.getElementById('expenseDisplay'),
            monthBalance: document.getElementById('monthlyBalanceDisplay'),
            finalBalance: document.getElementById('finalBalanceDisplay'),

            transList: document.getElementById('transactionsBody'),
            categoriesList: document.getElementById('categoriesList'), // Added
            fixedIncomeList: document.getElementById('fixedIncomeBody'),
            fixedExpensesList: document.getElementById('fixedExpensesBody'),
            cardsList: document.getElementById('cardsList'),
            goalsList: document.getElementById('goalsList'),

            transModal: document.getElementById('transactionModal'),
            fixedModal: document.getElementById('fixedModal'),
            goalModal: document.getElementById('goalModal'),
            cardModal: document.getElementById('cardModal'),
            cardDetailsModal: document.getElementById('cardDetailsModal'),
            instModal: document.getElementById('installmentsModal'),

            transForm: document.getElementById('transactionForm'),
            fixedForm: document.getElementById('fixedForm'),
            goalForm: document.getElementById('goalForm'),
            cardForm: document.getElementById('cardForm'),

            detailCardName: document.getElementById('detailCardName'),
            detailCardInvoice: document.getElementById('detailCardInvoice'),
            detailCardLimit: document.getElementById('detailCardLimit'),
            detailCardPeriod: document.getElementById('detailCardPeriod'),
            cardTransBody: document.getElementById('cardTransactionsBody')
        };
    }

    bindEvents() {
        if (this.els.monthYear) this.els.monthYear.addEventListener('change', () => this.render());
        if (this.els.tagFilter) this.els.tagFilter.addEventListener('change', () => this.render());
        // Initial Balance Change
        if (this.els.initialBalance) this.els.initialBalance.addEventListener('change', (e) => this.updateInitialBalance(e.target.value));

        if (this.els.transForm) this.els.transForm.addEventListener('submit', (e) => this.handleTransactionSubmit(e));
        if (this.els.fixedForm) this.els.fixedForm.addEventListener('submit', (e) => this.handleFixedSubmit(e));
        if (this.els.goalForm) this.els.goalForm.addEventListener('submit', (e) => this.handleGoalSubmit(e));
        if (this.els.cardForm) this.els.cardForm.addEventListener('submit', (e) => this.handleCardSubmit(e));

        window.onclick = (event) => {
            const modals = [this.els.transModal, this.els.fixedModal, this.els.goalModal, this.els.cardModal, this.els.cardDetailsModal, this.els.instModal];
            if (modals.includes(event.target)) this.closeAllModals();
        };

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn));
        });
    }

    initTheme() {
        const themeBtn = document.getElementById('themeToggle');
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
            if (themeBtn) {
                const i = themeBtn.querySelector('i');
                if (i) i.classList.replace('fa-moon', 'fa-sun');
            }
        }
        if (themeBtn) themeBtn.onclick = () => this.toggleTheme();
    }

    toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            const i = themeBtn.querySelector('i');
            if (i) {
                if (document.body.classList.contains('dark-mode')) i.classList.replace('fa-moon', 'fa-sun');
                else i.classList.replace('fa-sun', 'fa-moon');
            }
        }
    }

    // --- DATA ---
    async loadData() {
        const query = (table) => this.supabase.from(table).select('*');

        const [trans, fix, cards, goals, conf] = await Promise.all([
            query('transacoes'),
            query('despesas_fixas'),
            query('cartoes'),
            query('metas'),
            query('configuracoes')
        ]);

        if (trans.error) console.error('Trans Error:', trans.error);

        this.transactions = trans.data || [];
        this.fixedExpenses = fix.data || [];
        this.cards = cards.data || [];
        this.goals = goals.data || [];

        if (conf.data && conf.data.length > 0) {
            this.config = conf.data[0];
            if (this.els.initialBalance) this.els.initialBalance.value = this.config.saldo_inicial;
        } else {
            // Create default config if missing (optimistic)
            this.config = { saldo_inicial: 0 };
            // Try insert default
            this.supabase.from('configuracoes').insert([{ saldo_inicial: 0 }])
                .then(({ data }) => { if (data) this.config = data[0]; });
        }

        this.showToast('Dados Sincronizados');
    }

    async updateInitialBalance(val) {
        const v = parseFloat(val) || 0;
        this.config.saldo_inicial = v;
        if (this.config.id) {
            await this.supabase.from('configuracoes').update({ saldo_inicial: v }).eq('id', this.config.id);
        } else {
            const { data } = await this.supabase.from('configuracoes').insert([{ saldo_inicial: v }]).select();
            if (data) this.config = data[0];
        }
        this.render(); // Re-calculate finals
    }

    // --- HELPER METHODS (EXPOSED) ---
    toggleNotifications() {
        const drop = document.getElementById('notifDropdown');
        if (drop) drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
    }

    setSavingsGoal() {
        const val = prompt('Qual sua meta de economia mensal? (R$)');
        if (val) this.showToast(`Meta: R$ ${val}`);
    }

    addCategory() {
        const input = document.getElementById('newCatName');
        if (!input || !input.value) return;
        this.categories.push(input.value);
        this.render(); // Re-render categories list
        this.renderCategoryOptions();
        this.showToast(`Categoria ${input.value} adicionada!`);
        input.value = '';
    }

    exportData() {
        const data = {
            transactions: this.transactions,
            fixedExpenses: this.fixedExpenses,
            cards: this.cards,
            goals: this.goals,
            config: this.config
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financeiro_backup.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async importData(input) {
        if (!input.files[0]) return;
        // Placeholder
        alert('Importação JSON em desenvolvimento.');
        input.value = '';
    }

    // --- ACTIONS ---

    openModal(cardId = null) {
        this.currentCardId = cardId;
        this.renderCategoryOptions();
        const dateInput = document.getElementById('transDate');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        const title = this.els.transModal ? this.els.transModal.querySelector('h3') : null;
        if (title) title.innerText = cardId ? 'Nova Compra (Cartão)' : 'Nova Transação';
        if (this.els.transModal) this.els.transModal.classList.add('active');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        if (this.els.transForm) this.els.transForm.reset();
        if (this.els.fixedForm) this.els.fixedForm.reset();
        if (this.els.goalForm) this.els.goalForm.reset();
        if (this.els.cardForm) this.els.cardForm.reset();
        this.currentCardId = null;
    }
    closeModal() { this.closeAllModals(); }
    closeFixedModal() { this.closeAllModals(); }
    closeGoalModal() { this.closeAllModals(); }
    closeCardModal() { this.closeAllModals(); }
    closeCardDetailsModal() { this.closeAllModals(); }
    closeInstallmentsModal() { this.closeAllModals(); }

    async handleTransactionSubmit(e) {
        e.preventDefault();
        const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };

        const date = getVal('transDate');
        const desc = getVal('transDesc');
        const val = parseFloat(getVal('transValue'));
        const cat = getVal('transCategory');

        let type = 'expense';
        const typeEl = document.querySelector('input[name="transType"]:checked');
        if (typeEl) type = typeEl.value;

        const tags = getVal('transTags');
        const inst = parseInt(getVal('transInstallments')) || 1;

        const base = {
            data: date, descricao: desc, valor: val, categoria: cat, tipo: type, tag: tags, card_id: this.currentCardId
        };

        // Sanitize
        Object.keys(base).forEach(k => base[k] === undefined && delete base[k]);

        if (inst > 1 && type === 'expense') {
            const batch = [];
            const d = new Date(date);
            const valPart = parseFloat((val / inst).toFixed(2));
            for (let i = 0; i < inst; i++) {
                const currentD = new Date(d);
                currentD.setMonth(d.getMonth() + i);
                batch.push({
                    ...base,
                    data: currentD.toISOString().split('T')[0],
                    descricao: `${desc} (${i + 1}/${inst})`,
                    valor: valPart,
                    installment_current: i + 1, installment_total: inst
                });
            }
            const { data, error } = await this.supabase.from('transacoes').insert(batch).select();
            if (!error) { this.transactions.push(...data); this.success('Parcelamento Salvo'); }
            else this.error(error.message);
        } else {
            const { data, error } = await this.supabase.from('transacoes').insert([base]).select();
            if (!error) { this.transactions.push(data[0]); this.success('Salvo'); }
            else this.error(error.message);
        }
    }

    async deleteTransaction(id) {
        if (!confirm('Excluir?')) return;
        const { error } = await this.supabase.from('transacoes').delete().eq('id', id);
        if (!error) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this.render();
            this.showToast('Excluído');
        } else this.error(error.message);
    }

    openFixedModal() { this.renderCategoryOptions(); if (this.els.fixedModal) this.els.fixedModal.classList.add('active'); }

    async handleFixedSubmit(e) {
        e.preventDefault();
        const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : '';
        const fix = {
            dia_vencimento: parseInt(getVal('fixedDay')),
            descricao: getVal('fixedDesc'),
            categoria: getVal('fixedCategory'),
            valor: parseFloat(getVal('fixedValue')),
        };
        let tEl = document.querySelector('input[name="fixedType"]:checked');
        if (tEl) fix.tipo = tEl.value;

        const { data, error } = await this.supabase.from('despesas_fixas').insert([fix]).select();
        if (!error) {
            this.fixedExpenses.push(data[0]);
            this.success('Fixo Salvo');
        } else this.error(error.message);
    }

    async deleteFixedExpense(id) {
        if (!confirm('Excluir?')) return;
        await this.supabase.from('despesas_fixas').delete().eq('id', id);
        this.fixedExpenses = this.fixedExpenses.filter(f => f.id !== id);
        this.render();
    }

    openCardModal() { if (this.els.cardModal) this.els.cardModal.classList.add('active'); }

    async handleCardSubmit(e) {
        e.preventDefault();
        const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : '';

        // FIX: Ensure values aren't null/undefined which causes 400
        const card = {
            name: getVal('cardName') || 'Cartão',
            limit: parseFloat(getVal('cardLimit')) || 0,
            closing_day: parseInt(getVal('cardClosingDay')) || 1,
            due_day: parseInt(getVal('cardDueDay')) || 10,
            color: getVal('cardColor') || '#000000'
        };

        const { data, error } = await this.supabase.from('cartoes').insert([card]).select();
        if (!error) { this.cards.push(data[0]); this.success('Cartão Criado'); }
        else this.error(error.message);
    }

    async deleteCard(id) {
        if (!confirm('Excluir Cartão?')) return;
        await this.supabase.from('cartoes').delete().eq('id', id);
        this.cards = this.cards.filter(c => c.id !== id);
        this.render();
    }

    openGoalModal() { if (this.els.goalModal) this.els.goalModal.classList.add('active'); }
    async handleGoalSubmit(e) {
        e.preventDefault();
        const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : '';
        const g = {
            name: getVal('goalName'),
            target: parseFloat(getVal('goalTarget')) || 0,
            current: parseFloat(getVal('goalCurrent')) || 0,
            color: getVal('goalColor') || '#000000'
        };
        const { data, error } = await this.supabase.from('metas').insert([g]).select();
        if (!error) { this.goals.push(data[0]); this.success('Meta Criada'); }
        else this.error(error.message);
    }

    openInstallmentsModal() { if (this.els.instModal) this.els.instModal.classList.add('active'); }

    async handleCSVImport(input) {
        // ... Same CSV logic ...
        if (!input.files[0] || !this.currentCardId) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const rows = this.parseCSV(e.target.result);
            if (rows.length === 0) return this.showToast('CSV Inválido', 'warning');
            const batch = rows.map(r => ({
                data: r.date, descricao: r.description, valor: r.value, categoria: r.category, tipo: 'expense', card_id: this.currentCardId
            }));
            const { data, error } = await this.supabase.from('transacoes').insert(batch).select();
            if (!error) { this.transactions.push(...data); this.success('Importado!'); }
            else this.error(error.message);
        };
        reader.readAsText(input.files[0]);
        input.value = '';
    }

    parseCSV(text) {
        const lines = text.split('\n').filter(l => l.trim());
        let map = { d: -1, desc: -1, v: -1 }, res = [];
        for (let i = 0; i < lines.length && i < 5; i++) {
            const l = lines[i].toLowerCase();
            if (l.includes('data') || l.includes('date')) {
                const p = l.split(/[;,]/);
                map.d = p.findIndex(x => x.includes('data') || x.includes('date'));
                map.desc = p.findIndex(x => x.includes('desc') || x.includes('memo') || x.includes('hist'));
                map.v = p.findIndex(x => x.includes('valor') || x.includes('amount') || x.includes('mn'));
                break;
            }
        }
        if (map.d === -1) return [];
        lines.forEach(line => {
            const row = line.match(/(".*?"|[^",;\s]+)(?=\s*[;,]|\s*$)/g);
            if (!row) return;
            const cols = row.map(c => c.replace(/^"|"$/g, '').trim());
            if (cols[map.d] && cols[map.v]) {
                let d = cols[map.d], v = cols[map.v];
                if (d.match(/^\d{2}[\/-]\d{2}[\/-]\d{4}$/)) { const [dd, mm, yy] = d.split(/[\/-]/); d = `${yy}-${mm}-${dd}`; }
                v = parseFloat(v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
                if (!isNaN(v)) res.push({ date: d, description: cols[map.desc] || '', value: Math.abs(v), category: this.getCategoryFromDescription(cols[map.desc] || '') });
            }
        });
        return res;
    }

    getCategoryFromDescription(d) {
        d = d.toLowerCase();
        if (d.includes('uber') || d.includes('combustivel')) return 'Transporte';
        if (d.includes('food') || d.includes('mercado')) return 'Alimentação';
        return 'Outros';
    }

    // --- RENDER ---
    render() {
        if (!this.els.monthYear) return;
        const [y, m] = this.els.monthYear.value.split('-');

        const monthTrans = this.transactions.filter(t => t.data.startsWith(`${y}-${m}`));
        monthTrans.sort((a, b) => new Date(b.data) - new Date(a.data));

        // FIX: 6 Columns to match Header (Data, Desc, Cat, Tipo, Valor, Ação)
        if (this.els.transList) {
            this.els.transList.innerHTML = monthTrans.map(t => {
                const typeLabel = t.tipo === 'income' ? '<span class="text-green">Receita</span>' : '<span class="text-red">Despesa</span>';
                const sign = t.tipo === 'income' ? '+' : '-';
                const colorClass = t.tipo === 'income' ? 'text-green' : 'text-red';

                return `
                <tr>
                    <td>${this.formatDate(t.data)}</td>
                    <td>${t.descricao} <small>${t.installment_total ? `(${t.installment_current}/${t.installment_total})` : ''}</small></td>
                    <td>${this.getCategoryIcon(t.categoria)} ${t.categoria}</td>
                    <td>${typeLabel}</td>
                    <td class="${colorClass}">${sign} ${this.formatCurrency(t.valor)}</td>
                    <td><button class="btn-icon" onclick="window.app.deleteTransaction('${t.id}')"><i class="fa-solid fa-trash"></i></button></td>
                </tr>`;
            }).join('');
        }

        // FIX: Render Categories Grid
        if (this.els.categoriesList) {
            this.els.categoriesList.innerHTML = this.categories.map(c => `
                <div class="card" style="padding:1rem; text-align:center;">
                    <div style="font-size:2rem;">${this.getCategoryIcon(c)}</div>
                    <div>${c}</div>
                </div>
            `).join('');
        }

        // Dashboard
        const cashFlow = monthTrans.filter(t => !t.card_id);
        const inc = cashFlow.filter(t => t.tipo === 'income').reduce((s, t) => s + t.valor, 0);
        const exp = cashFlow.filter(t => t.tipo === 'expense').reduce((s, t) => s + t.valor, 0);
        const initBal = this.config.saldo_inicial || 0;

        this.setText(this.els.income, this.formatCurrency(inc));
        this.setText(this.els.expense, this.formatCurrency(exp));

        const bal = inc - exp;
        this.setText(this.els.monthBalance, this.formatCurrency(bal));
        // Final Balance = Initial + Month Balance
        this.setText(this.els.finalBalance, this.formatCurrency(initBal + bal));

        this.renderChart(inc, exp);

        // Cards, Fixed, Goals (Already safe)
        if (this.els.cardsList) {
            this.els.cardsList.innerHTML = this.cards.map(c => `
             <div class="card credit-card" style="border-left: 4px solid ${c.color}" onclick="window.app.openCardDetails('${c.id}')">
                 <h4>${c.name}</h4>
                 <p>Limite: ${this.formatCurrency(c.limit)}</p>
             </div>`).join('') +
                `<div class="card credit-card add-card" onclick="window.app.openCardModal()"><i class="fa fa-plus"></i> Novo</div>`;
        }
        if (this.currentCardId && this.els.cardDetailsModal && this.els.cardDetailsModal.classList.contains('active')) {
            this.openCardDetails(this.currentCardId);
        }
        if (this.els.fixedExpensesList) {
            this.els.fixedExpensesList.innerHTML = this.fixedExpenses.filter(f => !f.tipo || f.tipo === 'expense').map(f => `
                <tr><td>${f.dia_vencimento}</td><td>${f.descricao}</td><td>${f.categoria}</td><td>${this.formatCurrency(f.valor)}</td>
                <td><button onclick="window.app.deleteFixedExpense('${f.id}')"><i class="fa-trash"></i></button></td></tr>`).join('');
        }
        if (this.els.fixedIncomeList) {
            this.els.fixedIncomeList.innerHTML = this.fixedExpenses.filter(f => f.tipo === 'income').map(f => `
                <tr><td>${f.dia_vencimento}</td><td>${f.descricao}</td><td>${f.categoria}</td><td>${this.formatCurrency(f.valor)}</td>
                <td><button onclick="window.app.deleteFixedExpense('${f.id}')"><i class="fa-trash"></i></button></td></tr>`).join('');
        }
        if (this.els.goalsList) {
            this.els.goalsList.innerHTML = this.goals.map(g => `
             <div class="goal"><p>${g.name}</p><progress value="${g.current}" max="${g.target}"></progress></div>
             `).join('');
        }
    }

    setText(el, text) { if (el) el.innerText = text; }

    openCardDetails(id) {
        // ... Same logic ...
        this.currentCardId = id;
        const c = this.cards.find(x => x.id === id);
        if (!c || !this.els.cardDetailsModal) return;

        this.els.cardDetailsModal.classList.add('active');
        this.setText(this.els.detailCardName, c.name);

        const [y, m] = this.els.monthYear ? this.els.monthYear.value.split('-') : this.getCurrentMonthStr().split('-');
        const prevClosing = new Date(y, m - 1, c.closing_day);
        const closing = new Date(y, m, c.closing_day);
        const start = new Date(prevClosing); start.setDate(start.getDate() + 1);
        const end = closing;

        const txs = this.transactions.filter(t => t.card_id === id && new Date(t.data) >= start && new Date(t.data) <= end);
        const total = txs.reduce((s, t) => s + t.valor, 0);

        this.setText(this.els.detailCardInvoice, this.formatCurrency(total));
        this.setText(this.els.detailCardLimit, this.formatCurrency(c.limit - total));
        this.setText(this.els.detailCardPeriod, `${this.formatDate(start.toISOString().split('T')[0])} a ${this.formatDate(end.toISOString().split('T')[0])}`);

        if (this.els.cardTransBody) {
            this.els.cardTransBody.innerHTML = txs.map(t => `
             <tr><td>${this.formatDate(t.data)}</td><td>${t.descricao}</td><td>${this.formatCurrency(t.valor)}</td>
             <td><button onclick="window.app.deleteTransaction('${t.id}')"><i class="fa-trash"></i></button></td></tr>`).join('');
        }
    }

    renderChart(inc, exp) {
        const cvs = document.getElementById('financeChart');
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (this.chartInstance) this.chartInstance.destroy();
        this.chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Entradas', 'Saídas'], datasets: [{ data: [inc, exp], backgroundColor: ['#22c55e', '#ef4444'] }] } });
    }

    formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
    formatDate(d) { const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
    getCurrentMonthStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
    getCategoryIcon(c) { return CATEGORY_ICONS[c] || '🔹'; }
    renderCategoryOptions() {
        const h = this.categories.map(c => `<option value="${c}">${c}</option>`).join('');
        const els = [document.getElementById('transCategory'), document.getElementById('fixedCategory')];
        els.forEach(el => { if (el) el.innerHTML = h; });
    }

    switchTab(btn) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.dataset.target;
        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.add('active');
    }

    success(msg) { this.showToast(msg, 'success'); this.closeAllModals(); this.render(); }
    error(msg) { this.showToast(msg, 'error'); }
    showToast(msg, type = 'info') {
        const t = document.createElement('div'); t.className = `toast toast-${type}`; t.innerText = msg;
        document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
    }

    payInvoice() {
        if (!confirm('Pagar Fatura?')) return;
        const amtStr = this.els.detailCardInvoice ? this.els.detailCardInvoice.innerText : '0';
        const val = parseFloat(amtStr.replace(/[^\d,]/g, '').replace(',', '.'));
        if (val <= 0) return;
        const c = this.cards.find(x => x.id === this.currentCardId);
        this.supabase.from('transacoes').insert([{
            data: new Date().toISOString().split('T')[0], descricao: `Fatura ${c ? c.name : ''}`,
            valor: val, categoria: 'Outros', tipo: 'expense'
        }]).then(({ error }) => { if (!error) { this.showToast('Pago'); this.loadData().then(() => this.render()); } });
    }
}
window.app = new FinanceApp();
