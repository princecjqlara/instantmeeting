---
name: voiceover
description: Generates audio narration from a text file using Chatterbox TTS. Use when the user wants to generate voiceover/audio from ANY text file.
license: Apache-2.0
compatibility: Requires Python with torch, torchaudio, numpy, pyloudnorm, pydub, and chatterbox installed. GPU recommended. Requires ffmpeg for MP3 encoding.
metadata:
  author: community
  version: "8.0"
---

# Voiceover

Generates voiceover audio from a text file using Chatterbox TTS with voice cloning. Outputs MP3 format directly. **Supports automatic deployment and git push!**

## The Pipeline

```
[Content]
    ↓
create-script skill (REQUIRED FOR QUALITY)
    - Condenses content ~50%
    - Adds paralinguistic tags ([chuckle], [sigh], etc.)
    - Rewrites for conversational speech
    ↓
[filename].txt
    ↓
voiceover skill (YOU ARE HERE)
    - TTS generation with Chatterbox
    - Deploy to site
    - Git push
    ↓
[filename].mp3 published
```

**IMPORTANT:** For high-quality voiceovers, ALWAYS use the `create-script` skill first. The `--transform` flag only does basic markdown stripping—no condensation, no paralinguistic tags.

---

## When to Use This Skill

**USE THIS SKILL** when the user:
- Has a `.txt` script file ready (created by `create-script` skill)
- Says "voiceover", "generate audio", "create narration"
- Wants to convert a prepared script to audio

**IMPORTANT:** If the user provides raw content (markdown, URL, article), use the `create-script` skill FIRST to prepare it, THEN use this skill on the resulting `.txt` file.

---

## Project Location

**Chatterbox Directory:** `~/projects/chatterbox` (configure to your setup)

- **Script files (.txt):** `~/projects/chatterbox/archive/`
- **Output files (.mp3):** `~/projects/chatterbox/archive/`
- **Voice reference:** `~/projects/chatterbox/clone.wav`
- **Log file:** `~/projects/chatterbox/voiceover.log`

---

## CLI Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `-i, --input` | `article.txt` | Input text file (use `.txt` from create-script) |
| `-o, --output` | `<input>.mp3` | Output MP3 file (auto-generated if omitted) |
| `-v, --voice` | `clone.wav` | Voice reference for cloning |
| `-e, --entry` | none | Journal entry name (e.g., `entry-011`) for frontmatter update |
| `--deploy` | off | Copy MP3 to site `public/audio/` after generation |
| `--push` | off | Git add, commit, and push to remote (implies `--deploy`) |
| `-m, --message` | auto | Custom git commit message |
| `--preflight` | off | Run pre-flight checks only (no generation) |

---

## Instructions

### Step 1: Verify the Input File Exists

Ensure the input `.txt` file exists in the `archive/` directory:

```bash
ls ~/projects/chatterbox/archive/entry-XXX.txt
```

If the user provides raw markdown or content, **STOP** and use `create-script` first.

### Step 2: Launch in Background

**CRITICAL:** Use `uv run` from the chatterbox root directory.

```bash
cd ~/projects/chatterbox && nohup uv run python archive/voiceover_script.py \
  -i archive/entry-XXX.txt \
  -o archive/entry-XXX.mp3 \
  --entry entry-XXX \
  --push > voiceover.log 2>&1 &
```

### Step 3: Verify It Started (ONE CHECK ONLY)

Wait briefly and check the log **once**:

```bash
sleep 5 && head -10 ~/projects/chatterbox/voiceover.log
```

Expected output:
```
Using device: cuda
Loading model...
Fetching 10 files: 100%|██████████| 10/10 [00:00<?, ?it/s]
```

**CRITICAL: DO NOT poll for progress repeatedly.** This floods the context window. Trust the script to complete.

### Step 4: Inform the User and Move On

Tell the user:

1. Voiceover generation launched in background
2. Input: `archive/entry-XXX.txt`
3. Output: `archive/entry-XXX.mp3`
4. Will auto-deploy and push when complete
5. Desktop notification will appear when done
6. Monitor (optional): `tail -f ~/projects/chatterbox/voiceover.log`

**Then you are DONE with this task.** Do not wait for completion or check progress again.

---

## What the Script Does (Fire and Forget)

When `--push` is used, the script automatically:
1. Generates the MP3 with voice cloning
2. Copies MP3 to `your-site/public/audio/`
3. Updates journal frontmatter with `audioUrl`
4. Runs `git pull` to sync
5. Stages audio file and journal entry
6. Commits with message: "Add entry-XXX with audio narration"
7. Pushes to GitHub
8. Sends desktop notification

**You don't need to monitor any of this.** The script is self-contained.

---

## Examples

### Example 1: Full workflow with push

```bash
cd ~/projects/chatterbox && nohup uv run python archive/voiceover_script.py \
  -i archive/entry-013.txt \
  -o archive/entry-013.mp3 \
  --entry entry-013 \
  --push > voiceover.log 2>&1 &
```

Then verify started:
```bash
sleep 5 && head -10 voiceover.log
```

Done. Move on.

### Example 2: Deploy only (no push)

```bash
cd ~/projects/chatterbox && nohup uv run python archive/voiceover_script.py \
  -i archive/entry-010.txt \
  -o archive/entry-010.mp3 \
  --deploy > voiceover.log 2>&1 &
```

### Example 3: Generation only

```bash
cd ~/projects/chatterbox && nohup uv run python archive/voiceover_script.py \
  -i archive/my_script.txt \
  -o archive/final_audio.mp3 > voiceover.log 2>&1 &
```

### Example 4: Pre-flight check

```bash
cd ~/projects/chatterbox && uv run python archive/voiceover_script.py --preflight
```

---

## Output Specifications

The script produces an MP3 file with:
- 192kbps bitrate
- Normalized to -19 LUFS
- 0.5 second gaps between chunks

---

## Desktop Notifications

The script sends notifications via `notify-send`:
- **Success with push:** "Voiceover Complete - [file] generated, deployed, and pushed to GitHub!"
- **Success with deploy:** "Voiceover Complete - [file] generated and deployed"
- **Success (generation only):** "Voiceover Complete - [file] generated successfully!"

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `ModuleNotFoundError: No module named 'chatterbox'` | Check pyproject.toml package configuration |
| `No such file or directory` | Verify input file path and existence |
| `CUDA out of memory` | Reduce chunk size or run on CPU (slower) |
| `pydub.exceptions.CouldntEncodeError` | Install ffmpeg: `sudo apt install ffmpeg` |
| Git push fails | Check for uncommitted changes or network issues |

---

## Quick Reference

```bash
# Launch voiceover with push
cd ~/projects/chatterbox && nohup uv run python archive/voiceover_script.py \
  -i archive/entry-XXX.txt \
  -o archive/entry-XXX.mp3 \
  --entry entry-XXX \
  --push > voiceover.log 2>&1 &

# Verify started (ONE CHECK ONLY)
sleep 5 && head -10 voiceover.log

# DONE - do not poll for progress
```

---

## Critical Reminders

- **ONE startup check only** - do not poll for progress
- **Fire and forget** - trust the script to complete
- **Desktop notification** - user will know when done
- **Don't flood context** - repeated log checks waste tokens