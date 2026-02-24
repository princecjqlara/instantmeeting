---
name: testing
description: Use when writing tests, running test suites, or debugging test failures
---

# Testing Skill

When working with tests in OpenCode:

## Test Types to Consider
- **Unit tests** - Test individual functions/modules in isolation
- **Integration tests** - Test interactions between components
- **End-to-end tests** - Test complete user workflows
- **Performance tests** - Test system performance under load
- **Security tests** - Test for vulnerabilities

## Test Writing Guidelines
1. **Arrange** - Set up test data and environment
2. **Act** - Execute the code being tested
3. **Assert** - Verify expected outcomes
4. **Clean up** - Restore original state

## Test Quality Checklist
✅ **Deterministic** - Tests produce same results every time
✅ **Independent** - Tests don't depend on each other
✅ **Fast** - Tests run quickly
✅ **Clear** - Test failures are easy to understand
✅ **Comprehensive** - Tests cover edge cases and error conditions

## OpenCode Testing Workflow
1. Check project structure for existing test frameworks
2. Run existing test suite to establish baseline
3. Write new tests following project patterns
4. Run tests locally before committing
5. Ensure tests pass in CI/CD environment