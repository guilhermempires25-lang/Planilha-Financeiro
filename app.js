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

const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

class FinanceApp {
    constructor() {
        this.transactions = [];
        this.categories = ['Salário', 'Investimentos', 'Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Outros'];
        this.fixedExpenses = [];
        this.goals = [];
        this.cards = [];
        this.config = { id: null, saldo_inicial: 0 };

        this.currentCardId = null;
        this.mainChartInstance = null;
        this.projChartInstance = null;
        this.catChartInstance = null;

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

        // Date Init
        if (this.els.monthYear) {
            const now = new Date();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const y = now.getFullYear();
            this.els.monthYear.value = `${y}-${m}`;

            if (this.els.yearSelector) this.els.yearSelector.value = y;
            this.updateMonthLabel();
        }

        this.bindEvents();
        this.initTheme();

        this.showToast('Carregando...', 'info');
        await this.loadData();
        this.render();
    }

    cacheElements() {
        this.els = {
            // New Month Nav
            monthYear: document.getElementById('monthYear'), // Hidden input
            btnPrev: document.getElementById('btnPrevMonth'),
            btnNext: document.getElementById('btnNextMonth'),
            monthLabel: document.getElementById('monthLabel'),
            yearSelector: document.getElementById('yearSelector'),

            tagFilter: document.getElementById('tagFilter'),
            initialBalance: document.getElementById('initialBalance'),

            income: document.getElementById('incomeDisplay'),
            expense: document.getElementById('expenseDisplay'),
            monthBalance: document.getElementById('monthlyBalanceDisplay'),
            finalBalance: document.getElementById('finalBalanceDisplay'),

            transList: document.getElementById('transactionsBody'),
            categoriesList: document.getElementById('categoriesList'),
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
            cardTransBody: document.getElementById('cardTransactionsBody'),

            projChart: document.getElementById('projectionChart'),
            catChart: document.getElementById('categoryChart')
        };
    }

