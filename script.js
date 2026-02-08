// ═══════════════════════════════════════════════════════════
//  DO IT — Clarity-First Execution Platform
//  AI-Driven Conversation with Option-Based Structured Questions
// ═══════════════════════════════════════════════════════════

const GEMINI_API_KEY = 'AIzaSyAh3FZYTUJoR9iHd5qytMOUwIT2hBSTSzg';

// Try multiple model endpoints as fallback
const GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest'
];
let lastError = ''; // Track last API error for display

// ─── State ───
let userRole = '';
let conversationLog = [];
let structuredAnswers = {};   // key-value store for structured answers
let structuredQueueIndex = 0; // current position in structured questions
let inStructuredPhase = true; // true = option questions, false = AI free-text
let clarityState = {
    identity: false, context: false, goal: false,
    position: false, resources: false, constraints: false, friction: false
};
let extractedProfile = {};
let generatedPlan = '';
let isProcessing = false;

// ═══════════════════════════════════════════════════════════
//  STRUCTURED QUESTIONS PER ROLE
//  type: 'options' → show chips   |   type: 'text' → show textarea
// ═══════════════════════════════════════════════════════════

const structuredQuestions = {
    Student: [
        {
            key: 'educationLevel',
            question: '🎓 What is your current education level?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '📒', label: 'Primary School' },
                { emoji: '📗', label: 'Secondary School (6-10)' },
                { emoji: '📘', label: 'Higher Secondary (11-12)' },
                { emoji: '🎓', label: 'Undergraduate' },
                { emoji: '🎓', label: 'Postgraduate' },
                { emoji: '📚', label: 'Competitive Exam Prep' }
            ]
        },
        {
            key: 'board',
            question: '🏫 Which board or university are you in?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '📋', label: 'CBSE' },
                { emoji: '📋', label: 'ICSE' },
                { emoji: '📋', label: 'State Board' },
                { emoji: '🌍', label: 'IB' },
                { emoji: '🏛', label: 'University' },
                { emoji: '✏️', label: 'Other' }
            ]
        },
        {
            key: 'subject',
            question: '📖 What is your main subject or stream?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '🔬', label: 'Science' },
                { emoji: '📊', label: 'Commerce' },
                { emoji: '🎨', label: 'Arts / Humanities' },
                { emoji: '💻', label: 'Engineering / CS' },
                { emoji: '⚕️', label: 'Medical' },
                { emoji: '📐', label: 'Other' }
            ]
        },
        {
            key: 'goal',
            question: '🎯 What exactly do you want to achieve? Be specific — vague goals won\'t pass!',
            type: 'text',
            dimension: 'goal',
            placeholder: 'e.g. Score 95% in my board exams in 3 months, crack NEET with 600+ marks, build a portfolio project for internships...'
        },
        {
            key: 'currentPosition',
            question: '📍 Where do you stand right now relative to this goal?',
            type: 'text',
            dimension: 'position',
            placeholder: 'e.g. I\'ve covered 40% of the syllabus, I score around 70% in mock tests, I haven\'t started preparing yet...'
        },
        {
            key: 'timeAvailable',
            question: '⏰ How much time can you dedicate per day?',
            type: 'options',
            dimension: 'resources',
            options: [
                { emoji: '⏱️', label: '1-2 hours' },
                { emoji: '⏱️', label: '3-4 hours' },
                { emoji: '⏱️', label: '5-6 hours' },
                { emoji: '⏱️', label: '7+ hours (full-time)' }
            ]
        },
        {
            key: 'resources',
            question: '🛠 What resources do you currently have?',
            type: 'options',
            dimension: 'resources',
            multiSelect: true,
            options: [
                { emoji: '📱', label: 'Phone / Laptop' },
                { emoji: '📚', label: 'Textbooks' },
                { emoji: '🎥', label: 'Online courses' },
                { emoji: '👨‍🏫', label: 'Tutor / Coaching' },
                { emoji: '👥', label: 'Study group' },
                { emoji: '🏫', label: 'Library access' }
            ]
        },
        {
            key: 'constraint',
            question: '🚧 What limitations should I consider?',
            type: 'text',
            dimension: 'constraints',
            placeholder: 'e.g. Exams in 2 months, no coaching budget, limited internet, family responsibilities...'
        },
        {
            key: 'friction',
            question: '🧱 What is currently stopping you or slowing you down?',
            type: 'text',
            dimension: 'friction',
            placeholder: 'e.g. I procrastinate a lot, can\'t focus for long, overwhelmed by syllabus, lack motivation, phone distraction...'
        },
        {
            key: 'planType',
            question: '📐 What kind of plan do you want?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '📋', label: 'Detailed step-by-step' },
                { emoji: '🧭', label: 'High-level strategy' },
                { emoji: '⚡', label: 'Fast-track' },
                { emoji: '🌱', label: 'Sustainable pace' }
            ]
        }
    ],

    Founder: [
        {
            key: 'startupStage',
            question: '🚀 What stage is your startup at?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '💡', label: 'Just an idea' },
                { emoji: '📝', label: 'Validation / Research' },
                { emoji: '🔧', label: 'Building MVP' },
                { emoji: '🚀', label: 'MVP launched' },
                { emoji: '💰', label: 'Early revenue' },
                { emoji: '📈', label: 'Scaling / Growth' }
            ]
        },
        {
            key: 'industry',
            question: '🏭 What industry are you in?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '📚', label: 'EdTech' },
                { emoji: '💳', label: 'FinTech' },
                { emoji: '🏥', label: 'HealthTech' },
                { emoji: '🛒', label: 'E-commerce / D2C' },
                { emoji: '☁️', label: 'SaaS / B2B' },
                { emoji: '🎮', label: 'Gaming / Media' },
                { emoji: '🍔', label: 'Food / AgriTech' },
                { emoji: '✏️', label: 'Other' }
            ]
        },
        {
            key: 'targetUser',
            question: '🎯 Who is your target user?',
            type: 'text',
            dimension: 'context',
            placeholder: 'e.g. College students aged 18-24 in India, small business owners, working moms...'
        },
        {
            key: 'goal',
            question: '🎯 What exactly do you want to achieve right now?',
            type: 'text',
            dimension: 'goal',
            placeholder: 'e.g. Launch MVP in 2 months, get first 100 users, raise seed funding, find a co-founder...'
        },
        {
            key: 'currentPosition',
            question: '📍 Where are you right now relative to this goal?',
            type: 'text',
            dimension: 'position',
            placeholder: 'e.g. Have wireframes ready but no code, 50 beta sign-ups, pitched to 3 investors...'
        },
        {
            key: 'teamSize',
            question: '👥 What is your team situation?',
            type: 'options',
            dimension: 'resources',
            options: [
                { emoji: '🧑', label: 'Solo founder' },
                { emoji: '👥', label: '2-person team' },
                { emoji: '👥', label: '3-5 people' },
                { emoji: '🏢', label: '6-15 people' },
                { emoji: '🏢', label: '15+ people' }
            ]
        },
        {
            key: 'budget',
            question: '💰 What budget do you have available?',
            type: 'options',
            dimension: 'resources',
            options: [
                { emoji: '🚫', label: 'Bootstrapping (₹0)' },
                { emoji: '💵', label: 'Under ₹1 lakh' },
                { emoji: '💵', label: '₹1-5 lakh' },
                { emoji: '💰', label: '₹5-25 lakh' },
                { emoji: '💎', label: '₹25 lakh+' }
            ]
        },
        {
            key: 'constraint',
            question: '🚧 What limitations should I know about?',
            type: 'text',
            dimension: 'constraints',
            placeholder: 'e.g. Must launch before funding runs out in 3 months, no tech co-founder, can only work part-time...'
        },
        {
            key: 'friction',
            question: '🧱 What is the biggest thing stopping you right now?',
            type: 'text',
            dimension: 'friction',
            placeholder: 'e.g. Can\'t decide on pricing, no idea how to acquire users, stuck between two approaches, fear of launching...'
        },
        {
            key: 'planType',
            question: '📐 What kind of plan do you want?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '📋', label: 'Detailed step-by-step' },
                { emoji: '🧭', label: 'High-level strategy' },
                { emoji: '⚡', label: 'Fast-track' },
                { emoji: '🌱', label: 'Sustainable pace' }
            ]
        }
    ],

    Leader: [
        {
            key: 'orgType',
            question: '🏢 What type of organization are you in?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '🚀', label: 'Startup' },
                { emoji: '🏛', label: 'Corporate' },
                { emoji: '🤝', label: 'NGO / Non-profit' },
                { emoji: '🏫', label: 'Education' },
                { emoji: '🏥', label: 'Government' },
                { emoji: '💼', label: 'Freelance / Agency' }
            ]
        },
        {
            key: 'roleLevel',
            question: '👔 What is your role level?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '👤', label: 'Team Lead' },
                { emoji: '👔', label: 'Manager' },
                { emoji: '🎯', label: 'Director' },
                { emoji: '⭐', label: 'VP / Head of' },
                { emoji: '👑', label: 'C-Level / Founder' }
            ]
        },
        {
            key: 'teamSize',
            question: '👥 How big is the team you manage?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '👥', label: '1-5 people' },
                { emoji: '👥', label: '6-15 people' },
                { emoji: '🏢', label: '16-50 people' },
                { emoji: '🏢', label: '50+ people' }
            ]
        },
        {
            key: 'goal',
            question: '🎯 What exactly do you want to achieve?',
            type: 'text',
            dimension: 'goal',
            placeholder: 'e.g. Improve team delivery speed by 40%, reduce attrition, launch a new department, hit Q2 KPIs...'
        },
        {
            key: 'currentPosition',
            question: '📍 Where do things stand right now?',
            type: 'text',
            dimension: 'position',
            placeholder: 'e.g. Team morale is low, we missed last quarter targets, just took over this team 2 months ago...'
        },
        {
            key: 'resources',
            question: '🛠 What resources do you have?',
            type: 'options',
            dimension: 'resources',
            multiSelect: true,
            options: [
                { emoji: '💰', label: 'Budget for tools/hire' },
                { emoji: '👥', label: 'HR / Recruitment support' },
                { emoji: '📊', label: 'Data / Analytics tools' },
                { emoji: '🤝', label: 'Executive sponsor' },
                { emoji: '⏰', label: 'Dedicated time' },
                { emoji: '📋', label: 'Process documentation' }
            ]
        },
        {
            key: 'constraint',
            question: '🚧 What constraints should I factor in?',
            type: 'text',
            dimension: 'constraints',
            placeholder: 'e.g. Hiring freeze, limited budget, remote-only team, regulatory requirements, tight deadline...'
        },
        {
            key: 'friction',
            question: '🧱 What is the biggest blocker right now?',
            type: 'text',
            dimension: 'friction',
            placeholder: 'e.g. Team resistance to change, unclear expectations from above, burnout, lack of alignment...'
        },
        {
            key: 'planType',
            question: '📐 What kind of plan do you want?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '📋', label: 'Detailed step-by-step' },
                { emoji: '🧭', label: 'High-level strategy' },
                { emoji: '⚡', label: 'Fast-track' },
                { emoji: '🌱', label: 'Sustainable pace' }
            ]
        }
    ],

    Creator: [
        {
            key: 'platform',
            question: '📱 What is your primary platform?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '▶️', label: 'YouTube' },
                { emoji: '📸', label: 'Instagram' },
                { emoji: '🐦', label: 'Twitter / X' },
                { emoji: '🎵', label: 'TikTok' },
                { emoji: '🎙', label: 'Podcast' },
                { emoji: '✍️', label: 'Blog / Newsletter' },
                { emoji: '🎨', label: 'Art / Design' },
                { emoji: '✏️', label: 'Other' }
            ]
        },
        {
            key: 'contentNiche',
            question: '🎯 What is your content niche?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '💻', label: 'Tech / Programming' },
                { emoji: '📖', label: 'Education' },
                { emoji: '🎮', label: 'Entertainment / Gaming' },
                { emoji: '💪', label: 'Fitness / Health' },
                { emoji: '💼', label: 'Business / Finance' },
                { emoji: '🍳', label: 'Food / Cooking' },
                { emoji: '🧘', label: 'Self-improvement' },
                { emoji: '✏️', label: 'Other' }
            ]
        },
        {
            key: 'audienceSize',
            question: '📊 Where is your audience right now?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '🌱', label: 'Just starting (0)' },
                { emoji: '📈', label: 'Under 1K followers' },
                { emoji: '📈', label: '1K - 10K' },
                { emoji: '🚀', label: '10K - 100K' },
                { emoji: '⭐', label: '100K+' }
            ]
        },
        {
            key: 'goal',
            question: '🎯 What exactly do you want to achieve?',
            type: 'text',
            dimension: 'goal',
            placeholder: 'e.g. Get to 10K subscribers in 6 months, monetize my content, launch a course, start a brand deal pipeline...'
        },
        {
            key: 'currentPosition',
            question: '📍 Where do you stand right now?',
            type: 'text',
            dimension: 'position',
            placeholder: 'e.g. I post inconsistently, have 200 followers, made 5 videos so far, no monetization yet...'
        },
        {
            key: 'timeAvailable',
            question: '⏰ How much time can you dedicate to creating?',
            type: 'options',
            dimension: 'resources',
            options: [
                { emoji: '⏱️', label: '1-2 hours / day' },
                { emoji: '⏱️', label: '3-4 hours / day' },
                { emoji: '⏱️', label: 'Part-time (weekends)' },
                { emoji: '⏱️', label: 'Full-time creator' }
            ]
        },
        {
            key: 'tools',
            question: '🛠 What tools / equipment do you have?',
            type: 'options',
            dimension: 'resources',
            multiSelect: true,
            options: [
                { emoji: '📱', label: 'Smartphone' },
                { emoji: '💻', label: 'Laptop / PC' },
                { emoji: '🎥', label: 'Camera' },
                { emoji: '🎤', label: 'Microphone' },
                { emoji: '✂️', label: 'Editing software' },
                { emoji: '🎨', label: 'Design tools (Canva etc)' }
            ]
        },
        {
            key: 'constraint',
            question: '🚧 What limitations should I consider?',
            type: 'text',
            dimension: 'constraints',
            placeholder: 'e.g. No budget for ads, working full-time job, no video editing skills, camera-shy...'
        },
        {
            key: 'friction',
            question: '🧱 What is currently stopping you?',
            type: 'text',
            dimension: 'friction',
            placeholder: 'e.g. Perfectionism, imposter syndrome, don\'t know what to post, scared of being judged, burnout...'
        },
        {
            key: 'planType',
            question: '📐 What kind of plan do you want?',
            type: 'options',
            dimension: 'context',
            options: [
                { emoji: '📋', label: 'Detailed step-by-step' },
                { emoji: '🧭', label: 'High-level strategy' },
                { emoji: '⚡', label: 'Fast-track' },
                { emoji: '🌱', label: 'Sustainable pace' }
            ]
        }
    ]
};

