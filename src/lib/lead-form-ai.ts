export type LeadFormAiMode = 'default' | 'onboarding'

export interface LeadFormAiOption {
    id: string
    label: string
    value: string
    points: number
}

export interface LeadFormAiScoringRule {
    id: string
    keywords: string
    points: number
}

export interface LeadFormAiQuestion {
    question_text: string
    help_text: string | null
    type: 'short_answer' | 'long_answer' | 'email' | 'phone' | 'single_choice' | 'multi_choice' | 'date'
    required: boolean
    options: LeadFormAiOption[]
    ai_weight: number
    scoring_rules: LeadFormAiScoringRule[]
    ideal_answer: string | null
    disqualify_on: string | null
}

export interface LeadFormAiDraft {
    title: string
    description: string
    auto_admit_threshold: number
    ai_criteria: string
    unqualified_message: string
    questions: LeadFormAiQuestion[]
}

const BASE_SYSTEM = `You are a collaborative AI form builder. You work with the host
in a back-and-forth conversation to design a lead qualification form that
decides if a visitor should be auto-admitted into a live meeting.

HOW QUALIFICATION WORKS (you must design for this):
- Each single_choice/multi_choice option has a "points" value. At submit
  time the system sums earned vs. max possible points -> percentage.
  If percentage >= auto_admit_threshold the lead is AUTO-ADMITTED.
- Picking a 0-point option on a scoring question is treated as a HARD
  DISQUALIFY (lead is rejected, shown unqualified_message).
- disqualify_on keywords on a text answer are ALSO a hard disqualify.
- For open-ended questions you can provide scoring_rules (keyword -> pts)
  and an ideal_answer (the system asks an LLM to rate 0-10 how close the
  answer is to the ideal).
- ai_criteria is a natural-language fallback used only when no points are
  set anywhere. Always write it so it appears in the host's UI.

CONVERSATIONAL STYLE:
- If the host's request is vague or missing key info (industry, deal size,
  buying signals, geography, budget, disqualifiers), ASK 1-3 focused
  clarifying questions before producing a draft. Keep questions short.
- Volunteer ideas: suggest qualification angles, disqualifier patterns,
  or scoring gradients the host may not have considered, and ask them to
  confirm.
- Once you have enough signal, return a complete draft. On later turns,
  the host may ask to tweak the draft (add a question, raise a threshold,
  soften wording, etc.) — modify the draft and return the updated version.
- Address the host directly in "reply". Be concise, warm, and concrete.
  No markdown headers, no code fences.

OUTPUT FORMAT (STRICT):
Return ONLY a single valid JSON object, no prose, no code fences.
{
  "reply": string,
  "draft": null | {
    "title": string,
    "description": string,
    "auto_admit_threshold": number,
    "ai_criteria": string,
    "unqualified_message": string,
    "questions": [
      {
        "question_text": string,
        "help_text": string | null,
        "type": "short_answer" | "long_answer" | "email" | "phone" | "single_choice" | "multi_choice" | "date",
        "required": boolean,
        "options": [
          { "label": string, "points": number }
        ],
        "scoring_rules": [
          { "keywords": string, "points": number }
        ] | null,
        "ideal_answer": string | null,
        "disqualify_on": string | null
      }
    ]
  }
}

WHEN YOU RETURN A DRAFT, IT MUST SATISFY:
- Exactly 4-6 questions total. No fluff.
- First question: full name (short_answer, required).
- Include exactly one email question (type=email, required).
- Include AT LEAST 2 qualification gates as single_choice questions.
  Each gate must have 3-5 options with a CLEAR points gradient:
    * 1 option with points=0 (the disqualifier / "not a fit")
    * 1 option with the max points (the ideal fit)
    * intermediate options in between
- Max points per single_choice option should be 10.
- ai_criteria is mandatory and must describe the ideal lead concretely.
- auto_admit_threshold between 55 and 80. Set higher (70-80) when any
  question includes a 0-point disqualifier.

STYLE:
- Questions are specific, not generic. Prefer ranges and concrete options.
- Keep help_text empty (null) unless the question really needs a hint.
- Never ask for SSN, card numbers, passwords, or protected attributes.
- unqualified_message should be warm and brief (<160 chars).`