    bindEvents() {
        if (this.els.btnPrev) this.els.btnPrev.addEventListener('click', () => this.changeMonth(-1));
        if (this.els.btnNext) this.els.btnNext.addEventListener('click', () => this.changeMonth(1));
        if (this.els.yearSelector) this.els.yearSelector.addEventListener('change', () => this.changeYear());

        if (this.els.tagFilter) this.els.tagFilter.addEventListener('change', () => this.render());
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

    // Month Nav Methods
    changeMonth(delta) {
        if (!this.els.monthYear) return;
        const [y, m] = this.els.monthYear.value.split('-').map(Number);

        let d = new Date(y, m - 1 + delta, 1);

        const newY = d.getFullYear();
        const newStr = `${newY}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        this.els.monthYear.value = newStr;

        if (this.els.yearSelector && this.els.yearSelector.value != newY) {
            this.els.yearSelector.value = newY;
        }

        this.updateMonthLabel();
        this.render();
    }

    changeYear() {
        if (!this.els.monthYear || !this.els.yearSelector) return;
        const newYear = this.els.yearSelector.value;
        const [_, m] = this.els.monthYear.value.split('-');

        const newStr = `${newYear}-${m}`;
        this.els.monthYear.value = newStr;

        this.updateMonthLabel();
        this.render();
    }

    updateMonthLabel() {
        if (!this.els.monthYear || !this.els.monthLabel) return;
        const [y, m] = this.els.monthYear.value.split('-');
        const date = new Date(y, m - 1, 1);
        const monthName = date.toLocaleString('pt-BR', { month: 'long' });
        this.els.monthLabel.innerText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;
    }

    initTheme() {
        const themeBtn = document.getElementById('themeToggle');
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
            if (themeBtn && themeBtn.querySelector('i')) themeBtn.querySelector('i').classList.replace('fa-moon', 'fa-sun');
        }
        if (themeBtn) themeBtn.onclick = () => {
            document.body.classList.toggle('dark-mode');
            const i = themeBtn.querySelector('i');
            if (i) i.classList.contains('fa-sun') ? i.classList.replace('fa-sun', 'fa-moon') : i.classList.replace('fa-moon', 'fa-sun');
        };
    }

    // --- DATA FETCHING (Corrected) ---
    async loadData() {
        await Promise.all([
            this.fetchTransactions(),
            this.fetchFixed(),
            this.fetchCards(),
            this.fetchGoals(),
            this.fetchConfig()
        ]);
        this.showToast('Dados Sincronizados');
    }

    async fetchTransactions() {
        const { data, error } = await this.supabase.from('transacoes').select('*').order('data', { ascending: false });
        if (error) console.error(error);
        this.transactions = data || [];
    }

    async fetchFixed() {
        const { data, error } = await this.supabase.from('despesas_fixas').select('*');
        if (error) console.error(error);
        this.fixedExpenses = data || [];
    }

    async fetchCards() {
        // CORRECTION: Strict syntax for Supabase order
        const { data, error } = await this.supabase.from('cartoes').select('*').order('color', { ascending: true });
        if (error) console.error('fetchCards Error:', error);
        this.cards = data || [];
    }

    async fetchGoals() {
        const { data, error } = await this.supabase.from('metas').select('*').order('color', { ascending: true });
        if (error) console.error('fetchGoals Error:', error);
        this.goals = data || [];
    }

    async fetchConfig() {
        const { data, error } = await this.supabase.from('configuracoes').select('*');
        if (error) console.error(error);

        if (data && data.length > 0) {
            this.config = data[0];
            if (this.els.initialBalance) this.els.initialBalance.value = this.config.saldo_inicial;
        } else {
            this.config = { saldo_inicial: 0 };
            this.supabase.from('configuracoes').insert([{ saldo_inicial: 0 }])
                .then(({ data }) => { if (data) this.config = data[0]; });
        }
    }

    async updateInitialBalance(val) {
        const v = parseFloat(val) || 0;
        this.config.saldo_inicial = v;
        if (this.config.id) await this.supabase.from('configuracoes').update({ saldo_inicial: v }).eq('id', this.config.id);
        else { const { data } = await this.supabase.from('configuracoes').insert([{ saldo_inicial: v }]).select(); if (data) this.config = data[0]; }
        this.render();
    }

    // --- HELPERS (Global) ---
    toggleNotifications() {
        const drop = document.getElementById('notifDropdown');
        if (drop) drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
    }
    setSavingsGoal() { const val = prompt('Meta de economia (R$):'); if (val) this.showToast(`Meta: R$ ${val}`); }
    addCategory() {
        const input = document.getElementById('newCatName');
        if (!input || !input.value) return;
        this.categories.push(input.value);
        this.render();
        this.showToast(`Categoria ${input.value} adicionada!`);
        input.value = '';
    }
    exportData() {
        const data = { transactions: this.transactions, fixedExpenses: this.fixedExpenses, cards: this.cards, goals: this.goals, config: this.config };
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = `finances_${new Date().toISOString().split('T')[0]}.json`;
        a.click(); URL.revokeObjectURL(url);
    }
    async importData(input) { alert('Importação JSON em desenvolvimento.'); input.value = ''; }

    // --- ACTIONS ---
    openModal(cardId = null) {
        this.currentCardId = cardId;
        this.renderCategoryOptions();
        const d = document.getElementById('transDate'); if (d) d.value = new Date().toISOString().split('T')[0];
        const t = document.getElementById('transactionModal'); if (t) {
            const h3 = t.querySelector('h3'); if (h3) h3.innerText = cardId ? 'Nova Compra (Cartão)' : 'Nova Transação';
            t.classList.add('active');
        }
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
        const date = getVal('transDate'), desc = getVal('transDesc'), val = parseFloat(getVal('transValue')), cat = getVal('transCategory');
        let type = 'expense'; const tEl = document.querySelector('input[name="transType"]:checked'); if (tEl) type = tEl.value;
        const inst = parseInt(getVal('transInstallments')) || 1, tags = getVal('transTags');

        const base = { data: date, descricao: desc, valor: val, categoria: cat, tipo: type, tag: tags, card_id: this.currentCardId, efetivado: true };
        Object.keys(base).forEach(k => base[k] === undefined && delete base[k]);

        if (inst > 1 && type === 'expense') {
            const batch = [];
            const d = new Date(date);
            const valPart = parseFloat((val / inst).toFixed(2));
            for (let i = 0; i < inst; i++) {
                const cur = new Date(d); cur.setMonth(d.getMonth() + i);
                batch.push({ ...base, data: cur.toISOString().split('T')[0], descricao: `${desc} (${i + 1}/${inst})`, valor: valPart, installment_current: i + 1, installment_total: inst });
            }
            const { data, error } = await this.supabase.from('transacoes').insert(batch).select();
            if (!error) { this.transactions.push(...data); this.success('Parcelamento Salvo'); } else this.error(error.message);
        } else {
            const { data, error } = await this.supabase.from('transacoes').insert([base]).select();
            if (!error) { this.transactions.push(data[0]); this.success('Salvo'); } else this.error(error.message);
        }
    }

    async approveTransaction(id) {
        const { data, error } = await this.supabase.from('transacoes').update({ efetivado: true }).eq('id', id).select();
        if (!error) {
            const idx = this.transactions.findIndex(t => t.id === id);
            if (idx !== -1) {
                this.transactions[idx].efetivado = true;
            }
            if (this.currentCardId) this.openCardDetails(this.currentCardId);
            this.render(); // IMMEDIATE UPDATE
            this.showToast('Despesa Aprovada!');
        } else {
            this.error(error.message);
        }
    }

    async deleteTransaction(id) {
        if (!confirm('Excluir?')) return;
        const { error } = await this.supabase.from('transacoes').delete().eq('id', id);
        if (!error) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            if (this.currentCardId) this.openCardDetails(this.currentCardId);
            this.render();
            this.showToast('Excluído');
        }
    }

    openFixedModal() { this.renderCategoryOptions(); if (this.els.fixedModal) this.els.fixedModal.classList.add('active'); }
    async handleFixedSubmit(e) { /* ... Same ... */
        e.preventDefault();
        const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : '';
        const fix = { dia_vencimento: parseInt(getVal('fixedDay')), descricao: getVal('fixedDesc'), categoria: getVal('fixedCategory'), valor: parseFloat(getVal('fixedValue')) };
        let tEl = document.querySelector('input[name="fixedType"]:checked'); if (tEl) fix.tipo = tEl.value;
        const { data, error } = await this.supabase.from('despesas_fixas').insert([fix]).select();
        if (!error) { this.fixedExpenses.push(data[0]); this.success('Fixo Salvo'); } else this.error(error.message);
    }
    async deleteFixedExpense(id) {
        if (!confirm('Excluir?')) return;
        await this.supabase.from('despesas_fixas').delete().eq('id', id);
        this.fixedExpenses = this.fixedExpenses.filter(f => f.id !== id);
        this.render();
    }

    async generateFixedForMonth() {
        if (!this.els.monthYear) return;
        const currentMonth = this.els.monthYear.value;
        const [y, m] = currentMonth.split('-');

        const alreadyGenerated = this.transactions.some(t => t.data.startsWith(currentMonth) && t.tag && t.tag.includes('fixa_gerada'));

        if (alreadyGenerated) {
            if (!confirm('Atenção: Já existem despesas fixas geradas para este mês. Deseja gerar novamente (pode duplicar)?')) return;
        }

        if (this.fixedExpenses.length === 0) return this.showToast('Nenhuma despesa fixa cadastrada', 'warning');

        const batch = this.fixedExpenses.map(f => {
            let day = f.dia_vencimento;
            const maxDay = new Date(y, m, 0).getDate();
            if (day > maxDay) day = maxDay;
            return {
                data: `${y}-${m}-${String(day).padStart(2, '0')}`,
                descricao: f.descricao,
                valor: f.valor,
                categoria: f.categoria,
                tipo: f.tipo || 'expense',
                tag: 'fixa_gerada',
                efetivado: true
            };
        });

        const { data, error } = await this.supabase.from('transacoes').insert(batch).select();

        if (!error) {
            this.transactions.push(...data);
            this.showToast(`${data.length} Transações Fixas Geradas!`, 'success');
            this.render();
        } else {
            this.error(error.message);
        }
    }

    openCardModal() { if (this.els.cardModal) this.els.cardModal.classList.add('active'); }
    async handleCardSubmit(e) {
        e.preventDefault();
        const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : '';
        const card = {
            id: crypto.randomUUID(),
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
    async handleGoalSubmit(e) { /* ... Same ... */
        e.preventDefault();
        const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : '';
        const g = { name: getVal('goalName'), target: parseFloat(getVal('goalTarget')) || 0, current: parseFloat(getVal('goalCurrent')) || 0, color: getVal('goalColor') || '#000000' };
        const { data, error } = await this.supabase.from('metas').insert([g]).select();
        if (!error) { this.goals.push(data[0]); this.success('Meta Criada'); } else this.error(error.message);
    }
    openInstallmentsModal() { if (this.els.instModal) this.els.instModal.classList.add('active'); }

    async handleCSVImport(input) {
        if (!input.files[0] || !this.currentCardId) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const rows = this.parseCSV(e.target.result);
            if (rows.length === 0) return this.showToast('CSV Inválido', 'warning');

            // EFETIVADO = FALSE (Pending Approval)
            const batch = rows.map(r => ({
                data: r.date,
                descricao: r.description,
                valor: r.value,
                categoria: r.category,
                tipo: 'expense',
                card_id: this.currentCardId,
                efetivado: false
            }));

            const { data, error } = await this.supabase.from('transacoes').insert(batch).select();
            if (!error) {
                this.transactions.push(...data);
                this.showToast(`Importado! ${data.length} pendentes.`);
                if (this.currentCardId) this.openCardDetails(this.currentCardId);
                input.value = '';
            } else this.error(error.message);
        };
        reader.readAsText(input.files[0]);
    }

    parseCSV(text) {
        const lines = text.split('\n').filter(l => l.trim());
        let map = { d: -1, desc: -1, v: -1 }, res = [];
        for (let i = 0; i < lines.length && i < 10; i++) {
            const l = lines[i].toLowerCase();
            if (l.includes('data') || l.includes('date')) {
                const p = l.split(/[;,]/);
                map.d = p.findIndex(x => x.trim().includes('data') || x.trim().includes('date'));
                map.desc = p.findIndex(x => {
                    const h = x.trim();
                    return h.includes('desc') || h.includes('memo') || h.includes('hist') || h.includes('title') || h.includes('establishment') || h.includes('loja');
                });
                map.v = p.findIndex(x => x.trim().includes('valor') || x.trim().includes('amount') || x.trim().includes('mn'));
                if (map.d !== -1 && map.v !== -1) break;
            }
        }
        if (map.d === -1) return [];
        lines.forEach(line => {
            const row = line.match(/(".*?"|[^",;\s]+)(?=\s*[;,]|\s*$)/g);
            if (!row) return;
            const cols = row.map(c => c.replace(/^"|"$/g, '').trim());
            if (cols[map.d] && cols[map.v]) {
                let d = cols[map.d], vStr = cols[map.v], desc = map.desc !== -1 ? cols[map.desc] : 'Importado CSV';
                if (d.match(/^\d{2}[\/-]\d{2}[\/-]\d{4}$/)) { const [dd, mm, yy] = d.split(/[\/-]/); d = `${yy}-${mm}-${dd}`; }
                let v = 0; vStr = vStr.replace(/[R$\s]/g, '');
                if (vStr.includes(',')) vStr = vStr.replace(/\./g, '').replace(',', '.');
                v = parseFloat(vStr);
                if (!isNaN(v) && v !== 0 && !d.toLowerCase().includes('data')) {
                    res.push({ date: d, description: desc || 'Sem Nome', value: Math.abs(v), category: this.getCategoryFromDescription(desc || '') });
                }
            }
        });
        return res;
    }
    getCategoryFromDescription(d) {
        d = d.toLowerCase();
        if (d.includes('uber') || d.includes('combustivel') || d.includes('posto')) return 'Transporte';
        if (d.includes('food') || d.includes('restaurante') || d.includes('mercado') || d.includes('ifood')) return 'Alimentação';
        if (d.includes('farmacia') || d.includes('drogaria')) return 'Saúde';
        return 'Outros';
    }

    // --- RENDER ---
    calculateTotals(monthTrans) {
        // CORRECTION: Explicit logic to sum all effective expenses.
        // We ensure values are numbers and effective status is checked.
        // monthTrans is already filtered by Date and (efetivado !== false).

        let inc = 0;
        let exp = 0;

        monthTrans.forEach(t => {
            const val = parseFloat(t.valor) || 0;
            if (t.tipo === 'income') {
                inc += val;
            } else if (t.tipo === 'expense') {
                // Double check effective status just in case
                if (t.efetivado !== false) {
                    exp += val;
                }
            }
        });

        return { inc, exp };
    }

    render() {
        if (!this.els.monthYear) return;
        const [y, m] = this.els.monthYear.value.split('-');

        const monthTrans = this.transactions.filter(t => t.data.startsWith(`${y}-${m}`) && (t.efetivado !== false));
        monthTrans.sort((a, b) => new Date(b.data) - new Date(a.data));

        if (this.els.transList) {
            this.els.transList.innerHTML = monthTrans.map(t => {
                const typeLabel = t.tipo === 'income' ? '<span class="text-green">Receita</span>' : '<span class="text-red">Despesa</span>';
                const sign = t.tipo === 'income' ? '+' : '-';
                const colorClass = t.tipo === 'income' ? 'text-green' : 'text-red';
                return `<tr><td>${this.formatDate(t.data)}</td><td>${t.descricao} <small>${t.installment_total ? `(${t.installment_current}/${t.installment_total})` : ''}</small></td><td>${this.getCategoryIcon(t.categoria)} ${t.categoria}</td><td>${typeLabel}</td><td class="${colorClass}">${sign} ${this.formatCurrency(t.valor)}</td><td><button class="btn-icon delete-btn" onclick="window.app.deleteTransaction('${t.id}')">${TRASH_ICON}</button></td></tr>`;
            }).join('');
        }

        if (this.els.categoriesList) {
            this.els.categoriesList.innerHTML = this.categories.map(c => `<div class="card" style="padding:1rem; text-align:center;"><div style="font-size:2rem;">${this.getCategoryIcon(c)}</div><div>${c}</div></div>`).join('');
        }

        const { inc, exp } = this.calculateTotals(monthTrans);
        const initBal = this.config.saldo_inicial || 0;

        this.setText(this.els.income, this.formatCurrency(inc));
        this.setText(this.els.expense, this.formatCurrency(exp));

        const bal = inc - exp;
        this.setText(this.els.monthBalance, this.formatCurrency(bal));
        this.setText(this.els.finalBalance, this.formatCurrency(initBal + bal));

        this.renderProjectionCharts(monthTrans);

        if (this.els.cardsList) {
            this.els.cardsList.innerHTML = this.cards.map(c => `<div class="card credit-card" style="border-left: 4px solid ${c.color}" onclick="window.app.openCardDetails('${c.id}')"><h4>${c.name}</h4><p>Limite: ${this.formatCurrency(c.limit)}</p></div>`).join('') + `<div class="card credit-card add-card" onclick="window.app.openCardModal()"><i class="fa fa-plus"></i> Novo</div>`;
        }

        if (this.els.fixedExpensesList) {
            this.els.fixedExpensesList.innerHTML = this.fixedExpenses.filter(f => !f.tipo || f.tipo === 'expense').map(f => `<tr><td>${f.dia_vencimento}</td><td>${f.descricao}</td><td>${f.categoria}</td><td>${this.formatCurrency(f.valor)}</td><td><button class="delete-btn" onclick="window.app.deleteFixedExpense('${f.id}')">${TRASH_ICON}</button></td></tr>`).join('');
        }
        if (this.els.fixedIncomeList) {
            this.els.fixedIncomeList.innerHTML = this.fixedExpenses.filter(f => f.tipo === 'income').map(f => `<tr><td>${f.dia_vencimento}</td><td>${f.descricao}</td><td>${f.categoria}</td><td>${this.formatCurrency(f.valor)}</td><td><button class="delete-btn" onclick="window.app.deleteFixedExpense('${f.id}')">${TRASH_ICON}</button></td></tr>`).join('');
        }
        if (this.els.goalsList) {
            this.els.goalsList.innerHTML = this.goals.map(g => `<div class="goal"><p>${g.name}</p><progress value="${g.current}" max="${g.target}"></progress></div>`).join('');
        }
    }

    renderProjectionCharts(transactions) { /* ... Same ... */
        if (this.els.projChart) {
            const ctx = this.els.projChart.getContext('2d');
            if (this.projChartInstance) this.projChartInstance.destroy();
            const sorted = [...transactions].filter(t => !t.card_id).sort((a, b) => new Date(a.data) - new Date(b.data));
            if (sorted.length === 0) {
                this.projChartInstance = new Chart(ctx, { type: 'line', data: { labels: ['Sem dados'], datasets: [{ label: 'Saldo', data: [0] }] } });
            } else {
                let acc = this.config.saldo_inicial || 0;
                const labels = sorted.map(t => this.formatDate(t.data));
                const data = sorted.map(t => { const v = t.tipo === 'income' ? t.valor : -t.valor; acc += v; return acc; });
                this.projChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Evolução do Saldo', data: data, borderColor: '#3b82f6', tension: 0.4, fill: true }] }, options: { responsive: true, maintainAspectRatio: false } });
            }
        }
        if (this.els.catChart) {
            const ctx = this.els.catChart.getContext('2d');
            if (this.catChartInstance) this.catChartInstance.destroy();
            const expenses = transactions.filter(t => t.tipo === 'expense');
            if (expenses.length === 0) {
                this.catChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Sem despesas'], datasets: [{ data: [1], backgroundColor: ['#e5e7eb'] }] } });
            } else {
                const map = {}; expenses.forEach(t => { map[t.categoria] = (map[t.categoria] || 0) + t.valor; });
                const labels = Object.keys(map); const data = Object.values(map);
                const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#6366f1'];
                this.catChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: colors.slice(0, labels.length) }] }, options: { responsive: true, maintainAspectRatio: false } });
            }
        }
    }

    setText(el, text) { if (el) el.innerText = text; }

    // --- UPDATED CARD DETAILS WITH SHARED EXPENSE LOGIC ---
    openCardDetails(id) {
        this.currentCardId = id; const c = this.cards.find(x => x.id === id); if (!c || !this.els.cardDetailsModal) return;
        this.els.cardDetailsModal.classList.add('active'); this.setText(this.els.detailCardName, c.name);
        const [y, m] = this.els.monthYear ? this.els.monthYear.value.split('-') : this.getCurrentMonthStr().split('-');
        const prevClosing = new Date(y, m - 1, c.closing_day), closing = new Date(y, m, c.closing_day);
        const start = new Date(prevClosing); start.setDate(start.getDate() + 1);

        const txs = this.transactions.filter(t => t.card_id === id && new Date(t.data) >= start && new Date(t.data) <= closing);
        const calcTxs = txs.filter(t => t.efetivado !== false);
        const total = calcTxs.reduce((s, t) => s + t.valor, 0);

        this.setText(this.els.detailCardInvoice, this.formatCurrency(total));
        this.setText(this.els.detailCardLimit, this.formatCurrency(c.limit - total));
        this.setText(this.els.detailCardPeriod, `${this.formatDate(start.toISOString().split('T')[0])} a ${this.formatDate(closing.toISOString().split('T')[0])}`);

        if (this.els.cardTransBody) {
            this.els.cardTransBody.innerHTML = txs.map(t => {
                const isPending = t.efetivado === false;
                const rowClass = isPending ? 'invoice-row pending-row' : 'invoice-row';
                const statusIcon = isPending ?
                    `<button class="btn-icon approve-btn" onclick="window.app.approveTransaction('${t.id}')" title="Aprovar Despesa"><i class="fa-solid fa-check"></i></button>` :
                    `<i class="fa-solid fa-check-circle text-green" title="Aprovado" style="margin-right:8px; opacity:0.5;"></i>`;

                return `
                <tr class="${rowClass}">
                    <td>${this.formatDate(t.data)}</td>
                    <td style="text-transform: capitalize;">${t.descricao}</td>
                    <td style="text-align: right;">${this.formatCurrency(t.valor)}</td>
                    <td style="text-align: center; white-space: nowrap;">
                        ${statusIcon}
                        <button class="delete-btn" onclick="window.app.deleteTransaction('${t.id}')" title="Excluir">
                            ${TRASH_ICON}
                        </button>
                    </td>
                </tr>`;
            }).join('');
        }
    }

    formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
    formatDate(d) { const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
    getCurrentMonthStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
    getCategoryIcon(c) { return CATEGORY_ICONS[c] || '🔹'; }
    renderCategoryOptions() {
        const h = this.categories.map(c => `<option value="${c}">${c}</option>`).join('');
        [document.getElementById('transCategory'), document.getElementById('fixedCategory')].forEach(el => { if (el) el.innerHTML = h; });
    }
    switchTab(btn) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active'); const t = document.getElementById(btn.dataset.target); if (t) t.classList.add('active');
    }
    success(msg) { this.showToast(msg, 'success'); this.closeAllModals(); this.render(); }
    error(msg) { this.showToast(msg, 'error'); }
    showToast(msg, type = 'info') { const t = document.createElement('div'); t.className = `toast toast-${type}`; t.innerText = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }
    payInvoice() { /* Same */
        if (!confirm('Pagar Fatura?')) return;
        const amtStr = this.els.detailCardInvoice ? this.els.detailCardInvoice.innerText : '0';
        const val = parseFloat(amtStr.replace(/[^\d,]/g, '').replace(',', '.'));
        if (val <= 0) return;
        const c = this.cards.find(x => x.id === this.currentCardId);
        this.supabase.from('transacoes').insert([{
            data: new Date().toISOString().split('T')[0], descricao: `Fatura ${c ? c.name : ''}`,
            valor: val, categoria: 'Outros', tipo: 'expense', efetivado: true
        }]).then(({ error }) => { if (!error) { this.showToast('Pago'); this.loadData().then(() => this.render()); } });
    }
}
window.app = new FinanceApp();