// ═══════════════════════════════════════════════════════════
//  GEMINI API CALL
// ═══════════════════════════════════════════════════════════

async function callGemini(prompt, maxTokens = 2048) {
    // Try each model endpoint until one works
    for (const model of GEMINI_MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        try {
            console.log(`Trying model: ${model}...`);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens }
                })
            });

            if (!res.ok) {
                const errBody = await res.text();
                lastError = `HTTP ${res.status} on ${model}: ${errBody.slice(0, 200)}`;
                console.error(lastError);
                // If rate limited (429), wait and try next model
                if (res.status === 429) {
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                // If 400/403, try next model
                continue;
            }

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                lastError = `${model} returned empty. Response: ${JSON.stringify(data).slice(0, 300)}`;
                console.error(lastError);
                continue;
            }
            console.log(`✅ Success with model: ${model}`);
            return text;
        } catch (err) {
            lastError = `Network error on ${model}: ${err.message}`;
            console.error(lastError);
            continue;
        }
    }
    // All models failed
    console.error('All Gemini models failed. Last error:', lastError);
    return '';
}

// ═══════════════════════════════════════════════════════════
//  SCREEN MANAGEMENT
// ═══════════════════════════════════════════════════════════

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${id}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════════
//  ROLE SELECTION
// ═══════════════════════════════════════════════════════════

