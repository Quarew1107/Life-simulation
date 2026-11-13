# Working rules for Claude on this project

Claude Code reads this file automatically, so these rules apply on any computer. The project's own guide is
`docs/HANDOFF.md`: section 1 explains how the project works, and section 0 is the current to-do list. Read
those first.

## The owner's rules
- **Plan first.** Plan any big feature and get the owner's approval before building it. Ask questions and
  give suggestions before building; the owner likes to see a demo first. Keep the setup screen simple and put
  rarely used settings under Advanced.
- **One task at a time.** Work through tasks in order. Never start parallel sessions or agents (they cost
  too many tokens). When the owner says "split into sessions", they mean separate tasks, done one after another.
- **Finish each task properly:**
  1. Run the targeted tests, then the full suite.
  2. Add a short entry to `docs/HANDOFF.md`.
  3. Commit, then push to GitHub (github.com/Quarew1107/Life-simulation, private).
  - Push after every finished task without asking, but never with failing tests or half-done work. If GitHub
    answers with a 500 error, just retry.
- **Never touch these:**
  - `Prompt for later.txt` (project root): never open, read, search, commit or push it. It holds the owner's
    private notes.
  - `Idea/`: kept off GitHub. The one exception is `Idea/Life simulation expansion/` (the Play a Life design
    package), which the owner allowed on GitHub in Nov 2026 so it can be used on another laptop. Never
    `git add -f` anything else in `Idea/`.
- **Fingerprints:** never change stored fingerprints (Classic, Malaysia, the report check-values) unless the
  owner approves it.

## Play a Life (branch `feature/playable-life`)
- Work one task card (PL-xx) at a time, from `Idea/Life simulation expansion/CLAUDE_OPUS_5_5_MEDIUM_TASK_CARDS.md`.
- Push the feature branch after each card, never force-push, and never merge into `main` without the owner.
  Stop for review after each card unless the owner says "continue until PL-xx".
- **Owner decisions (PL-00):**
  - a ~5 days/s "Story" speed;
  - the lottery is on but can be hidden;
  - affairs and casual partners sit behind a mature-content switch that is off by default;
  - suicide appears only as non-graphic crisis and support stories, never as an action;
  - leaving town ends control and offers succession.
- Status and next step: see the "Playable Life Mode" item in `docs/HANDOFF.md`.

## Pick up here (Nov 14 2026)
- **Done:** PL-00 to PL-12, the owner's extra requests, and the My life redesign (steps 1-5).
  - The redesign: view A Hub (the default), B Planner and C Story. Plans are checked before they are
    queued; important decisions stop the clock; the character decides everyday ones at fast speeds; big
    moments slow the game to 1x.
  - Last commit `a2358bf`; full suite 534/534.
- **Next:** ask the owner first. Either they give feedback after trying the three views, or **PL-13**
  (catalogue rollout in small tranches of 5-10 events, from `Idea/Life simulation expansion/ALL_EVENTS_REVIEW.md`).
  - Mark each new event important or everyday in `Player.IMPORTANT` (`js/sim/player-flow.js`).
  - Add its texts to `js/i18n/en.js` and `js/i18n/zh-Hans.js`, with the same keys in both.
- **Not checked live yet:** the 1x slow-down and the 10-second resume on a visible screen. They were
  checked by stepping the game by hand, because the preview pane does not run the game loop while hidden.
- **Where the Play a Life code lives:**
  - `js/sim/player*.js` (engine side; `player-flow.js` holds the check, auto-decide, moments and clock
    rules);
  - `js/ui/player-ui.js` (hub and shared parts, `UI._life`), `js/ui/life-story.js` (view C),
    `js/ui/life-planner.js` (view B);
  - tests in `js/tests/tests.js` (`play*Tests`).
- **Working pattern:**
  - Make engine edits with small scripts that replace exact text and keep each file's line endings
    (files mix CRLF and LF).
  - Run the new test group, then all `play*Tests` groups, then the full suite in the background (never two
    headless browsers at once; never start it with `&`).
  - Update HANDOFF, then commit and push to `feature/playable-life`.

## Practical notes
- **No Node here.** Run tests in headless Microsoft Edge:
  - `python tools/edge.py tests.html "await LES_TESTS.runAll(), document.getElementById('out').textContent" 2700`
    runs the whole suite (5 to 14 minutes);
  - `await LES_TESTS.<group>()` runs one group.
  - It needs Python and the `websockets` package. Run only one headless browser at a time.
- **Previewing:** the `life-sim` server in `.claude/launch.json` (python http.server on port 8765). Scripts are
  cached, so reload them with `fetch(src, {cache: 'reload'})` before `location.reload()`.
- **Editing a line of engine code:** never put a `//` comment in the middle of a line before more code. It
  comments out the rest of the line (this once switched off every breakup in town; the fingerprint tests caught it).
- **The owner:** Malaysian (RM, Malaysian context), learning AI-assisted development. Explain things plainly.
