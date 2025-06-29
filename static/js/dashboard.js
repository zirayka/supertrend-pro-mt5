/**
 * SuperTrend Pro MT5 Dashboard - Enhanced JavaScript
 * Professional trading dashboard with direct MT5 integration
 */

class SuperTrendDashboard {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isRunning = true;
        this.currentSymbol = 'EURUSD';
        this.chart = null;
        this.config = {
            periods: 20,
            multiplier: 2.0,
            rsi_length: 14,
            use_rsi_filter: true
        };
        
        // Data storage
        this.availablePairs = [];
        this.filteredPairs = [];
        this.accountInfo = {};
        this.connectionInfo = {};
        this.chartData = [];
        this.signals = [];
        
        // Performance monitoring
        this.lastUpdateTime = Date.now();
        this.updateCount = 0;
        this.performanceMetrics = {
            avgLatency: 0,
            updateRate: 0
        };
        
        this.init();
    }
    
    init() {
        console.log('🚀 Initializing Enhanced SuperTrend Dashboard - MT5 Direct Connection');
        
        this.setupWebSocket();
        this.setupEventListeners();
        this.setupChart();
        this.loadInitialData();
        this.startPerformanceMonitoring();
        
        // Start periodic updates
        setInterval(() => this.updateLastUpdateTime(), 1000);
        setInterval(() => this.refreshData(), 3000);
        setInterval(() => this.updatePerformanceMetrics(), 5000);
    }
    
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('🔌 Establishing WebSocket connection:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket connected successfully');
            this.isConnected = true;
            this.updateConnectionStatus(true);
            
            // Subscribe to all events
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                events: [
                    'tick', 'market_data', 'connection_status', 'signal', 
                    'account_info', 'symbols', 'positions', 'orders',
                    'supertrend_update', 'error'
                ]
            }));
            
            this.showNotification('Connected to MT5 Dashboard', 'success');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
                this.updateCount++;
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('❌ WebSocket disconnected');
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.showNotification('Connection lost. Attempting to reconnect...', 'warning');
            
            // Attempt to reconnect after 3 seconds
            setTimeout(() => this.setupWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.showNotification('WebSocket connection error', 'error');
        };
    }
    
    handleWebSocketMessage(data) {
        const startTime = performance.now();
        
        switch (data.type) {
            case 'tick':
                this.updateTickData(data.data);
                break;
            case 'market_data':
                this.updateMarketData(data.data);
                break;
            case 'connection_status':
                this.updateMT5Status(data.data);
                break;
            case 'account_info':
                this.updateAccountInfo(data.data);
                break;
            case 'symbols':
                this.updateAvailablePairs(data.data);
                break;
            case 'positions':
                this.updatePositions(data.data);
                break;
            case 'orders':
                this.updateOrders(data.data);
                break;
            case 'signal':
                this.addTradingSignal(data.data);
                break;
            case 'supertrend_update':
                this.updateSupertrendData(data.data);
                break;
            case 'error':
                this.handleError(data.data);
                break;
            case 'subscription_confirmed':
                console.log('✅ Subscribed to events:', data.events);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
        
        // Update performance metrics
        const processingTime = performance.now() - startTime;
        this.updateLatencyMetrics(processingTime);
    }
    
    setupEventListeners() {
        // Enhanced control buttons
        document.getElementById('play-pause-btn')?.addEventListener('click', () => {
            this.toggleRunning();
        });
        
        document.getElementById('reset-btn')?.addEventListener('click', () => {
            this.resetData();
        });
        
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.toggleSettings();
        });
        
        document.getElementById('close-settings')?.addEventListener('click', () => {
            this.toggleSettings();
        });
        
        document.getElementById('refresh-connection')?.addEventListener('click', () => {
            this.refreshConnection();
        });
        
        // Connection test modal
        document.getElementById('connection-test-btn')?.addEventListener('click', () => {
            this.showConnectionTestModal();
        });
        
        document.getElementById('close-test-modal')?.addEventListener('click', () => {
            this.hideConnectionTestModal();
        });
        
        document.getElementById('run-test')?.addEventListener('click', () => {
            this.runConnectionTest();
        });
        
        // Pair management
        document.getElementById('pair-selector')?.addEventListener('change', (e) => {
            this.changeSymbol(e.target.value);
        });
        
        document.getElementById('pair-search')?.addEventListener('input', (e) => {
            this.filterPairs(e.target.value);
        });
        
        // Category filters
        document.querySelectorAll('.category-filter').forEach(button => {
            button.addEventListener('click', (e) => {
                this.filterByCategory(e.target.dataset.category);
                this.updateCategoryFilterUI(e.target);
            });
        });
        
        // Enhanced parameter controls
        this.setupParameterControls();
        
        // Alert management
        document.getElementById('clear-alerts')?.addEventListener('click', () => {
            this.clearAlerts();
        });
        
        // Apply settings
        document.getElementById('apply-settings')?.addEventListener('click', () => {
            this.applySettings();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
        
        // Click outside to close modals
        document.addEventListener('click', (e) => {
            this.handleOutsideClick(e);
        });
    }
    
    setupParameterControls() {
        const controls = [
            { id: 'atr-period', key: 'periods', display: 'atr-period-value' },
            { id: 'multiplier', key: 'multiplier', display: 'multiplier-value' },
            { id: 'rsi-period', key: 'rsi_length', display: 'rsi-period-value' }
        ];
        
        controls.forEach(control => {
            const element = document.getElementById(control.id);
            const display = document.getElementById(control.display);
            
            if (element && display) {
                element.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    this.config[control.key] = value;
                    
                    // Update display with proper formatting
                    if (control.key === 'multiplier') {
                        display.textContent = value.toFixed(1);
                    } else {
                        display.textContent = value;
                    }
                    
                    // Update range slider background
                    this.updateRangeSliderBackground(element);
                    
                    // Real-time config update
                    this.updateConfig();
                });
                
                // Initialize range slider background
                this.updateRangeSliderBackground(element);
            }
        });
        
        // RSI filter toggle
        const rsiToggle = document.getElementById('use-rsi-filter');
        if (rsiToggle) {
            rsiToggle.addEventListener('change', (e) => {
                this.config.use_rsi_filter = e.target.checked;
                this.updateConfig();
                this.updateToggleUI(rsiToggle);
            });
        }
    }
    
    // Missing method implementations
    updateRangeSliderBackground(element) {
        const value = element.value;
        const min = element.min || 0;
        const max = element.max || 100;
        const percentage = ((value - min) / (max - min)) * 100;
        
        element.style.setProperty('--value', `${percentage}%`);
    }
    
    updateToggleUI(toggle) {
        const wrapper = toggle.parentElement;
        if (toggle.checked) {
            wrapper.classList.add('bg-primary-500');
            wrapper.classList.remove('bg-gray-600');
        } else {
            wrapper.classList.add('bg-gray-600');
            wrapper.classList.remove('bg-primary-500');
        }
    }
    
    updateCategoryFilterUI(activeButton) {
        // Remove active state from all buttons
        document.querySelectorAll('.category-filter').forEach(btn => {
            btn.classList.remove('active', 'bg-primary-500', 'text-white');
            btn.classList.add('glass', 'text-gray-300');
        });
        
        // Add active state to clicked button
        activeButton.classList.add('active', 'bg-primary-500', 'text-white');
        activeButton.classList.remove('glass', 'text-gray-300');
    }
    
    showConnectionTestModal() {
        const modal = document.getElementById('connection-test-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }
    
    hideConnectionTestModal() {
        const modal = document.getElementById('connection-test-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
    
    async runConnectionTest() {
        const resultsDiv = document.getElementById('test-results');
        if (!resultsDiv) return;
        
        resultsDiv.innerHTML = `
            <div class="text-center py-8">
                <div class="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p class="text-gray-400">Testing MT5 connection...</p>
            </div>
        `;
        
        try {
            const response = await fetch('/api/test-connection', { method: 'POST' });
            const result = await response.json();
            
            let html = '<div class="space-y-3">';
            
            for (const [testName, testResult] of Object.entries(result.results)) {
                const icon = testResult.success ? 'check-circle' : 'x-circle';
                const color = testResult.success ? 'text-primary-500' : 'text-red-500';
                
                html += `
                    <div class="flex items-center justify-between p-3 glass rounded-lg">
                        <div class="flex items-center space-x-3">
                            <i data-lucide="${icon}" class="w-5 h-5 ${color}"></i>
                            <span class="text-white font-medium">${testName.replace('_', ' ').toUpperCase()}</span>
                        </div>
                        <span class="text-sm text-gray-400">${testResult.success ? 'PASS' : 'FAIL'}</span>
                    </div>
                    <p class="text-sm text-gray-400 ml-8">${testResult.message}</p>
                `;
            }
            
            html += '</div>';
            resultsDiv.innerHTML = html;
            
            lucide.createIcons();
            
        } catch (error) {
            resultsDiv.innerHTML = `
                <div class="text-center py-8">
                    <i data-lucide="x-circle" class="w-12 h-12 text-red-500 mx-auto mb-4"></i>
                    <p class="text-red-400 font-medium">Connection test failed</p>
                    <p class="text-gray-400 text-sm">${error.message}</p>
                </div>
            `;
            lucide.createIcons();
        }
    }
    
    clearAlerts() {
        const alertsContent = document.getElementById('alerts-content');
        if (alertsContent) {
            alertsContent.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <i data-lucide="bell" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                    <p class="font-medium">No signals yet</p>
                    <p class="text-sm">Trading signals will appear here when conditions are met</p>
                </div>
            `;
            lucide.createIcons();
        }
        this.signals = [];
    }
    
    applySettings() {
        this.updateConfig();
        this.showNotification('Settings applied successfully', 'success');
        this.toggleSettings();
    }
    
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + key combinations
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'p':
                    e.preventDefault();
                    this.toggleRunning();
                    break;
                case 'r':
                    e.preventDefault();
                    this.resetData();
                    break;
                case 's':
                    e.preventDefault();
                    this.toggleSettings();
                    break;
                case 't':
                    e.preventDefault();
                    this.showConnectionTestModal();
                    break;
            }
        }
        
        // Escape key
        if (e.key === 'Escape') {
            this.hideConnectionTestModal();
            const settingsPanel = document.getElementById('settings-panel');
            if (settingsPanel && !settingsPanel.classList.contains('hidden')) {
                this.toggleSettings();
            }
        }
    }
    
    handleOutsideClick(e) {
        // Close modals when clicking outside
        const modal = document.getElementById('connection-test-modal');
        if (modal && !modal.classList.contains('hidden')) {
            if (e.target === modal) {
                this.hideConnectionTestModal();
            }
        }
    }
    
    handleError(errorData) {
        console.error('MT5 Error:', errorData);
        this.showNotification(`MT5 Error: ${errorData.message || 'Unknown error'}`, 'error');
    }
    
    updatePositions(positions) {
        document.getElementById('open-positions').textContent = positions.length;
        
        // Calculate total P&L
        const totalPnL = positions.reduce((sum, pos) => sum + (pos.profit || 0), 0);
        const pnlElement = document.getElementById('daily-pnl');
        if (pnlElement) {
            const sign = totalPnL >= 0 ? '+' : '';
            pnlElement.textContent = `${sign}$${totalPnL.toFixed(2)}`;
            pnlElement.className = totalPnL >= 0 ? 'text-2xl font-bold text-primary-500' : 'text-2xl font-bold text-red-500';
        }
    }
    
    updateOrders(orders) {
        document.getElementById('pending-orders').textContent = orders.length;
    }
    
    setupChart() {
        const ctx = document.getElementById('price-chart');
        if (!ctx) return;
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Price',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'SuperTrend Upper',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                        borderDash: [5, 5]
                    },
                    {
                        label: 'SuperTrend Lower',
                        data: [],
                        borderColor: '#22c55e',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#10b981',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                size: 11
                            }
                        },
                        grid: {
                            color: 'rgba(55, 65, 81, 0.3)',
                            drawBorder: false
                        }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                size: 11
                            }
                        },
                        grid: {
                            color: 'rgba(55, 65, 81, 0.3)',
                            drawBorder: false
                        }
                    }
                },
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }
    
    async loadInitialData() {
        try {
            console.log('📊 Loading initial data from MT5...');
            this.showLoadingState();
            
            // Load dashboard state
            const response = await fetch('/api/dashboard-state');
            if (response.ok) {
                const state = await response.json();
                this.updateDashboardState(state);
                console.log('✅ Dashboard state loaded');
            } else {
                console.warn('Failed to load dashboard state');
                this.showConnectionError();
            }
            
            // Load available pairs
            await this.loadAvailablePairs();
            
            // Load account summary
            await this.loadAccountSummary();
            
            this.hideLoadingState();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showConnectionError();
            this.hideLoadingState();
        }
    }
    
    showLoadingState() {
        // Show loading indicators
        const elements = ['pairs-count', 'current-price', 'account-balance'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Loading...';
                element.classList.add('animate-pulse');
            }
        });
    }
    
    hideLoadingState() {
        // Hide loading indicators
        const elements = ['pairs-count', 'current-price', 'account-balance'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.remove('animate-pulse');
            }
        });
    }
    
    showConnectionError() {
        // Show MT5 connection error
        const statusContent = document.getElementById('mt5-status-content');
        if (statusContent) {
            statusContent.innerHTML = `
                <div class="text-center py-8">
                    <i data-lucide="alert-triangle" class="w-16 h-16 text-red-500 mx-auto mb-4"></i>
                    <h3 class="text-white font-medium mb-2">MT5 Connection Required</h3>
                    <p class="text-gray-400 mb-4">Please ensure MetaTrader 5 Terminal is running and you are logged into your account.</p>
                    <div class="space-y-2 text-sm text-gray-400 mb-4">
                        <p>✓ Start MetaTrader 5 Terminal</p>
                        <p>✓ Log into your trading account</p>
                        <p>✓ Enable 'Allow automated trading' in settings</p>
                    </div>
                    <button onclick="dashboard.refreshConnection()" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                        Try Connect
                    </button>
                </div>
            `;
        }
        
        // Update connection status
        this.updateConnectionStatus(false, 'disconnected');
        
        lucide.createIcons();
    }
    
    showEmptyPairsState() {
        const selector = document.getElementById('pair-selector');
        if (selector) {
            selector.innerHTML = '<option value="" disabled>No pairs available - Check MT5 connection</option>';
        }
        
        const pairsCount = document.getElementById('pairs-count');
        if (pairsCount) {
            pairsCount.textContent = '0 pairs';
        }
    }
    
    async loadAvailablePairs() {
        try {
            const response = await fetch('/api/pairs');
            if (response.ok) {
                const pairs = await response.json();
                this.updateAvailablePairs(pairs);
                console.log(`✅ Loaded ${pairs.length} trading pairs`);
            } else {
                console.warn('Failed to load pairs from MT5');
                this.showEmptyPairsState();
            }
        } catch (error) {
            console.error('Error loading pairs:', error);
            this.showEmptyPairsState();
        }
    }
    
    async loadAccountSummary() {
        try {
            const response = await fetch('/api/account-summary');
            if (response.ok) {
                const summary = await response.json();
                this.updateAccountInfo(summary.account);
                this.updatePositions(summary.positions);
                this.updateOrders(summary.orders);
                this.updateTradingStats(summary.trading);
                console.log('✅ Account summary loaded');
            }
        } catch (error) {
            console.error('Error loading account summary:', error);
        }
    }
    
    async refreshData() {
        if (!this.isRunning) return;
        
        try {
            // Refresh tick data for current symbol
            const tickResponse = await fetch(`/api/tick?symbol=${this.currentSymbol}`);
            if (tickResponse.ok) {
                const tick = await tickResponse.json();
                this.updateTickData(tick);
            }
            
            // Refresh connection status
            const connectionResponse = await fetch('/api/connection');
            if (connectionResponse.ok) {
                const connection = await connectionResponse.json();
                this.updateMT5Status(connection);
            }
            
            // Calculate SuperTrend
            await this.calculateSuperTrend();
            
        } catch (error) {
            console.debug('Error refreshing data:', error);
        }
    }
    
    async calculateSuperTrend() {
        try {
            const response = await fetch('/api/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    symbol: this.currentSymbol,
                    timeframe: 'M15'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    this.updateSupertrendData(result.result);
                }
            }
        } catch (error) {
            console.debug('Error calculating SuperTrend:', error);
        }
    }
    
    updateAvailablePairs(pairs) {
        this.availablePairs = pairs;
        this.filteredPairs = [...pairs];
        
        // Update pairs count
        document.getElementById('pairs-count').textContent = `${pairs.length} pairs`;
        
        // Populate selector
        this.populatePairSelector();
        
        console.log(`📈 Updated ${pairs.length} trading pairs`);
    }
    
    populatePairSelector() {
        const selector = document.getElementById('pair-selector');
        if (!selector) return;
        
        selector.innerHTML = '';
        
        if (this.filteredPairs.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No pairs available - Check MT5 connection';
            option.disabled = true;
            selector.appendChild(option);
            return;
        }
        
        this.filteredPairs.forEach(pair => {
            const option = document.createElement('option');
            option.value = pair.symbol;
            option.textContent = `${pair.symbol} - ${pair.name}`;
            option.dataset.category = pair.category;
            option.dataset.digits = pair.digits;
            option.dataset.minLot = pair.min_lot;
            option.dataset.spread = pair.spread || 0;
            
            if (pair.symbol === this.currentSymbol) {
                option.selected = true;
                this.updateSelectedPairInfo(pair);
            }
            
            selector.appendChild(option);
        });
    }
    
    updateSelectedPairInfo(pair) {
        const infoPanel = document.getElementById('selected-pair-info');
        if (!infoPanel) return;
        
        document.getElementById('pair-digits').textContent = pair.digits;
        document.getElementById('pair-min-lot').textContent = pair.min_lot;
        document.getElementById('pair-spread').textContent = `${pair.spread} pips`;
        document.getElementById('pair-category').textContent = this.formatCategory(pair.category);
        
        infoPanel.classList.remove('hidden');
        infoPanel.classList.add('animate-fade-in');
    }
    
    filterPairs(searchTerm) {
        const term = searchTerm.toLowerCase();
        this.filteredPairs = this.availablePairs.filter(pair => 
            pair.symbol.toLowerCase().includes(term) || 
            pair.name.toLowerCase().includes(term)
        );
        this.populatePairSelector();
    }
    
    filterByCategory(category) {
        if (category === 'all') {
            this.filteredPairs = [...this.availablePairs];
        } else {
            this.filteredPairs = this.availablePairs.filter(pair => pair.category === category);
        }
        this.populatePairSelector();
    }
    
    updateAccountInfo(accountData) {
        this.accountInfo = { ...this.accountInfo, ...accountData };
        
        const balance = this.accountInfo.balance || 0;
        const equity = this.accountInfo.equity || 0;
        const freeMargin = this.accountInfo.free_margin || 0;
        const marginLevel = this.accountInfo.margin_level || 0;
        
        // Update balance displays with animations
        this.animateNumberUpdate('account-balance', `$${balance.toFixed(2)}`);
        this.animateNumberUpdate('account-equity', `$${equity.toFixed(2)}`);
        this.animateNumberUpdate('account-free-margin', `$${freeMargin.toFixed(2)}`);
        
        // Update balance color based on P&L
        const balanceElement = document.getElementById('account-balance');
        const balanceChange = ((equity - balance) / balance * 100);
        
        if (balanceChange > 0) {
            balanceElement.className = 'text-3xl font-bold text-primary-500';
        } else if (balanceChange < 0) {
            balanceElement.className = 'text-3xl font-bold text-red-500';
        } else {
            balanceElement.className = 'text-3xl font-bold text-white';
        }
        
        // Update balance change percentage
        const changeElement = document.getElementById('balance-change');
        if (changeElement) {
            const sign = balanceChange >= 0 ? '+' : '';
            changeElement.textContent = `${sign}${balanceChange.toFixed(2)}%`;
            changeElement.className = balanceChange >= 0 ? 'text-sm text-primary-500' : 'text-sm text-red-500';
        }
        
        // Update margin level with animation
        this.updateMarginLevel(marginLevel);
    }
    
    updateMT5Status(connection) {
        this.connectionInfo = { ...this.connectionInfo, ...connection };
        
        const isConnected = connection.is_connected;
        const connectionType = connection.connection_type || 'disconnected';
        
        // Update connection indicator
        this.updateConnectionStatus(isConnected, connectionType);
        
        // Update connection details
        document.getElementById('mt5-server').textContent = connection.server || 'Not Connected';
        document.getElementById('mt5-account').textContent = connection.account || 'N/A';
        document.getElementById('mt5-connection-status').textContent = 
            isConnected ? 'Connected' : 'Disconnected';
        
        // Update connection type badge
        const badge = document.getElementById('connection-type-badge');
        if (badge) {
            if (isConnected) {
                badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-primary-500/20 text-primary-500';
                badge.textContent = 'MT5 Live';
            } else {
                badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-500';
                badge.textContent = 'Disconnected';
            }
        }
        
        // Update last update time
        if (connection.last_update) {
            const updateTime = new Date(connection.last_update).toLocaleTimeString();
            document.getElementById('mt5-last-update').textContent = updateTime;
        }
    }
    
    updateTickData(tick) {
        if (tick.symbol !== this.currentSymbol) return;
        
        // Update price displays with animations
        this.animateNumberUpdate('current-price', this.formatPrice(tick.last));
        this.animateNumberUpdate('bid-price', this.formatPrice(tick.bid));
        this.animateNumberUpdate('ask-price', this.formatPrice(tick.ask));
        
        // Calculate and display spread
        const spread = tick.ask - tick.bid;
        const spreadPips = this.calculatePips(spread);
        this.animateNumberUpdate('spread', `${spreadPips.toFixed(1)} pips`);
        
        // Update volume
        const volumeFormatted = this.formatVolume(tick.volume);
        this.animateNumberUpdate('volume', volumeFormatted);
        
        // Update chart if running
        if (this.isRunning && this.chart) {
            this.addChartPoint(tick.last);
        }
        
        // Calculate price change
        this.updatePriceChange(tick.last);
    }
    
    updatePriceChange(currentPrice) {
        // Simple price change calculation (you might want to store previous price)
        const changeElement = document.getElementById('price-change');
        if (changeElement && this.lastPrice) {
            const change = currentPrice - this.lastPrice;
            const changePercent = (change / this.lastPrice) * 100;
            
            const sign = change >= 0 ? '+' : '';
            const icon = change >= 0 ? 'trending-up' : 'trending-down';
            const color = change >= 0 ? 'text-primary-500' : 'text-red-500';
            
            changeElement.className = `flex items-center justify-end ${color}`;
            changeElement.innerHTML = `
                <i data-lucide="${icon}" class="w-5 h-5 mr-1"></i>
                <span class="font-medium">${sign}${change.toFixed(5)} (${sign}${changePercent.toFixed(2)}%)</span>
            `;
            
            lucide.createIcons();
        }
        
        this.lastPrice = currentPrice;
    }
    
    updateMarketData(data) {
        // Update data points counter
        document.getElementById('data-points').textContent = data.length || 0;
    }
    
    updateSupertrendData(data) {
        // Update trend indicator
        const trendElement = document.getElementById('trend-indicator');
        if (trendElement && data.trend !== undefined) {
            const isBullish = data.trend === 1;
            
            if (isBullish) {
                trendElement.className = 'flex items-center px-4 py-2 rounded-full gradient-primary';
                trendElement.innerHTML = '<i data-lucide="trending-up" class="w-5 h-5 mr-2"></i><span class="font-bold">BULLISH TREND</span>';
            } else {
                trendElement.className = 'flex items-center px-4 py-2 rounded-full gradient-danger';
                trendElement.innerHTML = '<i data-lucide="trending-down" class="w-5 h-5 mr-2"></i><span class="font-bold">BEARISH TREND</span>';
            }
        }
        
        // Update trend strength
        if (data.trend_strength !== undefined) {
            const strength = data.trend_strength;
            this.animateNumberUpdate('trend-strength-value', `${strength.toFixed(1)}%`);
            this.updateProgressBar('trend-strength-bar', strength);
        }
        
        // Update ATR
        if (data.atr !== undefined) {
            this.animateNumberUpdate('atr-value', data.atr.toFixed(5));
        }
        
        // Update RSI
        if (data.rsi !== undefined) {
            const rsi = data.rsi;
            this.animateNumberUpdate('rsi-value', rsi.toFixed(1));
            this.updateProgressBar('rsi-bar', rsi);
        }
        
        // Update signal indicators
        this.updateSignalIndicators(data);
        
        lucide.createIcons();
    }
    
    updateSignalIndicators(data) {
        const buyIndicator = document.getElementById('buy-signal-indicator');
        const sellIndicator = document.getElementById('sell-signal-indicator');
        const strongIndicator = document.getElementById('strong-signal-indicator');
        
        // Buy signal
        if (buyIndicator) {
            if (data.buy_signal) {
                buyIndicator.className = 'w-4 h-4 rounded-full bg-primary-500 signal-active';
                document.getElementById('buy-signal-strength').textContent = 'Active';
            } else {
                buyIndicator.className = 'w-4 h-4 rounded-full border-2 border-gray-600';
                document.getElementById('buy-signal-strength').textContent = '--';
            }
        }
        
        // Sell signal
        if (sellIndicator) {
            if (data.sell_signal) {
                sellIndicator.className = 'w-4 h-4 rounded-full bg-red-500 signal-active';
                document.getElementById('sell-signal-strength').textContent = 'Active';
            } else {
                sellIndicator.className = 'w-4 h-4 rounded-full border-2 border-gray-600';
                document.getElementById('sell-signal-strength').textContent = '--';
            }
        }
        
        // Strong signal
        if (strongIndicator) {
            if (data.strong_signal) {
                strongIndicator.className = 'w-4 h-4 rounded-full bg-yellow-500 signal-active';
                document.getElementById('strong-signal-confidence').textContent = 'High';
            } else {
                strongIndicator.className = 'w-4 h-4 rounded-full border-2 border-gray-600';
                document.getElementById('strong-signal-confidence').textContent = '--';
            }
        }
    }
    
    addTradingSignal(signal) {
        const alertsContent = document.getElementById('alerts-content');
        if (!alertsContent) return;
        
        // Remove "no signals" message if it exists
        const noSignalsMsg = alertsContent.querySelector('.text-center');
        if (noSignalsMsg) {
            noSignalsMsg.remove();
        }
        
        // Create enhanced signal element
        const signalElement = document.createElement('div');
        signalElement.className = 'glass rounded-xl p-4 mb-3 animate-fade-in border border-white/10';
        
        const signalColor = signal.type === 'buy' ? 'primary-500' : 'red-500';
        const signalIcon = signal.type === 'buy' ? 'trending-up' : 'trending-down';
        
        signalElement.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="p-2 bg-${signalColor}/20 rounded-lg">
                        <i data-lucide="${signalIcon}" class="w-4 h-4 text-${signalColor}"></i>
                    </div>
                    <div>
                        <div class="flex items-center space-x-2 mb-1">
                            <span class="px-2 py-1 rounded-full text-xs font-medium bg-${signalColor}/20 text-${signalColor}">
                                ${signal.type.toUpperCase()}
                            </span>
                            <span class="text-white font-bold">${this.formatPrice(signal.price)}</span>
                        </div>
                        <div class="text-gray-400 text-sm">
                            Strength: ${signal.strength.toFixed(1)}% | Confidence: ${signal.confidence.toFixed(1)}%
                        </div>
                        ${signal.message ? `<div class="text-gray-300 text-sm mt-1">${signal.message}</div>` : ''}
                    </div>
                </div>
                <div class="text-gray-400 text-sm text-right">
                    <div>${new Date(signal.timestamp).toLocaleTimeString()}</div>
                    <div class="text-xs">${new Date(signal.timestamp).toLocaleDateString()}</div>
                </div>
            </div>
        `;
        
        // Add to top of alerts
        alertsContent.insertBefore(signalElement, alertsContent.firstChild);
        
        // Keep only last 10 signals
        const signals = alertsContent.querySelectorAll('.glass');
        if (signals.length > 10) {
            signals[signals.length - 1].remove();
        }
        
        // Store signal
        this.signals.unshift(signal);
        if (this.signals.length > 50) {
            this.signals = this.signals.slice(0, 50);
        }
        
        // Show notification
        this.showNotification(`${signal.type.toUpperCase()} signal for ${this.currentSymbol}`, 'info');
        
        lucide.createIcons();
    }
    
    addChartPoint(price) {
        if (!this.chart) return;
        
        const now = new Date().toLocaleTimeString();
        
        // Add new data point
        this.chart.data.labels.push(now);
        this.chart.data.datasets[0].data.push(price);
        
        // Keep only last 50 points
        if (this.chart.data.labels.length > 50) {
            this.chart.data.labels.shift();
            this.chart.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }
        
        this.chart.update('none');
    }
    
    // Enhanced UI update methods
    animateNumberUpdate(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const currentValue = element.textContent;
        if (currentValue === newValue) return;
        
        element.style.transform = 'scale(1.05)';
        element.style.transition = 'transform 0.2s ease';
        
        setTimeout(() => {
            element.textContent = newValue;
            element.style.transform = 'scale(1)';
        }, 100);
    }
    
    updateProgressBar(elementId, percentage) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        element.style.width = `${clampedPercentage}%`;
    }
    
    updateMarginLevel(marginLevel) {
        const bar = document.getElementById('margin-level-bar');
        const percent = document.getElementById('margin-level-percent');
        
        if (bar && percent) {
            const safeLevel = Math.min(marginLevel, 200); // Cap at 200% for display
            const displayPercentage = (safeLevel / 200) * 100;
            
            this.updateProgressBar('margin-level-bar', displayPercentage);
            this.animateNumberUpdate('margin-level-percent', `${marginLevel.toFixed(1)}%`);
            
            // Update color based on margin level
            if (marginLevel > 100) {
                bar.className = 'h-full gradient-primary transition-all duration-1000';
            } else if (marginLevel > 50) {
                bar.className = 'h-full bg-yellow-500 transition-all duration-1000';
            } else {
                bar.className = 'h-full bg-red-500 transition-all duration-1000';
            }
        }
    }
    
    updateConnectionStatus(isConnected, type = 'disconnected') {
        const statusElement = document.getElementById('connection-status');
        const modeIndicator = document.getElementById('mode-indicator');
        const statusDot = document.getElementById('status-dot');
        
        if (isConnected && type === 'direct') {
            statusElement.className = 'flex items-center px-4 py-2 rounded-full glass border border-primary-500/30';
            statusElement.innerHTML = `
                <div class="w-2 h-2 bg-primary-500 rounded-full mr-3 animate-pulse"></div>
                <i data-lucide="wifi" class="w-4 h-4 mr-2 text-primary-500"></i>
                <span class="text-primary-500 font-medium">MT5 Connected</span>
            `;
            
            if (modeIndicator) {
                modeIndicator.textContent = 'MT5 Live';
                modeIndicator.className = 'text-primary-500 font-medium';
            }
            
            if (statusDot) {
                statusDot.className = 'w-2 h-2 bg-primary-500 rounded-full animate-pulse';
            }
        } else {
            statusElement.className = 'flex items-center px-4 py-2 rounded-full glass border border-red-500/30 connection-pulse';
            statusElement.innerHTML = `
                <div class="w-2 h-2 bg-red-500 rounded-full mr-3 animate-pulse"></div>
                <i data-lucide="wifi-off" class="w-4 h-4 mr-2 text-red-400"></i>
                <span class="text-red-400 font-medium">MT5 Disconnected</span>
            `;
            
            if (modeIndicator) {
                modeIndicator.textContent = 'Disconnected';
                modeIndicator.className = 'text-red-400 font-medium';
            }
            
            if (statusDot) {
                statusDot.className = 'w-2 h-2 bg-red-500 rounded-full animate-pulse';
            }
        }
        
        lucide.createIcons();
    }
    
    // Enhanced utility methods
    formatPrice(price) {
        if (this.currentSymbol.includes('JPY')) {
            return price.toFixed(3);
        } else if (this.currentSymbol.includes('XAU') || this.currentSymbol.includes('GOLD')) {
            return price.toFixed(2);
        } else if (this.currentSymbol.includes('BTC') || this.currentSymbol.includes('ETH')) {
            return price.toFixed(2);
        } else {
            return price.toFixed(5);
        }
    }
    
    formatVolume(volume) {
        if (volume >= 1000000) {
            return `${(volume / 1000000).toFixed(1)}M`;
        } else if (volume >= 1000) {
            return `${(volume / 1000).toFixed(1)}K`;
        } else {
            return volume.toString();
        }
    }
    
    formatCategory(category) {
        const categoryMap = {
            'major': 'Major Pairs',
            'minor': 'Minor Pairs',
            'exotic': 'Exotic Pairs',
            'crypto': 'Cryptocurrency',
            'commodities': 'Commodities',
            'indices': 'Indices'
        };
        return categoryMap[category] || category;
    }
    
    calculatePips(spread) {
        if (this.currentSymbol.includes('JPY')) {
            return spread * 100;
        } else {
            return spread * 100000;
        }
    }
    
    // Enhanced notification system
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-24 right-4 z-50 p-4 rounded-xl glass border border-white/10 animate-fade-in max-w-sm`;
        
        const colors = {
            success: 'border-primary-500/30 text-primary-500',
            error: 'border-red-500/30 text-red-500',
            warning: 'border-yellow-500/30 text-yellow-500',
            info: 'border-blue-500/30 text-blue-500'
        };
        
        const icons = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-triangle',
            info: 'info'
        };
        
        notification.classList.add(...(colors[type] || colors.info).split(' '));
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <i data-lucide="${icons[type] || icons.info}" class="w-5 h-5"></i>
                <span class="text-white font-medium">${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        lucide.createIcons();
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
    
    // Performance monitoring
    startPerformanceMonitoring() {
        setInterval(() => {
            const performance = document.getElementById('performance-indicator');
            if (performance) {
                if (this.performanceMetrics.updateRate > 0.5) {
                    performance.textContent = 'Optimal';
                    performance.className = 'text-primary-500 font-medium';
                } else if (this.performanceMetrics.updateRate > 0.2) {
                    performance.textContent = 'Good';
                    performance.className = 'text-yellow-500 font-medium';
                } else {
                    performance.textContent = 'Slow';
                    performance.className = 'text-red-500 font-medium';
                }
            }
        }, 10000);
    }
    
    updatePerformanceMetrics() {
        const now = Date.now();
        const timeDiff = (now - this.lastUpdateTime) / 1000;
        this.performanceMetrics.updateRate = this.updateCount / timeDiff;
        
        this.lastUpdateTime = now;
        this.updateCount = 0;
    }
    
    updateLatencyMetrics(processingTime) {
        if (this.performanceMetrics.avgLatency === 0) {
            this.performanceMetrics.avgLatency = processingTime;
        } else {
            this.performanceMetrics.avgLatency = (this.performanceMetrics.avgLatency * 0.9) + (processingTime * 0.1);
        }
    }
    
    updateLastUpdateTime() {
        const element = document.getElementById('last-update');
        if (element) {
            element.textContent = new Date().toLocaleTimeString();
        }
    }
    
    updateDashboardState(state) {
        this.currentSymbol = state.selected_pair;
        this.config = state.config;
        this.isRunning = state.is_running;
        
        // Update UI elements
        document.getElementById('current-symbol').textContent = this.currentSymbol;
        document.getElementById('footer-pair').textContent = this.currentSymbol;
        
        // Update connection status
        this.updateMT5Status(state.connection);
        
        // Update parameter controls
        this.updateParameterControls();
    }
    
    updateParameterControls() {
        const controls = [
            { id: 'atr-period', key: 'periods', display: 'atr-period-value' },
            { id: 'multiplier', key: 'multiplier', display: 'multiplier-value' },
            { id: 'rsi-period', key: 'rsi_length', display: 'rsi-period-value' }
        ];
        
        controls.forEach(control => {
            const element = document.getElementById(control.id);
            const display = document.getElementById(control.display);
            
            if (element && display) {
                element.value = this.config[control.key];
                
                // Update display
                const value = this.config[control.key];
                if (control.key === 'multiplier') {
                    display.textContent = value.toFixed(1);
                } else {
                    display.textContent = value;
                }
                
                // Update range slider background
                this.updateRangeSliderBackground(element);
            }
        });
        
        // Update RSI filter toggle
        const rsiToggle = document.getElementById('use-rsi-filter');
        if (rsiToggle) {
            rsiToggle.checked = this.config.use_rsi_filter;
            this.updateToggleUI(rsiToggle);
        }
    }
    
    updateTradingStats(trading) {
        if (trading.open_positions !== undefined) {
            document.getElementById('open-positions').textContent = trading.open_positions;
        }
        if (trading.pending_orders !== undefined) {
            document.getElementById('pending-orders').textContent = trading.pending_orders;
        }
        if (trading.daily_pnl !== undefined) {
            const pnlElement = document.getElementById('daily-pnl');
            const sign = trading.daily_pnl >= 0 ? '+' : '';
            pnlElement.textContent = `${sign}$${trading.daily_pnl.toFixed(2)}`;
            pnlElement.className = trading.daily_pnl >= 0 ? 'text-2xl font-bold text-primary-500' : 'text-2xl font-bold text-red-500';
        }
    }
    
    toggleRunning() {
        this.isRunning = !this.isRunning;
        
        const button = document.getElementById('play-pause-btn');
        const statusIndicator = document.getElementById('status-indicator');
        
        if (this.isRunning) {
            button.innerHTML = '<i data-lucide="pause" class="w-4 h-4 mr-2"></i><span>Pause</span>';
            button.className = 'flex items-center px-6 py-3 rounded-xl btn-premium text-white font-medium';
            statusIndicator.textContent = 'Live';
            statusIndicator.className = 'text-primary-500 font-medium';
        } else {
            button.innerHTML = '<i data-lucide="play" class="w-4 h-4 mr-2"></i><span>Start</span>';
            button.className = 'flex items-center px-6 py-3 rounded-xl glass hover:bg-white/10 text-white font-medium transition-all duration-300';
            statusIndicator.textContent = 'Paused';
            statusIndicator.className = 'text-red-400 font-medium';
        }
        
        lucide.createIcons();
    }
    
    toggleSettings() {
        const panel = document.getElementById('settings-panel');
        if (panel) {
            panel.classList.toggle('hidden');
        }
    }
    
    resetData() {
        if (this.chart) {
            this.chart.data.labels = [];
            this.chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            this.chart.update();
        }
        
        this.clearAlerts();
        this.showNotification('Data reset successfully', 'success');
    }
    
    changeSymbol(symbol) {
        this.currentSymbol = symbol;
        document.getElementById('current-symbol').textContent = symbol;
        document.getElementById('footer-pair').textContent = symbol;
        
        // Reset chart data
        this.resetData();
        
        // Refresh tick data for new symbol
        this.refreshData();
        
        this.showNotification(`Switched to ${symbol}`, 'info');
    }
    
    async refreshConnection() {
        try {
            const button = document.getElementById('refresh-connection');
            const icon = button.querySelector('i');
            
            // Add spinning animation
            icon.classList.add('animate-spin');
            
            const response = await fetch('/api/reconnect', { method: 'POST' });
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log('✅ MT5 connection refreshed');
                this.showNotification('MT5 connection refreshed', 'success');
                // Reload data
                await this.loadInitialData();
            } else {
                this.showNotification('Failed to refresh MT5 connection', 'error');
            }
            
            // Remove spinning animation
            setTimeout(() => {
                icon.classList.remove('animate-spin');
            }, 1000);
            
        } catch (error) {
            console.error('Error refreshing connection:', error);
            this.showNotification('Connection refresh failed', 'error');
        }
    }
    
    async updateConfig() {
        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.config)
            });
            
            if (response.ok) {
                console.log('✅ Configuration updated');
            }
        } catch (error) {
            console.error('Error updating config:', error);
        }
    }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new SuperTrendDashboard();
});