function selectRole(btn) {
    userRole = btn.getAttribute('data-role');
    document.querySelectorAll('.role-button').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    clarityState.identity = true;
    structuredQueueIndex = 0;
    inStructuredPhase = true;
    updateClarityUI();

    setTimeout(() => {
        showScreen('conversation');
        showNextStructuredQuestion();
    }, 400);
}

// ═══════════════════════════════════════════════════════════
//  STRUCTURED QUESTION FLOW (options + text, one at a time)
// ═══════════════════════════════════════════════════════════

function showNextStructuredQuestion() {
    const queue = structuredQuestions[userRole];
    if (!queue || structuredQueueIndex >= queue.length) {
        // All structured questions done → check if AI wants to ask more
        inStructuredPhase = false;
        transitionToAIPhase();
        return;
    }

    const q = queue[structuredQueueIndex];
    const optionsArea = document.getElementById('optionsArea');
    const answerArea = document.getElementById('answerArea');
    const input = document.getElementById('answerInput');

    // Set question text
    setCurrentQuestion(q.question);
    addAIBubble(q.question);

    if (q.type === 'options') {
        // Show option chips, hide text input
        answerArea.style.display = 'none';
        optionsArea.innerHTML = '';

        if (q.multiSelect) {
            // Multi-select: show chips + a "Continue" button
            let selectedOptions = [];
            q.options.forEach(opt => {
                const chip = document.createElement('button');
                chip.className = 'option-chip';
                chip.innerHTML = `<span class="chip-emoji">${opt.emoji}</span> ${opt.label}`;
                chip.addEventListener('click', () => {
                    chip.classList.toggle('selected');
                    if (chip.classList.contains('selected')) {
                        selectedOptions.push(opt.label);
                    } else {
                        selectedOptions = selectedOptions.filter(o => o !== opt.label);
                    }
                });
                optionsArea.appendChild(chip);
            });

            // Add continue button for multi-select
            const continueBtn = document.createElement('button');
            continueBtn.className = 'option-chip';
            continueBtn.style.background = 'linear-gradient(135deg, var(--primary-purple), var(--primary-blue))';
            continueBtn.style.borderColor = 'transparent';
            continueBtn.style.width = '100%';
            continueBtn.style.justifyContent = 'center';
            continueBtn.style.marginTop = '4px';
            continueBtn.innerHTML = `<span class="chip-emoji">→</span> Continue`;
            continueBtn.addEventListener('click', () => {
                if (selectedOptions.length === 0) return;
                handleStructuredAnswer(q, selectedOptions.join(', '));
            });
            optionsArea.appendChild(continueBtn);
        } else {
            // Single-select: click to choose
            q.options.forEach(opt => {
                const chip = document.createElement('button');
                chip.className = 'option-chip';
                chip.innerHTML = `<span class="chip-emoji">${opt.emoji}</span> ${opt.label}`;
                chip.addEventListener('click', () => {
                    handleStructuredAnswer(q, opt.label);
                });
                optionsArea.appendChild(chip);
            });
        }
    } else {
        // Text input question
        optionsArea.innerHTML = '';
        answerArea.style.display = 'flex';
        input.placeholder = q.placeholder || 'Type your answer…';
        input.value = '';
        input.focus();
    }
}

