/**
 * SuperTrend Pro MT5 Dashboard - Enhanced JavaScript
 * Real MT5 connection with proper market hours checking
 */

class SuperTrendDashboard {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.currentSymbol = 'EURUSD';
        this.isRunning = true;
        this.chart = null;
        this.marketData = [];
        this.pairs = [];
        this.selectedPair = null;
        this.alerts = [];
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 5;
        this.reconnectDelay = 5000;
        
        // Market hours tracking
        this.marketHours = {
            isOpen: false,
            nextOpen: null,
            currentSession: null
        };
        
        // SuperTrend configuration
        this.config = {
            atrPeriod: 20,
            multiplier: 2.0,
            rsiPeriod: 14,
            useRsiFilter: true
        };
        
        this.init();
    }
    
    init() {
        console.log('🚀 Initializing SuperTrend Pro MT5 Dashboard');
        this.setupEventListeners();
        this.initializeChart();
        this.checkMarketHours();
        this.connectToMT5();
        this.startPeriodicUpdates();
    }
    
    setupEventListeners() {
        // Connection controls
        document.getElementById('play-pause-btn')?.addEventListener('click', () => this.toggleConnection());
        document.getElementById('reset-btn')?.addEventListener('click', () => this.resetDashboard());
        document.getElementById('refresh-connection')?.addEventListener('click', () => this.reconnectToMT5());
        document.getElementById('connection-test-btn')?.addEventListener('click', () => this.showConnectionTest());
        
        // Settings
        document.getElementById('settings-btn')?.addEventListener('click', () => this.toggleSettings());
        document.getElementById('close-settings')?.addEventListener('click', () => this.hideSettings());
        document.getElementById('apply-settings')?.addEventListener('click', () => this.applySettings());
        
        // Pair search and filtering
        document.getElementById('pair-search')?.addEventListener('input', (e) => this.filterPairs(e.target.value));
        document.querySelectorAll('.category-filter').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterByCategory(e.target.dataset.category));
        });
        
        // Settings sliders
        document.getElementById('atr-period')?.addEventListener('input', (e) => {
            document.getElementById('atr-period-value').textContent = e.target.value;
        });
        document.getElementById('multiplier')?.addEventListener('input', (e) => {
            document.getElementById('multiplier-value').textContent = e.target.value;
        });
        document.getElementById('rsi-period')?.addEventListener('input', (e) => {
            document.getElementById('rsi-period-value').textContent = e.target.value;
        });
        
        // Modal controls
        document.getElementById('close-test-modal')?.addEventListener('click', () => this.hideConnectionTest());
        document.getElementById('run-test')?.addEventListener('click', () => this.runConnectionTest());
        document.getElementById('clear-alerts')?.addEventListener('click', () => this.clearAlerts());
    }
    
    checkMarketHours() {
        const now = new Date();
        const utcTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
        const day = utcTime.getUTCDay();
        const hour = utcTime.getUTCHours();
        
        // Forex market hours: Sunday 22:00 UTC - Friday 22:00 UTC
        let isOpen = false;
        let currentSession = 'Closed';
        
        if (day === 0) { // Sunday
            isOpen = hour >= 22;
            currentSession = isOpen ? 'Sydney' : 'Closed';
        } else if (day >= 1 && day <= 4) { // Monday to Thursday
            isOpen = true;
            if (hour >= 22 || hour < 7) currentSession = 'Sydney';
            else if (hour >= 7 && hour < 15) currentSession = 'Tokyo';
            else if (hour >= 15 && hour < 22) currentSession = 'London';
            else currentSession = 'New York';
        } else if (day === 5) { // Friday
            isOpen = hour < 22;
            if (hour < 7) currentSession = 'Sydney';
            else if (hour >= 7 && hour < 15) currentSession = 'Tokyo';
            else if (hour >= 15 && hour < 22) currentSession = 'London';
            else currentSession = 'Closed';
        }
        
        this.marketHours.isOpen = isOpen;
        this.marketHours.currentSession = currentSession;
        
        // Calculate next market open
        if (!isOpen) {
            const nextOpen = new Date(utcTime);
            if (day === 5 && hour >= 22) { // Friday after close
                nextOpen.setUTCDate(nextOpen.getUTCDate() + 2); // Next Sunday
                nextOpen.setUTCHours(22, 0, 0, 0);
            } else if (day === 6) { // Saturday
                nextOpen.setUTCDate(nextOpen.getUTCDate() + 1); // Next Sunday
                nextOpen.setUTCHours(22, 0, 0, 0);
            } else if (day === 0 && hour < 22) { // Sunday before open
                nextOpen.setUTCHours(22, 0, 0, 0);
            }
            this.marketHours.nextOpen = nextOpen;
        }
        
        this.updateMarketStatus();
        console.log(`📊 Market Status: ${isOpen ? 'Open' : 'Closed'} (${currentSession})`);
    }
    
    updateMarketStatus() {
        const statusElements = {
            marketStatus: document.querySelector('#mt5-status-content .text-green-400'),
            session: document.querySelector('#mt5-status-content .text-white.font-medium'),
            nextClose: document.querySelector('#mt5-status-content .text-gray-300')
        };
        
        if (statusElements.marketStatus) {
            statusElements.marketStatus.textContent = this.marketHours.isOpen ? 'Open' : 'Closed';
            statusElements.marketStatus.className = this.marketHours.isOpen ? 'text-green-400 font-medium' : 'text-red-400 font-medium';
        }
        
        if (statusElements.session) {
            statusElements.session.textContent = this.marketHours.currentSession;
        }
        
        if (statusElements.nextClose && this.marketHours.nextOpen) {
            const timeStr = this.marketHours.nextOpen.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'America/New_York'
            });
            statusElements.nextClose.textContent = `${timeStr} EST`;
        }
    }
    
    async connectToMT5() {
        if (!this.marketHours.isOpen) {
            this.updateConnectionStatus('market-closed', 'Market Closed', 'Market is currently closed');
            this.updatePriceDisplay('Market Closed', '--', '--', '--', '--');
            return;
        }
        
        this.connectionAttempts++;
        console.log(`🔄 MT5 connection attempt ${this.connectionAttempts}/${this.maxConnectionAttempts}`);
        
        this.updateConnectionStatus('connecting', 'Connecting', 'Attempting to connect to MT5...');
        
        try {
            // Try WebSocket connection first
            await this.connectWebSocket();
        } catch (error) {
            console.warn('⚠️ WebSocket connection failed, trying HTTP API...');
            try {
                await this.connectHTTP();
            } catch (httpError) {
                console.error('❌ Both WebSocket and HTTP connections failed');
                this.handleConnectionFailure();
            }
        }
    }
    
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket('ws://localhost:8000/ws');
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected to MT5');
                    this.isConnected = true;
                    this.connectionAttempts = 0;
                    this.updateConnectionStatus('connected', 'MT5 Connected', 'WebSocket connection active');
                    
                    // Subscribe to events
                    this.ws.send(JSON.stringify({
                        type: 'subscribe',
                        events: ['tick', 'account_info', 'symbols', 'positions', 'orders', 'supertrend_update']
                    }));
                    
                    this.loadInitialData();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleWebSocketMessage(data);
                    } catch (error) {
                        console.error('❌ Error parsing WebSocket message:', error);
                    }
                };
                
                this.ws.onclose = () => {
                    console.log('🔌 WebSocket connection closed');
                    this.isConnected = false;
                    this.updateConnectionStatus('disconnected', 'Disconnected', 'Connection lost');
                    
                    // Auto-reconnect if market is open
                    if (this.marketHours.isOpen && this.connectionAttempts < this.maxConnectionAttempts) {
                        setTimeout(() => this.connectToMT5(), this.reconnectDelay);
                    }
                };
                
                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    reject(error);
                };
                
                // Connection timeout
                setTimeout(() => {
                    if (this.ws.readyState !== WebSocket.OPEN) {
                        this.ws.close();
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000);
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async connectHTTP() {
        try {
            // Test API connection
            const response = await fetch('/api/status');
            if (!response.ok) throw new Error('API not available');
            
            const status = await response.json();
            console.log('✅ HTTP API connected:', status);
            
            this.isConnected = true;
            this.connectionAttempts = 0;
            this.updateConnectionStatus('connected', 'MT5 Connected', 'HTTP API connection active');
            
            // Load data via HTTP
            await this.loadInitialData();
            
        } catch (error) {
            throw new Error(`HTTP API connection failed: ${error.message}`);
        }
    }
    
    handleConnectionFailure() {
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            console.error('❌ Max connection attempts reached');
            this.updateConnectionStatus('failed', 'Connection Failed', 'Unable to connect to MT5 Terminal');
            this.updatePriceDisplay('No Connection', '--', '--', '--', '--');
        } else {
            console.log(`🔄 Retrying connection in ${this.reconnectDelay/1000} seconds...`);
            setTimeout(() => this.connectToMT5(), this.reconnectDelay);
        }
    }
    
    async loadInitialData() {
        try {
            console.log('📊 Loading initial data from MT5...');
            
            // Load trading pairs
            await this.loadTradingPairs();
            
            // Load connection status
            await this.loadConnectionStatus();
            
            // Load current tick data
            await this.loadTickData();
            
            // Load account info
            await this.loadAccountInfo();
            
            console.log('✅ Initial data loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
        }
    }
    
    async loadTradingPairs() {
        try {
            const response = await fetch('/api/pairs');
            if (!response.ok) throw new Error('Failed to load pairs');
            
            this.pairs = await response.json();
            console.log(`📋 Loaded ${this.pairs.length} trading pairs`);
            
            this.renderPairsList();
            this.updatePairsCount();
            
        } catch (error) {
            console.error('❌ Error loading trading pairs:', error);
            this.pairs = this.getFallbackPairs();
            this.renderPairsList();
        }
    }
    
    async loadConnectionStatus() {
        try {
            const response = await fetch('/api/connection');
            if (!response.ok) throw new Error('Failed to load connection status');
            
            const connection = await response.json();
            this.updateMT5Status(connection);
            
        } catch (error) {
            console.error('❌ Error loading connection status:', error);
        }
    }
    
    async loadTickData() {
        try {
            const response = await fetch(`/api/tick?symbol=${this.currentSymbol}`);
            if (!response.ok) throw new Error('Failed to load tick data');
            
            const tick = await response.json();
            if (tick && !tick.error) {
                this.updatePriceDisplay(tick.last || tick.bid, tick.bid, tick.ask, tick.spread, tick.volume);
                this.updateLastUpdate();
            }
            
        } catch (error) {
            console.error('❌ Error loading tick data:', error);
        }
    }
    
    async loadAccountInfo() {
        try {
            const response = await fetch('/api/account-summary');
            if (!response.ok) throw new Error('Failed to load account info');
            
            const account = await response.json();
            if (account && !account.error) {
                this.updateAccountDisplay(account);
            }
            
        } catch (error) {
            console.error('❌ Error loading account info:', error);
        }
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'tick':
                this.handleTickUpdate(data.data);
                break;
            case 'account_info':
                this.handleAccountUpdate(data.data);
                break;
            case 'symbols':
                this.handleSymbolsUpdate(data.data);
                break;
            case 'positions':
                this.handlePositionsUpdate(data.data);
                break;
            case 'orders':
                this.handleOrdersUpdate(data.data);
                break;
            case 'supertrend_update':
                this.handleSupertrendUpdate(data.data);
                break;
            case 'connection_status':
                this.updateMT5Status(data.data);
                break;
            case 'error':
                console.error('❌ WebSocket error:', data.message);
                break;
            default:
                console.log('📨 Unknown message type:', data.type);
        }
    }
    
    handleTickUpdate(tick) {
        if (tick.symbol === this.currentSymbol) {
            this.updatePriceDisplay(tick.last || tick.bid, tick.bid, tick.ask, tick.spread, tick.volume);
            this.updateChart(tick);
            this.updateLastUpdate();
        }
    }
    
    handleAccountUpdate(account) {
        this.updateAccountDisplay({ account });
    }
    
    handleSymbolsUpdate(symbols) {
        if (Array.isArray(symbols)) {
            this.pairs = symbols;
            this.renderPairsList();
            this.updatePairsCount();
        }
    }
    
    handlePositionsUpdate(positions) {
        const positionsCount = Array.isArray(positions) ? positions.length : 0;
        document.getElementById('open-positions').textContent = positionsCount;
    }
    
    handleOrdersUpdate(orders) {
        const ordersCount = Array.isArray(orders) ? orders.length : 0;
        document.getElementById('pending-orders').textContent = ordersCount;
    }
    
    handleSupertrendUpdate(data) {
        this.updateSupertrendDisplay(data);
    }
    
    updateConnectionStatus(status, title, message) {
        const statusElement = document.getElementById('connection-status');
        const modeIndicator = document.getElementById('mode-indicator');
        const statusIndicator = document.getElementById('status-indicator');
        const statusDot = document.getElementById('status-dot');
        
        // Update connection status display
        if (statusElement) {
            const dot = statusElement.querySelector('.w-2.h-2');
            const icon = statusElement.querySelector('i');
            const text = statusElement.querySelector('span:last-child');
            
            statusElement.className = 'flex items-center px-3 py-1.5 rounded-full glass border connection-pulse';
            
            switch (status) {
                case 'connected':
                    statusElement.classList.add('border-green-500/30');
                    if (dot) dot.className = 'w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse';
                    if (icon) icon.setAttribute('data-lucide', 'wifi');
                    if (text) {
                        text.textContent = title;
                        text.className = 'text-green-400 font-medium text-sm';
                    }
                    break;
                case 'connecting':
                    statusElement.classList.add('border-yellow-500/30');
                    if (dot) dot.className = 'w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse';
                    if (icon) icon.setAttribute('data-lucide', 'loader');
                    if (text) {
                        text.textContent = title;
                        text.className = 'text-yellow-400 font-medium text-sm';
                    }
                    break;
                case 'market-closed':
                    statusElement.classList.add('border-blue-500/30');
                    if (dot) dot.className = 'w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse';
                    if (icon) icon.setAttribute('data-lucide', 'clock');
                    if (text) {
                        text.textContent = title;
                        text.className = 'text-blue-400 font-medium text-sm';
                    }
                    break;
                default:
                    statusElement.classList.add('border-red-500/30');
                    if (dot) dot.className = 'w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse';
                    if (icon) icon.setAttribute('data-lucide', 'wifi-off');
                    if (text) {
                        text.textContent = title;
                        text.className = 'text-red-400 font-medium text-sm';
                    }
            }
        }
        
        // Update footer indicators
        if (modeIndicator) {
            modeIndicator.textContent = status === 'connected' ? 'MT5 Live' : 
                                      status === 'market-closed' ? 'Market Closed' : 'Connecting';
            modeIndicator.className = status === 'connected' ? 'text-green-400 font-medium' :
                                     status === 'market-closed' ? 'text-blue-400 font-medium' : 'text-yellow-400 font-medium';
        }
        
        if (statusIndicator) {
            statusIndicator.textContent = status === 'connected' ? 'Live' : 'Offline';
            statusIndicator.className = status === 'connected' ? 'text-primary-500 font-medium' : 'text-red-400 font-medium';
        }
        
        if (statusDot) {
            statusDot.className = status === 'connected' ? 'w-2 h-2 bg-primary-500 rounded-full animate-pulse' : 
                                 'w-2 h-2 bg-red-500 rounded-full animate-pulse';
        }
        
        // Refresh icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    updatePriceDisplay(price, bid, ask, spread, volume) {
        // Update main price
        const priceElement = document.getElementById('current-price');
        if (priceElement) {
            priceElement.textContent = typeof price === 'string' ? price : parseFloat(price).toFixed(5);
        }
        
        // Update bid/ask
        const bidElement = document.getElementById('bid-price');
        const askElement = document.getElementById('ask-price');
        if (bidElement && bid !== '--') bidElement.textContent = parseFloat(bid).toFixed(5);
        if (askElement && ask !== '--') askElement.textContent = parseFloat(ask).toFixed(5);
        
        // Update spread
        const spreadElement = document.getElementById('spread');
        if (spreadElement && spread !== '--') {
            const spreadPips = typeof spread === 'number' ? spread : parseFloat(spread) || 0;
            spreadElement.textContent = `${spreadPips.toFixed(1)} pips`;
        }
        
        // Update volume
        const volumeElement = document.getElementById('volume');
        if (volumeElement && volume !== '--') {
            const vol = typeof volume === 'number' ? volume : parseFloat(volume) || 0;
            volumeElement.textContent = vol > 1000000 ? `${(vol/1000000).toFixed(1)}M` : 
                                       vol > 1000 ? `${(vol/1000).toFixed(1)}K` : vol.toString();
        }
    }
    
    updateMT5Status(connection) {
        // Update connection type badge
        const badge = document.getElementById('connection-type-badge');
        if (badge) {
            if (connection.is_connected) {
                badge.textContent = connection.connection_type === 'direct' ? 'MT5 Live' : 'Connected';
                badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400';
            } else {
                badge.textContent = 'Disconnected';
                badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400';
            }
        }
        
        // Update connection details
        document.getElementById('mt5-server').textContent = connection.server || 'Not connected';
        document.getElementById('mt5-account').textContent = connection.account || '--';
        document.getElementById('mt5-connection-status').textContent = connection.is_connected ? 'Connected' : 'Disconnected';
        
        // Update account balance info
        if (connection.balance !== undefined) {
            document.getElementById('account-balance').textContent = `$${parseFloat(connection.balance).toFixed(2)}`;
        }
        if (connection.equity !== undefined) {
            document.getElementById('account-equity').textContent = `$${parseFloat(connection.equity).toFixed(2)}`;
        }
        if (connection.free_margin !== undefined) {
            document.getElementById('account-free-margin').textContent = `$${parseFloat(connection.free_margin).toFixed(2)}`;
        }
        if (connection.margin_level !== undefined) {
            const marginLevel = parseFloat(connection.margin_level);
            document.getElementById('margin-level-percent').textContent = `${marginLevel.toFixed(1)}%`;
            document.getElementById('margin-level-bar').style.width = `${Math.min(marginLevel, 100)}%`;
        }
    }
    
    updateAccountDisplay(data) {
        if (data.account) {
            const account = data.account;
            
            // Update balance
            if (account.balance !== undefined) {
                document.getElementById('account-balance').textContent = `$${parseFloat(account.balance).toFixed(2)}`;
            }
            if (account.equity !== undefined) {
                document.getElementById('account-equity').textContent = `$${parseFloat(account.equity).toFixed(2)}`;
            }
            if (account.free_margin !== undefined) {
                document.getElementById('account-free-margin').textContent = `$${parseFloat(account.free_margin).toFixed(2)}`;
            }
            if (account.margin_level !== undefined) {
                const marginLevel = parseFloat(account.margin_level);
                document.getElementById('margin-level-percent').textContent = `${marginLevel.toFixed(1)}%`;
                document.getElementById('margin-level-bar').style.width = `${Math.min(marginLevel, 100)}%`;
            }
        }
        
        // Update trading statistics
        if (data.trading) {
            document.getElementById('open-positions').textContent = data.trading.open_positions || 0;
            document.getElementById('pending-orders').textContent = data.trading.pending_orders || 0;
            
            const dailyPnl = data.trading.daily_pnl || 0;
            const pnlElement = document.getElementById('daily-pnl');
            if (pnlElement) {
                pnlElement.textContent = `${dailyPnl >= 0 ? '+' : ''}$${Math.abs(dailyPnl).toFixed(2)}`;
                pnlElement.className = dailyPnl >= 0 ? 'text-2xl font-bold text-primary-500' : 'text-2xl font-bold text-red-500';
            }
        }
    }
    
    renderPairsList() {
        const container = document.getElementById('pairs-list');
        if (!container) return;
        
        if (this.pairs.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-6">
                    <i data-lucide="search-x" class="w-6 h-6 mx-auto mb-2"></i>
                    <p class="font-medium text-sm">No pairs available</p>
                    <p class="text-xs">Check MT5 connection</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.pairs.map(pair => `
            <div class="pair-item p-2 rounded-lg cursor-pointer transition-all" data-symbol="${pair.symbol}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <div class="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                            <span class="text-xs font-bold text-white">${pair.symbol.substring(0, 2)}</span>
                        </div>
                        <div>
                            <div class="text-white font-medium text-sm">${pair.symbol}</div>
                            <div class="text-gray-400 text-xs">${pair.name}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-white font-medium text-sm">1.08500</div>
                        <div class="text-xs">
                            <span class="category-${pair.category} px-1.5 py-0.5 rounded text-xs font-medium">${pair.category}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.pair-item').forEach(item => {
            item.addEventListener('click', () => {
                const symbol = item.dataset.symbol;
                this.selectPair(symbol);
            });
        });
        
        // Refresh icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    selectPair(symbol) {
        // Update selected pair
        this.currentSymbol = symbol;
        
        // Update UI
        document.getElementById('current-symbol').textContent = symbol;
        document.getElementById('footer-pair').textContent = symbol;
        
        // Update selected state
        document.querySelectorAll('.pair-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-symbol="${symbol}"]`)?.classList.add('selected');
        
        // Find pair details
        const pair = this.pairs.find(p => p.symbol === symbol);
        if (pair) {
            this.showPairDetails(pair);
        }
        
        // Load new data for selected pair
        this.loadTickData();
        
        console.log(`📊 Selected pair: ${symbol}`);
    }
    
    showPairDetails(pair) {
        const detailsElement = document.getElementById('selected-pair-info');
        if (detailsElement) {
            detailsElement.classList.remove('hidden');
            
            document.getElementById('pair-digits').textContent = pair.digits;
            document.getElementById('pair-min-lot').textContent = pair.min_lot;
            document.getElementById('pair-spread').textContent = `${pair.spread || 1.5} pips`;
            document.getElementById('pair-category').textContent = pair.category;
        }
    }
    
    updatePairsCount() {
        const countElement = document.getElementById('pairs-count');
        if (countElement) {
            countElement.textContent = `${this.pairs.length} pairs`;
        }
    }
    
    filterPairs(searchTerm) {
        const items = document.querySelectorAll('.pair-item');
        items.forEach(item => {
            const symbol = item.dataset.symbol.toLowerCase();
            const visible = symbol.includes(searchTerm.toLowerCase());
            item.style.display = visible ? 'block' : 'none';
        });
    }
    
    filterByCategory(category) {
        // Update active filter button
        document.querySelectorAll('.category-filter').forEach(btn => {
            btn.classList.remove('active', 'bg-primary-500', 'text-white');
            btn.classList.add('glass', 'text-gray-300');
        });
        
        const activeBtn = document.querySelector(`[data-category="${category}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('glass', 'text-gray-300');
            activeBtn.classList.add('active', 'bg-primary-500', 'text-white');
        }
        
        // Filter pairs
        const items = document.querySelectorAll('.pair-item');
        items.forEach(item => {
            const symbol = item.dataset.symbol;
            const pair = this.pairs.find(p => p.symbol === symbol);
            const visible = category === 'all' || (pair && pair.category === category);
            item.style.display = visible ? 'block' : 'none';
        });
    }
    
    getFallbackPairs() {
        return [
            { symbol: 'EURUSD', name: 'Euro vs US Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 1.5 },
            { symbol: 'GBPUSD', name: 'British Pound vs US Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 2.0 },
            { symbol: 'USDJPY', name: 'US Dollar vs Japanese Yen', category: 'major', digits: 3, min_lot: 0.01, spread: 1.8 },
            { symbol: 'BTCUSD', name: 'Bitcoin vs US Dollar', category: 'crypto', digits: 2, min_lot: 0.01, spread: 25.0 }
        ];
    }
    
    initializeChart() {
        const canvas = document.getElementById('price-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Price',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'SuperTrend Up',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0
                }, {
                    label: 'SuperTrend Down',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'minute'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#9ca3af'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#9ca3af'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }
    
    updateChart(tick) {
        if (!this.chart) return;
        
        const now = new Date();
        const price = tick.last || tick.bid;
        
        // Add new data point
        this.chart.data.labels.push(now);
        this.chart.data.datasets[0].data.push(price);
        
        // Keep only last 100 points
        if (this.chart.data.labels.length > 100) {
            this.chart.data.labels.shift();
            this.chart.data.datasets.forEach(dataset => dataset.data.shift());
        }
        
        this.chart.update('none');
    }
    
    updateSupertrendDisplay(data) {
        // Update trend indicator
        const trendIndicator = document.getElementById('trend-indicator');
        if (trendIndicator && data.trend !== undefined) {
            const isBullish = data.trend === 1;
            trendIndicator.innerHTML = `
                <i data-lucide="${isBullish ? 'trending-up' : 'trending-down'}" class="w-4 h-4 mr-1"></i>
                <span class="font-bold">${isBullish ? 'BULLISH' : 'BEARISH'}</span>
            `;
            trendIndicator.className = `flex items-center px-3 py-1.5 rounded-full text-sm ${
                isBullish ? 'gradient-primary' : 'gradient-danger'
            }`;
        }
        
        // Update trend strength
        if (data.trend_strength !== undefined) {
            const strength = Math.min(data.trend_strength, 100);
            document.getElementById('trend-strength-value').textContent = `${strength.toFixed(1)}%`;
            document.getElementById('trend-strength-bar').style.width = `${strength}%`;
        }
        
        // Update ATR
        if (data.atr !== undefined) {
            document.getElementById('atr-value').textContent = data.atr.toFixed(5);
        }
        
        // Update RSI
        if (data.rsi !== undefined) {
            const rsi = Math.min(Math.max(data.rsi, 0), 100);
            document.getElementById('rsi-value').textContent = rsi.toFixed(1);
            document.getElementById('rsi-bar').style.width = `${rsi}%`;
        }
        
        // Update signals
        this.updateSignalIndicators(data);
        
        // Refresh icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    updateSignalIndicators(data) {
        const buyIndicator = document.getElementById('buy-signal-indicator');
        const sellIndicator = document.getElementById('sell-signal-indicator');
        const strongIndicator = document.getElementById('strong-signal-indicator');
        
        // Buy signal
        if (buyIndicator) {
            if (data.buy_signal) {
                buyIndicator.className = 'w-4 h-4 rounded-full bg-green-500 signal-active';
                document.getElementById('buy-signal-strength').textContent = 'Active';
                this.addAlert('buy', 'Buy Signal Generated', data.trend_strength);
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
                this.addAlert('sell', 'Sell Signal Generated', data.trend_strength);
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
    
    addAlert(type, message, strength) {
        const alert = {
            id: Date.now(),
            type,
            message,
            strength: strength ? `${strength.toFixed(1)}%` : 'N/A',
            timestamp: new Date(),
            symbol: this.currentSymbol
        };
        
        this.alerts.unshift(alert);
        
        // Keep only last 10 alerts
        if (this.alerts.length > 10) {
            this.alerts = this.alerts.slice(0, 10);
        }
        
        this.renderAlerts();
    }
    
    renderAlerts() {
        const container = document.getElementById('alerts-content');
        if (!container) return;
        
        if (this.alerts.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-6">
                    <i data-lucide="bell" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                    <p class="font-medium text-sm">No signals yet</p>
                    <p class="text-xs">Trading signals will appear here</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.alerts.map(alert => `
            <div class="glass rounded-lg p-3 border-l-4 ${alert.type === 'buy' ? 'border-green-500' : 'border-red-500'}">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center space-x-2">
                        <i data-lucide="${alert.type === 'buy' ? 'trending-up' : 'trending-down'}" 
                           class="w-4 h-4 ${alert.type === 'buy' ? 'text-green-400' : 'text-red-400'}"></i>
                        <span class="text-white font-medium text-sm">${alert.message}</span>
                    </div>
                    <span class="text-xs text-gray-400">${alert.strength}</span>
                </div>
                <div class="flex justify-between text-xs text-gray-400">
                    <span>${alert.symbol}</span>
                    <span>${alert.timestamp.toLocaleTimeString()}</span>
                </div>
            </div>
        `).join('');
        
        // Refresh icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    clearAlerts() {
        this.alerts = [];
        this.renderAlerts();
    }
    
    updateLastUpdate() {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        
        document.getElementById('last-update').textContent = timeString;
        document.getElementById('mt5-last-update').textContent = timeString;
    }
    
    startPeriodicUpdates() {
        // Update market hours every minute
        setInterval(() => {
            this.checkMarketHours();
        }, 60000);
        
        // Update data every 5 seconds if connected
        setInterval(() => {
            if (this.isConnected && this.marketHours.isOpen) {
                this.loadTickData();
                this.loadAccountInfo();
            }
        }, 5000);
        
        // Update time display every second
        setInterval(() => {
            this.updateLastUpdate();
        }, 1000);
    }
    
    // Control methods
    toggleConnection() {
        const btn = document.getElementById('play-pause-btn');
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');
        
        this.isRunning = !this.isRunning;
        
        if (this.isRunning) {
            icon.setAttribute('data-lucide', 'pause');
            text.textContent = 'Pause';
            this.connectToMT5();
        } else {
            icon.setAttribute('data-lucide', 'play');
            text.textContent = 'Resume';
            if (this.ws) {
                this.ws.close();
            }
            this.isConnected = false;
            this.updateConnectionStatus('paused', 'Paused', 'Connection paused by user');
        }
        
        // Refresh icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    resetDashboard() {
        console.log('🔄 Resetting dashboard...');
        
        // Reset data
        this.alerts = [];
        this.marketData = [];
        
        // Reset displays
        this.renderAlerts();
        this.updatePriceDisplay('1.08500', '1.08485', '1.08515', '3.0', '1.2M');
        
        // Reset chart
        if (this.chart) {
            this.chart.data.labels = [];
            this.chart.data.datasets.forEach(dataset => dataset.data = []);
            this.chart.update();
        }
        
        // Reconnect
        this.reconnectToMT5();
    }
    
    reconnectToMT5() {
        console.log('🔄 Reconnecting to MT5...');
        
        if (this.ws) {
            this.ws.close();
        }
        
        this.isConnected = false;
        this.connectionAttempts = 0;
        
        setTimeout(() => {
            this.connectToMT5();
        }, 1000);
    }
    
    toggleSettings() {
        const panel = document.getElementById('settings-panel');
        if (panel) {
            panel.classList.toggle('hidden');
        }
    }
    
    hideSettings() {
        const panel = document.getElementById('settings-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
    }
    
    applySettings() {
        // Get values from sliders
        this.config.atrPeriod = parseInt(document.getElementById('atr-period').value);
        this.config.multiplier = parseFloat(document.getElementById('multiplier').value);
        this.config.rsiPeriod = parseInt(document.getElementById('rsi-period').value);
        this.config.useRsiFilter = document.getElementById('use-rsi-filter')?.checked || true;
        
        // Update displays
        document.getElementById('atr-period-display').textContent = this.config.atrPeriod;
        document.getElementById('multiplier-display').textContent = this.config.multiplier.toFixed(1);
        
        console.log('⚙️ Settings applied:', this.config);
        
        // Send to backend
        fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.config)
        }).catch(error => console.error('❌ Error updating config:', error));
        
        this.hideSettings();
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
        const resultsContainer = document.getElementById('test-results');
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = `
            <div class="text-center py-6">
                <div class="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p class="text-gray-400 text-sm">Testing MT5 connection...</p>
            </div>
        `;
        
        try {
            const response = await fetch('/api/test-connection', { method: 'POST' });
            const results = await response.json();
            
            let html = '<div class="space-y-3">';
            
            for (const [test, result] of Object.entries(results.results || {})) {
                const icon = result.success ? 'check-circle' : 'x-circle';
                const color = result.success ? 'text-green-400' : 'text-red-400';
                
                html += `
                    <div class="flex items-center justify-between p-3 glass rounded-lg">
                        <div class="flex items-center space-x-3">
                            <i data-lucide="${icon}" class="w-5 h-5 ${color}"></i>
                            <span class="text-white font-medium text-sm">${test.replace(/_/g, ' ').toUpperCase()}</span>
                        </div>
                        <span class="text-xs ${color}">${result.success ? 'PASS' : 'FAIL'}</span>
                    </div>
                    <p class="text-xs text-gray-400 ml-8">${result.message}</p>
                `;
            }
            
            html += '</div>';
            resultsContainer.innerHTML = html;
            
            // Refresh icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            
        } catch (error) {
            resultsContainer.innerHTML = `
                <div class="text-center py-6">
                    <i data-lucide="alert-circle" class="w-8 h-8 mx-auto mb-3 text-red-400"></i>
                    <p class="text-red-400 font-medium">Connection test failed</p>
                    <p class="text-gray-400 text-sm">${error.message}</p>
                </div>
            `;
            
            // Refresh icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new SuperTrendDashboard();
});