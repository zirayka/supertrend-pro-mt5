#!/usr/bin/env python3
"""
SuperTrend Pro MT5 - Development Server
Quick start script with MetaTrader5 integration
"""

import os
import sys
import subprocess
import socket
from pathlib import Path

def check_port_available(host, port):
    """Check if a port is available"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex((host, port))
            return result != 0
    except Exception:
        return False

def find_available_port(host, start_port=3000, max_attempts=10):
    """Find an available port starting from start_port"""
    for port in range(start_port, start_port + max_attempts):
        if check_port_available(host, port):
            return port
    return None

def check_requirements():
    """Check if requirements are installed"""
    try:
        import fastapi
        import uvicorn
        import pandas
        import numpy
        import MetaTrader5
        print("✅ All requirements are installed")
        print("✅ MetaTrader5 package is available")
        return True
    except ImportError as e:
        print(f"❌ Missing requirement: {e}")
        print("📦 Installing requirements...")
        
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
            print("✅ Requirements installed successfully")
            return True
        except subprocess.CalledProcessError:
            print("❌ Failed to install requirements")
            return False

def check_mt5_installation():
    """Check if MT5 is properly installed and accessible"""
    try:
        import MetaTrader5 as mt5
        
        # Try to initialize MT5 (this will fail if MT5 is not running, but that's OK)
        if mt5.initialize():
            print("✅ MT5 Terminal is running and accessible")
            account_info = mt5.account_info()
            if account_info:
                print(f"📊 Connected to account: {account_info.login} on {account_info.server}")
                print(f"💰 Balance: ${account_info.balance:.2f}")
            mt5.shutdown()
            return True
        else:
            print("⚠️ MT5 Terminal is not running (this is OK for development)")
            print("💡 To connect to live MT5 data:")
            print("   1. Start MetaTrader 5 Terminal")
            print("   2. Log into your trading account")
            print("   3. Restart this application")
            return True
            
    except Exception as e:
        print(f"⚠️ MT5 check failed: {e}")
        print("💡 This is normal if MT5 is not installed or running")
        return True

def create_directories():
    """Create necessary directories"""
    directories = ["logs", "static/css", "static/js", "templates"]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
    
    print("✅ Directories created")

def setup_environment():
    """Setup environment variables"""
    env_file = Path(".env")
    
    if not env_file.exists():
        # Copy from example
        example_file = Path(".env.example")
        if example_file.exists():
            env_file.write_text(example_file.read_text())
            print("✅ Environment file created from example")
        else:
            # Create basic .env file with available port
            host = "127.0.0.1"
            port = find_available_port(host)
            if port is None:
                port = 3000
                print("⚠️ Could not find available port, using default 3000")
            
            env_content = f"""# SuperTrend Pro MT5 Configuration
HOST={host}
PORT={port}
DEBUG=true
LOG_LEVEL=INFO

# MT5 Connection Settings
MT5_WEBSOCKET_URL=ws://localhost:8765
MT5_FILE_SERVER_URL=http://localhost:3001
MT5_FILES_PATH=

# SuperTrend Default Settings
DEFAULT_ATR_PERIOD=20
DEFAULT_MULTIPLIER=2.0
DEFAULT_RSI_PERIOD=14

# Data Settings
MAX_CANDLES=1000
UPDATE_INTERVAL=1.0
"""
            env_file.write_text(env_content)
            print(f"✅ Basic environment file created with port {port}")

def main():
    """Main function with enhanced MT5 integration"""
    print("🚀 SuperTrend Pro MT5 - Python Trading Dashboard")
    print("=" * 60)
    
    # Check and install requirements
    if not check_requirements():
        sys.exit(1)
    
    # Check MT5 installation and connection
    check_mt5_installation()
    
    # Create directories
    create_directories()
    
    # Setup environment
    setup_environment()
    
    # Check port availability
    host = "127.0.0.1"
    port = 3000
    
    # Try to read port from .env if it exists
    env_file = Path(".env")
    if env_file.exists():
        try:
            for line in env_file.read_text().splitlines():
                if line.startswith("PORT="):
                    port = int(line.split("=")[1])
                    break
        except (ValueError, IndexError):
            pass
    
    if not check_port_available(host, port):
        print(f"⚠️ Port {port} is already in use")
        new_port = find_available_port(host, port + 1)
        if new_port:
            print(f"🔄 Using alternative port {new_port}")
            port = new_port
            # Update .env file
            if env_file.exists():
                content = env_file.read_text()
                content = content.replace(f"PORT={port-1}", f"PORT={port}")
                env_file.write_text(content)
        else:
            print("❌ No available ports found. Please close other applications using ports 3000-3010")
            print("\n💡 Common solutions:")
            print("   - Close any running web servers")
            print("   - Check Task Manager for applications using ports 3000-8000")
            print("   - Try running as Administrator")
            sys.exit(1)
    
    print(f"\n🎯 Starting SuperTrend Pro MT5 Dashboard...")
    print(f"📊 Dashboard will be available at: http://{host}:{port}")
    print(f"📚 API documentation at: http://{host}:{port}/api/docs")
    print("\n💡 Features:")
    print("   ✅ Direct MT5 Terminal integration via MetaTrader5 package")
    print("   ✅ Real-time tick data and account information")
    print("   ✅ Advanced SuperTrend indicator calculations")
    print("   ✅ Multiple connection methods (Direct, WebSocket, File-based)")
    print("   ✅ Live trading capabilities (when connected to MT5)")
    print("\n🔗 Connection Methods:")
    print("   1. Direct MT5 (Recommended) - Uses MetaTrader5 Python package")
    print("   2. WebSocket - Real-time data via WebSocket server")
    print("   3. File-based - Reads data from MT5 Expert Advisor files")
    print("   4. Demo Mode - Simulated data for testing")
    print("\n💡 Tips:")
    print("   - For live data: Start MT5 Terminal and log into your account")
    print("   - Check connection status in the dashboard")
    print("   - Use API endpoints for programmatic access")
    print("   - Press Ctrl+C to stop the server")
    print("\n" + "=" * 60)
    
    try:
        # Import and run the application
        import uvicorn
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except OSError as e:
        if "WinError 10013" in str(e):
            print(f"\n❌ Port access denied error on port {port}")
            print("\n💡 Solutions:")
            print("   1. Run Command Prompt as Administrator")
            print("   2. Try a different port by editing .env file")
            print("   3. Check Windows Firewall settings")
            print("   4. Close applications that might be using the port")
            print(f"\n🔍 To check what's using port {port}:")
            print(f"   netstat -ano | findstr :{port}")
        else:
            print(f"\n❌ Network error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()