function handleStructuredAnswer(q, answer) {
    // Store answer
    structuredAnswers[q.key] = answer;

    // Add user bubble
    addUserBubble(answer);
    conversationLog.push({ role: 'user', text: answer });

    // Update clarity
    if (q.dimension && clarityState.hasOwnProperty(q.dimension)) {
        clarityState[q.dimension] = true;
    }
    updateClarityUI();

    // Next question
    structuredQueueIndex++;
    setTimeout(() => showNextStructuredQuestion(), 300);
}

// ═══════════════════════════════════════════════════════════
//  SUBMIT TEXT ANSWER (for text-type structured questions)
// ═══════════════════════════════════════════════════════════

async function submitAnswer() {
    const input = document.getElementById('answerInput');
    const text = input.value.trim();
    if (!text || isProcessing) return;

    if (inStructuredPhase) {
        // Handle as structured text answer
        const queue = structuredQuestions[userRole];
        const q = queue[structuredQueueIndex];
        handleStructuredAnswer(q, text);
    } else {
        // Handle as AI conversation answer
        addUserBubble(text);
        conversationLog.push({ role: 'user', text });
        input.value = '';
        input.style.height = 'auto';

        // Update clarity in background
        updateClarityAfterAnswer(text);

        // Ask AI for next question
        await askNextAIQuestion();
    }
}

