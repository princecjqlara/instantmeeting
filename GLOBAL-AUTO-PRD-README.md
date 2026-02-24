# Global Auto-PRD System

**Automatically creates, optimizes, and manages PRDs across ALL your projects!**

## ✅ Setup Complete!

The Global Auto-PRD System has been installed and configured to work across all projects.

## 🚀 Quick Start

### Run in Any Project
```bash
auto-prd
```

### Run in Current Directory
```bash
bash ~/.global-prd-system/auto-prd.sh
```

### Run in Specific Project
```bash
cd /path/to/project
auto-prd
```

## 🔄 Automatic Execution

### 1. **Git Hook (Auto-Run on Commits)**
Automatically runs `auto-prd` after every commit:
```bash
# Already installed in current project
# To install in other projects:
cp ~/.global-prd-system/hooks/post-commit .git/hooks/
```

### 2. **Manual Watch**
Watch for PRD changes and auto-update:
```bash
# Run every 10 seconds
watch -n 10 bash ~/.global-prd-system/auto-prd.sh

# Or use a dedicated watcher
bash ~/.global-prd-system/watcher.sh
```

### 3. **Cron Job (Scheduled)**
Set up scheduled runs:
```bash
# Edit crontab
crontab -e

# Add daily runs:
# 9 AM - analyze and optimize
0 9 * * * bash ~/.global-prd-system/auto-prd.sh

# 5 PM - execute tasks
0 17 * * * bash ~/.global-prd-system/auto-prd.sh --execute
```

## 📁 Project Detection

The system automatically detects:
- **Node.js** projects (package.json)
- **Rust** projects (Cargo.toml)
- **Python** projects (pyproject.toml, setup.py, requirements.txt)
- **Java** projects (pom.xml)
- **Generic** projects (fallback)

## 🎯 What It Does

For each project, Auto-PRD automatically:

1. **Creates PRD** - If PRD.md doesn't exist, it creates one
2. **Analyzes Codebase** - Examines code structure and dependencies
3. **Generates Tasks** - Creates specific, actionable tasks
4. **Optimizes Structure** - Groups tasks by priority and effort
5. **Creates YAML** - Generates tasks.yaml for Ralphy
6. **Executes Tasks** - Runs Ralphy on incomplete tasks (optional)

## 📊 PRD Structure

Each generated PRD includes:

```markdown
# Auto-Generated PRD for Project-Name

## Project Overview
- Project Name: ...
- Last Updated: ...
- Project Type: ...

## Current Tasks
- [ ] Review project structure
- [ ] Analyze codebase for improvements
- [ ] Set up development environment
- [ ] Implement core features
- [ ] Add comprehensive testing
- [ ] Create documentation
- [ ] Configure deployment
- [ ] Set up monitoring and logging
```

## 🛠️ Configuration

### Global Config
Located at `~/.global-prd-system/`:
- `auto-prd.sh` - Main script
- `hooks/` - Git hooks and watchers
- `logs/` - Execution logs
- `templates/` - PRD templates

### Project Config
Each project gets:
- `PRD.md` - Main PRD file
- `tasks.yaml` - YAML version for Ralphy
- `.ralphy/` - Ralphy configuration
- `prd-backups/` - PRD backups

## 📝 Logs

All executions are logged:
```bash
# View today's log
cat ~/.global-prd-system/logs/$(date '+%Y-%m-%d').log

# View all logs
ls ~/.global-prd-system/logs/
```

## 🎮 Usage Examples

### 1. New Project
```bash
cd ~/projects/my-new-app
auto-prd
# Creates PRD with initial tasks
```

### 2. Existing Project
```bash
cd ~/projects/existing-app
auto-prd
# Analyzes codebase, generates improvement tasks
```

### 3. Review PRD
```bash
cd ~/projects/my-app
cat PRD.md
# View generated tasks
```

### 4. Execute Tasks
```bash
cd ~/projects/my-app
ralphy --opencode --prd PRD.md
# Run tasks with Ralphy
```

### 5. Edit PRD Manually
```bash
cd ~/projects/my-app
nano PRD.md
# Add custom tasks
auto-prd
# Auto-optimizes your changes
```

## 🔧 Customization

### Add Custom Tasks
Edit PRD.md and Auto-PRD will preserve them:
```markdown
## Custom Tasks
- [ ] My specific task
- [ ] Another custom task
```

### Create Project Templates
Add custom templates to `~/.global-prd-system/templates/`:
```bash
# Create Node.js template
cat > ~/.global-prd-system/templates/prd-node.md << 'EOF'
# Node.js PRD Template
## Dependencies
- [ ] Check package.json for outdated packages
- [ ] Review npm scripts
EOF
```

## 🚨 Troubleshooting

### Alias Not Found
```bash
# Reload shell or run manually
source ~/.bashrc
# or
bash ~/.global-prd-system/auto-prd.sh
```

### Ralphy Not Found
```bash
# Install Ralphy
npm install -g ralphy-cli
```

### OpenCode Not Found
```bash
# Install OpenCode
curl -fsSL https://opencode.ai/install | bash
```

## 🎯 Benefits

1. **Works Everywhere** - Same system for all projects
2. **Auto-Detection** - Recognizes different project types
3. **Zero Config** - No setup needed per project
4. **Git Integration** - Auto-runs on commits
5. **Optimization** - Smart task generation
6. **Backup** - Automatic PRD backups
7. **Logging** - Full execution history

## 📈 Future Enhancements

- AI-powered code analysis (using OpenCode directly)
- Task dependency tracking
- Progress visualization
- Multi-project dashboard
- Team collaboration features
- Custom priority schemes

## 🤝 Contributing

To extend the system:
1. Add new templates to `~/.global-prd-system/templates/`
2. Modify `auto-prd.sh` for custom workflows
3. Add hooks to `~/.global-prd-system/hooks/`

## 📞 Support

- **Logs:** `~/.global-prd-system/logs/`
- **Config:** `~/.global-prd-system/auto-prd.sh`
- **Help:** Run `auto-prd --help` (if implemented)

---

**Happy Automating! 🎉**