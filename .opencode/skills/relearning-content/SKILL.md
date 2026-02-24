---
name: relearning-content
description: Creates journal entries or project pages for a personal knowledge site. Use when the user wants to write, publish, or add content - journals, projects, or articles about cognitive engineering, productivity systems, or tool-driven growth.
license: Apache-2.0
compatibility: Requires access to your content repository. Uses create-script and voiceover skills for audio generation.
metadata:
  author: community
  version: "3.0"
---

# Relearning Content Creator

Creates structured journal entries or project pages following a cognitive engineering philosophy and Astro content schema.

## The Philosophy

**Core Mission:** Apply enterprise-grade engineering discipline to the messy reality of being human. Debug sleep, focus, and decision-making as if they were mission-critical infrastructure.

**The Lens:** Every human problem is reframed as a **systems engineering problem**. We don't moralize; we diagnose. We don't motivate; we architect.

**The Promise:** No hype. Just honest metrics. If something failed, log it. If a belief was wrong, document the update.

---

## When to use this skill

**USE THIS SKILL** when the user:
- Wants to create a new journal entry
- Wants to add a new project page
- Says "new journal", "new entry", "write about [topic]"
- Provides content/ideas and wants them formatted for the site
- Wants to document a project, tool, or system they've built

**IMPORTANT**: This skill creates content files. After content is finalized:
1. Use `create-script` skill to condense + add paralinguistic tags → saves `.txt`
2. Use `voiceover` skill on the `.txt` file → generates `.mp3` + deploys + pushes

---

## Workflow Architecture (CRITICAL)

**Your role as the main agent is REVIEWER, not drafter.**

The `google-search` subagent handles:
- Research (finding sources, opposing views)
- Drafting (writing the complete journal entry)
- Citation integration

You handle:
- Repository sync and file management
- Tone/consistency review against standards
- Iteration requests if draft doesn't match voice
- Final file creation and audio pipeline

```
User provides topic/content
        ↓
Step 0: Git pull + determine entry number
        ↓
Step 1: Spawn google-search subagent to DRAFT
        - Subagent researches topic
        - Subagent writes complete journal entry
        - Subagent returns full markdown
        ↓
Step 2: YOU review for tone/consistency
        - Does it match the voice?
        - Engineering metaphors present?
        - Fallacy → Model → Protocol structure?
        - Memorable one-liner ending?
        ↓
Step 3: If lacking, send back to subagent with feedback
        ↓
Step 4: Save final draft to entry-XXX.md
        ↓
Step 5: Present to user for approval
        ↓
Step 6: Audio pipeline (create-script → voiceover)
```

---

## How to Execute This Skill

### Step 0: Sync Repository (ALWAYS DO THIS FIRST)

```bash
cd ~/projects/your-site && git pull origin main
ls src/content/journal/
date +%Y-%m-%d  # Get today's date for the entry
```

Determine the next entry number (e.g., if entry-013.md exists, next is entry-014.md).

**CRITICAL: Use TODAY'S DATE as the publish date.** Run `date +%Y-%m-%d` to get the current date. Do NOT use the date from the user's notes - that is their draft date, not the publish date.

### Step3829/8192 Steps Remaining | Memory: 4098/8192 tokens | Cost: $0.015