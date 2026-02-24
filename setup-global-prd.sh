#!/bin/bash
# Setup Global Auto-PRD System

echo "=== Global Auto-PRD System Setup ==="
echo ""

# Create global directory
GLOBAL_DIR="$HOME/.global-prd-system"
echo "Creating global directory: $GLOBAL_DIR"
mkdir -p "$GLOBAL_DIR"
mkdir -p "$GLOBAL_DIR/hooks"
mkdir -p "$GLOBAL_DIR/logs"
mkdir -p "$GLOBAL_DIR/templates"

# Copy auto-prd-global.sh if it exists
if [ -f "auto-prd-global.sh" ]; then
    cp auto-prd-global.sh "$GLOBAL_DIR/"
    chmod +x "$GLOBAL_DIR/auto-prd-global.sh"
    echo "Copied auto-prd-global.sh to global directory"
fi

# Create simple global script
cat > "$GLOBAL_DIR/auto-prd.sh" << 'EOF'
#!/bin/bash
# Global Auto-PRD - Simple version

PROJECT_NAME=$(basename "$(pwd)")
PRD_FILE="PRD.md"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

main() {
    log "Auto-PRD for $PROJECT_NAME"
    
    # Create PRD if doesn't exist
    if [ ! -f "$PRD_FILE" ]; then
        log "Creating PRD..."
        cat > "$PRD_FILE" << PRD
# Auto-Generated PRD for $PROJECT_NAME
## Project Overview
- Project Name: $PROJECT_NAME
- Last Updated: $(date '+%Y-%m-%d %H:%M:%S')

## Current Tasks
- [ ] Review project structure
- [ ] Analyze codebase for improvements
- [ ] Set up development environment
- [ ] Implement core features
- [ ] Add comprehensive testing
- [ ] Create documentation
- [ ] Configure deployment
- [ ] Set up monitoring and logging

## Auto-Management
- This PRD is automatically managed
- Tasks will be optimized based on code analysis
- Use: ralphy --opencode --prd PRD.md
PRD
        log "Created PRD at $PRD_FILE"
    else
        log "PRD exists at $PRD_FILE"
    fi
    
    # Count tasks
    local total=$(grep -c "^-\s*\[" "$PRD_FILE" 2>/dev/null || echo "0")
    local incomplete=$(grep -c "^-\s*\[\s*\]" "$PRD_FILE" 2>/dev/null || echo "0")
    
    log "Total tasks: $total"
    log "Incomplete: $incomplete"
    
    # Run Ralphy if available
    if command -v ralphy &> /dev/null && [ "$incomplete" -gt 0 ]; then
        log "Running Ralphy on PRD..."
        ralphy --opencode --prd "$PRD_FILE" --max-iterations 3 || true
    fi
}

main "$@"
EOF

chmod +x "$GLOBAL_DIR/auto-prd.sh"

echo "Created global script: $GLOBAL_DIR/auto-prd.sh"
echo ""

# Create git hook template
cat > "$GLOBAL_DIR/hooks/post-commit" << 'EOF'
#!/bin/bash
# Auto-PRD Post-Commit Hook
PROJECT_DIR=$(git rev-parse --show-toplevel)
cd "$PROJECT_DIR"
bash "$HOME/.global-prd-system/auto-prd.sh"
EOF

chmod +x "$GLOBAL_DIR/hooks/post-commit"
echo "Created git hook template: $GLOBAL_DIR/hooks/post-commit"
echo ""

# Create alias for easy use
ALIAS_CMD='alias auto-prd="bash $HOME/.global-prd-system/auto-prd.sh"'

# Check shell type
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_RC="$HOME/.bashrc"
else
    SHELL_RC="$HOME/.bashrc"
fi

echo ""
echo "=== Add to your $SHELL_RC ==="
echo ""
echo "$ALIAS_CMD"
echo ""

# Ask to add alias
if command -v grep &> /dev/null && ! grep -q "alias auto-prd" "$SHELL_RC" 2>/dev/null; then
    read -p "Add alias to $SHELL_RC? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "" >> "$SHELL_RC"
        echo "# Global Auto-PRD System" >> "$SHELL_RC"
        echo "$ALIAS_CMD" >> "$SHELL_RC"
        echo "Alias added! Run: source $SHELL_RC"
    fi
fi

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Usage:"
echo "  auto-prd              # Run in current project"
echo "  bash $GLOBAL_DIR/auto-prd.sh  # Run directly"
echo ""
echo "To auto-run on git commits:"
echo "  cp $GLOBAL_DIR/hooks/post-commit .git/hooks/"
echo ""
echo "To watch for changes:"
echo "  watch -n 10 bash $GLOBAL_DIR/auto-prd.sh"
echo ""