// ═══════════════════════════════════════════════════════════
//  AI PHASE — After structured questions are done
// ═══════════════════════════════════════════════════════════

async function transitionToAIPhase() {
    // Show text input
    document.getElementById('optionsArea').innerHTML = '';
    document.getElementById('answerArea').style.display = 'flex';

    // Ask AI if it needs more info or if clarity is complete
    await askNextAIQuestion();
}

async function askNextAIQuestion() {
    showTypingIndicator();
    disableInput();

    const prompt = buildAIPrompt();
    const response = await callGemini(prompt, 1024);

    hideTypingIndicator();

    if (!response) {
        // Retry once
        const retry = await callGemini(prompt, 1024);
        if (!retry) {
            // If AI fails, go straight to summary with what we have
            buildProfileFromStructuredAnswers();
            addAIBubble("I have enough information to build your plan. Let me show you a summary!");
            setTimeout(() => showSummary(), 1200);
            return;
        }
        handleAIResponse(retry);
        return;
    }

    handleAIResponse(response);
}

function buildAIPrompt() {
    const answersStr = Object.entries(structuredAnswers)
        .map(([k, v]) => `• ${k}: ${v}`)
        .join('\n');

    const history = conversationLog
        .filter(m => m.role === 'user')
        .map(m => `USER: ${m.text}`)
        .join('\n');

    return `You are "Do it" — a clarity-first AI execution planner talking to a ${userRole}.

The user has already answered these structured questions:
${answersStr}

Additional conversation:
${conversationLog.slice(-10).map(m => `${m.role === 'ai' ? 'DO IT' : 'USER'}: ${m.text}`).join('\n')}

Current clarity state:
${Object.entries(clarityState).map(([k, v]) => `- ${k}: ${v ? '✅' : '❌'}`).join('\n')}

YOUR TASK:
Look at all the information gathered. If you feel like you have FULL CLARITY to build a great execution plan, respond with CLARITY_COMPLETE. If some critical detail is still vague or missing, ask ONE follow-up question.

RULES:
- Keep tone warm and adapted for a ${userRole}.
- If asking a question, make it specific and targeted.
- DO NOT re-ask things already answered.
- You may ask 0-3 additional questions max.

RESPOND IN THIS EXACT FORMAT:

If asking a follow-up:
[TYPE]QUESTION[/TYPE]
[TEXT]Your specific follow-up question[/TEXT]

If clarity is complete:
[TYPE]CLARITY_COMPLETE[/TYPE]
[TEXT]A brief confirmation, e.g. "I now have a complete picture. Let me show you a summary before building your plan."[/TEXT]
[PROFILE]
{
  "role": "${userRole}",
  "context": "synthesized context from all answers",
  "goal": "the user's specific goal",
  "currentPosition": "where they stand now",
  "resources": "what they have available",
  "constraints": "their limitations",
  "friction": "what's blocking them",
  "scopeHint": "plan type they chose"
}
[/PROFILE]`;
}

function handleAIResponse(response) {
    const parsed = parseAIResponse(response);

    if (parsed.type === 'question') {
        addAIBubble(parsed.text);
        setCurrentQuestion(parsed.text);
        document.getElementById('optionsArea').innerHTML = '';
        document.getElementById('answerArea').style.display = 'flex';
        enableInput();
    } else if (parsed.type === 'clarity_complete') {
        addAIBubble(parsed.text);
        if (parsed.profile && parsed.profile.goal) {
            extractedProfile = parsed.profile;
        } else {
            buildProfileFromStructuredAnswers();
        }
        updateClarityUI(100);
        setTimeout(() => showSummary(), 1500);
    }
}

