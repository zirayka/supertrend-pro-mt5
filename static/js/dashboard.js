/**
 * SuperTrend Pro MT5 Dashboard - Final Optimized Real-time JavaScript
 * Ultra-fast updates with minimal delay and enhanced performance
 */

class SuperTrendDashboard {
    constructor() {
        // Ultra-optimized settings for minimal delay
        this.updateInterval = 500; // Ultra-fast 500ms updates
        this.fastTickInterval = 250; // Super fast tick updates
        this.reconnectDelay = 1000; // Very quick reconnection
        this.maxRetries = 15;
        this.retryCount = 0;
        
        // WebSocket connection for real-time data
        this.ws = null;
        this.wsReconnectTimer = null;
        this.isConnected = false;
        
        // Data management with caching
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
        this.maxChartPoints = 50; // Reduced for better performance
        
        // UI state
        this.selectedPair = 'EURUSD';
        this.isRunning = true;
        this.lastUpdateTime = null;
        
        // Performance monitoring
        this.updateTimes = [];
        this.avgUpdateTime = 0;
        this.lastTickTime = 0;
        
        // Enhanced price formatting cache
        this.priceFormatCache = new Map();
        this.formatCacheSize = 500; // Limit cache size
        
        // Update throttling
        this.lastUIUpdate = 0;
        this.uiUpdateThrottle = 100; // Minimum 100ms between UI updates
        
        // Initialize dashboard
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing SuperTrend Pro MT5 Dashboard - Ultra-Optimized Version');
        
        try {
            // Setup event listeners first
            this.setupEventListeners();
            
            // Initialize chart with optimized settings
            this.initializeChart();
            
            // Start WebSocket connection immediately
            this.connectWebSocket();
            
            // Start ultra-fast data polling as backup
            this.startUltraFastPolling();
            
            // Load initial data immediately
            await this.loadInitialData();
            
            console.log('✅ Dashboard initialized with ultra-fast updates');
            
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
                console.log('✅ WebSocket connected - Ultra-fast mode enabled');
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
                    console.debug('WebSocket message parse error:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected - switching to polling mode');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.scheduleReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.debug('WebSocket error:', error);
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
            const delay = Math.min(this.reconnectDelay * Math.min(this.retryCount, 3), 5000);
            
            console.log(`🔄 Scheduling WebSocket reconnect in ${delay}ms (attempt ${this.retryCount})`);
            
            this.wsReconnectTimer = setTimeout(() => {
                this.connectWebSocket();
            }, delay);
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
            }
            
            // Track update performance
            const updateTime = performance.now() - startTime;
            this.trackUpdatePerformance(updateTime);
            
        } catch (error) {
            console.debug('Error handling WebSocket message:', error);
        }
    }
    
    handleTickUpdate(tickData) {
        if (!tickData || !tickData.symbol) return;
        
        // Throttle UI updates for better performance
        const now = performance.now();
        if (now - this.lastUIUpdate < this.uiUpdateThrottle) {
            return;
        }
        this.lastUIUpdate = now;
        
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
    
    startUltraFastPolling() {
        // Ultra-fast tick polling for critical price updates
        setInterval(async () => {
            if (!this.isConnected && this.isRunning) {
                try {
                    await this.fetchTickData();
                } catch (error) {
                    // Silent fail for polling
                }
            }
        }, this.fastTickInterval);
        
        // Regular data polling for other updates
        setInterval(async () => {
            if (this.isRunning) {
                try {
                    // Fetch data concurrently for better performance
                    const promises = [
                        this.fetchConnectionStatus(),
                        this.fetchAccountData(),
                        this.fetchSupertrendData()
                    ];
                    
                    // Don't wait for all to complete, process as they come
                    Promise.allSettled(promises);
                    
                } catch (error) {
                    // Silent fail for polling
                }
            }
        }, this.updateInterval);
        
        // Slower polling for pairs (they don't change often)
        setInterval(async () => {
            if (this.isRunning && this.currentData.pairs.length === 0) {
                try {
                    await this.fetchPairsData();
                } catch (error) {
                    // Silent fail
                }
            }
        }, 5000);
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
            // Silent fail for polling
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
            // Silent fail
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
            // Silent fail
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
            // Silent fail
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
            // Silent fail
        }
    }
    
    // Enhanced price formatting with optimized caching
    formatPrice(price, symbol = null) {
        if (typeof price !== 'number' || isNaN(price)) return '0.00000';
        
        const cacheKey = `${price.toFixed(8)}_${symbol}`;
        if (this.priceFormatCache.has(cacheKey)) {
            return this.priceFormatCache.get(cacheKey);
        }
        
        let formatted;
        
        // Optimized decimal places logic
        if (symbol && symbol.includes('JPY')) {
            formatted = price.toFixed(3);
        } else if (price > 10000) {
            formatted = price.toFixed(2);
        } else if (price > 1000) {
            formatted = price.toFixed(3);
        } else if (price > 100) {
            formatted = price.toFixed(4);
        } else {
            formatted = price.toFixed(5);
        }
        
        // Optimized cache management
        if (this.priceFormatCache.size >= this.formatCacheSize) {
            // Clear oldest entries
            const keysToDelete = Array.from(this.priceFormatCache.keys()).slice(0, 100);
            keysToDelete.forEach(key => this.priceFormatCache.delete(key));
        }
        
        this.priceFormatCache.set(cacheKey, formatted);
        return formatted;
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
        
        // Use the most appropriate price for display
        const displayPrice = tickData.last || tickData.bid || tickData.ask || 0;
        
        // Batch DOM updates for better performance
        requestAnimationFrame(() => {
            if (elements.currentPrice && displayPrice) {
                elements.currentPrice.textContent = this.formatPrice(displayPrice, this.selectedPair);
            }
            
            if (elements.bidPrice && tickData.bid) {
                elements.bidPrice.textContent = this.formatPrice(tickData.bid, this.selectedPair);
            }
            
            if (elements.askPrice && tickData.ask) {
                elements.askPrice.textContent = this.formatPrice(tickData.ask, this.selectedPair);
            }
            
            if (elements.spread && tickData.bid && tickData.ask) {
                const spread = Math.abs(tickData.ask - tickData.bid);
                const pips = this.calculatePips(spread, this.selectedPair);
                elements.spread.textContent = `${pips.toFixed(1)} pips`;
            }
            
            if (elements.volume && tickData.volume) {
                elements.volume.textContent = this.formatVolume(tickData.volume);
            }
            
            // Update price change with animation
            if (elements.priceChange) {
                this.updatePriceChange(elements.priceChange, displayPrice);
            }
        });
    }
    
    updatePriceChange(element, currentPrice) {
        const changeIcon = element.querySelector('i');
        const changeText = element.querySelector('span');
        
        if (changeIcon && changeText) {
            // Calculate change based on previous price
            const prevPrice = this.chartData.length > 1 ? 
                this.chartData[this.chartData.length - 2].y : currentPrice;
            const change = currentPrice - prevPrice;
            const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;
            
            const sign = change >= 0 ? '+' : '';
            changeText.textContent = `${sign}${change.toFixed(4)} (${sign}${changePercent.toFixed(2)}%)`;
            
            // Animate color change
            if (change >= 0) {
                changeIcon.setAttribute('data-lucide', 'trending-up');
                element.className = 'flex items-center justify-end text-primary-500 text-sm transition-colors duration-300';
            } else {
                changeIcon.setAttribute('data-lucide', 'trending-down');
                element.className = 'flex items-center justify-end text-red-500 text-sm transition-colors duration-300';
            }
            
            // Refresh icons efficiently
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }
    
    updateChart(tickData) {
        if (!this.chart || !tickData) return;
        
        try {
            const now = Date.now();
            const price = tickData.last || tickData.bid || tickData.ask || 0;
            
            // Throttle chart updates for performance
            if (now - this.lastTickTime < 200) { // Max 5 updates per second
                return;
            }
            this.lastTickTime = now;
            
            // Add new data point
            this.chartData.push({
                x: now,
                y: price
            });
            
            // Keep only recent points for performance
            if (this.chartData.length > this.maxChartPoints) {
                this.chartData = this.chartData.slice(-this.maxChartPoints);
            }
            
            // Update chart with minimal animation
            this.chart.data.datasets[0].data = this.chartData;
            this.chart.update('none'); // No animation for fastest updates
            
        } catch (error) {
            console.debug('Chart update error:', error);
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
                        tension: 0.2,
                        pointRadius: 0,
                        pointHoverRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false, // Disable all animations for maximum performance
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
                            intersect: false,
                            animation: false, // Disable tooltip animations
                            callbacks: {
                                label: (context) => {
                                    return `Price: ${this.formatPrice(context.parsed.y, this.selectedPair)}`;
                                }
                            }
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
                                maxTicksLimit: 5
                            }
                        },
                        y: {
                            display: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#9ca3af',
                                callback: (value) => {
                                    return this.formatPrice(value, this.selectedPair);
                                }
                            }
                        }
                    },
                    // Performance optimizations
                    parsing: false,
                    normalized: true,
                    spanGaps: true
                }
            });
            
            console.log('✅ Chart initialized with ultra-fast settings');
            
        } catch (error) {
            console.error('❌ Error initializing chart:', error);
        }
    }
    
    updateConnectionDisplay() {
        const connection = this.currentData.connection;
        
        // Batch DOM updates
        requestAnimationFrame(() => {
            // Update main connection status
            const statusElement = document.getElementById('connection-status');
            const typeElement = document.getElementById('connection-type-badge');
            
            if (statusElement) {
                const dot = statusElement.querySelector('.w-2.h-2');
                const icon = statusElement.querySelector('i');
                const text = statusElement.querySelector('span');
                
                if (connection.is_connected) {
                    statusElement.className = 'flex items-center px-3 py-1.5 rounded-full glass border border-green-500/30 transition-all duration-300';
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
                
                // Refresh icons efficiently
                if (window.lucide) {
                    window.lucide.createIcons();
                }
            }
            
            if (typeElement) {
                if (connection.is_connected) {
                    typeElement.textContent = connection.connection_type === 'direct' ? 'MT5 Live' : 'Connected';
                    typeElement.className = 'px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 transition-all duration-300';
                } else {
                    typeElement.textContent = 'Connecting...';
                    typeElement.className = 'px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 transition-all duration-300';
                }
            }
            
            // Update detailed connection info
            this.updateElement('mt5-server', connection.server || 'Connecting...');
            this.updateElement('mt5-account', connection.account ? connection.account.toString() : '--');
            this.updateElement('mt5-connection-status', connection.is_connected ? 'Connected' : 'Initializing');
            
            // Update mode indicator in footer
            this.updateElement('mode-indicator', connection.is_connected ? 'MT5 Live' : 'Connecting');
            this.updateElement('status-indicator', connection.is_connected ? 'Live' : 'Connecting');
        });
    }
    
    updateAccountDisplay() {
        const account = this.currentData.account;
        
        // Batch DOM updates
        requestAnimationFrame(() => {
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
                const marginLevel = Math.min(Math.max(account.margin_level || 0, 0), 100);
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
                    changeElement.className = change >= 0 ? 'text-sm text-green-400 transition-colors duration-300' : 'text-sm text-red-400 transition-colors duration-300';
                }
            }
        });
    }
    
    updateTradingStats() {
        const positions = this.currentData.positions || [];
        const orders = this.currentData.orders || [];
        
        // Batch DOM updates
        requestAnimationFrame(() => {
            this.updateElement('open-positions', positions.length.toString());
            this.updateElement('pending-orders', orders.length.toString());
            
            // Calculate daily P&L
            const totalProfit = positions.reduce((sum, pos) => sum + (pos.profit || 0), 0);
            const dailyPnlElement = document.getElementById('daily-pnl');
            if (dailyPnlElement) {
                const sign = totalProfit >= 0 ? '+' : '';
                dailyPnlElement.textContent = `${sign}${this.formatCurrency(totalProfit)}`;
                dailyPnlElement.className = totalProfit >= 0 ? 
                    'text-2xl font-bold text-primary-500 transition-colors duration-300' : 
                    'text-2xl font-bold text-red-500 transition-colors duration-300';
            }
        });
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
            
            // Refresh icons
            if (window.lucide) {
                window.lucide.createIcons();
            }
            return;
        }
        
        // Limit to first 50 pairs for performance
        const displayPairs = pairs.slice(0, 50);
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        displayPairs.forEach(pair => {
            const div = document.createElement('div');
            div.className = `pair-item p-2 rounded-lg cursor-pointer transition-all duration-200 ${pair.symbol === this.selectedPair ? 'selected' : ''}`;
            div.dataset.symbol = pair.symbol;
            
            div.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <span class="font-medium text-white text-sm">${pair.symbol}</span>
                        <span class="category-${pair.category} px-1.5 py-0.5 rounded text-xs font-medium">${pair.category}</span>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-gray-400">${(pair.spread || 0).toFixed(1)} pips</div>
                    </div>
                </div>
                <div class="text-xs text-gray-400 mt-1 truncate">${pair.name}</div>
            `;
            
            fragment.appendChild(div);
        });
        
        pairsListElement.innerHTML = '';
        pairsListElement.appendChild(fragment);
        
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
        
        // Batch DOM updates
        requestAnimationFrame(() => {
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
                    'flex items-center px-3 py-1.5 rounded-full gradient-primary text-sm transition-all duration-300' :
                    'flex items-center px-3 py-1.5 rounded-full gradient-danger text-sm transition-all duration-300';
                
                // Refresh icons
                if (window.lucide) {
                    window.lucide.createIcons();
                }
            }
            
            // Update trend strength
            if (supertrend.trend_strength !== undefined) {
                const strength = Math.min(Math.max(supertrend.trend_strength, 0), 100);
                this.updateElement('trend-strength-value', `${strength.toFixed(1)}%`);
                
                const strengthBar = document.getElementById('trend-strength-bar');
                if (strengthBar) {
                    strengthBar.style.width = `${strength}%`;
                }
            }
            
            // Update ATR
            if (supertrend.atr !== undefined) {
                this.updateElement('atr-value', supertrend.atr.toFixed(5));
            }
            
            // Update RSI
            if (supertrend.rsi !== undefined) {
                const rsi = Math.min(Math.max(supertrend.rsi, 0), 100);
                this.updateElement('rsi-value', rsi.toFixed(1));
                
                const rsiBar = document.getElementById('rsi-bar');
                if (rsiBar) {
                    rsiBar.style.width = `${rsi}%`;
                }
            }
            
            // Update signals
            this.updateSignalIndicator('buy-signal-indicator', supertrend.buy_signal);
            this.updateSignalIndicator('sell-signal-indicator', supertrend.sell_signal);
            this.updateSignalIndicator('strong-signal-indicator', supertrend.strong_signal);
        });
    }
    
    updateSignalIndicator(elementId, isActive) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        if (isActive) {
            element.className = 'w-4 h-4 rounded-full bg-green-500 signal-active transition-all duration-300';
        } else {
            element.className = 'w-4 h-4 rounded-full border-2 border-gray-600 transition-all duration-300';
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
        
        // Search functionality with debouncing
        const searchInput = document.getElementById('pair-search');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterPairs(e.target.value);
                }, 300);
            });
        }
        
        // Category filters
        const categoryFilters = document.querySelectorAll('.category-filter');
        categoryFilters.forEach(filter => {
            filter.addEventListener('click', (e) => this.filterByCategory(e.target.dataset.category));
        });
        
        // Settings panel
        const closeSettings = document.getElementById('close-settings');
        if (closeSettings) {
            closeSettings.addEventListener('click', () => this.toggleSettings());
        }
        
        // Connection test modal
        const closeTestModal = document.getElementById('close-test-modal');
        if (closeTestModal) {
            closeTestModal.addEventListener('click', () => this.hideConnectionTest());
        }
        
        const runTest = document.getElementById('run-test');
        if (runTest) {
            runTest.addEventListener('click', () => this.runConnectionTest());
        }
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
        
        // Clear price format cache for new symbol
        this.priceFormatCache.clear();
        
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
            this.chart.update('none');
        }
        
        // Fetch new data immediately
        this.fetchTickData();
        this.fetchSupertrendData();
    }
    
    async loadInitialData() {
        console.log('📊 Loading initial dashboard data...');
        
        try {
            // Load critical data first
            await Promise.race([
                this.fetchConnectionStatus(),
                this.fetchTickData()
            ]);
            
            // Load other data in background
            setTimeout(() => {
                this.fetchAccountData();
                this.fetchPairsData();
                this.fetchSupertrendData();
            }, 100);
            
            console.log('✅ Initial data loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
        }
    }
    
    trackUpdatePerformance(updateTime) {
        this.updateTimes.push(updateTime);
        
        // Keep only last 50 measurements
        if (this.updateTimes.length > 50) {
            this.updateTimes = this.updateTimes.slice(-25);
        }
        
        // Calculate average
        this.avgUpdateTime = this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length;
        
        // Update performance indicator
        const perfElement = document.getElementById('performance-indicator');
        if (perfElement) {
            if (this.avgUpdateTime < 5) {
                perfElement.textContent = 'Ultra-Fast';
                perfElement.className = 'text-primary-500 font-medium';
            } else if (this.avgUpdateTime < 15) {
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
                statusDot.className = 'w-2 h-2 bg-primary-500 rounded-full transition-all duration-300';
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
    
    formatCurrency(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
        return `$${amount.toFixed(2)}`;
    }
    
    formatVolume(volume) {
        if (typeof volume !== 'number' || isNaN(volume)) return '0';
        if (volume >= 1000000) {
            return `${(volume / 1000000).toFixed(1)}M`;
        } else if (volume >= 1000) {
            return `${(volume / 1000).toFixed(1)}K`;
        }
        return volume.toString();
    }
    
    calculatePips(spread, symbol) {
        if (!symbol) return spread * 10000;
        
        const symbolUpper = symbol.toUpperCase();
        if (symbolUpper.includes('JPY')) {
            return spread * 100;
        } else if (symbolUpper.includes('XAU') || symbolUpper.includes('GOLD')) {
            return spread * 10;
        } else if (symbolUpper.includes('BTC') || symbolUpper.includes('ETH')) {
            return spread;
        }
        return spread * 10000;
    }
    
    showError(message) {
        console.error('❌ Dashboard Error:', message);
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
                btn.className = 'flex items-center px-4 py-2 rounded-lg btn-premium text-white font-medium text-sm transition-all duration-300';
            } else {
                if (icon) icon.setAttribute('data-lucide', 'play');
                if (text) text.textContent = 'Play';
                btn.className = 'flex items-center px-4 py-2 rounded-lg bg-gray-600 text-white font-medium text-sm transition-all duration-300';
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
            this.chart.update('none');
        }
        
        // Clear caches
        this.priceFormatCache.clear();
        this.updateTimes = [];
        
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
    
    hideConnectionTest() {
        const modal = document.getElementById('connection-test-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    async runConnectionTest() {
        const resultsElement = document.getElementById('test-results');
        if (!resultsElement) return;
        
        resultsElement.innerHTML = `
            <div class="text-center py-6">
                <div class="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p class="text-gray-400 text-sm">Testing MT5 connection...</p>
            </div>
        `;
        
        try {
            const response = await fetch('/api/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.displayTestResults(data);
            } else {
                throw new Error('Test request failed');
            }
        } catch (error) {
            resultsElement.innerHTML = `
                <div class="text-center py-6">
                    <div class="text-red-500 mb-3">❌ Test Failed</div>
                    <p class="text-gray-400 text-sm">${error.message}</p>
                </div>
            `;
        }
    }
    
    displayTestResults(data) {
        const resultsElement = document.getElementById('test-results');
        if (!resultsElement || !data.results) return;
        
        const results = Object.entries(data.results).map(([key, result]) => {
            const icon = result.success ? '✅' : '❌';
            const color = result.success ? 'text-green-400' : 'text-red-400';
            return `
                <div class="flex items-center justify-between p-3 glass rounded-lg">
                    <span class="text-gray-300 text-sm">${key.replace(/_/g, ' ').toUpperCase()}</span>
                    <div class="flex items-center space-x-2">
                        <span class="${color} text-sm">${icon}</span>
                        <span class="text-xs text-gray-400">${result.message}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        resultsElement.innerHTML = results;
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
    console.log('🚀 SuperTrend Pro MT5 Dashboard - Ultra-Fast Real-time Version');
    window.dashboard = new SuperTrendDashboard();
});

// Handle page visibility changes to optimize performance
document.addEventListener('visibilitychange', () => {
    if (window.dashboard) {
        if (document.hidden) {
            console.log('📱 Page hidden - reducing update frequency');
            window.dashboard.updateInterval = 1000;
            window.dashboard.fastTickInterval = 500;
        } else {
            console.log('📱 Page visible - resuming ultra-fast updates');
            window.dashboard.updateInterval = 500;
            window.dashboard.fastTickInterval = 250;
        }
    }
});

// Handle window focus for optimal performance
window.addEventListener('focus', () => {
    if (window.dashboard) {
        console.log('🎯 Window focused - enabling ultra-fast mode');
        window.dashboard.updateInterval = 500;
        window.dashboard.fastTickInterval = 250;
    }
});

window.addEventListener('blur', () => {
    if (window.dashboard) {
        console.log('💤 Window blurred - reducing update frequency');
        window.dashboard.updateInterval = 1000;
        window.dashboard.fastTickInterval = 500;
    }
});