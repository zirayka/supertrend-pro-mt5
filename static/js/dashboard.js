/**
 * SuperTrend Pro MT5 Dashboard - JavaScript
 * Real-time trading dashboard with WebSocket communication
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
        
        this.init();
    }
    
    init() {
        console.log('🚀 Initializing SuperTrend Dashboard');
        
        this.setupWebSocket();
        this.setupEventListeners();
        this.setupChart();
        this.loadInitialData();
        
        // Start periodic updates
        setInterval(() => this.updateLastUpdateTime(), 1000);
    }
    
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('🔌 Connecting to WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket connected');
            this.isConnected = true;
            this.updateConnectionStatus(true);
            
            // Subscribe to events
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                events: ['tick', 'market_data', 'connection_status', 'signal', 'account_info', 'symbols']
            }));
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
            
            // Attempt to reconnect after 3 seconds
            setTimeout(() => this.setupWebSocket(), 3000);
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
            case 'signal':
                this.addTradingSignal(data.data);
                break;
            case 'subscription_confirmed':
                console.log('✅ Subscribed to events:', data.events);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    setupEventListeners() {
        // Play/Pause button
        document.getElementById('play-pause-btn').addEventListener('click', () => {
            this.toggleRunning();
        });
        
        // Reset button
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetData();
        });
        
        // Settings button
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.toggleSettings();
        });
        
        // Refresh connection button
        document.getElementById('refresh-connection').addEventListener('click', () => {
            this.refreshConnection();
        });
        
        // Pair selector
        document.getElementById('pair-selector').addEventListener('change', (e) => {
            this.changeSymbol(e.target.value);
        });
        
        // Pair search
        document.getElementById('pair-search').addEventListener('input', (e) => {
            this.filterPairs(e.target.value);
        });
        
        // Category filters
        document.querySelectorAll('.category-filter').forEach(button => {
            button.addEventListener('click', (e) => {
                this.filterByCategory(e.target.dataset.category);
                
                // Update active state
                document.querySelectorAll('.category-filter').forEach(btn => {
                    btn.classList.remove('active', 'bg-blue-500', 'text-white');
                    btn.classList.add('bg-gray-700', 'text-gray-300');
                });
                e.target.classList.add('active', 'bg-blue-500', 'text-white');
                e.target.classList.remove('bg-gray-700', 'text-gray-300');
            });
        });
        
        // Parameter controls
        this.setupParameterControls();
    }
    
    setupParameterControls() {
        const controls = [
            { id: 'atr-period', key: 'periods' },
            { id: 'multiplier', key: 'multiplier' },
            { id: 'rsi-period', key: 'rsi_length' }
        ];
        
        controls.forEach(control => {
            const element = document.getElementById(control.id);
            if (element) {
                element.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    this.config[control.key] = value;
                    
                    // Update display
                    const display = e.target.parentNode.querySelector('.text-white');
                    if (display) {
                        display.textContent = control.key === 'multiplier' ? value.toFixed(1) : value;
                    }
                    
                    this.updateConfig();
                });
            }
        });
        
        // RSI filter toggle
        const rsiToggle = document.getElementById('use-rsi-filter');
        if (rsiToggle) {
            rsiToggle.addEventListener('change', (e) => {
                this.config.use_rsi_filter = e.target.checked;
                this.updateConfig();
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
                        tension: 0.1
                    },
                    {
                        label: 'SuperTrend Up',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: 'SuperTrend Down',
                        data: [],
                        borderColor: '#22c55e',
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: '#374151'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: '#374151'
                        }
                    }
                }
            }
        });
    }
    
    async loadInitialData() {
        try {
            // Load dashboard state
            const response = await fetch('/api/dashboard-state');
            const state = await response.json();
            
            this.updateDashboardState(state);
            
            // Load available pairs
            this.loadAvailablePairs();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            // Initialize with demo data if API fails
            this.initializeDemoData();
        }
    }
    
    async loadAvailablePairs() {
        try {
            const response = await fetch('/api/pairs');
            const pairs = await response.json();
            
            this.updateAvailablePairs(pairs);
            
        } catch (error) {
            console.error('Error loading pairs:', error);
            // Initialize with demo pairs
            this.initializeDemoPairs();
        }
    }
    
    initializeDemoData() {
        // Demo account info
        this.accountInfo = {
            balance: 10000.00,
            equity: 10000.00,
            margin: 0.00,
            free_margin: 10000.00,
            margin_level: 0.00
        };
        
        this.connectionInfo = {
            is_connected: true,
            connection_type: 'demo',
            server: 'Demo Server',
            account: 12345678
        };
        
        this.updateAccountInfo(this.accountInfo);
        this.updateMT5Status(this.connectionInfo);
    }
    
    initializeDemoPairs() {
        const demoPairs = [
            { symbol: 'EURUSD', name: 'Euro vs US Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 1.5 },
            { symbol: 'GBPUSD', name: 'British Pound vs US Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 2.0 },
            { symbol: 'USDJPY', name: 'US Dollar vs Japanese Yen', category: 'major', digits: 3, min_lot: 0.01, spread: 1.8 },
            { symbol: 'USDCHF', name: 'US Dollar vs Swiss Franc', category: 'major', digits: 5, min_lot: 0.01, spread: 2.2 },
            { symbol: 'AUDUSD', name: 'Australian Dollar vs US Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 2.5 },
            { symbol: 'USDCAD', name: 'US Dollar vs Canadian Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 2.8 },
            { symbol: 'NZDUSD', name: 'New Zealand Dollar vs US Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 3.0 },
            { symbol: 'EURGBP', name: 'Euro vs British Pound', category: 'minor', digits: 5, min_lot: 0.01, spread: 2.5 },
            { symbol: 'EURJPY', name: 'Euro vs Japanese Yen', category: 'minor', digits: 3, min_lot: 0.01, spread: 2.8 },
            { symbol: 'GBPJPY', name: 'British Pound vs Japanese Yen', category: 'minor', digits: 3, min_lot: 0.01, spread: 3.5 },
            { symbol: 'XAUUSD', name: 'Gold vs US Dollar', category: 'commodities', digits: 2, min_lot: 0.01, spread: 3.0 },
            { symbol: 'XAGUSD', name: 'Silver vs US Dollar', category: 'commodities', digits: 3, min_lot: 0.01, spread: 5.0 },
            { symbol: 'BTCUSD', name: 'Bitcoin vs US Dollar', category: 'crypto', digits: 2, min_lot: 0.01, spread: 50.0 },
            { symbol: 'ETHUSD', name: 'Ethereum vs US Dollar', category: 'crypto', digits: 2, min_lot: 0.01, spread: 5.0 }
        ];
        
        this.updateAvailablePairs(demoPairs);
    }
    
    updateAvailablePairs(pairs) {
        this.availablePairs = pairs;
        this.filteredPairs = [...pairs];
        
        // Update pairs count
        document.getElementById('pairs-count').textContent = `${pairs.length} pairs`;
        
        // Populate selector
        this.populatePairSelector();
    }
    
    populatePairSelector() {
        const selector = document.getElementById('pair-selector');
        if (!selector) return;
        
        selector.innerHTML = '';
        
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
        
        document.getElementById('pair-digits').textContent = pair.digits;
        document.getElementById('pair-min-lot').textContent = pair.min_lot;
        document.getElementById('pair-spread').textContent = `${pair.spread} pips`;
        
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
        
        document.getElementById('account-balance').textContent = `$${balance.toFixed(2)}`;
        document.getElementById('account-equity').textContent = `$${equity.toFixed(2)}`;
        document.getElementById('account-free-margin').textContent = `$${freeMargin.toFixed(2)}`;
        document.getElementById('account-margin-level').textContent = `${marginLevel.toFixed(2)}%`;
        
        // Update balance color based on equity vs balance
        const balanceElement = document.getElementById('account-balance');
        if (equity > balance) {
            balanceElement.className = 'text-lg font-bold balance-positive';
        } else if (equity < balance) {
            balanceElement.className = 'text-lg font-bold balance-negative';
        } else {
            balanceElement.className = 'text-lg font-bold balance-neutral';
        }
        
        // Update margin level bar
        const marginBar = document.getElementById('margin-level-bar');
        const marginPercent = document.getElementById('margin-level-percent');
        if (marginBar && marginPercent) {
            const safeLevel = Math.min(marginLevel / 100 * 100, 100);
            marginBar.style.width = `${safeLevel}%`;
            marginPercent.textContent = `${marginLevel.toFixed(1)}%`;
            
            // Color based on margin level
            if (marginLevel > 100) {
                marginBar.className = 'h-2 rounded-full bg-emerald-400 transition-all duration-500';
            } else if (marginLevel > 50) {
                marginBar.className = 'h-2 rounded-full bg-yellow-400 transition-all duration-500';
            } else {
                marginBar.className = 'h-2 rounded-full bg-red-400 transition-all duration-500';
            }
        }
        
        // Calculate balance change percentage (mock for demo)
        const balanceChange = ((equity - balance) / balance * 100);
        const changeElement = document.getElementById('balance-change');
        if (changeElement) {
            const sign = balanceChange >= 0 ? '+' : '';
            changeElement.textContent = `${sign}${balanceChange.toFixed(2)}%`;
            changeElement.className = balanceChange >= 0 ? 'text-xs text-emerald-400' : 'text-xs text-red-400';
        }
    }
    
    updateMT5Status(connection) {
        this.connectionInfo = { ...this.connectionInfo, ...connection };
        
        const isConnected = connection.is_connected;
        const connectionType = connection.connection_type || 'demo';
        
        // Update connection indicator
        this.updateConnectionStatus(isConnected, connectionType);
        
        // Update connection details
        document.getElementById('mt5-server').textContent = connection.server || 'Demo Server';
        document.getElementById('mt5-account').textContent = connection.account || '12345678';
        document.getElementById('mt5-connection-status').textContent = 
            isConnected ? (connectionType === 'demo' ? 'Demo Mode' : 'Connected') : 'Disconnected';
        
        // Update connection type badge
        const badge = document.getElementById('connection-type-badge');
        if (badge) {
            badge.className = `px-2 py-1 rounded-full text-xs font-medium connection-${connectionType}`;
            badge.textContent = connectionType === 'websocket' ? 'WebSocket Live' :
                              connectionType === 'file' ? 'File-based Live' : 'Demo Mode';
        }
        
        // Update last update time
        if (connection.last_update) {
            const updateTime = new Date(connection.last_update).toLocaleTimeString();
            document.getElementById('mt5-last-update').textContent = updateTime;
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
            { id: 'atr-period', key: 'periods' },
            { id: 'multiplier', key: 'multiplier' },
            { id: 'rsi-period', key: 'rsi_length' }
        ];
        
        controls.forEach(control => {
            const element = document.getElementById(control.id);
            if (element) {
                element.value = this.config[control.key];
                
                // Update display
                const display = element.parentNode.querySelector('.text-white');
                if (display) {
                    const value = this.config[control.key];
                    display.textContent = control.key === 'multiplier' ? value.toFixed(1) : value;
                }
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
        document.getElementById('current-price').textContent = this.formatPrice(tick.last);
        document.getElementById('bid-price').textContent = this.formatPrice(tick.bid);
        document.getElementById('ask-price').textContent = this.formatPrice(tick.ask);
        
        // Calculate and display spread
        const spread = tick.ask - tick.bid;
        const spreadPips = this.calculatePips(spread);
        document.getElementById('spread').textContent = `${spreadPips.toFixed(1)} pips`;
        
        // Update volume
        const volumeK = Math.round(tick.volume / 1000);
        document.getElementById('volume').textContent = `${volumeK}K`;
        
        // Update chart if running
        if (this.isRunning && this.chart) {
            this.addChartPoint(tick.last);
        }
    }
    
    updateMarketData(data) {
        // Update data points counter
        document.getElementById('data-points').textContent = data.length || 0;
    }
    
    updateConnectionStatus(isConnected, type = 'demo') {
        const statusElement = document.getElementById('connection-status');
        const modeIndicator = document.getElementById('mode-indicator');
        
        if (isConnected) {
            statusElement.className = 'flex items-center px-3 py-1 rounded-full text-sm bg-emerald-500/20 text-emerald-400';
            statusElement.innerHTML = '<i data-lucide="wifi" class="w-4 h-4 mr-2"></i><span>Connected</span>';
            
            if (modeIndicator) {
                modeIndicator.textContent = type === 'websocket' ? 'WebSocket' : 
                                          type === 'file' ? 'File-based' : 'Demo';
                modeIndicator.className = type === 'demo' ? 'text-yellow-400' : 'text-emerald-400';
            }
        } else {
            statusElement.className = 'flex items-center px-3 py-1 rounded-full text-sm bg-red-500/20 text-red-400';
            statusElement.innerHTML = '<i data-lucide="wifi-off" class="w-4 h-4 mr-2"></i><span>Disconnected</span>';
            
            if (modeIndicator) {
                modeIndicator.textContent = 'Demo';
                modeIndicator.className = 'text-yellow-400';
            }
        }
        
        lucide.createIcons();
    }
    
    addTradingSignal(signal) {
        const alertsContent = document.getElementById('alerts-content');
        if (!alertsContent) return;
        
        // Create signal element
        const signalElement = document.createElement('div');
        signalElement.className = 'bg-gray-700 rounded-lg p-3 mb-3';
        signalElement.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="${signal.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}">
                        <i data-lucide="${signal.type === 'buy' ? 'trending-up' : 'trending-down'}" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <div class="flex items-center space-x-2">
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
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
        
        // Keep only last 5 signals
        const signals = alertsContent.querySelectorAll('.bg-gray-700');
        if (signals.length > 5) {
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
            button.innerHTML = '<i data-lucide="pause" class="w-4 h-4 mr-2"></i><span>Pause</span>';
            button.className = 'flex items-center px-4 py-2 rounded-lg font-medium bg-red-500 hover:bg-red-600 text-white transition-colors';
            statusIndicator.textContent = 'Live';
            statusIndicator.className = 'text-emerald-400';
        } else {
            button.innerHTML = '<i data-lucide="play" class="w-4 h-4 mr-2"></i><span>Start</span>';
            button.className = 'flex items-center px-4 py-2 rounded-lg font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors';
            statusIndicator.textContent = 'Paused';
            statusIndicator.className = 'text-red-400';
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
        
        // Clear alerts
        const alertsContent = document.getElementById('alerts-content');
        if (alertsContent) {
            alertsContent.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <i data-lucide="bell" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                    <p>No signals yet</p>
                    <p class="text-sm">Signals will appear here when conditions are met</p>
                </div>
            `;
        }
        
        lucide.createIcons();
    }
    
    changeSymbol(symbol) {
        this.currentSymbol = symbol;
        document.getElementById('current-symbol').textContent = symbol;
        document.getElementById('footer-pair').textContent = symbol;
        
        // Reset chart data
        this.resetData();
        
        // TODO: Send symbol change to backend
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
                console.log('✅ Connection refreshed');
                // Reload data
                await this.loadInitialData();
            }
            
            // Remove spinning animation
            setTimeout(() => {
                icon.classList.remove('animate-spin');
            }, 1000);
            
        } catch (error) {
            console.error('Error refreshing connection:', error);
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
    
    async reconnectMT5() {
        try {
            const response = await fetch('/api/reconnect', { method: 'POST' });
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log('✅ Reconnection attempted');
            }
        } catch (error) {
            console.error('Error reconnecting:', error);
        }
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