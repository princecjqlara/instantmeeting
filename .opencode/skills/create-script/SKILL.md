---
name: create-script
description: Transforms content into a voiceover-ready script optimized for Chatterbox TTS. Use when the user provides ANY content for voiceover - URLs, raw text, video scripts, notes, or asks to "create a script" for audio.
license: Apache-2.0
compatibility: Requires web fetching capability (for URLs) and LLM processing. No external scripts needed.
metadata:
  author: community
  version: "5.0"
---

# Create Script

Transforms ANY content into a **condensed, natural, engaging voiceover script** with paralinguistic tags for Chatterbox TTS.

## The Core Purpose

This skill does what regex can't:

1. **CONDENSATION** — Turn a 10-minute article into a 5-minute narration by:
   - Removing redundant explanations
   - Cutting verbose academic language
   - Preserving key insights while trimming filler
   - Maintaining narrative flow despite cuts

2. **PARALINGUISTIC TAGS** — Add natural human expressions:
   - `[chuckle]` — Light amusement, self-deprecating humor
   - `[sigh]` — Resignation, frustration, or relief
   - `[laugh]` — Genuine laughter at absurdity or joy
   - `[gasp]` — Surprise, realization
   - `[clear throat]` — Transition, emphasis shift
   - `[sniff]` — Emotional moment, reflection

3. **CONVERSATIONAL REWRITE** — Transform written prose into spoken flow:
   - Break complex sentences into digestible chunks
   - Add rhetorical pauses (paragraph breaks)
   - Convert passive to active voice
   - Make abstract concepts concrete

---

## When to Use This Skill

**USE THIS SKILL** when the user:
- Provides raw text/content and wants a voiceover (e.g., "do voiceover on this: [content]")
- Provides a video script, notes, or outline to convert to audio
- Shares a URL to convert to audio narrative
- Says "create a script" or "make this into a voiceover script"
- Has a journal entry/article and wants a **condensed audio version**
- Provides content with timestamps, bullet points, or formatting to clean up

**IMPORTANT**: This skill creates the `.txt` script file. After creating it, use the `voiceover` skill to generate audio from the `.txt` file.

---

## How to Execute This Skill

### Step 1: Determine the Output Filename

Ask yourself: What should this script be named?
- **For journal entries:** Use the entry name (e.g., `entry-011.txt`)
- **For URLs:** Use the URL slug (e.g., for `https://example.com/article-name`, use `article-name.txt`)
- **For raw content:** Use a descriptive name (e.g., `productivity_tips.txt`)
- **User-specified:** Use whatever filename the user provides

**Output location:** `~/projects/chatterbox/archive/` (or your configured output directory)

### Step 2: Transform the Content

Apply these transformations **in order**:

#### 2.1: CONDENSE (The Critical Step)

**Target: ~50% reduction in length while preserving all key insights.**