function parseAIResponse(text) {
    const typeMatch = text.match(/\[TYPE\](.*?)\[\/TYPE\]/s);
    const textMatch = text.match(/\[TEXT\](.*?)\[\/TEXT\]/s);
    const profileMatch = text.match(/\[PROFILE\](.*?)\[\/PROFILE\]/s);

    const type = typeMatch ? typeMatch[1].trim().toLowerCase() : 'question';
    const responseText = textMatch ? textMatch[1].trim() : text.replace(/\[.*?\]/g, '').trim();

    if (type === 'clarity_complete') {
        let profile = {};
        if (profileMatch) {
            try { profile = JSON.parse(profileMatch[1].trim()); } catch (e) { console.warn('Profile parse error', e); }
        }
        return { type: 'clarity_complete', text: responseText, profile };
    }

    return { type: 'question', text: responseText, dimensions: [] };
}

function buildProfileFromStructuredAnswers() {
    const a = structuredAnswers;
    extractedProfile = {
        role: userRole,
        context: [a.educationLevel, a.board, a.subject, a.startupStage, a.industry, a.targetUser, a.orgType, a.roleLevel, a.platform, a.contentNiche, a.audienceSize].filter(Boolean).join(', '),
        goal: a.goal || '',
        currentPosition: a.currentPosition || '',
        resources: [a.timeAvailable, a.budget, a.resources, a.tools, a.teamSize].filter(Boolean).join(', '),
        constraints: a.constraint || '',
        friction: a.friction || '',
        scopeHint: a.planType || 'Detailed step-by-step'
    };
}

// ═══════════════════════════════════════════════════════════
//  CHAT UI HELPERS
// ═══════════════════════════════════════════════════════════

function addAIBubble(text) {
    conversationLog.push({ role: 'ai', text });
    const history = document.getElementById('chatHistory');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ai';
    bubble.innerHTML = `<div class="bubble-label">Do it</div>${text}`;
    history.appendChild(bubble);
    scrollChatToBottom();
}

function addUserBubble(text) {
    const history = document.getElementById('chatHistory');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.innerHTML = `<div class="bubble-label">You</div>${text}`;
    history.appendChild(bubble);
    scrollChatToBottom();
}

function setCurrentQuestion(text) {
    document.getElementById('currentQuestion').textContent = text;
}

function scrollChatToBottom() {
    const history = document.getElementById('chatHistory');
    setTimeout(() => { history.scrollTop = history.scrollHeight; }, 50);
}

function showTypingIndicator() {
    isProcessing = true;
    const history = document.getElementById('chatHistory');
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    history.appendChild(indicator);
    scrollChatToBottom();
}

function hideTypingIndicator() {
    isProcessing = false;
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
}

function disableInput() {
    document.getElementById('answerInput').disabled = true;
    document.getElementById('sendButton').disabled = true;
}

function enableInput() {
    const input = document.getElementById('answerInput');
    input.disabled = false;
    document.getElementById('sendButton').disabled = false;
    input.focus();
}

function updateClarityUI(forcePct) {
    const dims = Object.values(clarityState);
    const filled = dims.filter(Boolean).length;
    const pct = forcePct || Math.round((filled / dims.length) * 100);

    document.getElementById('clarityFill').style.width = pct + '%';

    if (pct < 30) document.getElementById('clarityText').textContent = 'Understanding you…';
    else if (pct < 60) document.getElementById('clarityText').textContent = 'Getting clearer…';
    else if (pct < 90) document.getElementById('clarityText').textContent = 'Almost there…';
    else document.getElementById('clarityText').textContent = 'Full clarity achieved ✓';

    Object.keys(clarityState).forEach(key => {
        const el = document.getElementById(`dim-${key}`);
        if (el) el.classList.toggle('filled', clarityState[key]);
    });
}

// LOCAL clarity tracking — no API call needed, saves quota!
function updateClarityAfterAnswer(userText) {
    const t = userText.toLowerCase();
    const goalWords = ['want', 'achieve', 'goal', 'aim', 'target', 'dream', 'plan to', 'wish', 'aspire', 'objective'];
    const posWords = ['currently', 'right now', 'so far', 'at this point', 'i am', 'i have', 'stage', 'progress', 'standing'];
    const resWords = ['budget', 'money', 'time', 'hours', 'team', 'tool', 'laptop', 'phone', 'skill', 'experience', 'access'];
    const conWords = ['deadline', 'limit', 'can\'t', 'cannot', 'restriction', 'only', 'no more', 'maximum', 'must', 'before'];
    const frcWords = ['stuck', 'problem', 'issue', 'struggle', 'difficult', 'hard', 'challenge', 'block', 'stop', 'afraid', 'scared', 'procrastinat', 'overwhelm', 'confus', 'distract'];

    if (goalWords.some(w => t.includes(w))) clarityState.goal = true;
    if (posWords.some(w => t.includes(w))) clarityState.position = true;
    if (resWords.some(w => t.includes(w))) clarityState.resources = true;
    if (conWords.some(w => t.includes(w))) clarityState.constraints = true;
    if (frcWords.some(w => t.includes(w))) clarityState.friction = true;

    updateClarityUI();
}

