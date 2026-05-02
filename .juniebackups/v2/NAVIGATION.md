# Navigation Guide — How to use the Junie Skill documentation

You have three guides. This explains what each is for and how they work together.

---

## The Three Guides

### 1. SKILL_USAGE.md — Complete Reference Manual

**What it is:** Authoritative documentation of every feature, option, and configuration.

**Length:** ~200 lines (concise but comprehensive)

**Contains:**
- ✅ Full architecture explanation
- ✅ All 5 modular playbooks described
- ✅ Every input/output parameter
- ✅ Running individual phases (advanced)
- ✅ Edge cases and customization
- ✅ Token efficiency analysis
- ✅ Design rationale

**Read this when you:**
- Want to understand the complete architecture
- Need to customize the skill (add a phase, change defaults)
- Want to run phases independently
- Are building on top of this skill
- Need a reference for all options

**Example questions it answers:**
- "What are the 5 playbooks and what does each do?"
- "Can I run just the frontend phase?"
- "What are all the files generated?"
- "How does the resumption logic work?"

---

### 2. QUICK_START.md — Real Scenario Walkthrough

**What it is:** Step-by-step walkthrough of one complete scaffolding session. Real commands. Real output.

**Length:** ~400 lines (detailed but practical)

**Contains:**
- ✅ Prerequisites checklist
- ✅ Exact Junie prompts to send
- ✅ Real output from each phase (copy-paste)
- ✅ How to verify it works (with expected terminal output)
- ✅ 5 concrete failure scenarios + exact recovery steps
- ✅ Post-scaffold extension examples
- ✅ Checklists (pre, post, integration)
- ✅ Common pitfalls table

**Read this when you:**
- Are scaffolding for the first time
- Want to see what "success" looks like
- Need to recover from a failure
- Want to see real command output before running it
- Are learning by example

**Example questions it answers:**
- "What do I type in Junie?"
- "What should I see when Phase 02 runs?"
- "My Junie crashed mid-Phase 03 — how do I recover?"
- "How do I run the app after scaffolding?"
- "What if Port 8080 is in use?"

---

### 3. NAVIGATION.md — This File

**What it is:** Explains which document to read when. How they complement each other.

**Read this when you:**
- Are confused about which guide to use
- Don't know where to find a specific answer
- Are navigating for the first time

---

## Decision Tree — Which to read?

```
I want to scaffold a RAG app.
│
├─ "Just tell me exactly what to do, step by step"
│  └─ Read: QUICK_START.md
│
├─ "Something went wrong, how do I recover?"
│  └─ Read: QUICK_START.md → "When Things Go Wrong" section
│
├─ "I want to understand the full architecture first"
│  └─ Read: SKILL_USAGE.md
│
├─ "Can I customize the skill? Run phases independently?"
│  └─ Read: SKILL_USAGE.md → "5 Modular Playbooks" + "Running individual phases"
│
├─ "I want to see real output before I start"
│  └─ Read: QUICK_START.md → "Real Scenario: Complete Walkthrough"
│
└─ "I'm still confused about which guide to use"
   └─ You are here. Keep reading this file.
```

---

## How to use both together

### Scenario A: First-time scaffold

1. **Start here:** Read QUICK_START.md top-to-bottom
   - Get prerequisites
   - Follow the walkthrough
   - Understand the flow
   - See what success looks like

2. **If something fails:** Stay in QUICK_START.md → "When Things Go Wrong"
   - Find your scenario
   - Follow exact recovery steps

3. **After scaffold:** SKILL_USAGE.md if you want to understand design decisions
   - Why 5 phases?
   - Why modular?
   - How does resumption work?

### Scenario B: Customizing or extending

1. **Start here:** SKILL_USAGE.md → "5 Modular Playbooks"
   - Understand the architecture
   - See which playbook to modify

2. **Then:** QUICK_START.md → "Post-scaffold: Extending the app"
   - Real examples of adding features/tools
   - See TDD pattern in action

3. **For details:** Read the actual playbook files (`.junie/playbooks/01-preflight.md`, etc.)

### Scenario C: Troubleshooting

1. **Start here:** QUICK_START.md → "When Things Go Wrong"
   - 5 concrete scenarios
   - Recovery steps
   - Expected outputs after fix

2. **If not found there:** SKILL_USAGE.md → "Troubleshooting"
   - More concise, links back to QUICK_START.md for detailed recovery

---

## Key differences at a glance