Remove or compress:
- Redundant examples (keep 1 of 3 similar examples)
- Academic citations in full (convert to conversational: "researchers found that...")
- Lengthy introductions (get to the point faster)
- Repetitive conclusions (one strong closing statement)
- Tangential asides (unless they're compelling stories)
- Lists longer than 3-4 items (summarize or pick the best)

Preserve:
- Core thesis and key arguments
- Memorable metaphors and analogies
- Specific statistics and findings
- Action items and protocols
- Opening hooks and closing one-liners

**Example of condensation:**

*Original (verbose):*
> "Research conducted by Baumeister and colleagues in 1998, which was subsequently replicated by numerous studies over the following two decades, demonstrated conclusively that willpower operates much like a muscle—it can become fatigued through repeated use, a phenomenon they termed 'ego depletion.' This finding has profound implications for how we structure our days."

*Condensed (for speech):*
> "Baumeister's research showed that willpower works like a muscle. Use it too much, and it gets tired. [clear throat] This changes everything about how we should structure our days."

#### 2.2: ADD PARALINGUISTIC TAGS

Insert tags where a human narrator would naturally express emotion:

| Tag | When to Use |
|-----|-------------|
| `[chuckle]` | Self-deprecating moments, absurd realizations, light humor |
| `[sigh]` | Frustration, resignation, relief after tension |
| `[laugh]` | Genuine amusement, absurdity, joy |
| `[gasp]` | Surprise, sudden realization, shock |
| `[clear throat]` | Topic transition, about to say something important |
| `[sniff]` | Emotional reflection, poignant moment |
| `[groan]` | Frustration, bad news, difficult admission |
| `[shush]` | Rarely used - conspiratorial whisper |
| `[cough]` | Rarely used - awkward moment |

**Guidelines for tag placement:**
- Use **sparingly** — 3-6 tags per 1000 words maximum
- Place BEFORE the relevant sentence, not mid-sentence
- Match the content's emotional tone
- Don't force humor where there is none

**Example:**
> "[sigh] I spent three weeks optimizing a system that, in hindsight, didn't need to exist. [chuckle] Classic engineer move."

**NEVER USE:** `[pause]`, `[breath]`, `[emphasis]`, `[slower]`, `[faster]` — Chatterbox TTS ignores these completely.

#### 2.3: REWRITE FOR SPEECH

- Convert written style → conversational spoken style
- Break long sentences (>25 words) into shorter ones
- Use contractions ("don't" not "do not")
- Add rhetorical questions to engage listeners
- Use direct address ("you" and "we")
- Create paragraph breaks for natural pauses

**Symbol conversions:**
- `%` → "percent"
- `$` → "dollars"
- `&` → "and"
- `@` → "at"
- `#` → "number" (or skip if hashtag context)
- `→` → "leads to" / "becomes"
- `≈` → "approximately"

**Remove:**
- Timestamps, bullet markers, section numbers
- "Click here", "see image below", visual references
- Markdown formatting (`**`, `*`, `` ` ``, etc.)
- Code blocks (unless you can describe them naturally)
- Footnotes (integrate key info into prose)

#### 2.4: ENSURE FLOW

- **Opening hook:** Start with something compelling (not "In this article...")
- **Transitions:** Use bridging phrases between major sections
- **Pacing:** Vary sentence length for rhythm
- **Closing:** End with a memorable one-liner or call to reflection

### Step 3: Save the Script

Write the transformed content to your configured output directory:
```
~/projects/chatterbox/archive/[filename].txt
```

### Step 4: Report Back

Tell the user:
1. **Filename:** The script file created
2. **Word count:** Original vs. condensed (show reduction %)
3. **Estimated duration:** ~150 words/minute for narration
4. **Paralinguistic tags added:** List them
5. **Next step:** Ready for the `voiceover` skill

---

## Example Transformation

### Input (Journal Entry Excerpt - 180 words):

> ## The Physics of Decision Fatigue
>
> Research conducted by Baumeister et al. (1998) demonstrated through a series of elegant experiments that our capacity for self-control operates much like a muscle—subject to fatigue through repeated exertion. This phenomenon, which they termed "ego depletion," has been subsequently validated by over 100 studies, though some recent replications (Hagger et al., 2016) have shown smaller effect sizes.
>
> The implications are significant. When we force ourselves to make decisions repeatedly throughout the day, we deplete this finite resource. By evening, the average person has made an estimated 35,000 decisions, leaving the cognitive "muscle" exhausted.
>
> * Morning decisions: typically higher quality
> * Afternoon decisions: moderate quality
> * Evening decisions: prone to shortcuts and impulse
>
> The solution isn't to "try harder"—that approach ignores the biological reality. Instead, we must architect our environments to minimize low-value decisions, preserving our cognitive reserves for what truly matters.

### Output (Condensed Script - 95 words, 47% reduction):

> Baumeister's research showed that willpower works like a muscle. Use it too much, and it gets tired.
>
> [clear throat] Here's the thing. By evening, the average person has made thirty-five thousand decisions. Thirty-five thousand. Your cognitive muscle is exhausted.
>
> [sigh] And the solution isn't to "try harder." That ignores biology.
>
> Instead, we need to architect our environments. Eliminate the low-value decisions. Save your mental reserves for what actually matters.
>
> [chuckle] Stop debugging yourself. Debug your environment.

**Report:**
- Original: 180 words → Condensed: 95 words (47% reduction)
- Estimated duration: ~38 seconds
- Tags added: `[clear throat]`, `[sigh]`, `[chuckle]`
- Ready for `voiceover` skill

---

## Edge Cases

### Very Short Content (<200 words)
Don't condense heavily. Focus on adding natural tags and speech flow.

### Technical Content
- Keep essential terminology but explain jargon conversationally
- Spell out acronyms on first use if uncommon
- Common acronyms (AI, API, CPU) can stay as-is

### Emotional/Personal Content
- More liberal use of `[sigh]`, `[sniff]`, `[chuckle]`
- Preserve vulnerability and authentic moments
- Don't over-condense personal stories

### Lists and Protocols
- Condense to top 3-4 items maximum
- Use "first... second... finally" structure for audio
- Or summarize: "There are five key steps, but the most important is..."

---

## Output Format

The script should:
- Read naturally when spoken aloud
- Use short, digestible sentences (15-25 words max)
- Have paragraph breaks for natural pauses
- Include 3-6 paralinguistic tags per 1000 words
- Be saved as a `.txt` file in your configured output directory

---

## Workflow Integration

This skill is part of the content-to-audio pipeline:

```
[Content/URL/Article]
        ↓
   create-script (YOU ARE HERE)
   - Condense ~50%
   - Add paralinguistic tags
   - Rewrite for speech
        ↓
   [filename].txt saved
        ↓
   voiceover skill
   - TTS generation
   - Deploy + Push
        ↓
   [filename].mp3 published
```

**IMPORTANT:** After creating the script, tell the user it's ready and they can proceed with the `voiceover` skill, OR if they said "then voiceover" in their original request, proceed directly to the voiceover skill.