// ═══════════════════════════════════════════════════════════
//  SUMMARY CONFIRMATION
// ═══════════════════════════════════════════════════════════

function showSummary() {
    if (!extractedProfile.goal) buildProfileFromStructuredAnswers();

    const grid = document.getElementById('summaryGrid');
    const p = extractedProfile;

    grid.innerHTML = `
        ${summaryItem('👤 Role', p.role || userRole)}
        ${summaryItem('🌐 Context', p.context || '—')}
        ${summaryItem('🎯 Goal', p.goal || '—')}
        ${summaryItem('📍 Current Position', p.currentPosition || '—')}
        ${summaryItem('🛠 Resources', p.resources || '—')}
        ${summaryItem('🚧 Constraints', p.constraints || '—')}
        ${summaryItem('🧱 Friction', p.friction || '—')}
        ${summaryItem('📐 Plan Type', p.scopeHint || 'Detailed step-by-step')}
    `;

    showScreen('summary');
}

function summaryItem(label, value) {
    return `<div class="summary-item">
        <div class="summary-item-label">${label}</div>
        <div class="summary-item-value">${value}</div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
//  PLAN GENERATION
// ═══════════════════════════════════════════════════════════

async function generatePlan() {
    showScreen('plan');
    document.getElementById('planLoading').style.display = 'flex';
    document.getElementById('planOutput').innerHTML = '';
    document.getElementById('planActions').style.display = 'none';
    document.getElementById('qaSection').style.display = 'none';

    const p = extractedProfile;

    const prompt = `You are "Do it" — a clarity-first AI execution planner. Generate a customized plan.

Role: ${p.role || userRole}
Context: ${p.context}
Goal: ${p.goal}
Current position: ${p.currentPosition}
Resources: ${p.resources}
Constraints: ${p.constraints}
Friction: ${p.friction}
Plan type: ${p.scopeHint || 'Detailed'}

Rules: Respect constraints, address friction in Phase 1, be realistic, adapt tone for a ${p.role || userRole}.

Format output as markdown with these sections:
## 🎯 Execution Plan Overview
## Phase 1: [Name] (timeframe)
## Phase 2: [Name] (timeframe)
## Phase 3: [Name] (timeframe)
## ⚠️ Risks & Mitigation
## 📊 Checkpoints & Metrics
## ⚡ Immediate Next 3 Actions`;

    // Try generating with API
    document.getElementById('planLoading').querySelector('p').innerHTML =
        'Analyzing your profile…<br>Building phased execution plan…';

    let result = await callGemini(prompt, 4096);

    // If first attempt failed, retry once after a pause
    if (!result) {
        document.getElementById('planLoading').querySelector('p').innerHTML =
            'Retrying with backup model…';
        await new Promise(r => setTimeout(r, 2000));
        result = await callGemini(prompt, 4096);
    }

    document.getElementById('planLoading').style.display = 'none';

    // If API completely fails, generate a local fallback plan
    if (!result) {
        console.warn('API failed — generating local fallback plan');
        result = generateLocalPlan(p);
    }

    generatedPlan = result;
    document.getElementById('planSubtitle').textContent = `Custom plan for ${p.role || userRole}`;
    document.getElementById('planOutput').innerHTML = markdownToHtml(result);
    document.getElementById('planActions').style.display = 'grid';
    document.getElementById('qaSection').style.display = 'block';
}

