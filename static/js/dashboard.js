/**
 * SuperTrend Pro MT5 Dashboard - Enhanced JavaScript
 * Fixed to display ALL pairs from MT5 without hardcoding
 * Optimized for real-time updates and better performance
 */

class SuperTrendDashboard {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.currentSymbol = 'EURUSD';
        this.isRunning = true;
        this.chart = null;
        this.allPairs = [];
        this.filteredPairs = [];
        this.selectedCategory = 'all';
        this.searchTerm = '';
        
        // Performance optimization
        this.updateIntervals = {
            tick: 500,        // 0.5 seconds for tick data
            connection: 2000, // 2 seconds for connection status
            pairs: 10000,     // 10 seconds for pairs refresh
            market: 1000      // 1 second for market data
        };
        
        this.lastUpdates = {
            tick: 0,
            connection: 0,
            pairs: 0,
            market: 0
        };
        
        // Data caching
        this.cache = {
            pairs: null,
            connection: null,
            marketData: new Map(),
            tickData: new Map()
        };
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing SuperTrend Pro MT5 Dashboard');
        
        this.setupEventListeners();
        this.initializeChart();
        
        // Start data fetching immediately
        await this.startDataFetching();
        
        // Initialize WebSocket connection
        this.initWebSocket();
        
        console.log('✅ Dashboard initialized successfully');
    }

    setupEventListeners() {
        // Pair search functionality
        const searchInput = document.getElementById('pair-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterAndDisplayPairs();
            });
        }

        // Category filters
        document.querySelectorAll('.category-filter').forEach(button => {
            button.addEventListener('click', (e) => {
                // Update active state
                document.querySelectorAll('.category-filter').forEach(btn => {
                    btn.classList.remove('active', 'bg-primary-500', 'text-white');
                    btn.classList.add('glass', 'text-gray-300');
                });
                
                e.target.classList.remove('glass', 'text-gray-300');
                e.target.classList.add('active', 'bg-primary-500', 'text-white');
                
                this.selectedCategory = e.target.dataset.category;
                this.filterAndDisplayPairs();
            });
        });

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

        // Settings panel
        const closeSettingsBtn = document.getElementById('close-settings');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => this.hideSettings());
        }

        const applySettingsBtn = document.getElementById('apply-settings');
        if (applySettingsBtn) {
            applySettingsBtn.addEventListener('click', () => this.applySettings());
        }

        // Range sliders
        const atrPeriodSlider = document.getElementById('atr-period');
        if (atrPeriodSlider) {
            atrPeriodSlider.addEventListener('input', (e) => {
                document.getElementById('atr-period-value').textContent = e.target.value;
            });
        }

        const multiplierSlider = document.getElementById('multiplier');
        if (multiplierSlider) {
            multiplierSlider.addEventListener('input', (e) => {
                document.getElementById('multiplier-value').textContent = e.target.value;
            });
        }

        const rsiPeriodSlider = document.getElementById('rsi-period');
        if (rsiPeriodSlider) {
            rsiPeriodSlider.addEventListener('input', (e) => {
                document.getElementById('rsi-period-value').textContent = e.target.value;
            });
        }

        // Connection test modal
        const closeTestModal = document.getElementById('close-test-modal');
        if (closeTestModal) {
            closeTestModal.addEventListener('click', () => this.hideConnectionTest());
        }

        const runTestBtn = document.getElementById('run-test');
        if (runTestBtn) {
            runTestBtn.addEventListener('click', () => this.runConnectionTest());
        }

        // Refresh connection
        const refreshConnectionBtn = document.getElementById('refresh-connection');
        if (refreshConnectionBtn) {
            refreshConnectionBtn.addEventListener('click', () => this.refreshConnection());
        }

        // Clear alerts
        const clearAlertsBtn = document.getElementById('clear-alerts');
        if (clearAlertsBtn) {
            clearAlertsBtn.addEventListener('click', () => this.clearAlerts());
        }
    }

    async startDataFetching() {
        console.log('🔄 Starting data fetching...');
        
        // Start all data fetching processes
        await Promise.all([
            this.fetchConnectionStatus(),
            this.fetchAllPairsData(),
            this.fetchMarketData(),
            this.fetchAccountData()
        ]);
        
        // Start periodic updates
        this.startPeriodicUpdates();
    }

    startPeriodicUpdates() {
        // Optimized update intervals for different data types
        setInterval(() => this.fetchTickData(), this.updateIntervals.tick);
        setInterval(() => this.fetchConnectionStatus(), this.updateIntervals.connection);
        setInterval(() => this.fetchAllPairsData(), this.updateIntervals.pairs);
        setInterval(() => this.fetchMarketData(), this.updateIntervals.market);
    }

    async fetchAllPairsData() {
        const now = Date.now();
        if (now - this.lastUpdates.pairs < this.updateIntervals.pairs && this.cache.pairs) {
            return this.cache.pairs;
        }

        try {
            console.log('📊 Fetching ALL pairs data from MT5...');
            
            // Try multiple endpoints for maximum compatibility
            const endpoints = [
                '/api/pairs',
                '/api/pairs/reload',
                '/api/debug/pairs'
            ];
            
            let pairs = null;
            let lastError = null;
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`🔄 Trying endpoint: ${endpoint}`);
                    const response = await fetch(endpoint);
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        // Handle different response formats
                        if (Array.isArray(data)) {
                            pairs = data;
                        } else if (data.pairs && Array.isArray(data.pairs)) {
                            pairs = data.pairs;
                        } else if (data.data && Array.isArray(data.data)) {
                            pairs = data.data;
                        }
                        
                        if (pairs && pairs.length > 0) {
                            console.log(`✅ Successfully fetched ${pairs.length} pairs from ${endpoint}`);
                            break;
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Endpoint ${endpoint} failed:`, error);
                    lastError = error;
                    continue;
                }
            }
            
            // If all endpoints failed, show error but don't crash
            if (!pairs || pairs.length === 0) {
                console.error('❌ All endpoints failed to fetch pairs:', lastError);
                this.showPairsError('Unable to load trading pairs from MT5. Please check your connection.');
                return [];
            }
            
            // Process and validate pairs
            const processedPairs = this.processPairsData(pairs);
            
            // Cache the results
            this.cache.pairs = processedPairs;
            this.lastUpdates.pairs = now;
            
            // Update the pairs list
            this.allPairs = processedPairs;
            this.filterAndDisplayPairs();
            
            // Update pairs count
            this.updatePairsCount(processedPairs.length);
            
            console.log(`✅ Processed ${processedPairs.length} trading pairs`);
            return processedPairs;
            
        } catch (error) {
            console.error('❌ Error fetching pairs data:', error);
            this.showPairsError('Error loading trading pairs. Retrying...');
            return [];
        }
    }

    processPairsData(rawPairs) {
        console.log('🔄 Processing pairs data...');
        
        const processedPairs = [];
        const seenSymbols = new Set();
        
        for (const pair of rawPairs) {
            try {
                // Skip duplicates
                if (seenSymbols.has(pair.symbol)) {
                    continue;
                }
                seenSymbols.add(pair.symbol);
                
                // Validate required fields
                if (!pair.symbol || typeof pair.symbol !== 'string') {
                    console.warn('⚠️ Invalid pair symbol:', pair);
                    continue;
                }
                
                // Create standardized pair object
                const processedPair = {
                    symbol: pair.symbol.toUpperCase(),
                    name: pair.name || pair.description || pair.symbol,
                    category: this.categorizePair(pair.symbol, pair.category),
                    digits: pair.digits || 5,
                    point_size: pair.point_size || pair.point || 0.00001,
                    min_lot: pair.min_lot || pair.volume_min || 0.01,
                    max_lot: pair.max_lot || pair.volume_max || 100.0,
                    lot_step: pair.lot_step || pair.volume_step || 0.01,
                    spread: pair.spread || 2.0,
                    swap_long: pair.swap_long || -1.0,
                    swap_short: pair.swap_short || 0.5
                };
                
                processedPairs.push(processedPair);
                
            } catch (error) {
                console.warn('⚠️ Error processing pair:', pair, error);
                continue;
            }
        }
        
        // Sort pairs by category and symbol
        processedPairs.sort((a, b) => {
            const categoryOrder = ['major', 'minor', 'crypto', 'commodities', 'indices', 'exotic', 'other'];
            const aCategoryIndex = categoryOrder.indexOf(a.category);
            const bCategoryIndex = categoryOrder.indexOf(b.category);
            
            if (aCategoryIndex !== bCategoryIndex) {
                return aCategoryIndex - bCategoryIndex;
            }
            
            return a.symbol.localeCompare(b.symbol);
        });
        
        console.log(`✅ Processed ${processedPairs.length} pairs successfully`);
        
        // Log category distribution
        const categoryCount = {};
        processedPairs.forEach(pair => {
            categoryCount[pair.category] = (categoryCount[pair.category] || 0) + 1;
        });
        console.log('📊 Category distribution:', categoryCount);
        
        return processedPairs;
    }

    categorizePair(symbol, existingCategory) {
        // Use existing category if provided and valid
        const validCategories = ['major', 'minor', 'crypto', 'commodities', 'indices', 'exotic', 'other'];
        if (existingCategory && validCategories.includes(existingCategory)) {
            return existingCategory;
        }
        
        const symbolUpper = symbol.toUpperCase();
        
        // Major forex pairs
        const majorPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'];
        if (majorPairs.includes(symbolUpper)) {
            return 'major';
        }
        
        // Minor forex pairs (cross currencies)
        const minorPairs = ['EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'GBPCHF', 'GBPAUD', 'AUDCAD', 'AUDCHF', 'AUDJPY', 'AUDNZD', 'CADCHF', 'CADJPY', 'CHFJPY', 'GBPCAD', 'GBPNZD', 'NZDCAD', 'NZDCHF', 'NZDJPY'];
        if (minorPairs.includes(symbolUpper)) {
            return 'minor';
        }
        
        // Cryptocurrencies
        if (symbolUpper.includes('BTC') || symbolUpper.includes('ETH') || symbolUpper.includes('LTC') || 
            symbolUpper.includes('XRP') || symbolUpper.includes('ADA') || symbolUpper.includes('DOT') ||
            symbolUpper.includes('LINK') || symbolUpper.includes('BCH') || symbolUpper.includes('EOS') ||
            symbolUpper.includes('TRX') || symbolUpper.includes('CRYPTO')) {
            return 'crypto';
        }
        
        // Commodities
        if (symbolUpper.includes('XAU') || symbolUpper.includes('XAG') || symbolUpper.includes('GOLD') || 
            symbolUpper.includes('SILVER') || symbolUpper.includes('OIL') || symbolUpper.includes('WTI') || 
            symbolUpper.includes('BRENT') || symbolUpper.includes('USOIL') || symbolUpper.includes('UKOIL') ||
            symbolUpper.includes('COPPER') || symbolUpper.includes('PLATINUM')) {
            return 'commodities';
        }
        
        // Indices
        if (symbolUpper.includes('US30') || symbolUpper.includes('SPX') || symbolUpper.includes('NAS') || 
            symbolUpper.includes('UK100') || symbolUpper.includes('GER') || symbolUpper.includes('FRA') || 
            symbolUpper.includes('JPN') || symbolUpper.includes('AUS') || symbolUpper.includes('HK') ||
            symbolUpper.includes('CHINA') || symbolUpper.includes('INDEX') || symbolUpper.includes('DOW') ||
            symbolUpper.includes('NASDAQ') || symbolUpper.includes('SP500')) {
            return 'indices';
        }
        
        // Exotic forex pairs (6-character currency pairs not in major/minor)
        if (symbolUpper.length === 6 && /^[A-Z]{6}$/.test(symbolUpper)) {
            return 'exotic';
        }
        
        return 'other';
    }

    filterAndDisplayPairs() {
        console.log(`🔍 Filtering pairs: category="${this.selectedCategory}", search="${this.searchTerm}"`);
        
        let filtered = [...this.allPairs];
        
        // Apply category filter
        if (this.selectedCategory !== 'all') {
            filtered = filtered.filter(pair => pair.category === this.selectedCategory);
        }
        
        // Apply search filter
        if (this.searchTerm) {
            filtered = filtered.filter(pair => 
                pair.symbol.toLowerCase().includes(this.searchTerm) ||
                pair.name.toLowerCase().includes(this.searchTerm)
            );
        }
        
        this.filteredPairs = filtered;
        this.displayPairs(filtered);
        
        console.log(`📊 Displaying ${filtered.length} of ${this.allPairs.length} pairs`);
    }

    displayPairs(pairs) {
        const pairsList = document.getElementById('pairs-list');
        if (!pairsList) return;
        
        if (pairs.length === 0) {
            pairsList.innerHTML = `
                <div class="text-center text-gray-400 py-6">
                    <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                    <p class="font-medium text-sm">No pairs found</p>
                    <p class="text-xs">Try adjusting your search or filter</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        
        const pairsHTML = pairs.map(pair => `
            <div class="pair-item p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/5" 
                 data-symbol="${pair.symbol}" 
                 onclick="dashboard.selectPair('${pair.symbol}')">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2">
                            <span class="font-bold text-white text-sm">${pair.symbol}</span>
                            <span class="category-${pair.category} px-2 py-0.5 rounded text-xs font-medium">
                                ${pair.category.toUpperCase()}
                            </span>
                        </div>
                        <div class="text-xs text-gray-400 mt-1 truncate">${pair.name}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-yellow-400 font-medium text-sm">${pair.spread.toFixed(1)} pips</div>
                        <div class="text-xs text-gray-500">Spread</div>
                    </div>
                </div>
            </div>
        `).join('');
        
        pairsList.innerHTML = pairsHTML;
        
        // Highlight selected pair
        this.highlightSelectedPair();
        
        // Recreate icons
        lucide.createIcons();
    }

    showPairsError(message) {
        const pairsList = document.getElementById('pairs-list');
        if (!pairsList) return;
        
        pairsList.innerHTML = `
            <div class="text-center text-red-400 py-6">
                <i data-lucide="alert-circle" class="w-8 h-8 mx-auto mb-2"></i>
                <p class="font-medium text-sm">${message}</p>
                <button onclick="dashboard.fetchAllPairsData()" class="mt-2 px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors">
                    Retry
                </button>
            </div>
        `;
        lucide.createIcons();
    }

    updatePairsCount(count) {
        const pairsCountElement = document.getElementById('pairs-count');
        if (pairsCountElement) {
            pairsCountElement.textContent = `${count} pairs`;
        }
    }

    async selectPair(symbol) {
        console.log(`📊 Selecting pair: ${symbol}`);
        
        if (symbol === this.currentSymbol) {
            console.log('📊 Pair already selected');
            return;
        }
        
        this.currentSymbol = symbol;
        
        // Update UI immediately
        this.updateCurrentSymbolDisplay(symbol);
        this.highlightSelectedPair();
        this.showSelectedPairInfo(symbol);
        
        // Clear chart data for new pair
        this.clearChartData();
        
        // Fetch new data immediately
        await Promise.all([
            this.fetchTickData(symbol),
            this.fetchMarketData(symbol),
            this.calculateSuperTrend(symbol)
        ]);
        
        console.log(`✅ Pair selection complete: ${symbol}`);
    }

    highlightSelectedPair() {
        // Remove previous selection
        document.querySelectorAll('.pair-item').forEach(item => {
            item.classList.remove('selected', 'bg-primary-500/15', 'border-primary-500/30');
        });
        
        // Highlight current selection
        const selectedItem = document.querySelector(`[data-symbol="${this.currentSymbol}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected', 'bg-primary-500/15', 'border-primary-500/30');
        }
    }

    showSelectedPairInfo(symbol) {
        const pair = this.allPairs.find(p => p.symbol === symbol);
        if (!pair) return;
        
        const infoPanel = document.getElementById('selected-pair-info');
        if (!infoPanel) return;
        
        // Update pair details
        document.getElementById('pair-digits').textContent = pair.digits;
        document.getElementById('pair-min-lot').textContent = pair.min_lot;
        document.getElementById('pair-spread').textContent = `${pair.spread.toFixed(1)} pips`;
        document.getElementById('pair-category').textContent = pair.category.charAt(0).toUpperCase() + pair.category.slice(1);
        
        // Show the panel
        infoPanel.classList.remove('hidden');
    }

    updateCurrentSymbolDisplay(symbol) {
        const elements = [
            'current-symbol',
            'footer-pair'
        ];
        
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = symbol;
            }
        });
    }

    clearChartData() {
        if (this.chart) {
            this.chart.data.labels = [];
            this.chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            this.chart.update('none');
        }
    }

    async fetchTickData(symbol = null) {
        if (!this.isRunning) return;
        
        const targetSymbol = symbol || this.currentSymbol;
        const now = Date.now();
        
        // Check cache for this specific symbol
        const cacheKey = `tick_${targetSymbol}`;
        if (now - (this.lastUpdates[cacheKey] || 0) < this.updateIntervals.tick) {
            return this.cache.tickData.get(targetSymbol);
        }
        
        try {
            const response = await fetch(`/api/tick?symbol=${targetSymbol}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const tickData = await response.json();
            
            if (tickData && !tickData.error) {
                // Cache the data
                this.cache.tickData.set(targetSymbol, tickData);
                this.lastUpdates[cacheKey] = now;
                
                // Update UI only if this is the current symbol
                if (targetSymbol === this.currentSymbol) {
                    this.updateTickDisplay(tickData);
                }
                
                return tickData;
            }
        } catch (error) {
            console.debug(`⚠️ Error fetching tick data for ${targetSymbol}:`, error);
        }
        
        return null;
    }

    updateTickDisplay(tickData) {
        if (!tickData) return;
        
        // Update price displays
        const currentPrice = tickData.last || tickData.bid || 0;
        const bid = tickData.bid || 0;
        const ask = tickData.ask || 0;
        const spread = ask - bid;
        
        // Format prices based on symbol
        const digits = this.getSymbolDigits(this.currentSymbol);
        const priceFormat = digits === 3 ? 2 : digits;
        
        this.updateElement('current-price', currentPrice.toFixed(priceFormat));
        this.updateElement('bid-price', bid.toFixed(priceFormat));
        this.updateElement('ask-price', ask.toFixed(priceFormat));
        this.updateElement('spread', `${(spread * Math.pow(10, digits - 1)).toFixed(1)} pips`);
        this.updateElement('volume', this.formatVolume(tickData.volume || 0));
        
        // Update last update time
        this.updateElement('last-update', new Date().toLocaleTimeString());
    }

    getSymbolDigits(symbol) {
        const pair = this.allPairs.find(p => p.symbol === symbol);
        return pair ? pair.digits : 5;
    }

    formatVolume(volume) {
        if (volume >= 1000000) {
            return `${(volume / 1000000).toFixed(1)}M`;
        } else if (volume >= 1000) {
            return `${(volume / 1000).toFixed(1)}K`;
        }
        return volume.toString();
    }

    async fetchMarketData(symbol = null) {
        if (!this.isRunning) return;
        
        const targetSymbol = symbol || this.currentSymbol;
        const now = Date.now();
        
        // Check cache
        const cacheKey = `market_${targetSymbol}`;
        if (now - (this.lastUpdates[cacheKey] || 0) < this.updateIntervals.market) {
            return this.cache.marketData.get(targetSymbol);
        }
        
        try {
            const response = await fetch(`/api/market-data?symbol=${targetSymbol}&timeframe=M15&count=100`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const marketData = await response.json();
            
            if (marketData && Array.isArray(marketData) && marketData.length > 0) {
                // Cache the data
                this.cache.marketData.set(targetSymbol, marketData);
                this.lastUpdates[cacheKey] = now;
                
                // Update chart only if this is the current symbol
                if (targetSymbol === this.currentSymbol) {
                    this.updateChart(marketData);
                }
                
                return marketData;
            }
        } catch (error) {
            console.debug(`⚠️ Error fetching market data for ${targetSymbol}:`, error);
        }
        
        return null;
    }

    async calculateSuperTrend(symbol = null) {
        if (!this.isRunning) return;
        
        const targetSymbol = symbol || this.currentSymbol;
        
        try {
            const response = await fetch('/api/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    symbol: targetSymbol,
                    timeframe: 'M15'
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success' && result.result) {
                // Update SuperTrend display only if this is the current symbol
                if (targetSymbol === this.currentSymbol) {
                    this.updateSuperTrendDisplay(result.result);
                }
                return result.result;
            } else {
                console.debug(`⚠️ SuperTrend calculation failed for ${targetSymbol}:`, result.message);
            }
        } catch (error) {
            console.debug(`⚠️ Error calculating SuperTrend for ${targetSymbol}:`, error);
        }
        
        return null;
    }

    updateSuperTrendDisplay(result) {
        if (!result) return;
        
        // Update trend indicator
        const trendIndicator = document.getElementById('trend-indicator');
        if (trendIndicator) {
            const isBullish = result.trend === 1;
            trendIndicator.className = `flex items-center px-3 py-1.5 rounded-full text-sm ${isBullish ? 'gradient-primary' : 'gradient-danger'}`;
            trendIndicator.innerHTML = `
                <i data-lucide="${isBullish ? 'trending-up' : 'trending-down'}" class="w-4 h-4 mr-1"></i>
                <span class="font-bold">${isBullish ? 'BULLISH' : 'BEARISH'}</span>
            `;
        }
        
        // Update metrics
        this.updateElement('trend-strength-value', `${result.trend_strength.toFixed(1)}%`);
        this.updateElement('atr-value', result.atr.toFixed(5));
        this.updateElement('rsi-value', result.rsi.toFixed(1));
        
        // Update progress bars
        this.updateProgressBar('trend-strength-bar', result.trend_strength);
        this.updateProgressBar('rsi-bar', result.rsi);
        
        // Update signal indicators
        this.updateSignalIndicator('buy-signal-indicator', result.buy_signal);
        this.updateSignalIndicator('sell-signal-indicator', result.sell_signal);
        this.updateSignalIndicator('strong-signal-indicator', result.strong_signal);
        
        // Recreate icons
        lucide.createIcons();
    }

    updateProgressBar(id, value) {
        const bar = document.getElementById(id);
        if (bar) {
            bar.style.width = `${Math.min(Math.max(value, 0), 100)}%`;
        }
    }

    updateSignalIndicator(id, isActive) {
        const indicator = document.getElementById(id);
        if (indicator) {
            if (isActive) {
                indicator.className = 'w-4 h-4 rounded-full bg-primary-500 signal-active';
            } else {
                indicator.className = 'w-4 h-4 rounded-full border-2 border-gray-600';
            }
        }
    }

    async fetchConnectionStatus() {
        const now = Date.now();
        if (now - this.lastUpdates.connection < this.updateIntervals.connection && this.cache.connection) {
            return this.cache.connection;
        }
        
        try {
            const response = await fetch('/api/connection');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const connectionData = await response.json();
            
            // Cache the data
            this.cache.connection = connectionData;
            this.lastUpdates.connection = now;
            
            this.updateConnectionDisplay(connectionData);
            return connectionData;
            
        } catch (error) {
            console.debug('⚠️ Error fetching connection status:', error);
            this.updateConnectionDisplay({ is_connected: false, connection_type: 'error' });
        }
        
        return null;
    }

    updateConnectionDisplay(connection) {
        const statusElement = document.getElementById('connection-status');
        const typeElement = document.getElementById('connection-type-badge');
        
        if (connection.is_connected) {
            if (statusElement) {
                statusElement.className = 'flex items-center px-3 py-1.5 rounded-full glass border border-green-500/30';
                statusElement.innerHTML = `
                    <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <i data-lucide="wifi" class="w-4 h-4 mr-2 text-green-400"></i>
                    <span class="text-green-400 font-medium text-sm">Connected to MT5</span>
                `;
            }
            
            if (typeElement) {
                typeElement.className = 'px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400';
                typeElement.textContent = connection.connection_type.toUpperCase();
            }
            
            // Update account info
            if (connection.account) {
                this.updateElement('mt5-account', connection.account.toString());
                this.updateElement('mt5-server', connection.server || 'Unknown');
                this.updateElement('mt5-connection-status', 'Connected');
                
                if (connection.balance !== undefined) {
                    this.updateElement('account-balance', `$${connection.balance.toFixed(2)}`);
                }
                if (connection.equity !== undefined) {
                    this.updateElement('account-equity', `$${connection.equity.toFixed(2)}`);
                }
                if (connection.free_margin !== undefined) {
                    this.updateElement('account-free-margin', `$${connection.free_margin.toFixed(2)}`);
                }
                if (connection.margin_level !== undefined) {
                    this.updateElement('margin-level-percent', `${connection.margin_level.toFixed(1)}%`);
                    this.updateProgressBar('margin-level-bar', Math.min(connection.margin_level, 100));
                }
            }
            
            this.updateElement('mode-indicator', 'MT5 Live');
            
        } else {
            if (statusElement) {
                statusElement.className = 'flex items-center px-3 py-1.5 rounded-full glass border border-red-500/30 connection-pulse';
                statusElement.innerHTML = `
                    <div class="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                    <i data-lucide="wifi-off" class="w-4 h-4 mr-2 text-red-400"></i>
                    <span class="text-red-400 font-medium text-sm">MT5 Disconnected</span>
                `;
            }
            
            if (typeElement) {
                typeElement.className = 'px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400';
                typeElement.textContent = 'DISCONNECTED';
            }
            
            this.updateElement('mode-indicator', 'Disconnected');
        }
        
        // Update last update time
        this.updateElement('mt5-last-update', new Date().toLocaleTimeString());
        
        // Recreate icons
        lucide.createIcons();
    }

    async fetchAccountData() {
        try {
            const response = await fetch('/api/account-summary');
            if (!response.ok) return;
            
            const accountData = await response.json();
            
            if (accountData.account) {
                this.updateElement('open-positions', accountData.trading?.open_positions || 0);
                this.updateElement('pending-orders', accountData.trading?.pending_orders || 0);
                
                const dailyPnl = accountData.trading?.daily_pnl || 0;
                const pnlElement = document.getElementById('daily-pnl');
                if (pnlElement) {
                    pnlElement.textContent = `${dailyPnl >= 0 ? '+' : ''}$${dailyPnl.toFixed(2)}`;
                    pnlElement.className = `text-2xl font-bold ${dailyPnl >= 0 ? 'text-primary-500' : 'text-red-500'}`;
                }
            }
        } catch (error) {
            console.debug('⚠️ Error fetching account data:', error);
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    initializeChart() {
        const ctx = document.getElementById('price-chart');
        if (!ctx) return;
        
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
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#9ca3af'
                        }
                    },
                    y: {
                        display: true,
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

    updateChart(marketData) {
        if (!this.chart || !marketData || marketData.length === 0) return;
        
        const labels = marketData.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        
        const prices = marketData.map(item => item.close);
        
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = prices;
        this.chart.update('none');
    }

    initWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.isConnected = true;
                
                // Subscribe to events
                this.ws.send(JSON.stringify({
                    type: 'subscribe',
                    events: ['tick', 'connection', 'account_info', 'positions', 'orders', 'supertrend_update']
                }));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('❌ WebSocket disconnected');
                this.isConnected = false;
                
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.initWebSocket();
                    }
                }, 5000);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('Error initializing WebSocket:', error);
        }
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'tick':
                if (message.data.symbol === this.currentSymbol) {
                    this.updateTickDisplay(message.data);
                }
                break;
                
            case 'connection':
                this.updateConnectionDisplay(message.data);
                break;
                
            case 'account_info':
                // Handle account info updates
                break;
                
            case 'supertrend_update':
                if (message.data.symbol === this.currentSymbol) {
                    this.updateSuperTrendDisplay(message.data);
                }
                break;
                
            default:
                console.debug('Unknown WebSocket message type:', message.type);
        }
    }

    // Control methods
    togglePlayPause() {
        this.isRunning = !this.isRunning;
        const btn = document.getElementById('play-pause-btn');
        if (btn) {
            if (this.isRunning) {
                btn.innerHTML = '<i data-lucide="pause" class="w-4 h-4 mr-1"></i><span>Pause</span>';
            } else {
                btn.innerHTML = '<i data-lucide="play" class="w-4 h-4 mr-1"></i><span>Resume</span>';
            }
            lucide.createIcons();
        }
        
        this.updateElement('status-indicator', this.isRunning ? 'Live' : 'Paused');
    }

    resetDashboard() {
        console.log('🔄 Resetting dashboard...');
        
        // Clear cache
        this.cache = {
            pairs: null,
            connection: null,
            marketData: new Map(),
            tickData: new Map()
        };
        
        // Reset last updates
        this.lastUpdates = {
            tick: 0,
            connection: 0,
            pairs: 0,
            market: 0
        };
        
        // Clear chart
        this.clearChartData();
        
        // Restart data fetching
        this.startDataFetching();
        
        console.log('✅ Dashboard reset complete');
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

    async applySettings() {
        const atrPeriod = document.getElementById('atr-period').value;
        const multiplier = document.getElementById('multiplier').value;
        const rsiPeriod = document.getElementById('rsi-period').value;
        const useRsiFilter = document.getElementById('use-rsi-filter').checked;
        
        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    periods: parseInt(atrPeriod),
                    multiplier: parseFloat(multiplier),
                    rsi_length: parseInt(rsiPeriod),
                    use_rsi_filter: useRsiFilter
                })
            });
            
            if (response.ok) {
                console.log('✅ Settings applied successfully');
                this.hideSettings();
                
                // Recalculate SuperTrend with new settings
                await this.calculateSuperTrend();
            }
        } catch (error) {
            console.error('❌ Error applying settings:', error);
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
        const resultsDiv = document.getElementById('test-results');
        if (!resultsDiv) return;
        
        resultsDiv.innerHTML = `
            <div class="text-center py-6">
                <div class="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p class="text-gray-400 text-sm">Testing MT5 connection...</p>
            </div>
        `;
        
        try {
            const response = await fetch('/api/test-connection', { method: 'POST' });
            const result = await response.json();
            
            let html = '<div class="space-y-3">';
            
            for (const [test, data] of Object.entries(result.results)) {
                const icon = data.success ? 'check-circle' : 'x-circle';
                const color = data.success ? 'text-green-400' : 'text-red-400';
                
                html += `
                    <div class="flex items-start space-x-3">
                        <i data-lucide="${icon}" class="w-5 h-5 ${color} mt-0.5"></i>
                        <div>
                            <div class="font-medium text-white">${test.replace(/_/g, ' ').toUpperCase()}</div>
                            <div class="text-sm text-gray-400">${data.message}</div>
                        </div>
                    </div>
                `;
            }
            
            html += '</div>';
            resultsDiv.innerHTML = html;
            
        } catch (error) {
            resultsDiv.innerHTML = `
                <div class="text-center text-red-400 py-6">
                    <i data-lucide="alert-circle" class="w-8 h-8 mx-auto mb-2"></i>
                    <p class="font-medium">Connection test failed</p>
                    <p class="text-sm">${error.message}</p>
                </div>
            `;
        }
        
        lucide.createIcons();
    }

    async refreshConnection() {
        console.log('🔄 Refreshing MT5 connection...');
        
        try {
            const response = await fetch('/api/reconnect', { method: 'POST' });
            const result = await response.json();
            
            console.log('✅ Connection refresh result:', result);
            
            // Refresh all data
            await this.startDataFetching();
            
        } catch (error) {
            console.error('❌ Error refreshing connection:', error);
        }
    }

    clearAlerts() {
        const alertsContent = document.getElementById('alerts-content');
        if (alertsContent) {
            alertsContent.innerHTML = `
                <div class="text-center text-gray-400 py-6">
                    <i data-lucide="bell" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                    <p class="font-medium text-sm">No signals yet</p>
                    <p class="text-xs">Trading signals will appear here</p>
                </div>
            `;
            lucide.createIcons();
        }
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new SuperTrendDashboard();
});

// Make dashboard globally accessible for onclick handlers
window.dashboard = dashboard;