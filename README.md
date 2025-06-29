# SuperTrend Pro MT5 - Python Trading Dashboard

A professional-grade SuperTrend indicator dashboard with MetaTrader 5 integration, built with Python, FastAPI, and modern web technologies.

## 🚀 Features

### ✅ **Advanced SuperTrend Indicator**
- Real-time SuperTrend calculation with customizable parameters
- ATR-based trend detection with multiple timeframes
- RSI filter integration for enhanced signal accuracy
- Volatility and higher timeframe filters
- Strong signal detection with confidence levels

### ✅ **MT5 Integration**
- **WebSocket Connection**: Direct real-time data from MT5 Terminal
- **File-based Connection**: Reliable fallback using MT5 Expert Advisor files
- **Demo Mode**: Simulated market data for testing and development
- Support for multiple currency pairs, commodities, indices, and crypto

### ✅ **Professional Dashboard**
- Real-time price charts with SuperTrend overlay
- Live market data display (bid/ask/spread/volume)
- Trading signal alerts with strength indicators
- Connection status monitoring
- Responsive design for desktop and mobile

### ✅ **Modern Architecture**
- **Backend**: FastAPI with async/await support
- **Frontend**: Vanilla JavaScript with WebSocket communication
- **Real-time**: WebSocket-based live data streaming
- **Scalable**: Modular design with dependency injection

## 🛠️ Installation

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd supertrend-pro-mt5
   ```

2. **Run the setup script**:
   ```bash
   python run.py
   ```

The script will automatically:
- Install Python dependencies
- Create necessary directories
- Set up environment configuration
- Start the development server

### Manual Installation

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Start the server**:
   ```bash
   python main.py
   ```

## 📊 Usage

### Access the Dashboard
- **Main Dashboard**: http://127.0.0.1:8000
- **API Documentation**: http://127.0.0.1:8000/api/docs
- **API Alternative Docs**: http://127.0.0.1:8000/api/redoc

### Dashboard Features

#### 🎯 **Real-time Trading**
- Live price updates from MT5 or demo data
- Interactive price charts with SuperTrend levels
- Real-time signal generation and alerts
- Multiple currency pair support

#### ⚙️ **Configuration**
- Adjustable SuperTrend parameters (ATR period, multiplier)
- RSI filter settings (period, thresholds)
- Volatility and trend filters
- Real-time parameter updates

#### 📈 **Analysis Tools**
- Trend strength indicators
- RSI analysis with overbought/oversold levels
- Signal confidence scoring
- Historical signal tracking

## 🔌 MT5 Connection

### Connection Methods

#### 1. **WebSocket Connection** (Recommended for real-time)
- Direct connection to MT5 Terminal via WebSocket
- Requires MT5 WebSocket bridge or Expert Advisor
- Ultra-low latency for high-frequency trading

#### 2. **File-based Connection** (Most reliable)
- Reads data from MT5 Expert Advisor JSON files
- Works with the provided MT5 Expert Advisor
- Automatic file monitoring and updates

#### 3. **Demo Mode** (For testing)
- Simulated market data with realistic price movements
- Perfect for testing strategies and development
- No MT5 Terminal required

### Setting up MT5 Connection

1. **Install the MT5 Expert Advisor**:
   - Copy `docs/MT5_EA_FIXED_V2.mq5` to your MT5 Expert Advisors folder
   - Compile and attach to any chart in MT5 Terminal
   - Ensure "Allow automated trading" is enabled

2. **Verify file creation**:
   - Check `%APPDATA%\MetaQuotes\Terminal\Common\Files\` for JSON files
   - Files should update every few seconds

3. **Start the Python dashboard**:
   - The dashboard will automatically detect and connect to MT5 data

## 🏗️ Architecture

### Backend Structure
```
src/
├── core/           # Core application logic
│   ├── config.py   # Configuration management
│   └── models.py   # Data models and schemas
├── services/       # Business logic services
│   ├── mt5_connection.py      # MT5 connection management
│   ├── websocket_manager.py   # WebSocket communication
│   └── supertrend_calculator.py  # SuperTrend calculations
├── api/            # API routes and endpoints
│   └── routes.py   # REST API routes
└── utils/          # Utility functions
    └── logger.py   # Logging configuration
