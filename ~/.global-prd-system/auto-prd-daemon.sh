#!/bin/bash
# Auto-PRD Daemon - Runs automatically in the background
# Monitors ALL projects and auto-creates/manages PRDs without any user intervention

set -e

# Configuration
GLOBAL_DIR="$HOME/.global-prd-system"
DAEMON_PID_FILE="$GLOBAL_DIR/auto-prd-daemon.pid"
DAEMON_LOG="$GLOBAL_DIR/daemon.log"
PROJECTS_DIR="$HOME/projects"  # Change this to your projects directory
CHECK_INTERVAL=3600  # Check every hour (in seconds)
AUTO_EXECUTE=false  # Auto-execute tasks or just create PRDs
MAX_PARALLEL=3  # Max projects to process in parallel

# Ensure directories exist
mkdir -p "$GLOBAL_DIR"
mkdir -p "$PROJECTS_DIR"

# Logging function
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_message="[${timestamp}] $1"
    echo "$log_message" | tee -a "$DAEMON_LOG"
}

# Find all projects
find_all_projects() {
    local projects=()
    
    # Find directories with common project files
    for dir in "$PROJECTS_DIR"/*/; do
        if [ -d "$dir" ]; then
            # Check if it's a real project
            if [ -f "${dir}package.json" ] || [ -f "${dir}Cargo.toml" ] || \
               [ -f "${dir}pyproject.toml" ] || [ -f "${dir}setup.py" ] || \
               [ -f "${dir}requirements.txt" ] || [ -f "${dir}pom.xml" ] || \
               [ -f "${dir}.git/config" ]; then
                projects+=("${dir%/}")
            fi
        fi
    done
    
    echo "${projects[@]}"
}

# Process a single project
process_project() {
    local project_path="$1"
    local project_name=$(basename "$project_path")
    
    log "Processing project: $project_name"
    
    # Change to project directory
    cd "$project_path" || return 1
    
    # Run Auto-PRD
    bash "$GLOBAL_DIR/auto-prd.sh" >> "$GLOBAL_DIR/${project_name}.log" 2>&1
    
    # Auto-execute if enabled
    if [ "$AUTO_EXECUTE" = true ] && command -v ralphy &> /dev/null; then
        log "Auto-executing tasks for $project_name"
        ralphy --opencode --prd PRD.md --max-iterations 3 --no-commit >> "$GLOBAL_DIR/${project_name}.log" 2>&1 || true
    fi
    
    log "Completed processing: $project_name"
}

# Process all projects
process_all_projects() {
    log "=== Starting batch processing ==="
    
    local projects=($(find_all_projects))
    local total=${#projects[@]}
    
    if [ "$total" -eq 0 ]; then
        log "No projects found in $PROJECTS_DIR"
        return 0
    fi
    
    log "Found $total projects to process"
    
    # Process projects in parallel (up to MAX_PARALLEL)
    local running=0
    local completed=0
    
    for project in "${projects[@]}"; do
        # Wait if we're at max parallel
        while [ "$running" -ge "$MAX_PARALLEL" ]; do
            sleep 1
            running=$(jobs -r | wc -l)
        done
        
        # Process project in background
        process_project "$project" &
        running=$((running + 1))
        completed=$((completed + 1))
        
        log "Started processing ($completed/$total): $(basename "$project")"
    done
    
    # Wait for all to complete
    wait
    
    log "=== Batch processing complete ==="
}

# Daemon main loop
daemon_loop() {
    log "Auto-PRD Daemon started"
    log "Projects directory: $PROJECTS_DIR"
    log "Check interval: $CHECK_INTERVAL seconds"
    log "Auto-execute: $AUTO_EXECUTE"
    
    # Initial processing
    process_all_projects
    
    # Main loop
    while true; do
        sleep "$CHECK_INTERVAL"
        process_all_projects
    done
}

# Start daemon
start_daemon() {
    # Check if already running
    if [ -f "$DAEMON_PID_FILE" ]; then
        local old_pid=$(cat "$DAEMON_PID_FILE")
        if kill -0 "$old_pid" 2>/dev/null; then
            log "Daemon already running (PID: $old_pid)"
            echo "Daemon is already running. Stop it first: bash $0 --stop"
            return 1
        fi
    fi
    
    # Start daemon in background
    log "Starting daemon..."
    daemon_loop &
    
    local daemon_pid=$!
    echo "$daemon_pid" > "$DAEMON_PID_FILE"
    
    log "Daemon started with PID: $daemon_pid"
    log "Log file: $DAEMON_LOG"
    echo "Daemon started! Monitor with: tail -f $DAEMON_LOG"
}

# Stop daemon
stop_daemon() {
    if [ ! -f "$DAEMON_PID_FILE" ]; then
        log "No daemon running"
        echo "Daemon is not running"
        return 0
    fi
    
    local daemon_pid=$(cat "$DAEMON_PID_FILE")
    
    if kill -0 "$daemon_pid" 2>/dev/null; then
        log "Stopping daemon (PID: $daemon_pid)..."
        kill "$daemon_pid"
        rm -f "$DAEMON_PID_FILE"
        log "Daemon stopped"
        echo "Daemon stopped"
    else
        log "Daemon PID $daemon_pid not running"
        rm -f "$DAEMON_PID_FILE"
        echo "Daemon was not running"
        fi
}

# Show daemon status
daemon_status() {
    if [ -f "$DAEMON_PID_FILE" ]; then
        local daemon_pid=$(cat "$DAEMON_PID_FILE")
        if kill -0 "$daemon_pid" 2>/dev/null; then
            echo "✅ Daemon is RUNNING"
            echo "   PID: $daemon_pid"
            echo "   Log: $DAEMON_LOG"
            echo "   Projects: $PROJECTS_DIR"
            echo ""
            echo "Recent log entries:"
            tail -10 "$DAEMON_LOG"
        else
            echo "❌ Daemon PID exists but not running"
            rm -f "$DAEMON_PID_FILE"
        fi
    else
        echo "❌ Daemon is NOT running"
    fi
}

# Main function
main() {
    case "$1" in
        --start)
            start_daemon
            ;;
        --stop)
            stop_daemon
            ;;
        --restart)
            stop_daemon
            sleep 2
            start_daemon
            ;;
        --status)
            daemon_status
            ;;
        --execute)
            AUTO_EXECUTE=true
            shift
            start_daemon
            ;;
        *)
            echo "Auto-PRD Daemon - Fully automatic PRD management"
            echo ""
            echo "Usage:"
            echo "  $0 --start        Start daemon in background"
            echo "  $0 --stop         Stop daemon"
            echo "  $0 --restart      Restart daemon"
            echo "  $0 --status       Show daemon status"
            echo "  $0 --execute       Start with auto-task execution"
            echo ""
            echo "The daemon will:"
            echo "  • Auto-discover all projects in $PROJECTS_DIR"
            echo "  • Create PRDs automatically"
            echo "  • Generate and optimize tasks"
            echo "  • Run every $CHECK_INTERVAL seconds"
            echo "  • Log all activity to $DAEMON_LOG"
            echo ""
            echo "To start on boot, add to your shell startup (~/.bashrc):"
            echo "  bash $0 --start"
            ;;
    esac
}

main "$@"
