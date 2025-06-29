#!/usr/bin/env python3
"""
SuperTrend Pro MT5 - Development Server
Direct MT5 connection only - No demo mode
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
        
        # Try to initialize MT5
        if mt5.initialize():
            print("✅ MT5 Terminal is running and accessible")
            account_info = mt5.account_info()
            if account_info:
                print(f"📊 Connected to account: {account_info.login} on {account_info.server}")
                print(f"💰 Balance: ${account_info.balance:.2f}")
                print(f"🏦 Currency: {account_info.currency}")
                print(f"🔢 Leverage: 1:{account_info.leverage}")
            mt5.shutdown()
            return True
        else:
            error_code = mt5.last_error()
            print(f"⚠️ MT5 Terminal connection failed (Error: {error_code})")
            print("💡 To connect to MT5:")
            print("   1. Start MetaTrader 5 Terminal")
            print("   2. Log into your trading account")
            print("   3. Enable 'Allow automated trading' in Tools → Options → Expert Advisors")
            print("   4. Restart this application")
            return False
            
    except Exception as e:
        print(f"❌ MT5 check failed: {e}")
        print("💡 Please install MetaTrader 5 Terminal from your broker")
        return False

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
            
            env_content = f"""# SuperTrend Pro MT5 Configuration - Direct MT5 Only
HOST={host}
PORT={port}
DEBUG=true
LOG_LEVEL=INFO

# SuperTrend Default Settings
DEFAULT_ATR_PERIOD=20
DEFAULT_MULTIPLIER=2.0
DEFAULT_RSI_PERIOD=14

# Data Settings
MAX_CANDLES=1000
UPDATE_INTERVAL=1.0
"""
            env_file.write_text(env_content)
            print(f"✅ Environment file created with port {port}")

def main():
    """Main function with MT5 direct connection only"""
    print("🚀 SuperTrend Pro MT5 - Direct Connection Only")
    print("=" * 60)
    
    # Check and install requirements
    if not check_requirements():
        sys.exit(1)
    
    # Check MT5 installation and connection
    mt5_available = check_mt5_installation()
    
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
    
    print("\n🔗 Connection Mode:")
    print("   ✅ Direct MT5 Connection Only")
    print("   ❌ Demo Mode Disabled")
    print("   ❌ WebSocket Mode Disabled")
    print("   ❌ File-based Mode Disabled")
    
    print("\n💡 Features:")
    print("   ✅ Real-time MT5 account data")
    print("   ✅ Live tick data and market information")
    print("   ✅ Advanced SuperTrend indicator calculations")
    print("   ✅ Trading positions and orders monitoring")
    print("   ✅ Account balance and margin tracking")
    
    if not mt5_available:
        print("\n⚠️ MT5 Connection Status:")
        print("   ❌ MT5 Terminal not connected")
        print("   💡 Dashboard will show connection instructions")
        print("   🔄 Connection will be attempted when MT5 is available")
    else:
        print("\n✅ MT5 Connection Status:")
        print("   ✅ MT5 Terminal is ready")
        print("   📊 Live data will be available immediately")
    
    print("\n💡 Usage Tips:")
    print("   - Ensure MT5 Terminal is running for live data")
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