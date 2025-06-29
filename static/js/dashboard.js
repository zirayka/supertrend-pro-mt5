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
                events: ['tick', 'market_data', 'connection_status', 'signal']
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
        
        // Pair selector
        document.getElementById('pair-selector').addEventListener('change', (e) => {
            this.changeSymbol(e.target.value);
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
        }
    }
    
    async loadAvailablePairs() {
        try {
            const response = await fetch('/api/pairs');
            const pairs = await response.json();
            
            const selector = document.getElementById('pair-selector');
            if (selector && pairs.length > 0) {
                selector.innerHTML = '';
                pairs.forEach(pair => {
                    const option = document.createElement('option');
                    option.value = pair.symbol;
                    option.textContent = `${pair.symbol} - ${pair.name}`;
                    selector.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading pairs:', error);
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
    
    updateMT5Status(connection) {
        const statusContent = document.getElementById('mt5-status-content');
        if (!statusContent) return;
        
        const isConnected = connection.is_connected;
        const connectionType = connection.connection_type || 'demo';
        
        // Update connection indicator
        this.updateConnectionStatus(isConnected, connectionType);
        
        if (isConnected) {
            statusContent.innerHTML = `
                <div class="space-y-4">
                    <div class="bg-gray-800 rounded-lg p-4">
                        <h3 class="text-white font-medium mb-3">Connection Info</h3>
                        <div class="space-y-2 text-sm">
                            <div class="flex justify-between">
                                <span class="text-gray-400">Type</span>
                                <span class="text-white">${connectionType.charAt(0).toUpperCase() + connectionType.slice(1)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Server</span>
                                <span class="text-white">${connection.server || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Account</span>
                                <span class="text-white">${connection.account || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${connection.balance !== undefined ? `
                    <div class="bg-gray-800 rounded-lg p-4">
                        <h3 class="text-white font-medium mb-3">Account Balance</h3>
                        <div class="space-y-2 text-sm">
                            <div class="flex justify-between">
                                <span class="text-gray-400">Balance</span>
                                <span class="text-emerald-400 font-bold">$${connection.balance.toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Equity</span>
                                <span class="text-white">$${connection.equity.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        } else {
            statusContent.innerHTML = `
                <div class="text-center py-8">
                    <i data-lucide="wifi-off" class="w-16 h-16 text-gray-600 mx-auto mb-4"></i>
                    <h3 class="text-white font-medium mb-2">Not Connected to MT5</h3>
                    <p class="text-gray-400 mb-4">Running in demo mode</p>
                    <button onclick="dashboard.reconnectMT5()" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                        Try Reconnect
                    </button>
                </div>
            `;
        }
        
        // Re-initialize Lucide icons
        lucide.createIcons();
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