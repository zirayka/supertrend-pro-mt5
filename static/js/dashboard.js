/**
 * SuperTrend Pro MT5 Dashboard - Enhanced Real-time JavaScript
 * Optimized for minimal delay between MT5 and dashboard
 */

class SuperTrendDashboard {
    constructor() {
        // Real-time optimization settings
        this.updateInterval = 500; // Reduced from 2000ms to 500ms for faster updates
        this.fastTickInterval = 100; // Ultra-fast tick updates
        this.reconnectDelay = 1000; // Quick reconnection
        this.maxRetries = 10;
        this.retryCount = 0;
        
        // WebSocket connection for real-time data
        this.ws = null;
        this.wsReconnectTimer = null;
        this.isConnected = false;
        
        // Data management
        this.currentData = {
            connection: { is_connected: false, connection_type: 'connecting' },
            pairs: [],
            tick: null,
            account: {},
            positions: [],
            orders: [],
            supertrend: null
        };
        
        // Chart instance
        this.chart = null;
        this.chartData = [];
        
        // UI state
        this.selectedPair = 'EURUSD';
        this.isRunning = true;
        this.lastUpdateTime = null;
        
        // Performance monitoring
        this.updateTimes = [];
        this.avgUpdateTime = 0;
        
        // Initialize dashboard
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing SuperTrend Pro MT5 Dashboard - Real-time Optimized');
        
        try {
            // Setup event listeners first
            this.setupEventListeners();
            
            // Initialize chart
            this.initializeChart();
            
            // Start WebSocket connection
            this.connectWebSocket();
            
            // Start fast data polling as backup
            this.startFastPolling();
            
            // Load initial data immediately
            await this.loadInitialData();
            
            console.log('✅ Dashboard initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing dashboard:', error);
            this.showError('Failed to initialize dashboard');
        }
    }
    
    connectWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            console.log('🔌 Connecting to WebSocket:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.isConnected = true;
                this.retryCount = 0;
                
                // Subscribe to all events for real-time updates
                this.ws.send(JSON.stringify({
                    type: 'subscribe',
                    events: ['tick', 'connection', 'account_info', 'positions', 'orders', 'symbols', 'supertrend_update']
                }));
                
                this.updateConnectionStatus(true);
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('❌ Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.scheduleReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
            };
            
        } catch (error) {
            console.error('❌ Error creating WebSocket:', error);
            this.scheduleReconnect();
        }
    }
    
    scheduleReconnect() {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = Math.min(this.reconnectDelay * this.retryCount, 10000);
            
            console.log(`🔄 Scheduling WebSocket reconnect in ${delay}ms (attempt ${this.retryCount})`);
            
            this.wsReconnectTimer = setTimeout(() => {
                this.connectWebSocket();
            }, delay);
        } else {
            console.error('❌ Max WebSocket reconnection attempts reached');
        }
    }
    
    handleWebSocketMessage(message) {
        const startTime = performance.now();
        
        try {
            switch (message.type) {
                case 'tick':
                    this.handleTickUpdate(message.data);
                    break;
                case 'connection':
                    this.handleConnectionUpdate(message.data);
                    break;
                case 'account_info':
                    this.handleAccountUpdate(message.data);
                    break;
                case 'positions':
                    this.handlePositionsUpdate(message.data);
                    break;
                case 'orders':
                    this.handleOrdersUpdate(message.data);
                    break;
                case 'symbols':
                    this.handleSymbolsUpdate(message.data);
                    break;
                case 'supertrend_update':
                    this.handleSupertrendUpdate(message.data);
                    break;
                case 'connection_status':
                    this.updateConnectionStatus(message.data.is_connected);
                    break;
                default:
                    console.log('📨 Unknown WebSocket message type:', message.type);
            }
            
            // Track update performance
            const updateTime = performance.now() - startTime;
            this.trackUpdatePerformance(updateTime);
            
        } catch (error) {
            console.error('❌ Error handling WebSocket message:', error);
        }
    }
    
    handleTickUpdate(tickData) {
        if (!tickData || !tickData.symbol) return;
        
        this.currentData.tick = tickData;
        
        // Update price display immediately for selected pair
        if (tickData.symbol === this.selectedPair) {
            this.updatePriceDisplay(tickData);
            this.updateChart(tickData);
        }
        
        // Update last update time
        this.lastUpdateTime = new Date();
        this.updateLastUpdateDisplay();
    }
    
    handleConnectionUpdate(connectionData) {
        this.currentData.connection = connectionData;
        this.updateConnectionDisplay();
    }
    
    handleAccountUpdate(accountData) {
        this.currentData.account = accountData;
        this.updateAccountDisplay();
    }
    
    handlePositionsUpdate(positionsData) {
        this.currentData.positions = positionsData || [];
        this.updateTradingStats();
    }
    
    handleOrdersUpdate(ordersData) {
        this.currentData.orders = ordersData || [];
        this.updateTradingStats();
    }
    
    handleSymbolsUpdate(symbolsData) {
        this.currentData.pairs = symbolsData || [];
        this.updatePairsList();
    }
    
    handleSupertrendUpdate(supertrendData) {
        this.currentData.supertrend = supertrendData;
        this.updateSupertrendDisplay();
    }
    
    startFastPolling() {
        // Fast tick polling for critical price updates
        setInterval(async () => {
            if (!this.isConnected && this.isRunning) {
                try {
                    await this.fetchTickData();
                } catch (error) {
                    console.debug('Tick fetch error (normal if WebSocket is working):', error.message);
                }
            }
        }, this.fastTickInterval);
        
        // Regular data polling for other updates
        setInterval(async () => {
            if (this.isRunning) {
                try {
                    await this.fetchAllData();
                } catch (error) {
                    console.debug('Data fetch error:', error.message);
                }
            }
        }, this.updateInterval);
    }
    
    async fetchTickData() {
        try {
            const response = await fetch(`/api/tick?symbol=${this.selectedPair}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const tickData = await response.json();
                if (tickData && !tickData.error) {
                    this.handleTickUpdate(tickData);
                }
            }
        } catch (error) {
            throw new Error(`Tick fetch failed: ${error.message}`);
        }
    }
    
    async fetchAllData() {
        const promises = [
            this.fetchConnectionStatus(),
            this.fetchAccountData(),
            this.fetchPairsData(),
            this.fetchSupertrendData()
        ];
        
        try {
            await Promise.allSettled(promises);
        } catch (error) {
            console.debug('Some data fetch operations failed:', error);
        }
    }
    
    async fetchConnectionStatus() {
        try {
            const response = await fetch('/api/connection');
            if (response.ok) {
                const data = await response.json();
                this.handleConnectionUpdate(data);
            }
        } catch (error) {
            console.debug('Connection status fetch failed:', error.message);
        }
    }
    
    async fetchAccountData() {
        try {
            const response = await fetch('/api/account-summary');
            if (response.ok) {
                const data = await response.json();
                if (data.account) {
                    this.handleAccountUpdate(data.account);
                }
                if (data.positions) {
                    this.handlePositionsUpdate(data.positions);
                }
                if (data.orders) {
                    this.handleOrdersUpdate(data.orders);
                }
            }
        } catch (error) {
            console.debug('Account data fetch failed:', error.message);
        }
    }
    
    async fetchPairsData() {
        try {
            const response = await fetch('/api/pairs');
            if (response.ok) {
                const pairs = await response.json();
                this.handleSymbolsUpdate(pairs);
            }
        } catch (error) {
            console.debug('Pairs data fetch failed:', error.message);
        }
    }
    
    async fetchSupertrendData() {
        try {
            const response = await fetch(`/api/calculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: this.selectedPair,
                    timeframe: 'M15'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.result) {
                    this.handleSupertrendUpdate(data.result);
                }
            }
        } catch (error) {
            console.debug('SuperTrend data fetch failed:', error.message);
        }
    }
    
    updatePriceDisplay(tickData) {
        const elements = {
            currentPrice: document.getElementById('current-price'),
            bidPrice: document.getElementById('bid-price'),
            askPrice: document.getElementById('ask-price'),
            spread: document.getElementById('spread'),
            volume: document.getElementById('volume'),
            priceChange: document.getElementById('price-change')
        };
        
        if (elements.currentPrice && tickData.last) {
            elements.currentPrice.textContent = this.formatPrice(tickData.last);
        }
        
        if (elements.bidPrice && tickData.bid) {
            elements.bidPrice.textContent = this.formatPrice(tickData.bid);
        }
        
        if (elements.askPrice && tickData.ask) {
            elements.askPrice.textContent = this.formatPrice(tickData.ask);
        }
        
        if (elements.spread && tickData.bid && tickData.ask) {
            const spread = (tickData.ask - tickData.bid);
            const pips = this.calculatePips(spread, this.selectedPair);
            elements.spread.textContent = `${pips.toFixed(1)} pips`;
        }
        
        if (elements.volume && tickData.volume) {
            elements.volume.textContent = this.formatVolume(tickData.volume);
        }
        
        // Update price change (simplified - would need historical data for accurate calculation)
        if (elements.priceChange) {
            const changeIcon = elements.priceChange.querySelector('i');
            const changeText = elements.priceChange.querySelector('span');
            
            if (changeIcon && changeText) {
                // Simulate price change for demo (in real implementation, calculate from historical data)
                const change = 0.0012;
                const changePercent = 0.11;
                
                changeText.textContent = `+${change.toFixed(4)} (+${changePercent.toFixed(2)}%)`;
                changeIcon.setAttribute('data-lucide', 'trending-up');
                elements.priceChange.className = 'flex items-center justify-end text-primary-500 text-sm';
            }
        }
    }
    
    updateConnectionDisplay() {
        const connection = this.currentData.connection;
        
        // Update main connection status
        const statusElement = document.getElementById('connection-status');
        const typeElement = document.getElementById('connection-type-badge');
        
        if (statusElement) {
            const dot = statusElement.querySelector('.w-2.h-2');
            const icon = statusElement.querySelector('i');
            const text = statusElement.querySelector('span');
            
            if (connection.is_connected) {
                statusElement.className = 'flex items-center px-3 py-1.5 rounded-full glass border border-green-500/30';
                if (dot) dot.className = 'w-2 h-2 bg-green-500 rounded-full mr-2';
                if (icon) icon.setAttribute('data-lucide', 'wifi');
                if (text) {
                    text.textContent = `Connected to ${connection.server || 'MT5'}`;
                    text.className = 'text-green-400 font-medium text-sm';
                }
            } else {
                statusElement.className = 'flex items-center px-3 py-1.5 rounded-full glass border border-red-500/30 connection-pulse';
                if (dot) dot.className = 'w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse';
                if (icon) icon.setAttribute('data-lucide', 'wifi-off');
                if (text) {
                    text.textContent = 'Connecting to MT5...';
                    text.className = 'text-red-400 font-medium text-sm';
                }
            }
        }
        
        if (typeElement) {
            if (connection.is_connected) {
                typeElement.textContent = connection.connection_type === 'direct' ? 'MT5 Live' : 'Connected';
                typeElement.className = 'px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400';
            } else {
                typeElement.textContent = 'Connecting...';
                typeElement.className = 'px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400';
            }
        }
        
        // Update detailed connection info
        this.updateElement('mt5-server', connection.server || 'Connecting...');
        this.updateElement('mt5-account', connection.account ? connection.account.toString() : '--');
        this.updateElement('mt5-connection-status', connection.is_connected ? 'Connected' : 'Initializing');
        
        // Update mode indicator in footer
        this.updateElement('mode-indicator', connection.is_connected ? 'MT5 Live' : 'Connecting');
        this.updateElement('status-indicator', connection.is_connected ? 'Live' : 'Connecting');
    }
    
    updateAccountDisplay() {
        const account = this.currentData.account;
        
        if (account.balance !== undefined) {
            this.updateElement('account-balance', this.formatCurrency(account.balance));
        }
        
        if (account.equity !== undefined) {
            this.updateElement('account-equity', this.formatCurrency(account.equity));
        }
        
        if (account.free_margin !== undefined) {
            this.updateElement('account-free-margin', this.formatCurrency(account.free_margin));
        }
        
        if (account.margin_level !== undefined) {
            const marginLevel = Math.min(account.margin_level || 0, 100);
            this.updateElement('margin-level-percent', `${marginLevel.toFixed(1)}%`);
            
            const marginBar = document.getElementById('margin-level-bar');
            if (marginBar) {
                marginBar.style.width = `${marginLevel}%`;
            }
        }
        
        // Calculate and display balance change
        if (account.balance && account.equity) {
            const change = account.equity - account.balance;
            const changePercent = account.balance > 0 ? (change / account.balance) * 100 : 0;
            
            const changeElement = document.getElementById('balance-change');
            if (changeElement) {
                const sign = change >= 0 ? '+' : '';
                changeElement.textContent = `${sign}${changePercent.toFixed(2)}%`;
                changeElement.className = change >= 0 ? 'text-sm text-green-400' : 'text-sm text-red-400';
            }
        }
    }
    
    updateTradingStats() {
        const positions = this.currentData.positions || [];
        const orders = this.currentData.orders || [];
        
        this.updateElement('open-positions', positions.length.toString());
        this.updateElement('pending-orders', orders.length.toString());
        
        // Calculate daily P&L
        const totalProfit = positions.reduce((sum, pos) => sum + (pos.profit || 0), 0);
        const dailyPnlElement = document.getElementById('daily-pnl');
        if (dailyPnlElement) {
            const sign = totalProfit >= 0 ? '+' : '';
            dailyPnlElement.textContent = `${sign}${this.formatCurrency(totalProfit)}`;
            dailyPnlElement.className = totalProfit >= 0 ? 
                'text-2xl font-bold text-primary-500' : 
                'text-2xl font-bold text-red-500';
        }
    }
    
    updatePairsList() {
        const pairs = this.currentData.pairs || [];
        const pairsListElement = document.getElementById('pairs-list');
        const pairsCountElement = document.getElementById('pairs-count');
        
        if (pairsCountElement) {
            pairsCountElement.textContent = `${pairs.length} pairs`;
        }
        
        if (!pairsListElement) return;
        
        if (pairs.length === 0) {
            pairsListElement.innerHTML = `
                <div class="text-center text-gray-400 py-6">
                    <i data-lucide="loader" class="w-6 h-6 mx-auto mb-2 animate-spin"></i>
                    <p class="font-medium text-sm">Loading pairs...</p>
                    <p class="text-xs">Connecting to MT5...</p>
                </div>
            `;
            return;
        }
        
        // Limit to first 50 pairs for performance
        const displayPairs = pairs.slice(0, 50);
        
        pairsListElement.innerHTML = displayPairs.map(pair => `
            <div class="pair-item p-2 rounded-lg cursor-pointer transition-all duration-200 ${pair.symbol === this.selectedPair ? 'selected' : ''}" 
                 data-symbol="${pair.symbol}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <span class="font-medium text-white text-sm">${pair.symbol}</span>
                        <span class="category-${pair.category} px-1.5 py-0.5 rounded text-xs font-medium">${pair.category}</span>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-gray-400">${pair.spread?.toFixed(1) || '0.0'} pips</div>
                    </div>
                </div>
                <div class="text-xs text-gray-400 mt-1 truncate">${pair.name}</div>
            </div>
        `).join('');
        
        // Re-attach event listeners
        this.attachPairEventListeners();
        
        // Refresh icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
    
    updateSupertrendDisplay() {
        const supertrend = this.currentData.supertrend;
        if (!supertrend) return;
        
        // Update trend indicator
        const trendIndicator = document.getElementById('trend-indicator');
        if (trendIndicator) {
            const isBullish = supertrend.trend === 1;
            const icon = trendIndicator.querySelector('i');
            const text = trendIndicator.querySelector('span');
            
            if (icon) {
                icon.setAttribute('data-lucide', isBullish ? 'trending-up' : 'trending-down');
            }
            
            if (text) {
                text.textContent = isBullish ? 'BULLISH' : 'BEARISH';
            }
            
            trendIndicator.className = isBullish ? 
                'flex items-center px-3 py-1.5 rounded-full gradient-primary text-sm' :
                'flex items-center px-3 py-1.5 rounded-full gradient-danger text-sm';
        }
        
        // Update trend strength
        if (supertrend.trend_strength !== undefined) {
            this.updateElement('trend-strength-value', `${supertrend.trend_strength.toFixed(1)}%`);
            
            const strengthBar = document.getElementById('trend-strength-bar');
            if (strengthBar) {
                strengthBar.style.width = `${Math.min(supertrend.trend_strength, 100)}%`;
            }
        }
        
        // Update ATR
        if (supertrend.atr !== undefined) {
            this.updateElement('atr-value', supertrend.atr.toFixed(5));
        }
        
        // Update RSI
        if (supertrend.rsi !== undefined) {
            this.updateElement('rsi-value', supertrend.rsi.toFixed(1));
            
            const rsiBar = document.getElementById('rsi-bar');
            if (rsiBar) {
                rsiBar.style.width = `${Math.min(supertrend.rsi, 100)}%`;
            }
        }
        
        // Update signals
        this.updateSignalIndicator('buy-signal-indicator', supertrend.buy_signal);
        this.updateSignalIndicator('sell-signal-indicator', supertrend.sell_signal);
        this.updateSignalIndicator('strong-signal-indicator', supertrend.strong_signal);
    }
    
    updateSignalIndicator(elementId, isActive) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        if (isActive) {
            element.className = 'w-4 h-4 rounded-full bg-green-500 signal-active';
        } else {
            element.className = 'w-4 h-4 rounded-full border-2 border-gray-600';
        }
    }
    
    updateChart(tickData) {
        if (!this.chart || !tickData) return;
        
        try {
            const now = new Date();
            const price = tickData.last || tickData.bid || 0;
            
            // Add new data point
            this.chartData.push({
                x: now,
                y: price
            });
            
            // Keep only last 100 points for performance
            if (this.chartData.length > 100) {
                this.chartData = this.chartData.slice(-100);
            }
            
            // Update chart
            this.chart.data.datasets[0].data = this.chartData;
            this.chart.update('none'); // Use 'none' mode for fastest updates
            
        } catch (error) {
            console.error('❌ Error updating chart:', error);
        }
    }
    
    initializeChart() {
        const ctx = document.getElementById('price-chart');
        if (!ctx) return;
        
        try {
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Price',
                        data: this.chartData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false, // Disable animations for better performance
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            enabled: true,
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            display: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#9ca3af',
                                maxTicksLimit: 6
                            }
                        },
                        y: {
                            display: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#9ca3af',
                                callback: function(value) {
                                    return value.toFixed(5);
                                }
                            }
                        }
                    }
                }
            });
            
            console.log('✅ Chart initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing chart:', error);
        }
    }
    
    setupEventListeners() {
        // Pair selection
        this.attachPairEventListeners();
        
        // Control buttons
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetDashboard());
        }
        
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.toggleSettings());
        }
        
        const connectionTestBtn = document.getElementById('connection-test-btn');
        if (connectionTestBtn) {
            connectionTestBtn.addEventListener('click', () => this.showConnectionTest());
        }
        
        // Search functionality
        const searchInput = document.getElementById('pair-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterPairs(e.target.value));
        }
        
        // Category filters
        const categoryFilters = document.querySelectorAll('.category-filter');
        categoryFilters.forEach(filter => {
            filter.addEventListener('click', (e) => this.filterByCategory(e.target.dataset.category));
        });
    }
    
    attachPairEventListeners() {
        const pairItems = document.querySelectorAll('.pair-item');
        pairItems.forEach(item => {
            item.addEventListener('click', () => {
                const symbol = item.dataset.symbol;
                if (symbol) {
                    this.selectPair(symbol);
                }
            });
        });
    }
    
    selectPair(symbol) {
        if (symbol === this.selectedPair) return;
        
        console.log(`📊 Selecting pair: ${symbol}`);
        
        // Update selected pair
        this.selectedPair = symbol;
        
        // Update UI
        this.updateElement('current-symbol', symbol);
        this.updateElement('footer-pair', symbol);
        
        // Update pair selection in list
        const pairItems = document.querySelectorAll('.pair-item');
        pairItems.forEach(item => {
            if (item.dataset.symbol === symbol) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // Clear chart data for new pair
        this.chartData = [];
        if (this.chart) {
            this.chart.data.datasets[0].data = [];
            this.chart.update();
        }
        
        // Fetch new data immediately
        this.fetchTickData();
        this.fetchSupertrendData();
    }
    
    async loadInitialData() {
        console.log('📊 Loading initial dashboard data...');
        
        try {
            // Load all data in parallel for faster startup
            await Promise.allSettled([
                this.fetchConnectionStatus(),
                this.fetchAccountData(),
                this.fetchPairsData(),
                this.fetchTickData(),
                this.fetchSupertrendData()
            ]);
            
            console.log('✅ Initial data loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
        }
    }
    
    trackUpdatePerformance(updateTime) {
        this.updateTimes.push(updateTime);
        
        // Keep only last 100 measurements
        if (this.updateTimes.length > 100) {
            this.updateTimes = this.updateTimes.slice(-50);
        }
        
        // Calculate average
        this.avgUpdateTime = this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length;
        
        // Update performance indicator
        const perfElement = document.getElementById('performance-indicator');
        if (perfElement) {
            if (this.avgUpdateTime < 10) {
                perfElement.textContent = 'Optimal';
                perfElement.className = 'text-primary-500 font-medium';
            } else if (this.avgUpdateTime < 50) {
                perfElement.textContent = 'Good';
                perfElement.className = 'text-yellow-500 font-medium';
            } else {
                perfElement.textContent = 'Slow';
                perfElement.className = 'text-red-500 font-medium';
            }
        }
    }
    
    updateLastUpdateDisplay() {
        if (this.lastUpdateTime) {
            const timeStr = this.lastUpdateTime.toLocaleTimeString();
            this.updateElement('last-update', timeStr);
            this.updateElement('mt5-last-update', timeStr);
        }
    }
    
    updateConnectionStatus(isConnected) {
        const statusDot = document.getElementById('status-dot');
        if (statusDot) {
            if (isConnected) {
                statusDot.className = 'w-2 h-2 bg-primary-500 rounded-full';
            } else {
                statusDot.className = 'w-2 h-2 bg-red-500 rounded-full animate-pulse';
            }
        }
    }
    
    // Utility methods
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element && value !== undefined && value !== null) {
            element.textContent = value;
        }
    }
    
    formatPrice(price) {
        if (typeof price !== 'number') return '0.00000';
        return price.toFixed(5);
    }
    
    formatCurrency(amount) {
        if (typeof amount !== 'number') return '$0.00';
        return `$${amount.toFixed(2)}`;
    }
    
    formatVolume(volume) {
        if (typeof volume !== 'number') return '0';
        if (volume >= 1000000) {
            return `${(volume / 1000000).toFixed(1)}M`;
        } else if (volume >= 1000) {
            return `${(volume / 1000).toFixed(1)}K`;
        }
        return volume.toString();
    }
    
    calculatePips(spread, symbol) {
        // Simplified pip calculation
        if (symbol.includes('JPY')) {
            return spread * 100; // JPY pairs have different pip calculation
        }
        return spread * 10000; // Standard pip calculation
    }
    
    showError(message) {
        console.error('❌ Dashboard Error:', message);
        // Could implement toast notifications here
    }
    
    togglePlayPause() {
        this.isRunning = !this.isRunning;
        const btn = document.getElementById('play-pause-btn');
        if (btn) {
            const icon = btn.querySelector('i');
            const text = btn.querySelector('span');
            
            if (this.isRunning) {
                if (icon) icon.setAttribute('data-lucide', 'pause');
                if (text) text.textContent = 'Pause';
            } else {
                if (icon) icon.setAttribute('data-lucide', 'play');
                if (text) text.textContent = 'Play';
            }
            
            // Refresh icons
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }
    
    resetDashboard() {
        console.log('🔄 Resetting dashboard...');
        
        // Clear chart data
        this.chartData = [];
        if (this.chart) {
            this.chart.data.datasets[0].data = [];
            this.chart.update();
        }
        
        // Reset to default pair
        this.selectPair('EURUSD');
        
        // Reload all data
        this.loadInitialData();
    }
    
    toggleSettings() {
        const panel = document.getElementById('settings-panel');
        if (panel) {
            panel.classList.toggle('hidden');
        }
    }
    
    showConnectionTest() {
        const modal = document.getElementById('connection-test-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
    
    filterPairs(searchTerm) {
        const pairItems = document.querySelectorAll('.pair-item');
        const term = searchTerm.toLowerCase();
        
        pairItems.forEach(item => {
            const symbol = item.dataset.symbol.toLowerCase();
            const name = item.textContent.toLowerCase();
            
            if (symbol.includes(term) || name.includes(term)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    filterByCategory(category) {
        const pairItems = document.querySelectorAll('.pair-item');
        const filterBtns = document.querySelectorAll('.category-filter');
        
        // Update filter button states
        filterBtns.forEach(btn => {
            if (btn.dataset.category === category) {
                btn.classList.add('active', 'bg-primary-500', 'text-white');
                btn.classList.remove('glass', 'text-gray-300');
            } else {
                btn.classList.remove('active', 'bg-primary-500', 'text-white');
                btn.classList.add('glass', 'text-gray-300');
            }
        });
        
        // Filter pairs
        pairItems.forEach(item => {
            const categoryBadge = item.querySelector('[class*="category-"]');
            if (category === 'all' || (categoryBadge && categoryBadge.classList.contains(`category-${category}`))) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 SuperTrend Pro MT5 Dashboard - Real-time Optimized Version');
    window.dashboard = new SuperTrendDashboard();
});

// Handle page visibility changes to optimize performance
document.addEventListener('visibilitychange', () => {
    if (window.dashboard) {
        if (document.hidden) {
            console.log('📱 Page hidden - reducing update frequency');
            window.dashboard.updateInterval = 2000; // Slower updates when hidden
        } else {
            console.log('📱 Page visible - resuming normal update frequency');
            window.dashboard.updateInterval = 500; // Fast updates when visible
        }
    }
});