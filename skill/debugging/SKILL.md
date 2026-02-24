---
name: debugging
description: Use when debugging code, fixing errors, analyzing logs, or troubleshooting issues
---

# Debugging Skill

When debugging in OpenCode, follow this systematic approach:

## Debugging Workflow
1. **Reproduce the issue** - Understand exactly how to trigger the problem
2. **Check logs** - Look for error messages, stack traces, or warning signs
3. **Isolate the component** - Identify which part of the system is failing
4. **Analyze the code** - Read relevant source code to understand expected behavior
5. **Form a hypothesis** - Make an educated guess about what's causing the issue
6. **Test the hypothesis** - Make changes or add logging to verify your theory
7. **Fix and verify** - Implement the fix and ensure the issue is resolved

## Common Debugging Tools
- Console logs and error messages
- Stack traces and exception details
- Breakpoints in debuggers
- Log files and monitoring tools
- Unit tests and test failures
- Network traffic analysis

## OpenCode-Specific Debugging
- Check AGENTS.md for project-specific guidelines
- Review recent git changes for regressions
- Use the build agent for code analysis
- Use the plan agent for exploration without making changes
- Consider using @general subagent for complex searches