// Local fallback plan generator — works offline, no API needed
function generateLocalPlan(p) {
    const role = p.role || userRole;
    const goal = p.goal || 'your stated goal';
    const friction = p.friction || 'your main blocker';
    const constraints = p.constraints || 'your limitations';
    const resources = p.resources || 'available resources';
    const context = p.context || 'your background';
    const position = p.currentPosition || 'your current position';

    return `## 🎯 Execution Plan Overview
Based on your profile as a **${role}** with the goal of **${goal}**, here is a structured 3-phase plan designed around your constraints (${constraints}) and available resources (${resources}).

## Phase 1: Foundation & Friction Removal (Week 1-2)
The first priority is removing what's blocking you: **${friction}**.

- **Day 1-3:** Audit your current situation — ${position}. Write down exactly where you are vs where you want to be.
- **Day 4-7:** Break your goal into 5 micro-goals. The first one should be achievable in 48 hours.
- **Week 2:** Set up your environment for success — organize your ${resources}, create a daily schedule, and eliminate the friction (${friction}).

## Phase 2: Momentum Building (Week 3-6)
With the foundation set, it's time to build consistent momentum.

- **Weekly targets:** Set one measurable target per week directly tied to ${goal}.
- **Daily routine:** Dedicate focused time blocks using your available ${resources}.
- **Progress tracking:** Review progress every Sunday — what worked, what didn't, what to adjust.
- **Midpoint check (Week 4):** Are you 40-50% toward your goal? If not, adjust strategy.

## Phase 3: Acceleration & Results (Week 7-12)
Doubling down on what works and pushing toward the finish line.

- **Double down:** Invest more time into the strategies that showed results in Phase 2.
- **Seek feedback:** Get input from peers, mentors, or your community.
- **Final push:** The last 2 weeks should be focused execution with no new experiments.
- **Celebrate:** Acknowledge your progress regardless of the outcome percentage.

## ⚠️ Risks & Mitigation
- **Risk:** Burnout from pushing too hard → **Mitigation:** Built-in rest days and sustainable pace.
- **Risk:** ${friction} coming back → **Mitigation:** Daily 5-min check-in to re-commit to your plan.
- **Risk:** Losing motivation mid-way → **Mitigation:** Weekly progress reviews to see how far you've come.
- **Risk:** ${constraints} getting tighter → **Mitigation:** Have a "minimum viable progress" plan for low-energy days.

## 📊 Checkpoints & Metrics
- **Week 2:** Foundation complete, daily routine established.
- **Week 4:** 40% progress toward ${goal}.
- **Week 8:** 75% progress, clear path to completion.
- **Week 12:** Goal achieved or significant, measurable progress made.

## ⚡ Immediate Next 3 Actions
1. **Today:** Write down your exact goal and your #1 blocker on a piece of paper. Put it where you'll see it daily.
2. **Tomorrow:** Break your goal into 5 smaller milestones. Start working on milestone #1.
3. **This week:** Commit to a fixed daily time slot for working on this plan. Block it on your calendar.`;
}

// ═══════════════════════════════════════════════════════════
//  POST-PLAN Q&A
// ═══════════════════════════════════════════════════════════

async function askDoubt() {
    const input = document.getElementById('qaInput');
    const text = input.value.trim();
    if (!text) return;

    addQABubble('user', text);
    input.value = '';

    const history = document.getElementById('qaHistory');
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.id = 'qaTyping';
    typing.innerHTML = '<span></span><span></span><span></span>';
    history.appendChild(typing);
    history.scrollTop = history.scrollHeight;

    const prompt = `You are "Do it" in post-plan Q&A mode.

User profile: ${JSON.stringify(extractedProfile)}
Plan: ${generatedPlan}
User's question: "${text}"

Answer helpfully and concisely. Reference specific plan phases when relevant.`;

    const answer = await callGemini(prompt, 1536);

    const t = document.getElementById('qaTyping');
    if (t) t.remove();

    addQABubble('ai', answer || 'Sorry, I couldn\'t process that. Please try asking again.');
}

function addQABubble(role, text) {
    const history = document.getElementById('qaHistory');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.innerHTML = `<div class="bubble-label">${role === 'ai' ? 'Do it' : 'You'}</div>${role === 'ai' ? markdownToHtml(text) : text}`;
    history.appendChild(bubble);
    history.scrollTop = history.scrollHeight;
}

// ═══════════════════════════════════════════════════════════
//  MARKDOWN → HTML
// ═══════════════════════════════════════════════════════════

function markdownToHtml(md) {
    if (!md) return '<p style="color:var(--accent-pink)">⚠️ Could not generate. Please try again.</p>';

    let html = md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^[•\-\*]\s(.+)$/gm, '<li>$1</li>')
        .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br>');

    html = html.replace(/((?:<li>.*?<\/li>(?:<br>)?)+)/g, '<ul>$1</ul>');
    return '<p>' + html + '</p>';
}

// ═══════════════════════════════════════════════════════════
//  RESTART
// ═══════════════════════════════════════════════════════════

function restartConversation() {
    userRole = '';
    conversationLog = [];
    structuredAnswers = {};
    structuredQueueIndex = 0;
    inStructuredPhase = true;
    clarityState = { identity: false, context: false, goal: false, position: false, resources: false, constraints: false, friction: false };
    extractedProfile = {};
    generatedPlan = '';
    isProcessing = false;

    document.getElementById('chatHistory').innerHTML = '';
    document.getElementById('currentQuestion').textContent = '';
    document.getElementById('answerInput').value = '';
    document.getElementById('optionsArea').innerHTML = '';
    document.getElementById('answerArea').style.display = 'flex';
    document.getElementById('qaHistory').innerHTML = '';
    document.querySelectorAll('.role-button').forEach(b => b.classList.remove('selected'));
    updateClarityUI();

    showScreen('landing');
}

// ═══════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        const answerInput = document.getElementById('answerInput');
        const qaInput = document.getElementById('qaInput');

        if (document.activeElement === answerInput) {
            e.preventDefault();
            submitAnswer();
        } else if (document.activeElement === qaInput) {
            e.preventDefault();
            askDoubt();
        }
    }
});

document.addEventListener('input', (e) => {
    if (e.target.classList.contains('answer-input')) {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }
});

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    showScreen('landing');
});
