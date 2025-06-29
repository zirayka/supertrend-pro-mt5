/**
 * SuperTrend Pro MT5 Dashboard - Enhanced JavaScript
 * Implements exact SuperTrend logic from Pine Script and fixes price display
 */

class SuperTrendDashboard {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.currentSymbol = 'EURUSD';
        this.currentTimeframe = 'M15';
        this.isRunning = true;
        this.chart = null;
        this.marketData = [];
        this.supertrendData = [];
        
        // SuperTrend Configuration (matching Pine Script)
        this.config = {
            periods: 20,           // ATR Period
            multiplier: 2.0,       // Multiplier
            changeATR: true,       // Change ATR calculation method
            showSignals: true,     // Show strong move signals
            highlighting: true,    // Background highlighting
            
            // RSI Filter Settings
            rsiLength: 14,
            rsiBuyThreshold: 50,
            rsiSellThreshold: 50,
            useRsiFilter: true,
            
            // Additional Filters
            useVolatilityFilter: true,
            atrMaLength: 20,
            useHtfFilter: false,
            cooldownBars: 5,
            strongTrendThreshold: 50
        };
        
        // Signal tracking
        this.lastSignalBar = null;
        this.signals = [];
        
        // Demo data for when MT5 is not connected
        this.demoPrice = 1.08500;
        this.demoDirection = 1;
        this.demoInterval = null;
        
