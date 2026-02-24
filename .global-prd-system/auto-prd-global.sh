#!/bin/bash
# Global Auto-PRD System - Works across ALL projects and future projects
# Run this script to automatically create, optimize, and manage PRDs in any project

set -e

# Global Configuration
GLOBAL_CONFIG="$HOME/.global-prd-system/config"
GLOBAL_LOG="$HOME/.global-prd-system/global.log"
GLOBAL_TEMPLATE="$HOME/.global-prd-system/templates"
GLOBAL_HOOKS="$HOME/.global-prd-system/hooks"

# Ensure directories exist
mkdir -p "$GLOBAL_CONFIG"
mkdir -p "$GLOBAL_LOG"
mkdir -p "$GLOBAL_TEMPLATE"
mkdir -p "$GLOBAL_HOOKS"

# Current project detection
detect_current_project() {
    if [ -f "package.json" ]; then
        PROJECT_NAME=$(node -e "console.log(require('./package.json').name)" 2>/dev/null || echo "unknown")
        PROJECT_TYPE="node"
    elif [ -f "Cargo.toml" ]; then
        PROJECT_NAME=$(grep -E "^name\s*=" Cargo.toml | head -1 | sed 's/name = "\(.*\)"/\1/' | tr -d '"')
        PROJECT_TYPE="rust"
    elif [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "requirements.txt" ]; then
        PROJECT_NAME=$(basename "$(pwd)")
        PROJECT_TYPE="python"
    elif [ -f "pom.xml" ]; then
        PROJECT_NAME=$(grep -E "<artifactId>" pom.xml | head -1 | sed 's/.*<artifactId>\(.*\)<\/artifactId>.*/\1/')
        PROJECT_TYPE="java"
    else
        PROJECT_NAME=$(basename "$(pwd)")
        PROJECT_TYPE="generic"
    fi
    
    PROJECT_PATH=$(pwd)
    PRD_FILE="$PROJECT_PATH/PRD.md"
    YAML_FILE="$PROJECT_PATH/tasks.yaml"
    CONFIG_DIR="$PROJECT_PATH/.ralphy"
    BACKUP_DIR="$PROJECT_PATH/prd-backups"
}

# Logging function
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_message="[${timestamp}] [${PROJECT_NAME}] $1"
    echo "$log_message" | tee -a "$GLOBAL_LOG/$(date '+%Y-%m-%d').log"
}

# Backup PRD files
backup_prd() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    mkdir -p "$BACKUP_DIR"
    
    if [ -f "$PRD_FILE" ]; then
        cp "$PRD_FILE" "$BACKUP_DIR/${PROJECT_NAME}-prd-$timestamp.md" 2>/dev/null || true
        log "Backed up PRD to $BACKUP_DIR/"
    fi
    
    if [ -f "$YAML_FILE" ]; then
        cp "$YAML_FILE" "$BACKUP_DIR/${PROJECT_NAME}-yaml-$timestamp.yaml" 2>/dev/null || true
    fi
}

# Create initial PRD if none exists
ensure_prd_exists() {
    mkdir -p "$CONFIG_DIR"
    
    if [ ! -f "$PRD_FILE" ]; then
        log "No PRD found. Creating initial PRD for $PROJECT_NAME..."
        create_initial_prd
    fi
    
    if [ ! -f "$YAML_FILE" ]; then
        log "Creating YAML PRD for $PROJECT_NAME..."
        create_yaml_prd
    fi
}

