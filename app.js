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
        this.receivables = []; // New: Valores a Receber
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

        // AUTH INIT
        this.cacheAuthElements();
        this.bindAuthEvents();
        this.bindCapsWarning();

        const { data, error } = await this.supabase.auth.getSession();
        if (data.session) {
            this.onLoginSuccess(data.session.user);
        } else {
            this.showAuthScreen();
        }
    }

    cacheAuthElements() {
        this.auth = {
            screen: document.getElementById('authScreen'),
            app: document.getElementById('app'),
            loginForm: document.getElementById('loginForm'),
            email: document.getElementById('emailInput'),
            pass: document.getElementById('passwordInput')
        };
    }

    bindAuthEvents() {
        if (this.auth.loginForm) {
            this.auth.loginForm.onsubmit = (e) => this.handleLogin(e);
        }
    }

    showAuthScreen() {
        if (this.auth.screen && this.auth.app) {
            this.auth.screen.classList.remove('hidden');
            this.auth.screen.style.display = 'flex';
            this.auth.app.style.display = 'none';
        }
    }

    showAppScreen() {
        if (this.auth.screen && this.auth.app) {
            this.auth.screen.style.display = 'none';
            this.auth.app.style.display = 'block';
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = this.auth.email.value.trim();
        const password = this.auth.pass.value;
        const btn = this.auth.loginForm.querySelector('button');
        const icon = btn.querySelector('i');
        const span = btn.querySelector('span'); // Cache span

        try {
            // Loading State
            if (span) span.innerText = 'Entrando...';
            if (icon) icon.className = 'fa-solid fa-spinner fa-spin';

            // SIGN IN ONLY (Registration Disabled)
            const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });

            if (error) throw error;

            if (data.session) {
                this.onLoginSuccess(data.session.user);
            } else {
                throw new Error('Login sem sessão.');
            }

        } catch (error) {
            console.error(error);
            this.showToast('Erro: ' + error.message, 'error');
        } finally {
            // Reset Button State
            if (span) span.innerText = 'Entrar';
            if (icon) icon.className = 'fa-solid fa-arrow-right';
        }
    }

    async onLoginSuccess(user) {
        this.user = user;
        this.showAppScreen();
        this.showToast(`Bem-vindo, ${user.email.split('@')[0]}!`, 'success');

        // Load App Data now
        // Date Init
        if (this.els.monthYear) {
            const now = new Date();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const y = now.getFullYear();
            this.els.monthYear.value = `${y}-${m}`;

            if (this.els.yearSelector) this.els.yearSelector.value = y;
            this.updateMonthLabel();
        }

        this.setupInactivityTimer();
        this.bindEvents();
        this.initTheme();

        await this.loadData();
        this.render();
    }

    setupInactivityTimer() {
        const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes
        let lastActivity = Date.now();

        const updateActivity = () => {
            lastActivity = Date.now();
        };

        const checkInactivity = () => {
            if (Date.now() - lastActivity > INACTIVITY_LIMIT) {
                this.showToast('Sessão expirada por inatividade.', 'warning');
                setTimeout(() => this.logout(), 2000);
            }
        };

        // Check every minute if time has passed (handles background throttling/sleeping)
        setInterval(checkInactivity, 60 * 1000);

        // Events that record activity
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, updateActivity);
        });
    }

    async logout() {
        await this.supabase.auth.signOut();
        window.location.reload();
    }

    togglePasswordVisibility() {
        if (!this.auth.pass) {
            this.auth.pass = document.getElementById('passwordInput');
        }

        const type = this.auth.pass.getAttribute('type') === 'password' ? 'text' : 'password';
        this.auth.pass.setAttribute('type', type);

        const icon = this.auth.loginForm.querySelector('.password-toggle');
        if (icon) {
            icon.className = type === 'password' ? 'fa-solid fa-eye password-toggle' : 'fa-solid fa-eye-slash password-toggle';
        }
    }

    bindCapsWarning() {
        const passInput = document.getElementById('passwordInput');
        const warning = document.getElementById('capsLockWarning');

        if (!passInput || !warning) return;

        const checkCaps = (e) => {
            if (typeof e.getModifierState !== 'function') return;

            if (e.getModifierState("CapsLock")) {
                warning.classList.remove('hidden');
            } else {
                warning.classList.add('hidden');
            }
        };

        passInput.addEventListener('keyup', checkCaps);
        passInput.addEventListener('keydown', checkCaps);
        passInput.addEventListener('click', checkCaps);
        passInput.addEventListener('focus', checkCaps);
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

            transList: document.getElementById('transactionsList'),
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
            recModal: document.getElementById('receivablesModal'), // New Modal

            transForm: document.getElementById('transactionForm'),
            fixedForm: document.getElementById('fixedForm'),
            goalForm: document.getElementById('goalForm'),
            cardForm: document.getElementById('cardForm'),
            recForm: document.getElementById('addReceivableForm'),

            goalForm: document.getElementById('goalForm'),
            cardForm: document.getElementById('cardForm'),

            detailCardName: document.getElementById('detailCardName'),
            detailCardInvoice: document.getElementById('detailCardInvoice'),
            detailCardLimit: document.getElementById('detailCardLimit'),
            detailCardPeriod: document.getElementById('detailCardPeriod'),
            cardTransList: document.getElementById('cardTransactionsList'),

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
        if (this.els.recForm) this.els.recForm.addEventListener('submit', (e) => this.handleAddReceivable(e));

        window.onclick = (event) => {
            const modals = [this.els.transModal, this.els.fixedModal, this.els.goalModal, this.els.cardModal, this.els.cardDetailsModal, this.els.recModal];
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

        // Privacy Mode Init
        const savedPrivacy = localStorage.getItem('privacy_mode');
        if (savedPrivacy === 'true') {
            document.body.classList.add('privacy-mode');
        }
    }

    togglePrivacy() {
        document.body.classList.toggle('privacy-mode');
        const isPrivacy = document.body.classList.contains('privacy-mode');
        localStorage.setItem('privacy_mode', isPrivacy);
        // Using the GOOD showToast method (lines 1265+)
        this.showToast(isPrivacy ? 'Modo Privacidade Ativado 👀' : 'Modo Privacidade Desativado 👁️', 'info');
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
        const { data, error } = await this.supabase.from('cartoes').select('*');
        if (error) console.error('fetchCards Error:', error);
        this.cards = data || [];
    }

    async fetchGoals() {
        try {
            const { data, error } = await this.supabase
                .from('metas')
                .select('*');
            if (error) throw error;
            this.goals = data || [];
            this.renderGoals();
        } catch (error) {
            console.error('Erro ao buscar metas:', error);
        }
    }

    async fetchConfig() {
        const { data, error } = await this.supabase.from('configuracoes').select('*');
        if (error) console.error(error);

        if (data && data.length > 0) {
            this.config = data[0];
            if (this.els.initialBalance) this.els.initialBalance.value = this.config.saldo_inicial;
            // Load categories if they exist (simplification, assumes we might have added it)
            if (data[0].categories && Array.isArray(data[0].categories)) {
                this.categories = data[0].categories;
            }
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

        // UPDATED: Read 'transAmount' (Giant Input) instead of 'transValue'
        const date = getVal('transDate');
        const desc = getVal('transDesc');
        const val = parseFloat(getVal('transAmount'));
        const cat = getVal('transCategory');

        // UPDATED: Read Type from Hidden Input
        let type = 'expense';
        const tEl = document.getElementById('transType');
        if (tEl) type = tEl.value;

        const inst = parseInt(getVal('transInstallments')) || 1;
        const tags = getVal('transTags');

        const base = { data: date, descricao: desc, valor: val, categoria: cat, tipo: type, tag: tags, card_id: this.currentCardId, efetivado: true };

        // Remove undefined keys
        Object.keys(base).forEach(k => base[k] === undefined && delete base[k]);

        if (inst > 1 && type === 'expense') {
            const batch = [];
            const d = new Date(date);
            const valPart = parseFloat((val / inst).toFixed(2));
            for (let i = 0; i < inst; i++) {
                const cur = new Date(d); cur.setMonth(d.getMonth() + i);
                batch.push({ ...base, data: cur.toISOString().split('T')[0], descricao: desc, valor: valPart, installment_current: i + 1, installment_total: inst });
            }
            const { data, error } = await this.supabase.from('transacoes').insert(batch).select();
            if (!error) { this.transactions.push(...data); this.success('Parcelamento Salvo'); } else this.error(error.message);
        } else {
            const { data, error } = await this.supabase.from('transacoes').insert([base]).select();
            if (!error) { this.transactions.push(data[0]); this.success('Salvo'); } else this.error(error.message);
        }
    }

    setTransType(type) {
        const btnInc = document.getElementById('btnTypeIncome');
        const btnExp = document.getElementById('btnTypeExpense');
        const hidden = document.getElementById('transType');

        if (hidden) hidden.value = type;

        if (type === 'income') {
            if (btnInc) btnInc.classList.add('active');
            if (btnExp) btnExp.classList.remove('active');
        } else {
            if (btnInc) btnInc.classList.remove('active');
            if (btnExp) btnExp.classList.add('active');
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

    setFixedType(type) {
        const input = document.getElementById('fixedType');
        const btnInc = document.getElementById('btnFixedIncome');
        const btnExp = document.getElementById('btnFixedExpense');

        if (input) input.value = type;

        if (type === 'income') {
            btnInc.classList.add('active');
            btnExp.classList.remove('active');
        } else {
            btnExp.classList.add('active');
            btnInc.classList.remove('active');
        }
    }

    async handleFixedSubmit(e) {
        e.preventDefault();
        const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : '';
        const fix = {
            dia_vencimento: parseInt(getVal('fixedDay')),
            descricao: getVal('fixedDesc'),
            categoria: getVal('fixedCategory'),
            valor: parseFloat(getVal('fixedValue')),
            tipo: getVal('fixedType') || 'expense'
        };

        const { data, error } = await this.supabase.from('despesas_fixas').insert([fix]).select();
        if (!error) {
            this.fixedExpenses.push(data[0]);
            this.showToast('Fixo Salvo', 'success');
            this.closeFixedModal();
            this.render();
        } else this.showToast(error.message, 'error');
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

    setCardColor(color, el) {
        document.getElementById('cardColor').value = color;
        // Visual feedback
        document.querySelectorAll('#cardForm .color-option').forEach(c => c.classList.remove('active'));
        if (el) el.classList.add('active');
    }

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

    setGoalColor(color, el) {
        document.getElementById('goalColor').value = color;
        // Visual feedback
        document.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
        if (el) el.classList.add('active');
    }

    async handleGoalSubmit(e) {
        e.preventDefault();
        const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : '';
        const g = {
            id: crypto.randomUUID(), // FIX: Generate ID manually as DB expects it
            name: getVal('goalName'),
            target: parseFloat(getVal('goalTarget')) || 0,
            current: parseFloat(getVal('goalCurrent')) || 0,
            color: getVal('goalColor') || '#000000'
        };
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

    renderGoals() {
        if (!this.els.goalsList) return;

        // "Add Goal" Placeholder Card HTML
        const addGoalHtml = `
            <div class="goal-add-placeholder" onclick="window.app.openGoalModal()">
                <div class="goal-add-icon">
                    <i class="fa-solid fa-plus"></i>
                </div>
                <span style="font-weight: 600;">Nova Meta</span>
            </div>`;

        if (this.goals.length === 0) {
            this.els.goalsList.innerHTML = addGoalHtml;
            return;
        }

        const html = this.goals.map(g => {
            const current = parseFloat(g.current) || 0;
            const target = parseFloat(g.target) || 1; // Avoid div by zero
            let pct = (current / target) * 100;
            const displayPct = Math.round(pct);

            // Visual Limit at 100%
            const visualPct = Math.min(pct, 100);

            // Success State
            let isSuccess = pct >= 100;
            let barColor = g.color || '#3b82f6';
            let icon = '🎯';

            if (isSuccess) {
                barColor = '#10b981'; // Success Green
                icon = '🏆';
            }

            return `
            <div class="goal-card">
                <div class="goal-header">
                    <div class="goal-icon" style="color: ${barColor}; background: ${barColor}1a;">${icon}</div>
                    <div class="goal-title">${g.name}</div>
                </div>

                <div class="goal-actions">
                    <button class="goal-btn" onclick="window.app.editGoal('${g.id}')" title="Editar">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="goal-btn delete" onclick="window.app.deleteGoal('${g.id}')" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>

                <div class="goal-center">
                    <!-- Dynamic Gradient Text -->
                    <div class="goal-percentage" style="background: linear-gradient(to bottom, ${barColor}, #ffffff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${displayPct}%</div>
                    <div class="goal-values">
                        <span class="curr">${this.formatCurrency(current)}</span>
                        <span class="sep">/</span>
                        <span class="targ">${this.formatCurrency(target)}</span>
                    </div>
                </div>

                <div class="goal-row-bottom">
                    <div class="goal-progress-container">
                        <div class="goal-progress-bar" style="width: ${visualPct}%; background: linear-gradient(90deg, ${barColor}, ${barColor}dd); box-shadow: 0 0 15px ${barColor}4d;"></div>
                    </div>
                </div>
            </div>`;
        }).join('');

        this.els.goalsList.innerHTML = html + addGoalHtml;
    }

    // Stub for edit to prevent error
    editGoal(id) {
        // Simple prompt fallback if modal logic isn't ready for edits
        const g = this.goals.find(x => x.id === id);
        if (!g) return;
        const newVal = prompt(`Atualizar valor atual para ${g.name}:`, g.current);
        if (newVal !== null) {
            const val = parseFloat(newVal);
            if (!isNaN(val)) {
                // Direct update simulation
                this.supabase.from('metas').update({ current: val }).eq('id', id).then(({ error }) => {
                    if (!error) {
                        g.current = val;
                        this.renderGoals();
                        this.showToast('Meta atualizada!');
                    }
                });
            }
        }
    }

    async deleteGoal(id) {
        if (!confirm('Excluir esta meta?')) return;
        const { error } = await this.supabase.from('metas').delete().eq('id', id);
        if (!error) {
            this.goals = this.goals.filter(g => g.id !== id);
            this.renderGoals();
            this.showToast('Meta excluída');
        } else {
            this.error(error.message);
        }
    }

    // --- RENDER ---
    calculateTotals(monthTrans) {
        let inc = 0;
        let exp = 0;
        monthTrans.forEach(t => {
            // FORCE POSITIVE VALUES to ensure logic (Income - Expense) works regardless of DB sign
            const val = Math.abs(parseFloat(t.valor) || 0);

            if (t.tipo === 'income') {
                inc += val;
            } else if (t.tipo === 'expense' && t.efetivado !== false) {
                exp += val;
            }
        });
        return { inc, exp };
    }

    render() {
        if (!this.els.monthYear) return;
        const [y, mStr] = this.els.monthYear.value.split('-');
        const yNum = parseInt(y), mNum = parseInt(mStr); // 1-12

        // Filter Transactions: Cash (Calendar) | Card (Invoice Cycle)
        const monthTrans = this.transactions.filter(t => {
            if (t.efetivado === false) return false;

            // Normalize Transaction Date
            const [ty, tm, td] = t.data.split('-').map(Number);
            const tDate = new Date(ty, tm - 1, td);

            if (!t.card_id) {
                // Cash: Calendar Month
                return t.data.startsWith(`${y}-${mStr}`);
            } else {
                // Card: Invoice Cycle
                const card = this.cards.find(c => c.id === t.card_id);
                if (!card) return t.data.startsWith(`${y}-${mStr}`); // Fallback

                // Invoice for Month M:
                // Ends: Closing Day of Month M
                // Starts: Closing Day of Month M-1 + 1 day

                const closingDay = card.closing_day || 1;
                const closingDate = new Date(yNum, mNum - 1, closingDay); // Current Month Closing

                const startDate = new Date(yNum, mNum - 2, closingDay);   // Previous Month Closing
                startDate.setDate(startDate.getDate() + 1);               // Start is Next Day

                return tDate >= startDate && tDate <= closingDate;
            }
        });

        monthTrans.sort((a, b) => new Date(b.data) - new Date(a.data));


        // --- TRANSACTIONS LIST RENDERING ---
        // --- TRANSACTIONS LIST RENDERING (GLASS CARDS) ---
        if (this.els.transList) {
            // Un-hide container if hidden
            const containerEl = this.els.transList.parentElement;

            if (monthTrans.length === 0) {
                this.els.transList.innerHTML = `
                    <div class="trans-empty-state">
                        <div class="empty-icon"><i class="fa-regular fa-folder-open"></i></div>
                        <div class="empty-text">Nenhuma movimentação neste período.</div>
                        <div class="empty-subtext">Clique em + Adicionar para começar.</div>
                    </div>`;
            } else {
                this.els.transList.innerHTML = monthTrans.map(t => {
                    const metaDesc = t.card_id ? '<i class="fa-regular fa-credit-card"></i>' : (t.installment_total ? `<span class="inst-badge">${t.installment_current}/${t.installment_total}</span>` : '');
                    const icon = this.getCategoryIcon(t.categoria);
                    const isExp = t.tipo === 'expense';
                    const valColor = isExp ? 'text-red-400' : 'text-green-400';
                    const amountSign = isExp ? '-' : '+';

                    return `
                    <div class="trans-card">
                        <div class="trans-icon-box">${icon}</div>
                        
                        <div class="trans-details">
                            <div class="trans-title">${t.descricao} ${metaDesc}</div>
                            <div class="trans-meta">
                                <span>${this.formatDate(t.data)}</span>
                                <span class="dot">•</span>
                                <span>${t.categoria}</span>
                            </div>
                        </div>

                        <div class="trans-right">
                             <div class="trans-amount ${valColor}">
                                ${amountSign} ${this.formatCurrency(t.valor)}
                             </div>
                             <div class="trans-actions">
                                <button onclick="window.app.approveTransaction('${t.id}')" title="${t.efetivado ? 'Desmarcar' : 'Efetivar'}" class="action-btn ${t.efetivado ? 'done' : ''}">
                                    <i class="fa-solid fa-check"></i>
                                </button>
                                <button onclick="window.app.deleteTransaction('${t.id}')" title="Excluir" class="action-btn delete">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                             </div>
                        </div>
                    </div>`;
                }).join('');
            }

            // Update Count
            const countEl = document.getElementById('transCount');
            if (countEl) countEl.innerText = `${monthTrans.length} Registros`;
        }



        if (this.els.categoriesList) {
            const addCard = `
            <div class="category-card category-add-card" onclick="window.app.addCategory()">
                <div class="category-icon"><i class="fa-solid fa-plus"></i></div>
                <div class="category-name">Nova Categoria</div>
            </div>`;

            const cards = this.categories.map(c => `
            <div class="category-card">
                <button class="category-delete-btn" onclick="event.stopPropagation(); window.app.deleteCategory('${c}')" title="Excluir">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <div class="category-icon">${this.getCategoryIcon(c)}</div>
                <div class="category-name">${c}</div>
            </div>`).join('');

            this.els.categoriesList.innerHTML = addCard + cards;
        }

        // --- STRICT BALANCE CALCULATION ---
        let totalIncome = 0;
        let totalExpense = 0;

        monthTrans.forEach(t => {
            const val = Math.abs(parseFloat(t.valor) || 0); // Force positive magnitude
            if (t.tipo === 'income') {
                totalIncome += val;
            } else if (t.tipo === 'expense' && t.efetivado !== false && !t.card_id) {
                // FIXED: Only count expenses that are NOT on credit card (Credit Card expenses are paid via Invoice)
                totalExpense += val;
            }
        });

        const totalBalance = totalIncome - totalExpense;
        const initBal = this.config.saldo_inicial || 0;
        const finalBal = initBal + totalBalance;

        // Update Dashboard UI
        this.setText(this.els.income, this.formatCurrency(totalIncome));
        this.setText(this.els.expense, this.formatCurrency(totalExpense));

        // Format and Style Monthly Balance
        this.setText(this.els.monthBalance, this.formatCurrency(totalBalance));
        this.els.monthBalance.className = 'card-value sensitive'; // Reset + Ensure Sensitive

        const monthCard = this.els.monthBalance.closest('.card');
        if (monthCard) {
            monthCard.classList.remove('card-green', 'card-red', 'card-blue', 'card-purple');
            monthCard.classList.add(totalBalance < 0 ? 'card-red' : 'card-blue');
        }

        this.setText(this.els.finalBalance, this.formatCurrency(finalBal));
        this.els.finalBalance.className = 'card-value sensitive';

        const finalCard = this.els.finalBalance.closest('.card');
        if (finalCard) {
            finalCard.classList.remove('card-green', 'card-red', 'card-blue', 'card-purple');
            finalCard.classList.add(finalBal < 0 ? 'card-red' : 'card-purple');
        }

        this.renderProjectionCharts(monthTrans);

        if (this.els.cardsList) {
            const cardItems = this.cards.map(c => {
                // Calculate Invoice Total for this Month/Cycle
                const cardTotal = monthTrans.reduce((acc, t) => {
                    return (t.card_id === c.id && t.tipo === 'expense' && t.efetivado !== false) ? acc + t.valor : acc;
                }, 0);

                const limit = c.limit || 0;
                const available = limit - cardTotal;
                const progress = limit > 0 ? Math.min((cardTotal / limit) * 100, 100) : 0;

                // Color fallback
                const color = c.color || '#3b82f6';
                // We use inline style for the specific card color gradient
                // The class .credit-card handles the glass overlay and noise

                return `
                <div class="credit-card" 
                     style="background: linear-gradient(135deg, ${color}, ${color}CC);"
                     onclick="window.app.openCardDetails('${c.id}')">
                    
                    <div class="card-top">
                        <div class="card-chip"></div>
                        <h4 style="font-size: 1.2rem; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${c.name}</h4>
                    </div>

                    <div class="card-middle" style="margin-top: auto; margin-bottom: 1rem;">
                        <div class="card-invoice-label" style="font-size: 0.8rem; opacity: 0.8;">Fatura Atual</div>
                        <div class="card-invoice-value" style="font-size: 1.8rem; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                            ${this.formatCurrency(cardTotal)}
                        </div>
                    </div>

                    <div class="card-bottom">
                        <div class="card-limit-info" style="display:flex; justify-content:space-between; font-size: 0.85rem; margin-bottom: 6px; font-weight: 500;">
                            <span>Disp: ${this.formatCurrency(available)}</span>
                            <span>${Math.round(progress)}%</span>
                        </div>
                        <div class="card-progress-bg" style="background: rgba(255,255,255,0.2); height: 6px; border-radius: 3px; overflow:hidden;">
                            <div class="card-progress-fill" style="width: ${progress}%; background: white; height: 100%; box-shadow: 0 0 10px rgba(255,255,255,0.5);"></div>
                        </div>
                    </div>
                </div>`;
            }).join('');

            // Add Card Placeholder
            const addCardHtml = `
            <div class="card-add-placeholder" onclick="window.app.openCardModal()">
                <div class="card-add-icon">
                    <i class="fa-solid fa-plus"></i>
                </div>
                <span style="font-weight: 600;">Novo Cartão</span>
            </div>`;

            this.els.cardsList.innerHTML = cardItems + addCardHtml;
        }



        // --- RENDER OLD TO NEW CARD MAPPING ---
        if (this.els.fixedExpensesList) {
            this.els.fixedExpensesList.innerHTML = this.fixedExpenses.filter(f => !f.tipo || f.tipo === 'expense').map(f => `
            <div class="fixed-card expense-border">
                <div class="fixed-date-box">${f.dia_vencimento}</div>
                <div class="fixed-info">
                    <span class="fixed-title">${f.descricao}</span>
                    <span class="fixed-cat">${this.getCategoryIcon(f.categoria)} ${f.categoria}</span>
                </div>
                <div class="fixed-value">${this.formatCurrency(f.valor)}</div>
                <div class="fixed-actions">
                    <button class="delete-btn" onclick="window.app.deleteFixedExpense('${f.id}')" title="Excluir">
                        ${TRASH_ICON}
                    </button>
                </div>
            </div>`).join('');
        }
        if (this.els.fixedIncomeList) {
            this.els.fixedIncomeList.innerHTML = this.fixedExpenses.filter(f => f.tipo === 'income').map(f => `
            <div class="fixed-card recipe-border">
                <div class="fixed-date-box">${f.dia_vencimento}</div>
                <div class="fixed-info">
                    <span class="fixed-title">${f.descricao}</span>
                    <span class="fixed-cat">${this.getCategoryIcon(f.categoria)} ${f.categoria}</span>
                </div>
                <div class="fixed-value text-green">${this.formatCurrency(f.valor)}</div>
                <div class="fixed-actions">
                    <button class="delete-btn" onclick="window.app.deleteFixedExpense('${f.id}')" title="Excluir">
                        ${TRASH_ICON}
                    </button>
                </div>
            </div>`).join('');
        }
    }

    // --- CATEGORY MANAGEMENT ---
    async addCategory() {
        // Fallback to prompt if no input found (or if calling from card)
        let name = prompt('🌟 Nome da nova categoria:');

        if (!name) return;
        name = name.trim();

        if (this.categories.includes(name)) {
            return this.showToast('Categoria já existe!', 'warning');
        }

        this.categories.push(name);
        this.render(); // Will render the new card inside the grid
        this.saveCategories();
        this.showToast('Categoria adicionada', 'success');
    }

    async deleteCategory(name) {
        if (!confirm(`Excluir categoria "${name}"?`)) return;
        this.categories = this.categories.filter(c => c !== name);
        this.render();
        this.saveCategories();
        this.showToast('Categoria removida');
    }

    async saveCategories() {
        if (this.config && this.config.id) {
            const { error } = await this.supabase.from('configuracoes').update({ categories: this.categories }).eq('id', this.config.id);
            if (error) console.warn('Could not save categories to DB:', error);
        }
    }

    renderHomeChart(transactions) {
        if (!this.els.homeChart) return;

        const ctx = this.els.homeChart.getContext('2d');
        if (this.homeChartInstance) this.homeChartInstance.destroy();

        // 1. Group by Day (1-31)
        const daysInMonth = 31; // Simplification, could be dynamic
        const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const incomeData = new Array(daysInMonth).fill(0);
        const expenseData = new Array(daysInMonth).fill(0);

        transactions.forEach(t => {
            if (t.efetivado === false) return;
            // Extract day from YYYY-MM-DD
            const day = parseInt(t.data.split('-')[2]);
            if (day >= 1 && day <= daysInMonth) {
                const val = Math.abs(parseFloat(t.valor) || 0);
                if (t.tipo === 'income') incomeData[day - 1] += val;
                else if (t.tipo === 'expense') expenseData[day - 1] += val;
            }
        });

        // 2. Create Chart
        this.homeChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Receitas',
                        data: incomeData,
                        backgroundColor: '#10b981', // Green
                        borderRadius: 20, // Rounded Bars
                        borderSkipped: false, // Round all corners
                        barThickness: 12,
                    },
                    {
                        label: 'Despesas',
                        data: expenseData,
                        backgroundColor: '#ef4444', // Red
                        borderRadius: 20, // Rounded Bars
                        borderSkipped: false,
                        barThickness: 12,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#fff' } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false }, // Clean look
                        ticks: { color: '#9ca3af' }
                    },
                    y: {
                        grid: { display: false, drawBorder: false }, // Clean look
                        ticks: { display: false } // Minimalist
                    }
                }
            }
        });
    }

    renderProjectionCharts(transactions) {
        // --- 1. Daily Cash Flow (Bar Chart) ---
        if (this.els.projChart) {
            const ctx = this.els.projChart.getContext('2d');
            if (this.projChartInstance) this.projChartInstance.destroy();

            // Prepare Data: Days 1-31
            const daysInMonth = 31;
            const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
            const incomeData = new Array(daysInMonth).fill(0);
            const expenseData = new Array(daysInMonth).fill(0);

            transactions.forEach(t => {
                if (t.efetivado === false) return;
                const day = parseInt(t.data.split('-')[2]);
                if (day >= 1 && day <= daysInMonth) {
                    if (t.tipo === 'income') incomeData[day - 1] += t.valor;
                    else if (t.tipo === 'expense') expenseData[day - 1] += t.valor;
                }
            });

            this.projChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Receitas',
                            data: incomeData,
                            backgroundColor: (context) => {
                                const ctx = context.chart.ctx;
                                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                                gradient.addColorStop(0, '#34d399'); // Neon Green
                                gradient.addColorStop(1, 'rgba(52, 211, 153, 0.1)');
                                return gradient;
                            },
                            borderRadius: 4,
                            borderSkipped: false,
                            barPercentage: 0.6,
                        },
                        {
                            label: 'Despesas',
                            data: expenseData,
                            backgroundColor: (context) => {
                                const ctx = context.chart.ctx;
                                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                                gradient.addColorStop(0, '#f87171'); // Neon Red
                                gradient.addColorStop(1, 'rgba(248, 113, 113, 0.1)');
                                return gradient;
                            },
                            borderRadius: 4,
                            borderSkipped: false,
                            barPercentage: 0.6,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#e5e7eb', usePointStyle: true, font: { family: "'Inter', sans-serif" } } },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(17, 24, 39, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#e5e7eb',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false, drawBorder: false },
                            ticks: { color: '#9ca3af', font: { size: 10 } }
                        },
                        y: {
                            grid: { display: true, color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, // Subtle guidelines
                            border: { display: false },
                            ticks: { color: '#9ca3af', font: { size: 10 }, callback: (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumSignificantDigits: 1 }) }
                        }
                    }
                }
            });
        }

        // --- 2. Categories (Doughnut) ---
        if (this.els.catChart) {
            const ctx = this.els.catChart.getContext('2d');
            if (this.catChartInstance) this.catChartInstance.destroy();

            const expenses = transactions.filter(t => t.tipo === 'expense');

            if (expenses.length === 0) {
                this.catChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Sem dados'], datasets: [{ data: [1], backgroundColor: ['#374151'] }] }, options: { cutout: '70%', plugins: { legend: { display: false } } } });
            } else {
                const map = {};
                expenses.forEach(t => { map[t.categoria] = (map[t.categoria] || 0) + t.valor; });
                const labels = Object.keys(map);
                const data = Object.values(map);
                const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4'];

                this.catChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: colors.slice(0, labels.length),
                            borderWidth: 0,
                            hoverOffset: 10
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: { color: '#e5e7eb', usePointStyle: true, padding: 20, font: { size: 12 } }
                            }
                        }
                    }
                });
            }
        }
    }

    showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Animation Entry
        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });

        // Removal
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    setText(el, text) {
        if (!el) return;
        // UPDATED REGEX: Include '-' to allow negative numbers logic
        if (text && text.includes('R$') && !isNaN(parseFloat(text.replace(/[^\d,-]/g, '').replace(',', '.')))) {
            const endVal = parseFloat(text.replace(/[^\d,-]/g, '').replace(',', '.'));
            const currentStr = el.innerText;
            const startVal = currentStr && currentStr.includes('R$') ? parseFloat(currentStr.replace(/[^\d,-]/g, '').replace(',', '.')) : 0;
            if (startVal !== endVal) {
                this.animateValue(el, startVal, endVal, 1500);
            } else {
                el.innerText = text;
            }
        } else {
            el.innerText = text;
        }
    }

    animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4);
            const val = start + (end - start) * ease;
            obj.innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(end);
            }
        };
        window.requestAnimationFrame(step);
    }

    openCardDetails(id) {
        this.currentCardId = id; const c = this.cards.find(x => x.id === id); if (!c || !this.els.cardDetailsModal) return;
        this.els.cardDetailsModal.classList.add('active'); this.setText(this.els.detailCardName, c.name);

        const [y, mStr] = this.els.monthYear ? this.els.monthYear.value.split('-') : this.getCurrentMonthStr().split('-');
        const yNum = parseInt(y), mNum = parseInt(mStr);
        const closingDay = parseInt(c.closing_day) || 10;
        const closingDate = new Date(yNum, mNum - 1, closingDay);
        closingDate.setHours(23, 59, 59, 999);
        const startDate = new Date(yNum, mNum - 2, closingDay);
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(0, 0, 0, 0);

        const txs = this.transactions.filter(t => {
            if (t.card_id !== id) return false;
            const [ty, tm, td] = t.data.split('-').map(Number);
            const tDate = new Date(ty, tm - 1, td);
            tDate.setHours(12, 0, 0, 0);
            return tDate >= startDate && tDate <= closingDate;
        });

        const calcTxs = txs.filter(t => t.efetivado !== false);
        const total = calcTxs.reduce((s, t) => s + t.valor, 0);

        this.setText(this.els.detailCardInvoice, this.formatCurrency(total));
        this.setText(this.els.detailCardLimit, this.formatCurrency(c.limit - total));

        const startStr = `${startDate.getDate()}/${startDate.getMonth() + 1}`;
        const endStr = `${closingDate.getDate()}/${closingDate.getMonth() + 1}`;
        this.setText(this.els.detailCardPeriod, `${startStr} a ${endStr}`);

        if (this.els.cardTransList) {
            this.els.cardTransList.innerHTML = txs.map(t => {
                const isPending = t.efetivado === false;
                const statusClass = isPending ? 'pending' : 'approved';
                const statusIcon = isPending ?
                    `<button class="action-btn check-btn" onclick="window.app.approveTransaction('${t.id}')" title="Aprovar"><i class="fa-solid fa-check"></i></button>` :
                    `<i class="fa-solid fa-check-circle text-neon-green" title="Aprovado"></i>`;
                const [y, m, d] = t.data.split('-');
                const dayStr = `${d}/${m}`;
                return `
                <div class="transaction-card ${statusClass}">
                    <div class="trans-info">
                        <div class="trans-desc">${t.descricao}</div>
                        <div class="trans-date">${dayStr}</div>
                    </div>
                    <div class="trans-value">${this.formatCurrency(t.valor)}</div>
                    <div class="trans-actions">
                        ${statusIcon}
                        <button class="action-btn delete-btn" onclick="window.app.deleteTransaction('${t.id}')">
                            ${TRASH_ICON}
                        </button>
                    </div>
                </div>`;
            }).join('');
        }

        const percentage = c.limit > 0 ? Math.min((total / c.limit) * 100, 100) : 100;
        let progressBar = document.getElementById('limitProgressBar');
        if (!progressBar) {
            const limitEl = document.getElementById('detailCardLimit');
            if (limitEl && limitEl.parentNode && !limitEl.parentNode.querySelector('.limit-progress-bg')) {
                const bar = document.createElement('div');
                bar.className = 'limit-progress-bg';
                bar.innerHTML = `<div class="limit-progress-fill" id="limitProgressBar" style="width: 0%"></div>`;
                limitEl.parentNode.appendChild(bar);
                progressBar = document.getElementById('limitProgressBar');
            }
        }
        if (progressBar) progressBar.style.width = `${percentage}%`;
    }

    formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
    formatDate(d) { const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
    getCurrentMonthStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
    getCategoryIcon(c) { return CATEGORY_ICONS[c] || '🔹'; }
    renderCategoryOptions() {
        const h = this.categories.map(c => `<option value="${c}">${c}</option>`).join('');
        [document.getElementById('transCategory'), document.getElementById('fixedCategory')].forEach(el => { if (el) el.innerHTML = h; });
    }
    // --- RECEIVABLES LOGIC ---
    openReceivablesModal() {
        if (this.els.recModal) this.els.recModal.classList.add('active');
        this.renderReceivables();
    }

    closeReceivablesModal() {
        if (this.els.recModal) this.els.recModal.classList.remove('active');
    }

    async handleAddReceivable(e) {
        e.preventDefault();
        const getVal = (id) => document.getElementById(id).value;

        const devedor = getVal('recName');
        const descBase = getVal('recDesc');

        // Simple float parse for number input
        const totalVal = parseFloat(getVal('recValue')) || 0;

        const dateStr = getVal('recDate');
        let installments = parseInt(getVal('recInstallments')) || 1;
        if (installments < 1) installments = 1;

        const valPerInst = totalVal / installments;
        const baseDate = new Date(dateStr);
        const newRecs = [];

        for (let i = 0; i < installments; i++) {
            const d = new Date(baseDate);
            d.setMonth(d.getMonth() + i);
            const finalDesc = installments > 1 ? `${descBase} (${i + 1}/${installments})` : descBase;

            newRecs.push({
                id: crypto.randomUUID(),
                devedor: devedor,
                descricao: finalDesc,
                valor: valPerInst,
                data_prevista: d.toISOString().split('T')[0],
                pago: false
            });
        }

        const { data, error } = await this.supabase.from('valores_a_receber').insert(newRecs).select();
        if (!error) {
            this.receivables.push(...data);
            this.success(installments > 1 ? `${installments} Cobranças Geradas!` : 'Cobrança Adicionada');
            this.renderReceivables();
            e.target.reset();
            if (document.getElementById('recInstallments')) document.getElementById('recInstallments').value = 1;
        } else {
            this.error(error.message);
        }
    }

    renderReceivables() {
        if (!this.els.recModal || !this.els.recModal.querySelector('#receivablesList')) return;
        const container = this.els.recModal.querySelector('#receivablesList');

        if (this.receivables.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding: 2rem; color: #9ca3af; text-align: center;">Ninguém te deve nada! 🎉</div>';
            return;
        }

        container.classList.add('debts-list-container');

        container.innerHTML = this.receivables.map(r => {
            const initial = r.devedor.charAt(0).toUpperCase();
            const dateStr = this.formatDate(r.data_prevista);

            return `
            <div class="debt-card">
                <div class="debt-avatar">${initial}</div>
                <div class="debt-info">
                    <div class="debt-name">${r.devedor} <span class="debt-desc">${r.descricao}</span></div>
                    <div class="debt-date">${dateStr}</div>
                </div>
                <div class="debt-actions">
                    <div class="debt-value">${this.formatCurrency(r.valor)}</div>
                    <div style="display:flex; gap: 5px;">
                         <button class="btn-check" onclick="window.app.confirmReceive('${r.id}')" title="Receber">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button class="btn-delete" onclick="window.app.deleteReceivable('${r.id}')" title="Excluir">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    async confirmReceive(id) {
        const item = this.receivables.find(x => x.id === id);
        if (!item) return;

        if (confirm(`Confirmar recebimento de ${this.formatCurrency(item.valor)} de ${item.devedor}?`)) {
            const { error: transError } = await this.supabase.from('transacoes').insert([{
                descricao: `Recebido de ${item.devedor} (${item.descricao})`,
                valor: item.valor,
                tipo: 'income',
                data: new Date().toISOString().split('T')[0],
                categoria: 'Outros',
                efetivado: true
            }]);

            if (transError) {
                this.error('Erro ao criar receita: ' + transError.message);
                return;
            }

            const { error: updateError } = await this.supabase.from('valores_a_receber')
                .update({ pago: true })
                .eq('id', id);

            if (!updateError) {
                this.receivables = this.receivables.filter(x => x.id !== id);
                this.success(`Recebido R$ ${item.valor}!`);
                this.renderReceivables();
                this.render(); // Update balance
            } else {
                this.error(updateError.message);
            }
        }
    }

    async deleteReceivable(id) {
        if (!confirm('Excluir esta cobrança?')) return;
        const { error } = await this.supabase.from('valores_a_receber').delete().eq('id', id);
        if (!error) {
            this.receivables = this.receivables.filter(x => x.id !== id);
            this.renderReceivables();
            this.showToast('Excluído com sucesso');
        } else {
            this.error(error.message);
        }
    }

    switchTab(btn) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active'); const t = document.getElementById(btn.dataset.target); if (t) t.classList.add('active');
    }
    success(msg) { this.showToast(msg, 'success'); this.closeAllModals(); this.render(); }
    error(msg) { this.showToast(msg, 'error'); }
    payInvoice() {
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
