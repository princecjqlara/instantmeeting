#!/bin/bash
# Auto PRD System - Creates, optimizes, and manages PRDs automatically

set -e

# Configuration
PRD_FILE="PRD.md"
YAML_FILE="tasks.yaml"
CONFIG_DIR=".ralphy"
LOG_FILE="auto-prd.log"
BACKUP_DIR="prd-backups"
MAX_TASKS_PER_RUN=5
AI_ENGINE="--opencode"

# Ensure directories exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$CONFIG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Backup PRD files
backup_prd() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    cp "$PRD_FILE" "$BACKUP_DIR/${PRD_FILE}.$timestamp" 2>/dev/null || true
    cp "$YAML_FILE" "$BACKUP_DIR/${YAML_FILE}.$timestamp" 2>/dev/null || true
    log "Backed up PRD files to $BACKUP_DIR/"
}

# Create initial PRD if none exists
ensure_prd_exists() {
    if [ ! -f "$PRD_FILE" ]; then
        log "No PRD found. Creating initial PRD..."
        create_initial_prd
    fi
}

# Create initial PRD structure
create_initial_prd() {
    cat > "$PRD_FILE" << 'EOF'
# Auto-Generated PRD
## Project Overview
This PRD is automatically managed by the Auto-PRD System.

## Tasks
- [ ] Review and optimize this PRD structure
- [ ] Add project-specific tasks based on codebase analysis
- [ ] Create detailed implementation plans

## Guidelines
- Tasks should be specific, measurable, and achievable
- Each task should have clear acceptance criteria
- Tasks should be prioritized by importance and dependencies
- Use checkboxes [ ] for incomplete, [x] for complete tasks

## Auto-Management Rules
1. System will automatically add, update, and optimize tasks
2. Completed tasks will be marked and archived
3. New tasks will be generated based on code analysis
4. PRD structure will be optimized for AI execution
EOF
    log "Created initial PRD at $PRD_FILE"
}

# Analyze codebase and generate tasks
analyze_and_generate_tasks() {
    log "Analyzing codebase for task generation..."
    
    # Create analysis prompt for AI
    local analysis_prompt=$(cat << 'EOF'
Analyze the current codebase and generate specific, actionable tasks for improvement.
Focus on:
1. Code quality issues (bugs, performance, security)
2. Missing features or incomplete implementations
3. Technical debt and refactoring opportunities
4. Documentation needs
5. Testing gaps

Return tasks in PRD markdown format with checkboxes.
EOF
)
    
    # Save analysis to temporary file
    echo "$analysis_prompt" > /tmp/analysis_prompt.txt
    
    # Run AI analysis
    log "Running AI analysis..."
    ralphy $AI_ENGINE "Analyze this codebase and generate improvement tasks. Use the prompt in /tmp/analysis_prompt.txt" > /tmp/ai_analysis.md 2>&1
    
    # Extract tasks from AI output
    extract_tasks_from_analysis
}

# Extract tasks from AI analysis
extract_tasks_from_analysis() {
    log "Extracting tasks from AI analysis..."
    
    # Look for task patterns in AI output
    grep -E "^-\s*\[\s*\]|^[0-9]+\.|^###" /tmp/ai_analysis.md | head -20 > /tmp/extracted_tasks.txt
    
    # If we found tasks, add them to PRD
    if [ -s /tmp/extracted_tasks.txt ]; then
        log "Found tasks in analysis. Adding to PRD..."
        
        # Backup before modifying
        backup_prd
        
        # Add new tasks section
        echo "" >> "$PRD_FILE"
        echo "## AI-Generated Tasks $(date '+%Y-%m-%d')" >> "$PRD_FILE"
        echo "" >> "$PRD_FILE"
        cat /tmp/extracted_tasks.txt >> "$PRD_FILE"
        
        log "Added $(wc -l < /tmp/extracted_tasks.txt) new tasks to PRD"
    else
        log "No tasks extracted from analysis"
    fi
}