# Create initial PRD structure based on project type
create_initial_prd() {
    local template="$GLOBAL_TEMPLATE/prd-${PROJECT_TYPE}.md"
    
    if [ -f "$template" ]; then
        cp "$template" "$PRD_FILE"
        log "Used $PROJECT_TYPE template for PRD"
    else
        cat > "$PRD_FILE" << EOF
# Auto-Generated PRD for $PROJECT_NAME
## Project Overview
**Project Type:** $PROJECT_TYPE
**Project Name:** $PROJECT_NAME
**Last Updated:** $(date '+%Y-%m-%d %H:%M:%S')

## Project Goals
- [ ] Define clear project objectives and success criteria
- [ ] Identify key features and deliverables
- [ ] Establish project timeline and milestones

## Technical Setup
- [ ] Review and optimize project configuration
- [ ] Set up development environment
- [ ] Configure build and test processes
- [ ] Set up code quality tools (linting, formatting)

## Core Features
- [ ] Implement core functionality
- [ ] Add necessary dependencies
- [ ] Create basic project structure
- [ ] Set up data models and schemas

## Code Quality
- [ ] Ensure consistent code style
- [ ] Add comprehensive error handling
- [ ] Implement logging and monitoring
- [ ] Add input validation and sanitization

## Testing
- [ ] Create unit tests for core functionality
- [ ] Add integration tests
- [ ] Set up test coverage reporting
- [ ] Implement CI/CD testing

## Documentation
- [ ] Document API endpoints and functions
- [ ] Create user guides and examples
- [ ] Add inline code comments
- [ ] Set up documentation generation

## Deployment
- [ ] Configure deployment settings
- [ ] Set up environment variables
- [ ] Create deployment scripts
- [ ] Configure monitoring and alerts

## Maintenance
- [ ] Set up dependency updates
- [ ] Configure automated backups
- [ ] Add performance monitoring
- [ ] Implement security scanning

## Auto-Management Rules
1. This PRD is automatically managed by Global Auto-PRD System
2. Tasks will be auto-generated based on codebase analysis
3. Completed tasks will be marked and archived
4. PRD structure will be optimized for AI execution
5. System runs automatically on every project

## AI Commands
- Run: \`ralphy --opencode --prd PRD.md\`
- Watch: \`ralphy --opencode --prd PRD.md --parallel\`
- Debug: \`ralphy --opencode --prd PRD.md --verbose\`
EOF
    fi
    
    log "Created initial PRD at $PRD_FILE"
}

# Create YAML PRD
create_yaml_prd() {
    cat > "$YAML_FILE" << EOF
# Auto-Generated YAML PRD for $PROJECT_NAME
tasks:
  - title: Define project objectives
    completed: false
    priority: "P0"
    effort: "Medium"
    description: "Define clear project objectives and success criteria"
    
  - title: Review project setup
    completed: false
    priority: "P0"
    effort: "Small"
    description: "Review and optimize project configuration and dependencies"
    
  - title: Set up development environment
    completed: false
    priority: "P1"
    effort: "Small"
    description: "Ensure development environment is properly configured"
    
  - title: Implement core functionality
    completed: false
    priority: "P0"
    effort: "Large"
    description: "Implement core features and functionality"
    
  - title: Add comprehensive testing
    completed: false
    priority: "P1"
    effort: "Large"
    description: "Add unit tests, integration tests, and test coverage"
    
  - title: Create documentation
    completed: false
    priority: "P2"
    effort: "Medium"
    description: "Document API, features, and usage examples"
    
  - title: Configure deployment
    completed: false
    priority: "P1"
    effort: "Medium"
    description: "Set up deployment scripts and environment configuration"
    
  - title: Implement monitoring
    completed: false
    priority: "P2"
    effort: "Small"
    description: "Add logging, monitoring, and alerting"
EOF
    
    log "Created YAML PRD at $YAML_FILE"
}

# Analyze codebase and generate tasks
analyze_and_generate_tasks() {
    log "Analyzing codebase for task generation..."
    
    local analysis_results="$CONFIG_DIR/analysis-results.md"
    
    # Create analysis prompt based on project type
    cat > "$CONFIG_DIR/analysis-prompt.md" << EOF
# Codebase Analysis for $PROJECT_NAME

Project Type: $PROJECT_TYPE
Project Path: $PROJECT_PATH

## Analysis Instructions
Analyze this codebase and generate specific, actionable tasks for improvement.
Focus on:

### Code Quality Issues
1. Bugs and potential runtime errors
2. Performance bottlenecks and optimizations
3. Security vulnerabilities and best practices
4. Code smell and technical debt
5. Inconsistent code style or patterns

### Missing Features
1. Incomplete implementations
2. Missing error handling
3. Lack of validation or sanitization
4. Absence of logging or monitoring
5. Missing tests or low test coverage

### Improvements Needed
1. Refactoring opportunities
2. Code duplication
3. Poor abstractions or design patterns
4. Missing documentation
5. Configuration and deployment improvements

### Project-Specific Analysis
EOF
    
    # Add project-specific analysis instructions
    case "$PROJECT_TYPE" in
        node)
            cat >> "$CONFIG_DIR/analysis-prompt.md" << 'EOF'
- Check package.json dependencies for outdated or vulnerable packages
- Review npm scripts for completeness
- Analyze JavaScript/TypeScript code patterns
- Check for proper async/await usage
- Review error handling and try-catch blocks
- Check for proper type definitions (if TypeScript)
- Review file structure and organization
EOF
            ;;
        rust)
            cat >> "$CONFIG_DIR/analysis-prompt.md" << 'EOF'
- Check Cargo.toml for outdated dependencies
- Review Rust code for unsafe blocks
- Analyze error handling and Result types
- Check for proper lifetime usage
- Review borrowing and ownership patterns
- Check for proper use of traits and generics
- Review module organization and visibility
EOF
            ;;
        python)
            cat >> "$CONFIG_DIR/analysis-prompt.md" << 'EOF'
- Check requirements.txt or pyproject.toml for dependencies
- Review Python code for anti-patterns
- Analyze exception handling
- Check for proper use of type hints
- Review virtual environment setup
- Check for security best practices (input validation, etc.)
- Review package structure and __init__.py files
EOF
            ;;
        java)
            cat >> "$CONFIG_DIR/analysis-prompt.md" << 'EOF'
- Check pom.xml for dependencies and plugins
- Review Java code for anti-patterns
- Analyze exception handling
- Check for proper use of generics
- Review package structure and organization
- Check for Maven/Gradle best practices
- Review logging configuration
EOF
            ;;
    esac
    
    cat >> "$CONFIG_DIR/analysis-prompt.md" << 'EOF'
## Output Format
Return tasks in PRD markdown format:
- [ ] Task description (clear and specific)
- [ ] Another task

Prioritize tasks with [P0] [P1] [P2] labels.
Add estimated effort: [Small] [Medium] [Large].
Include technical details where helpful.

Generate 15-25 specific, actionable tasks.
EOF
    
    # Run AI analysis
    log "Running AI codebase analysis..."
    
    # Use OpenCode to analyze
    if command -v opencode &> /dev/null; then
        opencode "Analyze the codebase in $PROJECT_PATH and generate improvement tasks. Use the analysis guidelines in $CONFIG_DIR/analysis-prompt.md. Focus on code quality, missing features, security, and improvements. Return tasks in PRD markdown format with checkboxes." > "$analysis_results" 2>&1
    elif command -v claude &> /dev/null; then
        claude "Analyze the codebase in $PROJECT_PATH and generate improvement tasks. Use the analysis guidelines in $CONFIG_DIR/analysis-prompt.md. Focus on code quality, missing features, security, and improvements. Return tasks in PRD markdown format with checkboxes." > "$analysis_results" 2>&1
    else
        log "No AI tool found. Creating generic tasks..."
        create_generic_tasks > "$analysis_results"
    fi
    
    # Extract and add tasks
    if [ -s "$analysis_results" ]; then
        log "Analysis complete. Extracting tasks..."
        extract_and_add_tasks "$analysis_results"
    fi
}

# Create generic tasks when no AI available
create_generic_tasks() {
    cat << 'EOF'
- [ ] [P0] Review code for potential bugs and errors [Medium]
- [ ] [P0] Check for security vulnerabilities and implement fixes [Medium]
- [ ] [P1] Review and optimize performance bottlenecks [Large]
- [ ] [P1] Add comprehensive error handling throughout codebase [Large]
- [ ] [P1] Implement logging and monitoring [Medium]
- [ ] [P2] Improve code documentation and comments [Medium]
- [ ] [P2] Refactor code to reduce duplication [Medium]
- [ ] [P2] Add input validation and sanitization [Medium]
- [ ] [P2] Review and optimize database queries (if applicable) [Small]
- [ ] [P2] Set up automated testing [Large]
- [ ] [P2] Configure CI/CD pipeline [Medium]
- [ ] [P2] Add environment variable validation [Small]
- [ ] [P2] Implement proper exception handling [Medium]
- [ ] [P2] Add API rate limiting (if applicable) [Small]
- [ ] [P2] Review and update dependencies [Small]
EOF
}

# Extract and add tasks to PRD
extract_and_add_tasks() {
    local analysis_file="$1"
    local new_tasks_file="$CONFIG_DIR/new-tasks.md"
    
    # Extract task-like lines from analysis
    grep -E "^-\s*\[\s*\]|^-\s*\[x\]" "$analysis_file" 2>/dev/null | head -25 > "$new_tasks_file"
    
    # If no tasks found, try other patterns
    if [ ! -s "$new_tasks_file" ]; then
        grep -E "^[0-9]+\.|^[A-Z]" "$analysis_file" 2>/dev/null | sed 's/^/- [ ]/' | head -25 > "$new_tasks_file"
    fi
    
    # If still no tasks, create generic
    if [ ! -s "$new_tasks_file" ]; then
        log "No tasks extracted. Creating generic improvement tasks..."
        create_generic_tasks > "$new_tasks_file"
    fi
    
    # Add tasks to PRD
    if [ -s "$new_tasks_file" ]; then
        local task_count=$(wc -l < "$new_tasks_file")
        log "Adding $task_count tasks to PRD..."
        
        backup_prd
        
        echo "" >> "$PRD_FILE"
        echo "## AI-Generated Tasks $(date '+%Y-%m-%d %H:%M:%S')" >> "$PRD_FILE"
        echo "" >> "$PRD_FILE"
        echo "Tasks generated from codebase analysis:" >> "$PRD_FILE"
        echo "" >> "$PRD_FILE"
        cat "$new_tasks_file" >> "$PRD_FILE"
        
        log "Added $task_count tasks to PRD"
    fi
}

# Optimize PRD structure
optimize_prd() {
    log "Optimizing PRD structure..."
    
    backup_prd
    
    local optimized_file="$CONFIG_DIR/optimized-prd.md"
    
    # Create optimization prompt
    cat > "$CONFIG_DIR/optimize-prompt.md" << EOF
# PRD Optimization for $PROJECT_NAME

## Optimization Instructions
Optimize this PRD for maximum AI execution efficiency:

1. **Group Related Tasks** - Combine similar tasks together
2. **Add Clear Priorities** - Mark with [P0] [P1] [P2] 
3. **Estimate Effort** - Add [Small] [Medium] [Large]
4. **Remove Duplicates** - Eliminate redundant tasks
5. **Add Dependencies** - Note tasks that must complete first
6. **Clear Acceptance Criteria** - Each task should have measurable outcomes
7. **Add Technical Context** - Include relevant files, functions, or systems
8. **Logical Ordering** - Arrange tasks by dependencies and priorities
9. **Merge Small Tasks** - Combine related small tasks
10. **Split Large Tasks** - Break down complex tasks

## Priority Levels
- **P0** - Critical, must do now
- **P1** - Important, should do soon
- **P2** - Nice to have, can wait

## Effort Estimates
- **Small** - < 1 hour
- **Medium** - 1-4 hours
- **Large** - 4+ hours or multi-day

## Output Format
Return the complete optimized PRD in markdown format.
Keep the project overview and goals sections.
Replace the tasks section with optimized version.
EOF
    
    # Run AI optimization
    log "Running PRD optimization..."
    
    if command -v opencode &> /dev/null; then
        opencode "Optimize the PRD at $PRD_FILE. Use the guidelines in $CONFIG_DIR/optimize-prompt.md. Return the complete optimized PRD in markdown format." > "$optimized_file" 2>&1
    else
        log "No AI tool for optimization. Using basic optimization..."
        basic_prd_optimization
    fi
    
    # Apply optimization
    if [ -s "$optimized_file" ] && [ $(wc -l < "$optimized_file") -gt 10 ]; then
        cp "$optimized_file" "$PRD_FILE"
        log "PRD optimized successfully"
    else
        log "PRD optimization did not produce valid output"
    fi
}

# Basic PRD optimization (no AI)
basic_prd_optimization() {
    # Create optimized version with better structure
    local optimized="$CONFIG_DIR/optimized-prd.md"
    
    # Extract existing sections
    local overview=$(sed -n '/^## Project Overview/,/^## /p' "$PRD_FILE" | head -n -1)
    local goals=$(sed -n '/^## Project Goals/,/^## /p' "$PRD_FILE" | head -n -1)
    
    # Extract all tasks
    grep -E "^-\s*\[\s*\]|^-\s*\[x\]" "$PRD_FILE" | sort -u > "$CONFIG_DIR/all-tasks.txt"
    
    # Count tasks
    local total_tasks=$(wc -l < "$CONFIG_DIR/all-tasks.txt")
    
    # Create optimized PRD
    cat > "$optimized" << EOF
# Optimized PRD for $PROJECT_NAME
## Project Overview
$overview

## Project Goals
$goals

## Optimized Tasks ($(date '+%Y-%m-%d %H:%M:%S'))
Total tasks: $total_tasks

### P0 - Critical Tasks
$(grep -i "p0\|critical\|urgent\|important" "$CONFIG_DIR/all-tasks.txt" || echo "No P0 tasks")

### P1 - High Priority Tasks
$(grep -i "p1\|high\|priority\|should" "$CONFIG_DIR/all-tasks.txt" || echo "No P1 tasks")

### P2 - Medium Priority Tasks
$(grep -i "p2\|medium\|nice.*have" "$CONFIG_DIR/all-tasks.txt" || echo "No P2 tasks")

### Other Tasks
$(grep -v -i "p0\|p1\|p2\|critical\|urgent\|important\|high\|priority\|medium" "$CONFIG_DIR/all-tasks.txt" || echo "No other tasks")

## Execution Notes
- This PRD was automatically optimized by Global Auto-PRD System
- Tasks are grouped by priority for efficient execution
- Use \`ralphy --opencode --prd PRD.md\` to execute
EOF
    
    log "Basic optimization completed"
}

# Update YAML PRD
update_yaml_prd() {
    log "Updating YAML PRD..."
    
    backup_prd
    
    # Extract tasks from PRD
    grep -E "^-\s*\[\s*\]|^-\s*\[x\]" "$PRD_FILE" > "$CONFIG_DIR/tasks-for-yaml.txt"
    
    # Convert to YAML
    cat > "$YAML_FILE" << EOF
# Auto-Generated YAML PRD for $PROJECT_NAME
# Last updated: $(date '+%Y-%m-%d %H:%M:%S')
tasks:
EOF
    
    # Convert each task
    while IFS= read -r task; do
        # Clean task
        local clean_task=$(echo "$task" | sed 's/^- \[ \] //' | sed 's/^- \[x\] //')
        
        # Determine if completed
        local completed="false"
        if echo "$task" | grep -q "\[x\]"; then
            completed="true"
        fi
        
        # Extract priority and effort
        local priority="P2"
        local effort="Medium"
        
        if echo "$task" | grep -qi "p0"; then
            priority="P0"
        elif echo "$task" | grep -qi "p1"; then
            priority="P1"
        fi
        
        if echo "$task" | grep -qi "small"; then
            effort="Small"
        elif echo "$task" | grep -qi "large"; then
            effort="Large"
        fi
        
        # Add to YAML
        cat >> "$YAML_FILE" << EOF
  - title: "$clean_task"
    completed: $completed
    priority: "$priority"
    effort: "$effort"
    description: "Auto-generated task from PRD"

EOF
    done < "$CONFIG_DIR/tasks-for-yaml.txt"
    
    log "YAML PRD updated at $YAML_FILE"
}

# Execute tasks from PRD
execute_prd_tasks() {
    log "Executing PRD tasks..."
    
    # Count incomplete tasks
    local incomplete_count=$(grep -c "^-\s*\[\s*\]" "$PRD_FILE" 2>/dev/null || echo "0")
    
    if [ "$incomplete_count" -eq "0" ]; then
        log "All tasks complete! Great job!"
        return 0
    fi
    
    log "Found $incomplete_count incomplete tasks"
    
    # Check if Ralphy is available
    if command -v ralphy &> /dev/null; then
        # Run Ralphy with limit
        local tasks_to_run=$((incomplete_count < 5 ? incomplete_count : 5))
        log "Running $tasks_to_run tasks with Ralphy..."
        
        ralphy --opencode --prd "$PRD_FILE" --max-iterations "$tasks_to_run" --no-commit || true
        
        log "Task execution initiated"
    else
        log "Ralphy not found. Tasks are ready for manual execution."
    fi
}

# Create global git hook
create_global_git_hook() {
    local hook_template="$GLOBAL_HOOKS/post-commit.template"
    
    cat > "$hook_template" << 'EOF'
#!/bin/bash
# Global Auto-PRD Git Hook
# Automatically runs Auto-PRD after every commit

# Get project directory
PROJECT_DIR=$(git rev-parse --show-toplevel)

# Run global Auto-PRD
bash "$HOME/.global-prd-system/auto-prd-global.sh" --project "$PROJECT_DIR" --no-execute

echo "Auto-PRD analysis complete. PRD updated."
EOF
    
    chmod +x "$hook_template"
    
    log "Created global git hook template at $hook_template"
}

# Install git hooks in current project
install_git_hooks() {
    local hooks_dir=".git/hooks"
    
    if [ -d "$hooks_dir" ]; then
        # Install post-commit hook
        cp "$GLOBAL_HOOKS/post-commit.template" "$hooks_dir/post-commit"
        chmod +x "$hooks_dir/post-commit"
        
        log "Installed git hooks in current project"
    else
        log "No .git/hooks directory found. Not in a git repository?"
    fi
}

# Create global watcher script
create_global_watcher() {
    local watcher="$GLOBAL_HOOKS/watcher.sh"
    
    cat > "$watcher" << 'EOF'
#!/bin/bash
# Global Auto-PRD Watcher
# Watches for PRD changes and auto-optimizes

echo "Starting Global Auto-PRD Watcher..."
echo "Press Ctrl+C to stop"

# Check for file watchers
if command -v fswatch &> /dev/null; then
    echo "Using fswatch for file watching..."
    fswatch -o PRD.md tasks.yaml | while read; do
        echo "PRD changed! Running auto-optimization..."
        bash "$HOME/.global-prd-system/auto-prd-global.sh" --no-execute
    done
elif command -v inotifywait &> /dev/null; then
    echo "Using inotifywait for file watching..."
    while true; do
        inotifywait -e modify,close_write PRD.md tasks.yaml 2>/dev/null || break
        echo "PRD changed! Running auto-optimization..."
        bash "$HOME/.global-prd-system/auto-prd-global.sh" --no-execute
    done
else
    echo "No file watcher found. Using polling method..."
    
    local prd_time=$(stat -c %Y PRD.md 2>/dev/null || echo "0")
    local yaml_time=$(stat -c %Y tasks.yaml 2>/dev/null || echo "0")
    
    while true; do
        local current_prd_time=$(stat -c %Y PRD.md 2>/dev/null || echo "0")
        local current_yaml_time=$(stat -c %Y tasks.yaml 2>/dev/null || echo "0")
        
        if [ "$current_prd_time" != "$prd_time" ] || [ "$current_yaml_time" != "$yaml_time" ]; then
            echo "PRD changed! Running auto-optimization..."
            bash "$HOME/.global-prd-system/auto-prd-global.sh" --no-execute
            
            prd_time=$current_prd_time
            yaml_time=$current_yaml_time
        fi
        
        sleep 5
    done
fi
EOF
    
    chmod +x "$watcher"
    
    log "Created global watcher at $watcher"
}

# Create global cron job
create_cron_job() {
    local cron_file="$GLOBAL_HOOKS/automation.cron"
    
    cat > "$cron_file" << 'EOF'
# Global Auto-PRD Cron Job
# Runs auto-PRD daily at 9 AM and 5 PM

# Daily 9 AM - analyze and optimize
0 9 * * * bash $HOME/.global-prd-system/auto-prd-global.sh --all-projects

# Daily 5 PM - execute tasks
0 17 * * * bash $HOME/.global-prd-system/auto-prd-global.sh --all-projects --execute

# Hourly - check for PRD changes (alternative to watcher)
0 * * * * bash $HOME/.global-prd-system/auto-prd-global.sh --check-changes
EOF
    
    log "Created cron job template at $cron_file"
    log "To install: crontab $cron_file"
}

# Main workflow
main() {
    local PROJECT_ARG=""
    local NO_EXECUTE=false
    local ALL_PROJECTS=false
    local INSTALL_HOOKS=false
    local CHECK_CHANGES=false
    
    # Parse arguments
    while [ $# -gt 0 ]; do
        case $1 in
            --project)
                PROJECT_ARG="$2"
                shift 2
                ;;
            --no-execute)
                NO_EXECUTE=true
                shift
                ;;
            --all-projects)
                ALL_PROJECTS=true
                shift
                ;;
            --install-hooks)
                INSTALL_HOOKS=true
                shift
                ;;
            --check-changes)
                CHECK_CHANGES=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    # Create hooks and templates if needed
    [ ! -f "$GLOBAL_HOOKS/post-commit.template" ] && create_global_git_hook
    [ ! -f "$GLOBAL_HOOKS/watcher.sh" ] && create_global_watcher
    [ ! -f "$GLOBAL_HOOKS/automation.cron" ] && create_cron_job
    
    # Handle special modes
    if [ "$INSTALL_HOOKS" = true ]; then
        install_git_hooks
        return 0
    fi
    
    if [ "$CHECK_CHANGES" = true ]; then
        # Simple check for changes
        return 0
    fi
    
    # Detect current project or use provided
    if [ -n "$PROJECT_ARG" ]; then
        cd "$PROJECT_ARG" 2>/dev/null || {
            log "Error: Cannot access project directory $PROJECT_ARG"
            return 1
        }
    fi
    
    detect_current_project
    
    log "Starting Global Auto-PRD System for $PROJECT_NAME"
    log "Project Type: $PROJECT_TYPE"
    log "Project Path: $PROJECT_PATH"
    
    # Ensure PRD exists
    ensure_prd_exists
    
    # Analyze and generate tasks
    analyze_and_generate_tasks
    
    # Optimize PRD structure
    optimize_prd
    
    # Update YAML PRD
    update_yaml_prd
    
    # Execute tasks (if not disabled)
    if [ "$NO_EXECUTE" = false ]; then
        execute_prd_tasks
    fi
    
    log "Global Auto-PRD System completed for $PROJECT_NAME"
    
    # Show summary
    echo ""
    echo "=== Global Auto-PRD Summary ==="
    echo "Project: $PROJECT_NAME"
    echo "Type: $PROJECT_TYPE"
    echo "PRD: $PRD_FILE"
    echo "YAML: $YAML_FILE"
    echo "Incomplete tasks: $(grep -c "^-\s*\[\s*\]" "$PRD_FILE" 2>/dev/null || echo "0")"
    echo "=============================="
    
    # Show next steps
    echo ""
    echo "Next Steps:"
    echo "1. Review PRD: $PRD_FILE"
    echo "2. Execute tasks: ralphy --opencode --prd $PRD_FILE"
    echo "3. Watch for changes: bash $GLOBAL_HOOKS/watcher.sh"
    echo "4. Install cron: crontab $GLOBAL_HOOKS/automation.cron"
}

# Run main function
main "$@"