```

### Frontend Structure
```
templates/          # HTML templates
├── dashboard.html  # Main dashboard template
static/
├── js/
│   └── dashboard.js    # Dashboard JavaScript
└── css/
    └── styles.css      # Custom styles
```

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Server Settings
HOST=127.0.0.1
PORT=8000
DEBUG=true

# MT5 Connection
MT5_WEBSOCKET_URL=ws://localhost:8765
MT5_FILE_SERVER_URL=http://localhost:3001
MT5_FILES_PATH=/path/to/mt5/files

# SuperTrend Settings
DEFAULT_ATR_PERIOD=20
DEFAULT_MULTIPLIER=2.0
DEFAULT_RSI_PERIOD=14

# Data Settings
MAX_CANDLES=1000
UPDATE_INTERVAL=1.0
```

### SuperTrend Parameters
- **ATR Period**: Number of periods for ATR calculation (5-50)
- **Multiplier**: ATR multiplier for trend bands (0.5-5.0)
- **RSI Length**: RSI calculation period (5-30)
- **RSI Thresholds**: Buy/sell signal thresholds (30-70)
- **Filters**: Volatility, higher timeframe, and signal filters

## 📡 API Endpoints

### Core Endpoints
- `GET /api/status` - Application status
- `GET /api/connection` - MT5 connection status
- `GET /api/pairs` - Available currency pairs
- `GET /api/tick` - Current tick data
- `GET /api/market-data` - Historical market data

### Configuration
- `GET /api/config` - Get SuperTrend configuration
- `POST /api/config` - Update SuperTrend configuration
- `POST /api/calculate` - Calculate SuperTrend for symbol

### Utilities
- `POST /api/test-connection` - Test MT5 connection
- `POST /api/reconnect` - Reconnect to MT5
- `GET /api/dashboard-state` - Complete dashboard state

## 🔍 Troubleshooting

### Common Issues

#### 1. **MT5 Connection Failed**
```bash
# Check if MT5 Terminal is running
# Verify Expert Advisor is attached and active
# Check file permissions in MT5 data folder
# Try running MT5 as Administrator
```

#### 2. **No Market Data**
```bash
# Verify MT5 Expert Advisor is creating JSON files
# Check MT5 Expert tab for error messages
# Ensure selected symbol is available in MT5
# Try switching to demo mode for testing
```

#### 3. **WebSocket Connection Issues**
```bash
# Check if port 8765 is available
# Verify WebSocket server is running in MT5
# Try file-based connection as fallback
# Check firewall settings
```

### Debug Mode
Enable debug logging in `.env`:
```bash
DEBUG=true
LOG_LEVEL=DEBUG
```

Check logs in `logs/supertrend.log` for detailed information.

## 🚀 Development

### Running in Development Mode
```bash
# Start with auto-reload
python main.py

# Or use uvicorn directly
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Adding New Features
1. **Backend**: Add new routes in `src/api/routes.py`
2. **Frontend**: Extend `static/js/dashboard.js`
3. **Models**: Define new data structures in `src/core/models.py`
4. **Services**: Add business logic in `src/services/`

### Testing
```bash
# Test API endpoints
curl http://127.0.0.1:8000/api/status

# Test WebSocket connection
# Use browser developer tools or WebSocket client
```

## 📚 Documentation

### Additional Resources
- `docs/MT5_CONNECTION_GUIDE.md` - Detailed MT5 setup guide
- `docs/MT5_EA_FIXED_V2.mq5` - Latest Expert Advisor code
- `docs/MT5_INSTALLATION_STEPS.md` - Step-by-step installation
- API documentation available at `/api/docs` when running

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
1. Check the troubleshooting section
2. Review the MT5 connection guide
3. Check API documentation
4. Create an issue on GitHub

---

**SuperTrend Pro MT5** - Professional trading analysis made simple with Python! 🐍📊