# Optimize PRD structure
optimize_prd() {
    log "Optimizing PRD structure..."
    
    backup_prd
    
    # Create optimization prompt
    local optimize_prompt=$(cat << 'EOF'
Optimize this PRD for AI execution:
1. Group related tasks together
2. Add clear priorities (P0, P1, P2)
3. Add estimated effort (Small, Medium, Large)
4. Remove duplicate or redundant tasks
5. Add dependencies between tasks
6. Ensure each task has clear acceptance criteria
7. Add technical details and context where needed

Return the optimized PRD in markdown format.
EOF
)
    
    echo "$optimize_prompt" > /tmp/optimize_prompt.txt
    
    # Run AI optimization
    log "Running PRD optimization..."
    ralphy $AI_ENGINE "Optimize the PRD at $PRD_FILE using guidelines in /tmp/optimize_prompt.txt" > /tmp/optimized_prd.md 2>&1
    
    # Check if optimization produced output
    if [ -s /tmp/optimized_prd.md ] && [ $(wc -l < /tmp/optimized_prd.md) -gt感到很抱歉，我还没有学会回答这个问题。如果你有其他问题，我非常乐意为你提供帮助。]; then
        # Replace PRD with optimized version
        cp /tmp/optimized_prd.md "$PRD_FILE"
        log "PRD optimized successfully"
    else
        log "PRD optimization did not produce output"
    fi
}

# Convert PRD to YAML format
convert_to_yaml() {
    log "Converting PRD to YAML format..."
    
    # Simple conversion logic
    cat > "$YAML_FILE" << 'EOF'
tasks:
EOF
    
    # Extract tasks from PRD and convert to YAML
    grep -E "^-\s*\[\s*\]" "$PRD_FILE" | head -20 | while read task; do
        # Clean up task description
        local clean_task=$(echo "$task" | sed 's/^- \[ \] //' | sed 's/^- \[x\] //')
        
        # Determine if completed
        if echo "$task" | grep -q "^-\s*\[x\]"; then
            local completed="true"
        else
            local completed="false"
        fi
        
        # Add to YAML
        cat >> "$YAML_FILE" << EOF
  - title: "$clean_task"
    completed: $completed
    priority: "P2"
    effort: "Medium"
EOF
    done
    
    log "Converted to YAML at $YAML_FILE"
}

# Execute tasks from PRD
execute_prd_tasks() {
    log "Executing PRD tasks..."
    
    # Count incomplete tasks
    local incomplete_count=$(grep -c "^-\s*\[\s*\]" "$PRD_FILE" 2>/dev/null || echo "0")
    
    if [ "$incomplete_count" -eq "0" ]; then
        log "No incomplete tasks found"
        return 0
    fi
    
    log "Found $incomplete_count incomplete tasks"
    
    # Run Ralphy on PRD with limit
    local tasks_to_run=$((incomplete_count < MAX_TASKS_PER_RUN ? incomplete_count : MAX_TASKS_PER_RUN))
    log "Running $tasks_to_run tasks..."
    
    ralphy $AI_ENGINE --prd "$PRD_FILE" --max-iterations "$tasks_to_run" --no-commit
    
    # Update PRD with completed tasks
    update_prd_after_execution
}

# Update PRD after task execution
update_prd_after_execution() {
    log "Updating PRD with completion status..."
    
    # This would ideally parse Ralphy output to mark completed tasks
    # For now, we'll add a timestamp marker
    echo "" >> "$PRD_FILE"
    echo "## Last Execution: $(date '+%Y-%m-%d %H:%M:%S')" >> "$PRD_FILE"
    echo "- Tasks executed via Auto-PRD System" >> "$PRD_FILE"
    
    log "PRD updated with execution timestamp"
}

# Main workflow
main() {
    log "Starting Auto-PRD System..."
    
    # Ensure PRD exists
    ensure_prd_exists
    
    # Analyze and generate tasks
    analyze_and_generate_tasks
    
    # Optimize PRD structure
    optimize_prd
    
    # Convert to YAML
    convert_to_yaml
    
    # Execute tasks
    execute_prd_tasks
    
    log "Auto-PRD System completed"
    
    # Show summary
    echo ""
    echo "=== Auto-PRD System Summary ==="
    echo "PRD File: $PRD_FILE"
    echo "YAML File: $YAML_FILE"
    echo "Backups: $BACKUP_DIR/"
    echo "Log: $LOG_FILE"
    echo "Incomplete tasks: $(grep -c "^-\s*\[\s*\]" "$PRD_FILE" 2>/dev/null || echo "0")"
    echo "==============================="
}

# Run main function
main "$@"