const ONBOARDING_APPENDIX = `

ONBOARDING MODE:
- This is first-run onboarding.
- Do not ask clarifying questions.
- Make reasonable assumptions from the host prompt.
- Return a complete draft on the first reply.
- If details are missing, choose sensible B2B-friendly qualification gates and keep the draft editable.`

function trimPrompt(prompt: string) {
    return prompt.trim().replace(/\s+/g, ' ').slice(0, 220)
}

export function buildLeadFormAiSystemPrompt(mode: LeadFormAiMode = 'default') {
    return mode === 'onboarding' ? `${BASE_SYSTEM}${ONBOARDING_APPENDIX}` : BASE_SYSTEM
}

function buildOptionId(questionIndex: number, optionIndex: number) {
    return `onboarding_option_${questionIndex}_${optionIndex}`
}

function createChoiceOption(questionIndex: number, optionIndex: number, label: string, points: number): LeadFormAiOption {
    const id = buildOptionId(questionIndex, optionIndex)
    return {
        id,
        label,
        value: id,
        points,
    }
}

function createQuestion(
    question: Omit<LeadFormAiQuestion, 'ai_weight' | 'scoring_rules'> & {
        scoring_rules?: LeadFormAiScoringRule[]
    }
): LeadFormAiQuestion {
    return {
        ...question,
        ai_weight: 1,
        scoring_rules: question.scoring_rules ?? [],
    }
}

export function buildOnboardingFallbackLeadForm(prompt: string): LeadFormAiDraft {
    const summary = trimPrompt(prompt) || 'your offer'

    return {
        title: 'New Lead Qualification Form',
        description: `Quick intake form for prospects interested in ${summary}.`,
        auto_admit_threshold: 70,
        ai_criteria: `Qualified leads are a strong fit for this offer: ${summary}. Prioritize decision-makers with active need and near-term intent.`,
        unqualified_message: "Thanks for sharing a bit about your needs. We'll review this and follow up if it's a fit.",
        questions: [
            createQuestion({
                question_text: 'Full name',
                help_text: null,
                type: 'short_answer',
                required: true,
                options: [],
                ideal_answer: null,
                disqualify_on: null,
            }),
            createQuestion({
                question_text: 'Work email',
                help_text: null,
                type: 'email',
                required: true,
                options: [],
                ideal_answer: null,
                disqualify_on: null,
            }),
            createQuestion({
                question_text: 'Which best describes your role in this decision?',
                help_text: null,
                type: 'single_choice',
                required: true,
                options: [
                    createChoiceOption(2, 0, 'Just researching for myself', 0),
                    createChoiceOption(2, 1, 'Influencer or team member', 4),
                    createChoiceOption(2, 2, 'Primary recommender', 7),
                    createChoiceOption(2, 3, 'Decision-maker or owner', 10),
                ],
                ideal_answer: null,
                disqualify_on: null,
            }),
            createQuestion({
                question_text: 'How soon are you looking to move forward?',
                help_text: null,
                type: 'single_choice',
                required: true,
                options: [
                    createChoiceOption(3, 0, 'Just browsing / no timeline', 0),
                    createChoiceOption(3, 1, 'Later this year', 4),
                    createChoiceOption(3, 2, 'Within 1-3 months', 7),
                    createChoiceOption(3, 3, 'This month', 10),
                ],
                ideal_answer: null,
                disqualify_on: null,
            }),
            createQuestion({
                question_text: 'What are you trying to solve right now?',
                help_text: null,
                type: 'long_answer',
                required: true,
                options: [],
                ideal_answer: summary,
                disqualify_on: null,
            }),
        ],
    }
}
