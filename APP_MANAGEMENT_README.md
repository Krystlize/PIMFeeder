# React App Management Guide

## Overview
This workspace contains multiple React applications. To avoid conflicts and ensure the correct app runs, follow these guidelines:

## Available Apps

### 1. Program Queues App (Main App) ✅ RESOLVED
- **Location**: `program-queues/`
- **Purpose**: Participant grouping and queue management
- **Port**: 3001 (changed from 3000 to avoid conflicts)
- **Status**: Running successfully on http://localhost:3001

### 2. PIM Feeder App
- **Location**: Root directory and `my-react-app-superman/`
- **Purpose**: PIM feeder application
- **Port**: 3000 (default) - **CONFLICT RESOLVED**
- **Note**: Start script renamed to `start-pimfeeder` to prevent auto-starting

## How to Run Program Queues App

### Option 1: Use the Batch File (Recommended)
1. Double-click `start-program-queues.bat` from the root directory
2. This will automatically:
   - Stop any existing React apps on port 3000
   - Navigate to the program-queues directory
   - Start the app on port 3001

### Option 2: Manual Start
1. Open a terminal/command prompt
2. Navigate to the program-queues directory: `cd program-queues`
3. Run: `npm start` (will start on port 3001)
4. Open http://localhost:3001 in your browser

## How to Stop React Apps

### Option 1: Use the Batch File
1. Double-click `stop-react-apps.bat`
2. This will stop all React apps running on port 3000

### Option 2: Manual Stop
1. Find the process using port 3000: `netstat -ano | findstr :3000`
2. Kill the process: `taskkill /PID <PID> /F`

## Preventing Conflicts

### ✅ DO:
- Always start apps from their specific directories
- Use the provided batch files
- Check if port 3000 is free before starting
- Use port 3001 for program-queues app

### ❌ DON'T:
- Run `npm start` from the root directory (starts PIM feeder)
- Run multiple React apps simultaneously on the same port
- Start apps without checking for existing processes

## Troubleshooting

### Issue: Wrong app shows up
**Solution**: 
1. Stop all React apps: `stop-react-apps.bat`
2. Start the correct app: `start-program-queues.bat`

### Issue: Port 3000 already in use
**Solution**:
1. Use `stop-react-apps.bat` to free the port
2. Or manually kill the process using the port

### Issue: App won't start
**Solution**:
1. Ensure you're in the correct directory
2. Check if all dependencies are installed: `npm install`
3. Verify the port is free

## File Structure
```
my-react-app-superman/
├── program-queues/          # Your main app (port 3001)
├── my-react-app-superman/   # PIM feeder app (port 3000)
├── start-program-queues.bat # Start script for program-queues
├── stop-react-apps.bat      # Stop script
└── APP_MANAGEMENT_README.md # This file
```

## Quick Commands
- **Start Program Queues**: `start-program-queues.bat`
- **Stop All Apps**: `stop-react-apps.bat`
- **Check Port Usage**: `netstat -ano | findstr :3000`
- **Check Port 3001**: `netstat -ano | findstr :3001`

## Current Status
✅ **PIM Feeder conflict resolved** - Root package.json start script renamed to `start-pimfeeder`
✅ **Program Queues app running** - Successfully running on port 3001
✅ **Port conflicts eliminated** - Each app now uses different ports
✅ **TypeScript errors fixed** - All component type issues resolved
