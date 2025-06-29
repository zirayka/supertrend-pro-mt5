#!/usr/bin/env python3
"""
SuperTrend Pro MT5 - Development Server
Quick start script for development with enhanced error handling
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
        print("✅ All requirements are installed")
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
"""
            env_file.write_text(env_content)
            print(f"✅ Basic environment file created with port {port}")

def main():
    """Main function with enhanced error handling"""
    print("🚀 SuperTrend Pro MT5 - Python Trading Dashboard")
    print("=" * 50)
    
    # Check and install requirements
    if not check_requirements():
        sys.exit(1)
    
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
            print("   - Check Task Manager for applications using port 3000-8000")
            print("   - Try running as Administrator")
            sys.exit(1)
    
    print(f"\n🎯 Starting SuperTrend Pro MT5 Dashboard...")
    print(f"📊 Dashboard will be available at: http://{host}:{port}")
    print(f"📚 API documentation at: http://{host}:{port}/api/docs")
    print("\n💡 Tips:")
    print("   - Ensure MT5 Terminal is running for live data")
    print("   - Check MT5 connection guide in docs/ folder")
    print("   - Press Ctrl+C to stop the server")
    print("\n" + "=" * 50)
    
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