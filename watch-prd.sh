#!/bin/bash
echo "Watching PRD.md for changes..."

# Check if fswatch is available
if command -v fswatch &> /dev/null; then
    echo "Using fswatch..."
    fswatch -o PRD.md | while read; do
        echo "PRD changed! Running Ralphy..."
        ralphy --opencode --prd PRD.md --max-iterations 3
    done
elif command -v inotifywait &> /dev/null; then
    echo "Using inotifywait..."
    while true; do
        inotifywait -e modify PRD.md
        echo "PRD changed! Running Ralphy..."
        ralphy --opencode --prd PRD.md --max-iterations 3
    done
else
    echo "No file watcher found. Install fswatch or inotify-tools."
    echo "Or use polling method..."
    
    # Polling fallback
    last_modified=$(stat -c %Y PRD.md)
    while true; do
        current_modified=$(stat -c %Y PRD.md)
        if [ "$current_modified" != "$last_modified" ]; then
            echo "PRD changed! Running Ralphy..."
            ralphy --opencode --prd PRD.md --max-iterations 3
            last_modified=$current_modified
        fi
        sleep 5
    done
fi