| Aspect | SKILL_USAGE.md | QUICK_START.md |
|---|---|---|
| **Tone** | Reference, architectural | Narrative, practical |
| **Reading style** | Lookup/jump to sections | Sequential walkthrough |
| **Shows real output?** | No | Yes, detailed |
| **Failure scenarios** | Brief mention | 5 detailed examples with exact commands |
| **For first-time users?** | OK (but QUICK_START better) | 🌟 Best choice |
| **For extending/customizing?** | 🌟 Best choice | OK (examples provided) |
| **For understanding "why?"** | 🌟 Best choice | OK (brief rationale) |
| **Length** | ~200 lines (reference-dense) | ~400 lines (example-rich) |

---

## How they complement each other

**SKILL_USAGE.md is the "what" and "how."**
- What are the 5 phases?
- How does resumption work?
- What files are generated?
- How do I customize it?

**QUICK_START.md is the "why" (in practice) and "now what?"**
- Why do each of these phases matter? (shown via real outputs)
- Why might this fail? (shown via concrete failure scenarios)
- How do I actually do this? (shown via real commands)
- What's next after scaffolding? (shown via extension examples)

**Together:** Complete understanding + practical execution.

---

## Quick lookup: "Where is X described?"

| Question | Find in |
|---|---|
| What are the 5 playbooks? | SKILL_USAGE.md → "5 Modular Playbooks" |
| How do I run phases independently? | SKILL_USAGE.md → "Running individual phases" |
| What do I type in Junie? | QUICK_START.md → "Real Scenario: Complete Walkthrough" → Step 3 |
| What if Junie crashes? | QUICK_START.md → "Scenario A: Junie crashes mid-scaffold" |
| How do I verify it works? | QUICK_START.md → Step 6 "Verify it works" |
| How do I add a new feature? | QUICK_START.md → "Post-scaffold: Adding a feature" |
| How do I add a backend tool? | QUICK_START.md → "Post-scaffold: Adding a backend tool" |
| How do I integrate the real orchestrator? | QUICK_START.md → "Post-scaffold: Integrating real orchestrator" |
| What files are generated? | SKILL_USAGE.md → "Expected outputs" |
| Can I customize the skill? | SKILL_USAGE.md → "Customizing the skill" |
| What's the design rationale? | SKILL_USAGE.md → "Design notes" |
| I'm stuck in a failure scenario | QUICK_START.md → "When Things Go Wrong" |

---

## Recommendations by audience

### For the impatient ("Just get me a working app")
1. Read: QUICK_START.md top-to-bottom (15 minutes)
2. Follow the walkthrough exactly
3. You'll have a working app in ~45 minutes
4. Done!

### For the thorough ("I want to understand everything")
1. Read: SKILL_USAGE.md (understand architecture) — 10 minutes
2. Read: QUICK_START.md (see it in action) — 15 minutes
3. Read: Individual playbooks (`.junie/playbooks/`) if curious — 20 minutes
4. Follow the walkthrough
5. Done (with full context!)

### For the extenders ("I want to customize this")
1. Read: SKILL_USAGE.md → "5 Modular Playbooks" — understand what's there
2. Read: QUICK_START.md → "Post-scaffold: Extending the app" — see patterns
3. Read: The specific playbook you want to modify (`.junie/playbooks/02-frontend-scaffold.md`, etc.)
4. Modify and test
5. Done!

### For the troubleshooters ("Something went wrong")
1. Go straight to: QUICK_START.md → "When Things Go Wrong"
2. Find your scenario
3. Follow recovery steps exactly
4. Resume scaffold
5. Done!

---

## Summary

- **SKILL_USAGE.md** = The blueprint (what, how, why)
- **QUICK_START.md** = The walkthrough (do this, then this, expect this)
- **NAVIGATION.md** = The signposts (where to find what)

**Use both.** They're not competing; they're complementary. One is the map; the other is the journey. You need both to get somewhere.

**First time?** → QUICK_START.md (then SKILL_USAGE.md if curious)

**Extending?** → SKILL_USAGE.md (then QUICK_START.md for patterns)

**Lost?** → This file (NAVIGATION.md)

---

## And finally...

If you're still confused after reading all three, the answer is simple:

**Just follow QUICK_START.md step-by-step.** It works. It's designed for zero prior context. Trust it.

Questions? Check [SKILL_USAGE.md](SKILL_USAGE.md) or the troubleshooting section in [QUICK_START.md](QUICK_START.md).
