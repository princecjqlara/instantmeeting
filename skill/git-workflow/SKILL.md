---
name: git-workflow
description: Use when working with git repositories, committing changes, creating pull requests, or managing branches
---

# Git Workflow Skill

When working with git in OpenCode, follow these best practices:

## Git Safety Protocol
- NEVER update the git config unless explicitly requested
- NEVER run destructive/irreversible git commands (like push --force, hard reset, etc) unless explicitly requested
- NEVER skip hooks (--no-verify, --no-gpg-sign, etc) unless explicitly requested
- NEVER run force push to main/master, warn the user if they request it
- Avoid git commit --amend unless all conditions are met

## Creating Commits
1. Check git status to see untracked files
2. Review git diff to understand changes
3. Add relevant files with git add
4. Create commit with clear message focusing on "why" not "what"
5. Verify success with git status

## Creating Pull Requests
1. Push branch with -u flag
2. Create PR using gh pr create with clear title and body
3. Include summary with 1-3 bullet points
4. Reference relevant issues if applicable

## Branch Management
- Use descriptive branch names
- Keep branches focused on single features/fixes
- Regularly sync with main branch