        this.init();
    }
    
    init() {
        console.log('🚀 Initializing SuperTrend Pro MT5 Dashboard');
        this.setupEventListeners();
        this.initializeChart();
        this.connectToMT5();
        this.startDemoMode(); // Start with demo data while connecting
        this.loadTradingPairs();
        this.updateConnectionStatus();
    }
    
    setupEventListeners() {
        // Control buttons
        document.getElementById('play-pause-btn')?.addEventListener('click', () => this.togglePlayPause());
        document.getElementById('reset-btn')?.addEventListener('click', () => this.reset());
        document.getElementById('settings-btn')?.addEventListener('click', () => this.toggleSettings());
        document.getElementById('close-settings')?.addEventListener('click', () => this.toggleSettings());
        document.getElementById('connection-test-btn')?.addEventListener('click', () => this.showConnectionTest());
        document.getElementById('close-test-modal')?.addEventListener('click', () => this.hideConnectionTest());
        document.getElementById('run-test')?.addEventListener('click', () => this.runConnectionTest());
        document.getElementById('refresh-connection')?.addEventListener('click', () => this.refreshConnection());
        
        // Settings controls
        document.getElementById('atr-period')?.addEventListener('input', (e) => this.updateConfig('periods', parseInt(e.target.value)));
        document.getElementById('multiplier')?.addEventListener('input', (e) => this.updateConfig('multiplier', parseFloat(e.target.value)));
        document.getElementById('rsi-period')?.addEventListener('input', (e) => this.updateConfig('rsiLength', parseInt(e.target.value)));
        document.getElementById('use-rsi-filter')?.addEventListener('change', (e) => this.updateConfig('useRsiFilter', e.target.checked));
        document.getElementById('apply-settings')?.addEventListener('click', () => this.applySettings());
        
        // Pair search and filters
        document.getElementById('pair-search')?.addEventListener('input', (e) => this.filterPairs(e.target.value));
        document.querySelectorAll('.category-filter').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterByCategory(e.target.dataset.category));
        });
        
        // Clear alerts
        document.getElementById('clear-alerts')?.addEventListener('click', () => this.clearAlerts());
    }
    
    connectToMT5() {
        console.log('🔌 Attempting to connect to MT5...');
        
        try {
            // Try WebSocket connection first
            this.ws = new WebSocket('ws://localhost:8000/ws');
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected to MT5');
                this.isConnected = true;
                this.stopDemoMode();
                this.updateConnectionStatus('MT5 Live', 'connected');
                
                // Subscribe to real-time data
                this.ws.send(JSON.stringify({
                    type: 'subscribe',
                    events: ['tick', 'account_info', 'positions', 'orders', 'symbols']
                }));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMT5Data(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket connection closed');
                this.isConnected = false;
                this.updateConnectionStatus('Demo Mode', 'disconnected');
                this.startDemoMode();
                
                // Try to reconnect after 5 seconds
                setTimeout(() => this.connectToMT5(), 5000);
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus('Connection Error', 'error');
                this.startDemoMode();
            };
            
        } catch (error) {
            console.error('❌ Failed to create WebSocket connection:', error);
            this.startDemoMode();
        }
        
        // Also try to fetch data via HTTP API
        this.fetchMT5Data();
    }
    
    async fetchMT5Data() {
        try {
            // Try to get connection status
            const response = await fetch('/api/connection');
            if (response.ok) {
                const connectionData = await response.json();
                this.handleConnectionData(connectionData);
            }
            
            // Try to get current tick data
            const tickResponse = await fetch(`/api/tick?symbol=${this.currentSymbol}`);
            if (tickResponse.ok) {
                const tickData = await tickResponse.json();
                if (tickData && !tickData.error) {
                    this.handleTickData(tickData);
                }
            }
            
            // Try to get market data
            const marketResponse = await fetch(`/api/market-data?symbol=${this.currentSymbol}&timeframe=${this.currentTimeframe}&count=100`);
            if (marketResponse.ok) {
                const marketData = await marketResponse.json();
                if (marketData && marketData.length > 0) {
                    this.handleMarketData(marketData);
                }
            }
            
        } catch (error) {
            console.log('📡 HTTP API not available, using demo mode');
        }
    }
    
    handleMT5Data(data) {
        switch (data.type) {
            case 'tick':
                this.handleTickData(data.data);
                break;
            case 'account_info':
                this.handleAccountInfo(data.data);
                break;
            case 'positions':
                this.handlePositions(data.data);
                break;
            case 'orders':
                this.handleOrders(data.data);
                break;
            case 'symbols':
                this.handleSymbols(data.data);
                break;
            case 'connection_status':
                this.handleConnectionData(data.data);
                break;
        }
    }
    
    handleTickData(tickData) {
        if (!tickData || typeof tickData.bid === 'undefined') return;
        
        console.log('📊 Received tick data:', tickData);
        
        // Update current price display
        const currentPrice = (tickData.bid + tickData.ask) / 2;
        this.updatePriceDisplay(currentPrice, tickData.bid, tickData.ask);
        
        // Add to market data for SuperTrend calculation
        const now = new Date();
        const candle = {
            timestamp: now,
            open: currentPrice,
            high: currentPrice,
            low: currentPrice,
            close: currentPrice,
            volume: tickData.volume || 100
        };
        
        // Update or add current candle
        if (this.marketData.length > 0) {
            const lastCandle = this.marketData[this.marketData.length - 1];
            const timeDiff = now - new Date(lastCandle.timestamp);
            
            // If less than 1 minute, update current candle
            if (timeDiff < 60000) {
                lastCandle.high = Math.max(lastCandle.high, currentPrice);
                lastCandle.low = Math.min(lastCandle.low, currentPrice);
                lastCandle.close = currentPrice;
                lastCandle.volume += (tickData.volume || 1);
            } else {
                // Add new candle
                this.marketData.push(candle);
                if (this.marketData.length > 1000) {
                    this.marketData = this.marketData.slice(-500);
                }
            }
        } else {
            this.marketData.push(candle);
        }
        
        // Calculate SuperTrend
        this.calculateSuperTrend();
        this.updateChart();
        this.updateLastUpdate();
    }
    
    handleMarketData(marketData) {
        console.log('📈 Received market data:', marketData.length, 'candles');
        
        this.marketData = marketData.map(candle => ({
            timestamp: new Date(candle.timestamp),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
        }));
        
        if (this.marketData.length > 0) {
            const lastCandle = this.marketData[this.marketData.length - 1];
            this.updatePriceDisplay(lastCandle.close, lastCandle.close - 0.00015, lastCandle.close + 0.00015);
        }
        
        this.calculateSuperTrend();
        this.updateChart();
    }
    
    handleConnectionData(connectionData) {
        console.log('🔗 Connection data:', connectionData);
        
        if (connectionData.is_connected) {
            this.updateConnectionStatus('MT5 Live', 'connected');
            this.updateAccountInfo(connectionData);
        } else {
            this.updateConnectionStatus('Demo Mode', 'disconnected');
        }
    }
    
    handleAccountInfo(accountData) {
        console.log('💰 Account info:', accountData);
        this.updateAccountInfo(accountData);
    }
    
    handlePositions(positions) {
        console.log('📊 Positions:', positions);
        this.updateTradingStats(positions, null);
    }
    
    handleOrders(orders) {
        console.log('📋 Orders:', orders);
        this.updateTradingStats(null, orders);
    }
    
    handleSymbols(symbols) {
        console.log('📈 Symbols:', symbols);
        this.updateTradingPairs(symbols);
    }
    
    startDemoMode() {
        if (this.demoInterval) return;
        
        console.log('🎮 Starting demo mode with realistic price simulation');
        this.updateConnectionStatus('Demo Mode', 'demo');
        
        // Initialize demo data
        this.generateDemoMarketData();
        
        this.demoInterval = setInterval(() => {
            this.updateDemoPrice();
        }, 2000); // Update every 2 seconds
    }
    
    stopDemoMode() {
        if (this.demoInterval) {
            clearInterval(this.demoInterval);
            this.demoInterval = null;
            console.log('🛑 Demo mode stopped');
        }
    }
    
    generateDemoMarketData() {
        const now = new Date();
        this.marketData = [];
        
        // Generate 100 candles of demo data
        for (let i = 99; i >= 0; i--) {
            const timestamp = new Date(now.getTime() - (i * 15 * 60 * 1000)); // 15-minute candles
            const basePrice = 1.08500;
            const volatility = 0.001;
            
            // Generate realistic OHLC data
            const open = basePrice + (Math.random() - 0.5) * volatility;
            const close = open + (Math.random() - 0.5) * volatility * 0.5;
            const high = Math.max(open, close) + Math.random() * volatility * 0.3;
            const low = Math.min(open, close) - Math.random() * volatility * 0.3;
            
            this.marketData.push({
                timestamp,
                open,
                high,
                low,
                close,
                volume: Math.floor(Math.random() * 1000) + 500
            });
        }
        
        this.calculateSuperTrend();
        this.updateChart();
    }
    
    updateDemoPrice() {
        if (!this.isRunning) return;
        
        // Simulate realistic price movement
        const volatility = 0.0001;
        const trend = Math.sin(Date.now() / 100000) * 0.0005; // Slow trend
        const noise = (Math.random() - 0.5) * volatility;
        
        this.demoPrice += trend + noise;
        
        // Keep price in reasonable range
        this.demoPrice = Math.max(1.07000, Math.min(1.10000, this.demoPrice));
        
        const bid = this.demoPrice - 0.00015;
        const ask = this.demoPrice + 0.00015;
        
        this.updatePriceDisplay(this.demoPrice, bid, ask);
        
        // Add new candle data
        const now = new Date();
        const lastCandle = this.marketData[this.marketData.length - 1];
        
        if (lastCandle) {
            const timeDiff = now - new Date(lastCandle.timestamp);
            
            if (timeDiff > 15 * 60 * 1000) { // 15 minutes
                // Add new candle
                this.marketData.push({
                    timestamp: now,
                    open: lastCandle.close,
                    high: Math.max(lastCandle.close, this.demoPrice),
                    low: Math.min(lastCandle.close, this.demoPrice),
                    close: this.demoPrice,
                    volume: Math.floor(Math.random() * 1000) + 500
                });
                
                // Keep only last 100 candles
                if (this.marketData.length > 100) {
                    this.marketData = this.marketData.slice(-100);
                }
            } else {
                // Update current candle
                lastCandle.high = Math.max(lastCandle.high, this.demoPrice);
                lastCandle.low = Math.min(lastCandle.low, this.demoPrice);
                lastCandle.close = this.demoPrice;
            }
        }
        
        this.calculateSuperTrend();
        this.updateChart();
        this.updateLastUpdate();
    }
    
    // SuperTrend Calculation (Exact Pine Script Implementation)
    calculateSuperTrend() {
        if (this.marketData.length < this.config.periods + 1) {
            console.log('⚠️ Not enough data for SuperTrend calculation');
            return;
        }
        
        const data = this.marketData;
        const periods = this.config.periods;
        const multiplier = this.config.multiplier;
        
        // Calculate ATR
        const atrValues = this.calculateATR(data, periods);
        
        // Calculate RSI
        const rsiValues = this.calculateRSI(data, this.config.rsiLength);
        
        // Calculate SuperTrend levels
        const supertrendResult = this.calculateSupertrendLevels(data, atrValues, multiplier);
        
        if (!supertrendResult) return;
        
        const { up, down, trend } = supertrendResult;
        const currentIndex = data.length - 1;
        
        // Get current values
        const currentATR = atrValues[currentIndex];
        const currentRSI = rsiValues[currentIndex];
        const currentPrice = data[currentIndex].close;
        
        // Calculate trend strength
        const trendLevel = trend === 1 ? up[currentIndex] : down[currentIndex];
        const trendStrength = Math.min(Math.abs(currentPrice - trendLevel) / currentATR * 100, 100);
        
        // Generate signals with filters
        const signals = this.generateSignals(data, trend, up, down, rsiValues, atrValues);
        
        // Update UI
        this.updateSupertrendDisplay({
            trend: trend[currentIndex],
            trendStrength,
            atr: currentATR,
            rsi: currentRSI,
            up: up[currentIndex],
            down: down[currentIndex],
            signals
        });
        
        // Store for chart
        this.supertrendData = {
            up,
            down,
            trend,
            atr: atrValues,
            rsi: rsiValues
        };
    }
    
    calculateATR(data, period) {
        const atr = new Array(data.length).fill(0);
        
        for (let i = 1; i < data.length; i++) {
            const high = data[i].high;
            const low = data[i].low;
            const prevClose = data[i - 1].close;
            
            const tr1 = high - low;
            const tr2 = Math.abs(high - prevClose);
            const tr3 = Math.abs(low - prevClose);
            
            const trueRange = Math.max(tr1, tr2, tr3);
            
            if (i < period) {
                // Simple average for initial values
                let sum = 0;
                for (let j = 1; j <= i; j++) {
                    const h = data[j].high;
                    const l = data[j].low;
                    const pc = data[j - 1].close;
                    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
                    sum += tr;
                }
                atr[i] = sum / i;
            } else {
                // Exponential moving average
                atr[i] = (atr[i - 1] * (period - 1) + trueRange) / period;
            }
        }
        
        return atr;
    }
    
    calculateRSI(data, period) {
        const rsi = new Array(data.length).fill(50);
        
        if (data.length < period + 1) return rsi;
        
        let gains = 0;
        let losses = 0;
        
        // Calculate initial average gain and loss
        for (let i = 1; i <= period; i++) {
            const change = data[i].close - data[i - 1].close;
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        for (let i = period; i < data.length; i++) {
            const change = data[i].close - data[i - 1].close;
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? Math.abs(change) : 0;
            
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
            
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi[i] = 100 - (100 / (1 + rs));
        }
        
        return rsi;
    }
    
    calculateSupertrendLevels(data, atr, multiplier) {
        const length = data.length;
        const up = new Array(length).fill(0);
        const down = new Array(length).fill(0);
        const trend = new Array(length).fill(1);
        
        for (let i = 0; i < length; i++) {
            const hl2 = (data[i].high + data[i].low) / 2;
            const atrValue = atr[i] || 0;
            
            // Basic upper and lower bands
            const basicUp = hl2 - (multiplier * atrValue);
            const basicDown = hl2 + (multiplier * atrValue);
            
            if (i === 0) {
                up[i] = basicUp;
                down[i] = basicDown;
                trend[i] = 1;
            } else {
                // Final upper band
                if (basicUp > up[i - 1] || data[i - 1].close <= up[i - 1]) {
                    up[i] = basicUp;
                } else {
                    up[i] = up[i - 1];
                }
                
                // Final lower band
                if (basicDown < down[i - 1] || data[i - 1].close >= down[i - 1]) {
                    down[i] = basicDown;
                } else {
                    down[i] = down[i - 1];
                }
                
                // Trend determination
                if (trend[i - 1] === -1 && data[i].close > down[i]) {
                    trend[i] = 1;
                } else if (trend[i - 1] === 1 && data[i].close < up[i]) {
                    trend[i] = -1;
                } else {
                    trend[i] = trend[i - 1];
                }
            }
        }
        
        return { up, down, trend };
    }
    
    generateSignals(data, trend, up, down, rsi, atr) {
        const currentIndex = data.length - 1;
        const prevIndex = currentIndex - 1;
        
        if (prevIndex < 0) return { buy: false, sell: false, strong: false };
        
        // Check for trend change
        const buySignal = trend[currentIndex] === 1 && trend[prevIndex] === -1;
        const sellSignal = trend[currentIndex] === -1 && trend[prevIndex] === 1;
        
        // Apply filters
        const currentRSI = rsi[currentIndex];
        const currentATR = atr[currentIndex];
        const atrMA = this.calculateATRMA(atr, currentIndex);
        
        let buyOk = buySignal;
        let sellOk = sellSignal;
        
        // RSI Filter
        if (this.config.useRsiFilter) {
            if (buySignal && currentRSI <= this.config.rsiBuyThreshold) {
                buyOk = false;
            }
            if (sellSignal && currentRSI >= this.config.rsiSellThreshold) {
                sellOk = false;
            }
        }
        
        // Volatility Filter
        if (this.config.useVolatilityFilter) {
            if (currentATR <= atrMA) {
                buyOk = false;
                sellOk = false;
            }
        }
        
        // Cooldown Filter
        if (this.lastSignalBar !== null && (currentIndex - this.lastSignalBar) <= this.config.cooldownBars) {
            buyOk = false;
            sellOk = false;
        }
        
        // Update last signal bar
        if (buyOk || sellOk) {
            this.lastSignalBar = currentIndex;
        }
        
        // Calculate trend strength for strong signal
        const currentPrice = data[currentIndex].close;
        const trendLevel = trend[currentIndex] === 1 ? up[currentIndex] : down[currentIndex];
        const trendStrength = Math.abs(currentPrice - trendLevel) / currentATR * 100;
        const strongSignal = trendStrength > this.config.strongTrendThreshold;
        
        // Add signals to alerts
        if (buyOk) {
            this.addAlert('BUY', `Strong ${strongSignal ? 'STRONG ' : ''}BUY signal for ${this.currentSymbol}`, 'buy');
        }
        if (sellOk) {
            this.addAlert('SELL', `Strong ${strongSignal ? 'STRONG ' : ''}SELL signal for ${this.currentSymbol}`, 'sell');
        }
        
        return {
            buy: buyOk,
            sell: sellOk,
            strong: strongSignal && (buyOk || sellOk)
        };
    }
    
    calculateATRMA(atr, currentIndex) {
        const length = this.config.atrMaLength;
        const startIndex = Math.max(0, currentIndex - length + 1);
        let sum = 0;
        let count = 0;
        
        for (let i = startIndex; i <= currentIndex; i++) {
            sum += atr[i];
            count++;
        }
        
        return count > 0 ? sum / count : atr[currentIndex];
    }
    
    updatePriceDisplay(price, bid, ask) {
        // Update main price
        const priceElement = document.getElementById('current-price');
        if (priceElement) {
            priceElement.textContent = price.toFixed(5);
        }
        
        // Update bid/ask
        const bidElement = document.getElementById('bid-price');
        const askElement = document.getElementById('ask-price');
        if (bidElement) bidElement.textContent = bid.toFixed(5);
        if (askElement) askElement.textContent = ask.toFixed(5);
        
        // Calculate and update spread
        const spread = (ask - bid) * 10000; // Convert to pips
        const spreadElement = document.getElementById('spread');
        if (spreadElement) {
            spreadElement.textContent = `${spread.toFixed(1)} pips`;
        }
        
        // Update price change (simplified for demo)
        const changeElement = document.getElementById('price-change');
        if (changeElement) {
            const change = (Math.random() - 0.5) * 0.002;
            const changePercent = (change / price * 100);
            const isPositive = change >= 0;
            
            changeElement.innerHTML = `
                <i data-lucide="${isPositive ? 'trending-up' : 'trending-down'}" class="w-4 h-4 mr-1"></i>
                <span class="font-medium">${isPositive ? '+' : ''}${change.toFixed(5)} (${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)</span>
            `;
            changeElement.className = `flex items-center justify-end text-sm ${isPositive ? 'text-primary-500' : 'text-danger-500'}`;
        }
        
        // Update volume (demo)
        const volumeElement = document.getElementById('volume');
        if (volumeElement) {
            const volume = (Math.random() * 2 + 0.5).toFixed(1);
            volumeElement.textContent = `${volume}M`;
        }
    }
    
    updateSupertrendDisplay(data) {
        // Update trend indicator
        const trendIndicator = document.getElementById('trend-indicator');
        if (trendIndicator) {
            const isbullish = data.trend === 1;
            trendIndicator.className = `flex items-center px-3 py-1.5 rounded-full text-sm ${isbullish ? 'gradient-primary' : 'gradient-danger'}`;
            trendIndicator.innerHTML = `
                <i data-lucide="${isbullish ? 'trending-up' : 'trending-down'}" class="w-4 h-4 mr-1"></i>
                <span class="font-bold">${isbullish ? 'BULLISH' : 'BEARISH'}</span>
            `;
        }
        
        // Update trend strength
        const strengthValue = document.getElementById('trend-strength-value');
        const strengthBar = document.getElementById('trend-strength-bar');
        if (strengthValue && strengthBar) {
            strengthValue.textContent = `${data.trendStrength.toFixed(1)}%`;
            strengthBar.style.width = `${Math.min(data.trendStrength, 100)}%`;
        }
        
        // Update ATR
        const atrValue = document.getElementById('atr-value');
        if (atrValue) {
            atrValue.textContent = data.atr.toFixed(5);
        }
        
        // Update RSI
        const rsiValue = document.getElementById('rsi-value');
        const rsiBar = document.getElementById('rsi-bar');
        if (rsiValue && rsiBar) {
            rsiValue.textContent = data.rsi.toFixed(1);
            rsiBar.style.width = `${data.rsi}%`;
        }
        
        // Update signal indicators
        this.updateSignalIndicators(data.signals);
        
        // Update config displays
        document.getElementById('atr-period-display').textContent = this.config.periods;
        document.getElementById('multiplier-display').textContent = this.config.multiplier.toFixed(1);
    }
    
    updateSignalIndicators(signals) {
        // Buy signal
        const buyIndicator = document.getElementById('buy-signal-indicator');
        const buyStrength = document.getElementById('buy-signal-strength');
        if (buyIndicator && buyStrength) {
            if (signals.buy) {
                buyIndicator.className = 'w-4 h-4 rounded-full bg-primary-500 signal-active';
                buyStrength.textContent = signals.strong ? 'Strong' : 'Active';
                buyStrength.className = 'text-sm text-primary-500 font-medium';
            } else {
                buyIndicator.className = 'w-4 h-4 rounded-full border-2 border-gray-600';
                buyStrength.textContent = '--';
                buyStrength.className = 'text-sm text-gray-400';
            }
        }
        
        // Sell signal
        const sellIndicator = document.getElementById('sell-signal-indicator');
        const sellStrength = document.getElementById('sell-signal-strength');
        if (sellIndicator && sellStrength) {
            if (signals.sell) {
                sellIndicator.className = 'w-4 h-4 rounded-full bg-danger-500 signal-active';
                sellStrength.textContent = signals.strong ? 'Strong' : 'Active';
                sellStrength.className = 'text-sm text-danger-500 font-medium';
            } else {
                sellIndicator.className = 'w-4 h-4 rounded-full border-2 border-gray-600';
                sellStrength.textContent = '--';
                sellStrength.className = 'text-sm text-gray-400';
            }
        }
        
        // Strong signal
        const strongIndicator = document.getElementById('strong-signal-indicator');
        const strongConfidence = document.getElementById('strong-signal-confidence');
        if (strongIndicator && strongConfidence) {
            if (signals.strong) {
                strongIndicator.className = 'w-4 h-4 rounded-full bg-yellow-500 signal-active';
                strongConfidence.textContent = 'High';
                strongConfidence.className = 'text-sm text-yellow-500 font-medium';
            } else {
                strongIndicator.className = 'w-4 h-4 rounded-full border-2 border-gray-600';
                strongConfidence.textContent = '--';
                strongConfidence.className = 'text-sm text-gray-400';
            }
        }
    }
    
    addAlert(type, message, category) {
        const alert = {
            id: Date.now(),
            type,
            message,
            category,
            timestamp: new Date()
        };
        
        this.signals.unshift(alert);
        if (this.signals.length > 50) {
            this.signals = this.signals.slice(0, 50);
        }
        
        this.updateAlertsDisplay();
    }
    
    updateAlertsDisplay() {
        const alertsContent = document.getElementById('alerts-content');
        if (!alertsContent) return;
        
        if (this.signals.length === 0) {
            alertsContent.innerHTML = `
                <div class="text-center text-gray-400 py-6">
                    <i data-lucide="bell" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                    <p class="font-medium text-sm">No signals yet</p>
                    <p class="text-xs">Trading signals will appear here</p>
                </div>
            `;
            return;
        }
        
        const alertsHTML = this.signals.map(signal => {
            const timeStr = signal.timestamp.toLocaleTimeString();
            const categoryClass = signal.category === 'buy' ? 'border-l-primary-500 bg-primary-500/10' : 
                                 signal.category === 'sell' ? 'border-l-danger-500 bg-danger-500/10' : 
                                 'border-l-yellow-500 bg-yellow-500/10';
            
            return `
                <div class="p-3 rounded-lg glass border-l-4 ${categoryClass}">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-medium text-white text-sm">${signal.type}</span>
                        <span class="text-xs text-gray-400">${timeStr}</span>
                    </div>
                    <p class="text-sm text-gray-300">${signal.message}</p>
                </div>
            `;
        }).join('');
        
        alertsContent.innerHTML = alertsHTML;
    }
    
    clearAlerts() {
        this.signals = [];
        this.updateAlertsDisplay();
    }
    
    initializeChart() {
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
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: 'SuperTrend Up',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: 'SuperTrend Down',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#ffffff',
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'minute',
                            displayFormats: {
                                minute: 'HH:mm'
                            }
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
                            color: '#9ca3af',
                            callback: function(value) {
                                return value.toFixed(5);
                            }
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
    
    updateChart() {
        if (!this.chart || this.marketData.length === 0) return;
        
        const labels = this.marketData.map(candle => candle.timestamp);
        const prices = this.marketData.map(candle => candle.close);
        
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = prices;
        
        // Update SuperTrend lines if available
        if (this.supertrendData && this.supertrendData.up) {
            const upData = this.supertrendData.up.map((value, index) => 
                this.supertrendData.trend[index] === 1 ? value : null
            );
            const downData = this.supertrendData.down.map((value, index) => 
                this.supertrendData.trend[index] === -1 ? value : null
            );
            
            this.chart.data.datasets[1].data = upData;
            this.chart.data.datasets[2].data = downData;
        }
        
        this.chart.update('none');
        
        // Update data points counter
        const dataPointsElement = document.getElementById('data-points');
        if (dataPointsElement) {
            dataPointsElement.textContent = this.marketData.length;
        }
    }
    
    async loadTradingPairs() {
        try {
            const response = await fetch('/api/pairs');
            if (response.ok) {
                const pairs = await response.json();
                this.updateTradingPairs(pairs);
            } else {
                // Use demo pairs
                this.updateTradingPairs(this.getDemoPairs());
            }
        } catch (error) {
            console.log('📡 Using demo trading pairs');
            this.updateTradingPairs(this.getDemoPairs());
        }
    }
    
    getDemoPairs() {
        return [
            { symbol: 'EURUSD', name: 'Euro vs US Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 1.5 },
            { symbol: 'GBPUSD', name: 'British Pound vs US Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 2.0 },
            { symbol: 'USDJPY', name: 'US Dollar vs Japanese Yen', category: 'major', digits: 3, min_lot: 0.01, spread: 1.8 },
            { symbol: 'USDCHF', name: 'US Dollar vs Swiss Franc', category: 'major', digits: 5, min_lot: 0.01, spread: 2.2 },
            { symbol: 'AUDUSD', name: 'Australian Dollar vs US Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 1.9 },
            { symbol: 'USDCAD', name: 'US Dollar vs Canadian Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 2.1 },
            { symbol: 'NZDUSD', name: 'New Zealand Dollar vs US Dollar', category: 'major', digits: 5, min_lot: 0.01, spread: 2.5 },
            { symbol: 'EURGBP', name: 'Euro vs British Pound', category: 'minor', digits: 5, min_lot: 0.01, spread: 2.8 },
            { symbol: 'EURJPY', name: 'Euro vs Japanese Yen', category: 'minor', digits: 3, min_lot: 0.01, spread: 2.3 },
            { symbol: 'GBPJPY', name: 'British Pound vs Japanese Yen', category: 'minor', digits: 3, min_lot: 0.01, spread: 3.1 },
            { symbol: 'XAUUSD', name: 'Gold vs US Dollar', category: 'commodities', digits: 2, min_lot: 0.01, spread: 35.0 },
            { symbol: 'XAGUSD', name: 'Silver vs US Dollar', category: 'commodities', digits: 3, min_lot: 0.01, spread: 25.0 },
            { symbol: 'BTCUSD', name: 'Bitcoin vs US Dollar', category: 'crypto', digits: 2, min_lot: 0.01, spread: 2500.0 },
            { symbol: 'ETHUSD', name: 'Ethereum vs US Dollar', category: 'crypto', digits: 2, min_lot: 0.01, spread: 150.0 }
        ];
    }
    
    updateTradingPairs(pairs) {
        const pairsList = document.getElementById('pairs-list');
        const pairsCount = document.getElementById('pairs-count');
        
        if (!pairsList) return;
        
        if (pairsCount) {
            pairsCount.textContent = `${pairs.length} pairs`;
        }
        
        const pairsHTML = pairs.map(pair => {
            const isSelected = pair.symbol === this.currentSymbol;
            return `
                <div class="pair-item p-3 rounded-lg glass cursor-pointer transition-all ${isSelected ? 'selected' : ''}" 
                     data-symbol="${pair.symbol}" data-name="${pair.name}" data-category="${pair.category}"
                     data-digits="${pair.digits}" data-min-lot="${pair.min_lot}" data-spread="${pair.spread}">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
                                <span class="text-xs font-bold text-white">${pair.symbol.substring(0, 2)}</span>
                            </div>
                            <div>
                                <div class="text-white font-medium text-sm">${pair.symbol}</div>
                                <div class="text-gray-400 text-xs">${pair.name}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-white font-medium text-sm">1.08500</div>
                            <span class="px-2 py-0.5 rounded text-xs font-medium category-${pair.category}">${pair.category}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        pairsList.innerHTML = pairsHTML;
        
        // Add click handlers
        pairsList.querySelectorAll('.pair-item').forEach(item => {
            item.addEventListener('click', () => {
                const symbol = item.dataset.symbol;
                this.selectPair(symbol, item.dataset);
            });
        });
    }
    
    selectPair(symbol, pairData) {
        this.currentSymbol = symbol;
        
        // Update UI
        document.getElementById('current-symbol').textContent = symbol;
        document.getElementById('footer-pair').textContent = symbol;
        
        // Update selected pair info
        const pairInfo = document.getElementById('selected-pair-info');
        if (pairInfo) {
            document.getElementById('pair-digits').textContent = pairData.digits;
            document.getElementById('pair-min-lot').textContent = pairData.minLot;
            document.getElementById('pair-spread').textContent = `${pairData.spread} pips`;
            document.getElementById('pair-category').textContent = pairData.category;
            pairInfo.classList.remove('hidden');
        }
        
        // Update pair selection in list
        document.querySelectorAll('.pair-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-symbol="${symbol}"]`)?.classList.add('selected');
        
        // Reset data and recalculate
        this.marketData = [];
        this.supertrendData = [];
        
        if (this.isConnected) {
            this.fetchMT5Data();
        } else {
            this.generateDemoMarketData();
        }
    }
    
    filterPairs(searchTerm) {
        const pairs = document.querySelectorAll('.pair-item');
        pairs.forEach(pair => {
            const symbol = pair.dataset.symbol.toLowerCase();
            const name = pair.dataset.name.toLowerCase();
            const matches = symbol.includes(searchTerm.toLowerCase()) || name.includes(searchTerm.toLowerCase());
            pair.style.display = matches ? 'block' : 'none';
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
        const pairs = document.querySelectorAll('.pair-item');
        pairs.forEach(pair => {
            const pairCategory = pair.dataset.category;
            const matches = category === 'all' || pairCategory === category;
            pair.style.display = matches ? 'block' : 'none';
        });
    }
    
    updateConnectionStatus(mode = 'Demo Mode', status = 'disconnected') {
        const connectionStatus = document.getElementById('connection-status');
        const modeIndicator = document.getElementById('mode-indicator');
        const statusIndicator = document.getElementById('status-indicator');
        
        if (connectionStatus) {
            let statusClass, statusText, iconName;
            
            switch (status) {
                case 'connected':
                    statusClass = 'border-primary-500/30 bg-primary-500/10';
                    statusText = 'MT5 Connected';
                    iconName = 'wifi';
                    break;
                case 'demo':
                    statusClass = 'border-yellow-500/30 bg-yellow-500/10';
                    statusText = 'Demo Mode Active';
                    iconName = 'play-circle';
                    break;
                case 'error':
                    statusClass = 'border-red-500/30 bg-red-500/10';
                    statusText = 'Connection Error';
                    iconName = 'wifi-off';
                    break;
                default:
                    statusClass = 'border-red-500/30 bg-red-500/10';
                    statusText = 'Connecting...';
                    iconName = 'loader';
            }
            
            connectionStatus.className = `flex items-center px-3 py-1.5 rounded-full glass border ${statusClass} connection-pulse`;
            connectionStatus.innerHTML = `
                <div class="w-2 h-2 ${status === 'connected' ? 'bg-primary-500' : status === 'demo' ? 'bg-yellow-500' : 'bg-red-500'} rounded-full mr-2 animate-pulse"></div>
                <i data-lucide="${iconName}" class="w-4 h-4 mr-2 ${status === 'connected' ? 'text-primary-400' : status === 'demo' ? 'text-yellow-400' : 'text-red-400'}"></i>
                <span class="${status === 'connected' ? 'text-primary-400' : status === 'demo' ? 'text-yellow-400' : 'text-red-400'} font-medium text-sm">${statusText}</span>
            `;
        }
        
        if (modeIndicator) {
            modeIndicator.textContent = mode;
            modeIndicator.className = `font-medium ${status === 'connected' ? 'text-primary-500' : status === 'demo' ? 'text-yellow-400' : 'text-red-400'}`;
        }
        
        if (statusIndicator) {
            statusIndicator.textContent = this.isRunning ? 'Live' : 'Paused';
            statusIndicator.className = `font-medium ${this.isRunning ? 'text-primary-500' : 'text-gray-400'}`;
        }
        
        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    updateAccountInfo(accountData) {
        // Update account balance
        const balanceElement = document.getElementById('account-balance');
        if (balanceElement && accountData.balance !== undefined) {
            balanceElement.textContent = `$${accountData.balance.toFixed(2)}`;
        }
        
        // Update equity
        const equityElement = document.getElementById('account-equity');
        if (equityElement && accountData.equity !== undefined) {
            equityElement.textContent = `$${accountData.equity.toFixed(2)}`;
        }
        
        // Update free margin
        const freeMarginElement = document.getElementById('account-free-margin');
        if (freeMarginElement && accountData.free_margin !== undefined) {
            freeMarginElement.textContent = `$${accountData.free_margin.toFixed(2)}`;
        }
        
        // Update margin level
        const marginLevelElement = document.getElementById('margin-level-percent');
        const marginLevelBar = document.getElementById('margin-level-bar');
        if (marginLevelElement && marginLevelBar && accountData.margin_level !== undefined) {
            const marginLevel = accountData.margin_level || 0;
            marginLevelElement.textContent = `${marginLevel.toFixed(1)}%`;
            marginLevelBar.style.width = `${Math.min(marginLevel, 100)}%`;
        }
        
        // Update server and account info
        const serverElement = document.getElementById('mt5-server');
        const accountElement = document.getElementById('mt5-account');
        const statusElement = document.getElementById('mt5-connection-status');
        
        if (serverElement && accountData.server) {
            serverElement.textContent = accountData.server;
        }
        if (accountElement && accountData.account) {
            accountElement.textContent = accountData.account;
        }
        if (statusElement) {
            statusElement.textContent = accountData.is_connected ? 'Connected' : 'Disconnected';
            statusElement.className = `font-medium ${accountData.is_connected ? 'text-primary-500' : 'text-red-400'}`;
        }
    }
    
    updateTradingStats(positions, orders) {
        if (positions) {
            const positionsElement = document.getElementById('open-positions');
            if (positionsElement) {
                positionsElement.textContent = positions.length;
            }
        }
        
        if (orders) {
            const ordersElement = document.getElementById('pending-orders');
            if (ordersElement) {
                ordersElement.textContent = orders.length;
            }
        }
        
        // Calculate daily P&L (simplified)
        const pnlElement = document.getElementById('daily-pnl');
        if (pnlElement && positions) {
            const totalPnl = positions.reduce((sum, pos) => sum + (pos.profit || 0), 0);
            pnlElement.textContent = `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`;
            pnlElement.className = `text-2xl font-bold ${totalPnl >= 0 ? 'text-primary-500' : 'text-danger-500'}`;
        }
    }
    
    updateLastUpdate() {
        const lastUpdateElement = document.getElementById('last-update');
        const mt5LastUpdateElement = document.getElementById('mt5-last-update');
        
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        
        if (lastUpdateElement) {
            lastUpdateElement.textContent = timeString;
        }
        if (mt5LastUpdateElement) {
            mt5LastUpdateElement.textContent = timeString;
        }
    }
    
    updateConfig(key, value) {
        this.config[key] = value;
        
        // Update display values
        const displayElement = document.getElementById(`${key.replace(/([A-Z])/g, '-$1').toLowerCase()}-value`);
        if (displayElement) {
            displayElement.textContent = typeof value === 'number' ? value.toFixed(value < 1 ? 1 : 0) : value;
        }
        
        // Recalculate SuperTrend
        this.calculateSuperTrend();
    }
    
    applySettings() {
        console.log('⚙️ Applying SuperTrend settings:', this.config);
        this.calculateSuperTrend();
        this.updateChart();
        this.toggleSettings();
    }
    
    toggleSettings() {
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) {
            settingsPanel.classList.toggle('hidden');
        }
    }
    
    togglePlayPause() {
        this.isRunning = !this.isRunning;
        
        const button = document.getElementById('play-pause-btn');
        if (button) {
            const icon = this.isRunning ? 'pause' : 'play';
            const text = this.isRunning ? 'Pause' : 'Play';
            button.innerHTML = `
                <i data-lucide="${icon}" class="w-4 h-4 mr-1"></i>
                <span>${text}</span>
            `;
        }
        
        this.updateConnectionStatus();
        
        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    reset() {
        console.log('🔄 Resetting dashboard...');
        
        // Clear data
        this.marketData = [];
        this.supertrendData = [];
        this.signals = [];
        this.lastSignalBar = null;
        
        // Reset UI
        this.updateAlertsDisplay();
        this.updateChart();
        
        // Regenerate demo data if not connected
        if (!this.isConnected) {
            this.generateDemoMarketData();
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
            const response = await fetch('/api/test-connection', { method: 'POST' });
            const result = await response.json();
            
            let resultsHTML = '<div class="space-y-3">';
            
            if (result.results) {
                Object.entries(result.results).forEach(([test, data]) => {
                    const icon = data.success ? 'check-circle' : 'x-circle';
                    const color = data.success ? 'text-primary-500' : 'text-red-500';
                    
                    resultsHTML += `
                        <div class="flex items-center justify-between p-3 glass rounded-lg">
                            <div class="flex items-center space-x-3">
                                <i data-lucide="${icon}" class="w-5 h-5 ${color}"></i>
                                <span class="text-white font-medium text-sm">${test.replace(/_/g, ' ').toUpperCase()}</span>
                            </div>
                            <span class="text-xs ${color}">${data.success ? 'PASS' : 'FAIL'}</span>
                        </div>
                        <p class="text-xs text-gray-400 ml-8">${data.message}</p>
                    `;
                });
            }
            
            resultsHTML += '</div>';
            resultsElement.innerHTML = resultsHTML;
            
        } catch (error) {
            resultsElement.innerHTML = `
                <div class="text-center py-6">
                    <i data-lucide="x-circle" class="w-8 h-8 mx-auto mb-3 text-red-500"></i>
                    <p class="text-red-400 font-medium">Connection test failed</p>
                    <p class="text-gray-400 text-sm">Could not reach MT5 API</p>
                </div>
            `;
        }
        
        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    async refreshConnection() {
        console.log('🔄 Refreshing MT5 connection...');
        
        try {
            const response = await fetch('/api/reconnect', { method: 'POST' });
            const result = await response.json();
            
            if (result.connected) {
                this.isConnected = true;
                this.stopDemoMode();
                this.updateConnectionStatus('MT5 Live', 'connected');
                this.fetchMT5Data();
            } else {
                this.updateConnectionStatus('Demo Mode', 'disconnected');
            }
        } catch (error) {
            console.error('❌ Failed to refresh connection:', error);
            this.updateConnectionStatus('Connection Error', 'error');
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new SuperTrendDashboard();
});