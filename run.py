#!/usr/bin/env python3
"""
SuperTrend Pro MT5 - Development Server
Quick start script for development
"""

import os
import sys
import subprocess
from pathlib import Path

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
            # Create basic .env file
            env_content = """# SuperTrend Pro MT5 Configuration
HOST=127.0.0.1
PORT=8000
DEBUG=true
LOG_LEVEL=INFO
"""
            env_file.write_text(env_content)
            print("✅ Basic environment file created")

def main():
    """Main function"""
    print("🚀 SuperTrend Pro MT5 - Python Trading Dashboard")
    print("=" * 50)
    
    # Check and install requirements
    if not check_requirements():
        sys.exit(1)
    
    # Create directories
    create_directories()
    
    # Setup environment
    setup_environment()
    
    print("\n🎯 Starting SuperTrend Pro MT5 Dashboard...")
    print("📊 Dashboard will be available at: http://127.0.0.1:8000")
    print("📚 API documentation at: http://127.0.0.1:8000/api/docs")
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
            host="127.0.0.1",
            port=8000,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()