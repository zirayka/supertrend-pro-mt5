/**
 * SuperTrend Pro MT5 Dashboard - JavaScript
 * Real-time trading dashboard with direct MT5 connection only
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
        this.lastConnectionStatus = null;
        this.connectionStable = false;
        this.connectionCheckCount = 0;
        
        this.init();
    }
    
    init() {
        console.log('🚀 Initializing SuperTrend Dashboard - MT5 Direct Only');
        
        this.setupWebSocket();
        this.setupEventListeners();
        this.setupChart();
        this.loadInitialData();
        
        // Start periodic updates
        setInterval(() => this.updateLastUpdateTime(), 1000);
        setInterval(() => this.refreshData(), 10000); // Refresh every 10 seconds (less frequent)
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
            
            // Subscribe to events
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                events: ['tick', 'market_data', 'connection_status', 'signal', 'account_info', 'symbols', 'positions', 'orders', 'supertrend_update', 'error']
            }));
            
            this.showNotification('WebSocket connected', 'success');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('❌ WebSocket disconnected');
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.setupWebSocket(), 5000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    handleWebSocketMessage(data) {
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
            case 'subscription_confirmed':
                console.log('✅ Subscribed to events:', data.events);
                break;
            case 'error':
                console.error('Server error:', data.data);
                this.showNotification(data.data.message || 'Server error', 'error');
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    setupEventListeners() {
        // Play/Pause button
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.toggleRunning();
            });
        }
        
        // Reset button
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetData();
            });
        }
        
        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.toggleSettings();
            });
        }
        
        // Close settings button
        const closeSettingsBtn = document.getElementById('close-settings');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                this.toggleSettings();
            });
        }
        
        // Connection test button
        const connectionTestBtn = document.getElementById('connection-test-btn');
        if (connectionTestBtn) {
            connectionTestBtn.addEventListener('click', () => {
                this.showConnectionTest();
            });
        }
        
        // Refresh connection button
        const refreshConnectionBtn = document.getElementById('refresh-connection');
        if (refreshConnectionBtn) {
            refreshConnectionBtn.addEventListener('click', () => {
                this.refreshConnection();
            });
        }
        
        // Pair selector
        const pairSelector = document.getElementById('pair-selector');
        if (pairSelector) {
            pairSelector.addEventListener('change', (e) => {
                this.changeSymbol(e.target.value);
            });
        }
        
        // Pair search
        const pairSearch = document.getElementById('pair-search');
        if (pairSearch) {
            pairSearch.addEventListener('input', (e) => {
                this.filterPairs(e.target.value);
            });
        }
        
        // Category filters
        document.querySelectorAll('.category-filter').forEach(button => {
            button.addEventListener('click', (e) => {
                this.filterByCategory(e.target.dataset.category);
                
                // Update active state
                document.querySelectorAll('.category-filter').forEach(btn => {
                    btn.classList.remove('active', 'bg-primary-500', 'text-white');
                    btn.classList.add('glass', 'text-gray-300');
                });
                e.target.classList.add('active', 'bg-primary-500', 'text-white');
                e.target.classList.remove('glass', 'text-gray-300');
            });
        });
        
        // Parameter controls
        this.setupParameterControls();
        
        // Apply settings button
        const applySettingsBtn = document.getElementById('apply-settings');
        if (applySettingsBtn) {
            applySettingsBtn.addEventListener('click', () => {
                this.updateConfig();
                this.showNotification('Settings applied successfully', 'success');
            });
        }
        
        // Clear alerts button
        const clearAlertsBtn = document.getElementById('clear-alerts');
        if (clearAlertsBtn) {
            clearAlertsBtn.addEventListener('click', () => {
                this.clearAlerts();
            });
        }
        
        // Connection test modal
        this.setupConnectionTestModal();
    }
    
    setupParameterControls() {
        const controls = [
            { id: 'atr-period', key: 'periods', displayId: 'atr-period-value' },
            { id: 'multiplier', key: 'multiplier', displayId: 'multiplier-value' },
            { id: 'rsi-period', key: 'rsi_length', displayId: 'rsi-period-value' }
        ];
        
        controls.forEach(control => {
            const element = document.getElementById(control.id);
            const display = document.getElementById(control.displayId);
            
            if (element && display) {
                element.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    this.config[control.key] = value;
                    
                    // Update display
                    if (control.key === 'multiplier') {
                        display.textContent = value.toFixed(1);
                    } else {
                        display.textContent = value;
                    }
                    
                    // Update range slider background
                    this.updateRangeSliderBackground(element);
                });
                
                // Initialize display
                const initialValue = this.config[control.key];
                if (control.key === 'multiplier') {
                    display.textContent = initialValue.toFixed(1);
                } else {
                    display.textContent = initialValue;
                }
                
                // Initialize range slider
                this.updateRangeSliderBackground(element);
            }
        });
        
        // RSI filter toggle
        const rsiToggle = document.getElementById('use-rsi-filter');
        if (rsiToggle) {
            rsiToggle.addEventListener('change', (e) => {
                this.config.use_rsi_filter = e.target.checked;
            });
        }
    }
    
    updateRangeSliderBackground(slider) {
        const value = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
        slider.style.setProperty('--value', `${value}%`);
    }
    
    setupConnectionTestModal() {
        const modal = document.getElementById('connection-test-modal');
        const closeBtn = document.getElementById('close-test-modal');
        const runTestBtn = document.getElementById('run-test');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }
        
        if (runTestBtn) {
            runTestBtn.addEventListener('click', () => {
                this.runConnectionTest();
            });
        }
        
        // Close modal on backdrop click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
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
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'SuperTrend Up',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false,
                        borderDash: [5, 5]
                    },
                    {
                        label: 'SuperTrend Down',
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
                            usePointStyle: true
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
                            maxTicksLimit: 10
                        },
                        grid: {
                            color: 'rgba(55, 65, 81, 0.3)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: 'rgba(55, 65, 81, 0.3)'
                        }
                    }
                },
                animation: {
                    duration: 0 // Disable animations for real-time updates
                }
            }
        });
    }
    
    async loadInitialData() {
        try {
            console.log('📊 Loading initial data from MT5...');
            
            // Load dashboard state
            const response = await fetch('/api/dashboard-state');
            if (response.ok) {
                const state = await response.json();
                this.updateDashboardState(state);
            } else {
                console.warn('Failed to load dashboard state');
                this.showConnectionError();
            }
            
            // Load available pairs
            await this.loadAvailablePairs();
            
            // Load account summary
            await this.loadAccountSummary();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showConnectionError();
        }
    }
    
    async loadAvailablePairs() {
        try {
            const response = await fetch('/api/pairs');
            if (response.ok) {
                const pairs = await response.json();
                this.updateAvailablePairs(pairs);
            } else {
                console.warn('Failed to load pairs from MT5');
                this.showNoPairsMessage();
            }
        } catch (error) {
            console.error('Error loading pairs:', error);
            this.showNoPairsMessage();
        }
    }
    
    showNoPairsMessage() {
        const selector = document.getElementById('pair-selector');
        if (selector) {
            selector.innerHTML = '<option value="" disabled>No pairs available - Check MT5 connection</option>';
        }
        
        const pairsCount = document.getElementById('pairs-count');
        if (pairsCount) {
            pairsCount.textContent = '0 pairs';
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
            }
        } catch (error) {
            console.error('Error loading account summary:', error);
        }
    }
    
    async refreshData() {
        if (!this.isRunning) return;
        
        try {
            // Refresh connection status
            const connectionResponse = await fetch('/api/connection');
            if (connectionResponse.ok) {
                const connection = await connectionResponse.json();
                this.updateMT5Status(connection);
            }
            
            // Refresh tick data for current symbol
            const tickResponse = await fetch(`/api/tick?symbol=${this.currentSymbol}`);
            if (tickResponse.ok) {
                const tick = await tickResponse.json();
                this.updateTickData(tick);
            }
            
        } catch (error) {
            console.debug('Error refreshing data:', error);
        }
    }
    
    showConnectionError() {
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
    
    updateAvailablePairs(pairs) {
        this.availablePairs = pairs;
        this.filteredPairs = [...pairs];
        
        // Update pairs count
        const pairsCount = document.getElementById('pairs-count');
        if (pairsCount) {
            pairsCount.textContent = `${pairs.length} pairs`;
        }
        
        // Populate selector
        this.populatePairSelector();
        
        console.log(`📈 Loaded ${pairs.length} trading pairs from MT5`);
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
        
        // Add change listener for pair info
        selector.addEventListener('change', (e) => {
            const selectedOption = e.target.selectedOptions[0];
            if (selectedOption) {
                const pairInfo = {
                    symbol: selectedOption.value,
                    name: selectedOption.textContent.split(' - ')[1],
                    category: selectedOption.dataset.category,
                    digits: parseInt(selectedOption.dataset.digits),
                    min_lot: parseFloat(selectedOption.dataset.minLot),
                    spread: parseFloat(selectedOption.dataset.spread)
                };
                this.updateSelectedPairInfo(pairInfo);
            }
        });
    }
    
    updateSelectedPairInfo(pair) {
        const infoPanel = document.getElementById('selected-pair-info');
        if (!infoPanel) return;
        
        const digitsEl = document.getElementById('pair-digits');
        const minLotEl = document.getElementById('pair-min-lot');
        const spreadEl = document.getElementById('pair-spread');
        const categoryEl = document.getElementById('pair-category');
        
        if (digitsEl) digitsEl.textContent = pair.digits;
        if (minLotEl) minLotEl.textContent = pair.min_lot;
        if (spreadEl) spreadEl.textContent = `${pair.spread} pips`;
        if (categoryEl) categoryEl.textContent = pair.category || 'Unknown';
        
        infoPanel.classList.remove('hidden');
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
        
        // Update balance display
        const balance = this.accountInfo.balance || 0;
        const equity = this.accountInfo.equity || 0;
        const freeMargin = this.accountInfo.free_margin || 0;
        const marginLevel = this.accountInfo.margin_level || 0;
        
        const balanceEl = document.getElementById('account-balance');
        const equityEl = document.getElementById('account-equity');
        const freeMarginEl = document.getElementById('account-free-margin');
        const marginLevelEl = document.getElementById('account-margin-level');
        
        if (balanceEl) balanceEl.textContent = `$${balance.toFixed(2)}`;
        if (equityEl) equityEl.textContent = `$${equity.toFixed(2)}`;
        if (freeMarginEl) freeMarginEl.textContent = `$${freeMargin.toFixed(2)}`;
        if (marginLevelEl) marginLevelEl.textContent = `${marginLevel.toFixed(2)}%`;
        
        // Update balance color based on equity vs balance
        if (balanceEl) {
            if (equity > balance) {
                balanceEl.className = 'text-3xl font-bold text-emerald-400';
            } else if (equity < balance) {
                balanceEl.className = 'text-3xl font-bold text-red-400';
            } else {
                balanceEl.className = 'text-3xl font-bold text-white';
            }
        }
        
        // Update margin level bar
        const marginBar = document.getElementById('margin-level-bar');
        const marginPercent = document.getElementById('margin-level-percent');
        if (marginBar && marginPercent) {
            const safeLevel = Math.min(marginLevel, 100);
            marginBar.style.width = `${safeLevel}%`;
            marginPercent.textContent = `${marginLevel.toFixed(1)}%`;
            
            // Color based on margin level
            if (marginLevel > 100) {
                marginBar.className = 'h-full gradient-primary transition-all duration-1000';
            } else if (marginLevel > 50) {
                marginBar.className = 'h-full bg-yellow-400 transition-all duration-1000';
            } else {
                marginBar.className = 'h-full bg-red-400 transition-all duration-1000';
            }
        }
        
        // Calculate balance change percentage
        const balanceChange = ((equity - balance) / balance * 100);
        const changeElement = document.getElementById('balance-change');
        if (changeElement) {
            const sign = balanceChange >= 0 ? '+' : '';
            changeElement.textContent = `${sign}${balanceChange.toFixed(2)}%`;
            changeElement.className = balanceChange >= 0 ? 'text-sm text-emerald-400' : 'text-sm text-red-400';
        }
    }
    
    updateMT5Status(connection) {
        // Prevent rapid status changes
        const currentStatus = connection.is_connected;
        const currentType = connection.connection_type;
        
        if (this.lastConnectionStatus !== null) {
            if (this.lastConnectionStatus.is_connected === currentStatus && 
                this.lastConnectionStatus.connection_type === currentType) {
                this.connectionCheckCount++;
                
                // Only update if status is stable for at least 3 checks
                if (this.connectionCheckCount < 3) {
                    return;
                }
            } else {
                this.connectionCheckCount = 0;
            }
        }
        
        this.lastConnectionStatus = { is_connected: currentStatus, connection_type: currentType };
        this.connectionInfo = { ...this.connectionInfo, ...connection };
        
        const isConnected = connection.is_connected;
        const connectionType = connection.connection_type || 'disconnected';
        
        // Update connection indicator
        this.updateConnectionStatus(isConnected, connectionType);
        
        // Update connection details
        const serverEl = document.getElementById('mt5-server');
        const accountEl = document.getElementById('mt5-account');
        const statusEl = document.getElementById('mt5-connection-status');
        const lastUpdateEl = document.getElementById('mt5-last-update');
        
        if (serverEl) serverEl.textContent = connection.server || 'Not Connected';
        if (accountEl) accountEl.textContent = connection.account || 'N/A';
        if (statusEl) statusEl.textContent = isConnected ? 'Connected' : 'Disconnected';
        
        // Update connection type badge
        const badge = document.getElementById('connection-type-badge');
        if (badge) {
            if (isConnected && connectionType === 'direct') {
                badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400';
                badge.textContent = 'MT5 Live';
            } else {
                badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400';
                badge.textContent = 'Disconnected';
            }
        }
        
        // Update last update time
        if (connection.last_update && lastUpdateEl) {
            const updateTime = new Date(connection.last_update).toLocaleTimeString();
            lastUpdateEl.textContent = updateTime;
        }
    }
    
    updatePositions(positions) {
        const positionsEl = document.getElementById('open-positions');
        if (positionsEl) {
            positionsEl.textContent = positions.length;
        }
        
        // Calculate total P&L
        const totalPnL = positions.reduce((sum, pos) => sum + (pos.profit || 0), 0);
        const pnlElement = document.getElementById('daily-pnl');
        if (pnlElement) {
            const sign = totalPnL >= 0 ? '+' : '';
            pnlElement.textContent = `${sign}$${totalPnL.toFixed(2)}`;
            pnlElement.className = totalPnL >= 0 ? 'text-2xl font-bold text-primary-500' : 'text-2xl font-bold text-red-400';
        }
    }
    
    updateOrders(orders) {
        const ordersEl = document.getElementById('pending-orders');
        if (ordersEl) {
            ordersEl.textContent = orders.length;
        }
    }
    
    updateTradingStats(trading) {
        if (trading.open_positions !== undefined) {
            const positionsEl = document.getElementById('open-positions');
            if (positionsEl) positionsEl.textContent = trading.open_positions;
        }
        if (trading.pending_orders !== undefined) {
            const ordersEl = document.getElementById('pending-orders');
            if (ordersEl) ordersEl.textContent = trading.pending_orders;
        }
        if (trading.daily_pnl !== undefined) {
            const pnlElement = document.getElementById('daily-pnl');
            if (pnlElement) {
                const sign = trading.daily_pnl >= 0 ? '+' : '';
                pnlElement.textContent = `${sign}$${trading.daily_pnl.toFixed(2)}`;
                pnlElement.className = trading.daily_pnl >= 0 ? 'text-2xl font-bold text-primary-500' : 'text-2xl font-bold text-red-400';
            }
        }
    }
    
    updateDashboardState(state) {
        this.currentSymbol = state.selected_pair;
        this.config = state.config;
        this.isRunning = state.is_running;
        
        // Update UI elements
        const currentSymbolEl = document.getElementById('current-symbol');
        const footerPairEl = document.getElementById('footer-pair');
        
        if (currentSymbolEl) currentSymbolEl.textContent = this.currentSymbol;
        if (footerPairEl) footerPairEl.textContent = this.currentSymbol;
        
        // Update connection status
        this.updateMT5Status(state.connection);
        
        // Update parameter controls
        this.updateParameterControls();
    }
    
    updateParameterControls() {
        const controls = [
            { id: 'atr-period', key: 'periods', displayId: 'atr-period-value' },
            { id: 'multiplier', key: 'multiplier', displayId: 'multiplier-value' },
            { id: 'rsi-period', key: 'rsi_length', displayId: 'rsi-period-value' }
        ];
        
        controls.forEach(control => {
            const element = document.getElementById(control.id);
            const display = document.getElementById(control.displayId);
            
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
        }
    }
    
    updateTickData(tick) {
        if (tick.symbol !== this.currentSymbol) return;
        
        // Update price displays
        const currentPriceEl = document.getElementById('current-price');
        const bidPriceEl = document.getElementById('bid-price');
        const askPriceEl = document.getElementById('ask-price');
        const spreadEl = document.getElementById('spread');
        const volumeEl = document.getElementById('volume');
        
        if (currentPriceEl) currentPriceEl.textContent = this.formatPrice(tick.last);
        if (bidPriceEl) bidPriceEl.textContent = this.formatPrice(tick.bid);
        if (askPriceEl) askPriceEl.textContent = this.formatPrice(tick.ask);
        
        // Calculate and display spread
        const spread = tick.ask - tick.bid;
        const spreadPips = this.calculatePips(spread);
        if (spreadEl) spreadEl.textContent = `${spreadPips.toFixed(1)} pips`;
        
        // Update volume
        const volumeK = Math.round(tick.volume / 1000);
        if (volumeEl) volumeEl.textContent = `${volumeK}K`;
        
        // Update chart if running
        if (this.isRunning && this.chart) {
            this.addChartPoint(tick.last);
        }
    }
    
    updateMarketData(data) {
        // Update data points counter
        const dataPointsEl = document.getElementById('data-points');
        if (dataPointsEl) {
            dataPointsEl.textContent = Array.isArray(data) ? data.length : 0;
        }
    }
    
    updateSupertrendData(data) {
        // Update SuperTrend indicators
        const trendIndicator = document.getElementById('trend-indicator');
        const trendStrengthValue = document.getElementById('trend-strength-value');
        const trendStrengthBar = document.getElementById('trend-strength-bar');
        const atrValue = document.getElementById('atr-value');
        const rsiValue = document.getElementById('rsi-value');
        const rsiBar = document.getElementById('rsi-bar');
        
        if (data.trend === 1) {
            if (trendIndicator) {
                trendIndicator.className = 'flex items-center px-4 py-2 rounded-full gradient-primary';
                trendIndicator.innerHTML = '<i data-lucide="trending-up" class="w-5 h-5 mr-2"></i><span class="font-bold">BULLISH TREND</span>';
            }
        } else {
            if (trendIndicator) {
                trendIndicator.className = 'flex items-center px-4 py-2 rounded-full gradient-danger';
                trendIndicator.innerHTML = '<i data-lucide="trending-down" class="w-5 h-5 mr-2"></i><span class="font-bold">BEARISH TREND</span>';
            }
        }
        
        if (trendStrengthValue) trendStrengthValue.textContent = `${data.trend_strength.toFixed(1)}%`;
        if (trendStrengthBar) trendStrengthBar.style.width = `${data.trend_strength}%`;
        if (atrValue) atrValue.textContent = data.atr.toFixed(5);
        if (rsiValue) rsiValue.textContent = data.rsi.toFixed(1);
        if (rsiBar) rsiBar.style.width = `${data.rsi}%`;
        
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
                buyIndicator.className = 'w-4 h-4 rounded-full bg-emerald-500 signal-active';
            } else {
                buyIndicator.className = 'w-4 h-4 rounded-full border-2 border-gray-600';
            }
        }
        
        // Sell signal
        if (sellIndicator) {
            if (data.sell_signal) {
                sellIndicator.className = 'w-4 h-4 rounded-full bg-red-500 signal-active';
            } else {
                sellIndicator.className = 'w-4 h-4 rounded-full border-2 border-gray-600';
            }
        }
        
        // Strong signal
        if (strongIndicator) {
            if (data.strong_signal) {
                strongIndicator.className = 'w-4 h-4 rounded-full bg-yellow-500 signal-active';
            } else {
                strongIndicator.className = 'w-4 h-4 rounded-full border-2 border-gray-600';
            }
        }
    }
    
    updateConnectionStatus(isConnected, type = 'disconnected') {
        const statusElement = document.getElementById('connection-status');
        const modeIndicator = document.getElementById('mode-indicator');
        const statusDot = document.getElementById('status-dot');
        
        if (isConnected && type === 'direct') {
            if (statusElement) {
                statusElement.className = 'flex items-center px-4 py-2 rounded-full glass border border-emerald-500/30';
                statusElement.innerHTML = `
                    <div class="w-2 h-2 bg-emerald-500 rounded-full mr-3 animate-pulse"></div>
                    <i data-lucide="wifi" class="w-4 h-4 mr-2 text-emerald-400"></i>
                    <span class="text-emerald-400 font-medium">MT5 Connected</span>
                `;
            }
            
            if (modeIndicator) {
                modeIndicator.textContent = 'MT5 Live';
                modeIndicator.className = 'text-emerald-400 font-medium';
            }
            
            if (statusDot) {
                statusDot.className = 'w-2 h-2 bg-emerald-500 rounded-full animate-pulse';
            }
        } else {
            if (statusElement) {
                statusElement.className = 'flex items-center px-4 py-2 rounded-full glass border border-red-500/30 connection-pulse';
                statusElement.innerHTML = `
                    <div class="w-2 h-2 bg-red-500 rounded-full mr-3 animate-pulse"></div>
                    <i data-lucide="wifi-off" class="w-4 h-4 mr-2 text-red-400"></i>
                    <span class="text-red-400 font-medium">MT5 Disconnected</span>
                `;
            }
            
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
    
    addTradingSignal(signal) {
        const alertsContent = document.getElementById('alerts-content');
        if (!alertsContent) return;
        
        // Create signal element
        const signalElement = document.createElement('div');
        signalElement.className = 'glass rounded-xl p-4 mb-3 animate-fade-in';
        signalElement.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="${signal.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}">
                        <i data-lucide="${signal.type === 'buy' ? 'trending-up' : 'trending-down'}" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <div class="flex items-center space-x-2">
                            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                signal.type === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }">
                                ${signal.type.toUpperCase()}
                            </span>
                            <span class="text-white font-medium">${this.formatPrice(signal.price)}</span>
                        </div>
                        <div class="text-gray-400 text-sm">
                            Strength: ${signal.strength.toFixed(1)}% | Confidence: ${signal.confidence.toFixed(1)}%
                        </div>
                    </div>
                </div>
                <div class="text-gray-400 text-sm">
                    ${new Date(signal.timestamp).toLocaleTimeString()}
                </div>
            </div>
        `;
        
        // Replace "no signals" message if it exists
        if (alertsContent.querySelector('.opacity-50')) {
            alertsContent.innerHTML = '';
        }
        
        // Add to top of alerts
        alertsContent.insertBefore(signalElement, alertsContent.firstChild);
        
        // Keep only last 10 signals
        const signals = alertsContent.querySelectorAll('.glass');
        if (signals.length > 10) {
            signals[signals.length - 1].remove();
        }
        
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
    
    toggleRunning() {
        this.isRunning = !this.isRunning;
        
        const button = document.getElementById('play-pause-btn');
        const statusIndicator = document.getElementById('status-indicator');
        
        if (this.isRunning) {
            if (button) {
                button.innerHTML = '<i data-lucide="pause" class="w-4 h-4 mr-2"></i><span>Pause</span>';
                button.className = 'flex items-center px-6 py-3 rounded-xl gradient-danger text-white font-medium';
            }
            if (statusIndicator) {
                statusIndicator.textContent = 'Live';
                statusIndicator.className = 'text-emerald-400 font-medium';
            }
        } else {
            if (button) {
                button.innerHTML = '<i data-lucide="play" class="w-4 h-4 mr-2"></i><span>Start</span>';
                button.className = 'flex items-center px-6 py-3 rounded-xl btn-premium text-white font-medium';
            }
            if (statusIndicator) {
                statusIndicator.textContent = 'Paused';
                statusIndicator.className = 'text-red-400 font-medium';
            }
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
        }
        
        lucide.createIcons();
    }
    
    changeSymbol(symbol) {
        this.currentSymbol = symbol;
        
        const currentSymbolEl = document.getElementById('current-symbol');
        const footerPairEl = document.getElementById('footer-pair');
        
        if (currentSymbolEl) currentSymbolEl.textContent = symbol;
        if (footerPairEl) footerPairEl.textContent = symbol;
        
        // Reset chart data
        this.resetData();
        
        // Refresh tick data for new symbol
        this.refreshData();
    }
    
    async refreshConnection() {
        try {
            const button = document.getElementById('refresh-connection');
            if (button) {
                const icon = button.querySelector('i');
                if (icon) icon.classList.add('animate-spin');
            }
            
            const response = await fetch('/api/reconnect', { method: 'POST' });
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log('✅ MT5 connection refreshed');
                this.showNotification('Connection refreshed successfully', 'success');
                // Reload data
                await this.loadInitialData();
            } else {
                this.showNotification('Failed to refresh connection', 'error');
            }
            
            // Remove spinning animation
            setTimeout(() => {
                if (button) {
                    const icon = button.querySelector('i');
                    if (icon) icon.classList.remove('animate-spin');
                }
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
    
    showConnectionTest() {
        const modal = document.getElementById('connection-test-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
    
    async runConnectionTest() {
        const resultsDiv = document.getElementById('test-results');
        if (!resultsDiv) return;
        
        // Show loading
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
            
            for (const [key, test] of Object.entries(result.results)) {
                const icon = test.success ? 'check-circle' : 'x-circle';
                const color = test.success ? 'text-emerald-400' : 'text-red-400';
                
                html += `
                    <div class="flex items-center justify-between p-3 glass rounded-lg">
                        <div class="flex items-center space-x-3">
                            <i data-lucide="${icon}" class="w-5 h-5 ${color}"></i>
                            <span class="text-white">${key.replace(/_/g, ' ').toUpperCase()}</span>
                        </div>
                        <span class="text-sm ${color}">${test.success ? 'PASS' : 'FAIL'}</span>
                    </div>
                    <p class="text-sm text-gray-400 ml-8">${test.message}</p>
                `;
            }
            
            html += '</div>';
            resultsDiv.innerHTML = html;
            
        } catch (error) {
            resultsDiv.innerHTML = `
                <div class="text-center py-8">
                    <i data-lucide="alert-triangle" class="w-8 h-8 text-red-500 mx-auto mb-4"></i>
                    <p class="text-red-400">Connection test failed</p>
                    <p class="text-gray-400 text-sm">${error.message}</p>
                </div>
            `;
        }
        
        lucide.createIcons();
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm animate-fade-in`;
        
        const colors = {
            success: 'bg-emerald-500 text-white',
            error: 'bg-red-500 text-white',
            warning: 'bg-yellow-500 text-black',
            info: 'bg-blue-500 text-white'
        };
        
        notification.classList.add(...colors[type].split(' '));
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
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
    
    calculatePips(spread) {
        if (this.currentSymbol.includes('JPY')) {
            return spread * 100;
        } else {
            return spread * 100000;
        }
    }
    
    updateLastUpdateTime() {
        const element = document.getElementById('last-update');
        if (element) {
            element.textContent = new Date().toLocaleTimeString();
        }
    }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new SuperTrendDashboard();
});