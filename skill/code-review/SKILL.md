---
name: code-review
description: Use when reviewing code, providing feedback, or analyzing code quality
---

# Code Review Skill

When conducting code reviews in OpenCode, focus on these areas:

## Code Quality Checklist
✅ **Functionality** - Does the code work correctly?
✅ **Readability** - Is the code easy to understand?
✅ **Maintainability** - Is the code easy to modify and extend?
✅ **Performance** - Are there any obvious performance issues?
✅ **Security** - Are there any security vulnerabilities?
✅ **Testing** - Are there adequate tests?

## Review Priorities
1. **Critical issues** - Bugs, security vulnerabilities, performance problems
2. **Major issues** - Architecture problems, code smells, design flaws
3. **Minor issues** - Style inconsistencies, documentation gaps, minor optimizations

## OpenCode-Specific Review Tips
- Check if code follows patterns in the existing codebase
- Verify git commits have clear, descriptive messages
- Ensure no secrets are committed (check .env files, credentials)
- Review AGENTS.md for project-specific guidelines
- Consider using the plan agent for analysis without making changes