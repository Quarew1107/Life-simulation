# Setting up on another laptop

Everything needed to run the simulator and keep working on it is on GitHub. You need one manual step: copy
`Prompt for later.txt` yourself if you want it, because it is never put on GitHub.

## 1. Install (once)
1. **Git for Windows**: https://git-scm.com/download/win (the default options are fine).
2. **Python 3.11 or newer**: https://www.python.org/downloads/ (tick "Add python.exe to PATH" during
   setup). Then open a terminal and run:
   ```
   pip install websockets
   ```
   This lets the tests run in a headless browser.
3. **Microsoft Edge**: it comes with Windows. The tests use it, and the app also runs in Chrome.
4. **The Claude desktop app** (Code tab), signed in with your account.

## 2. Get the project
```
git clone https://github.com/Quarew1107/Life-simulation.git
cd Life-simulation
git checkout feature/playable-life
```
- The repo is private: sign in to GitHub when Git asks (a browser window opens).
- `main` is the stable version. The Play a Life work is on `feature/playable-life`.
- In the Claude app, open this `Life-simulation` folder as the session's folder.

## 3. Run it
- **The app:** double-click `Start Simulation.bat` (or open `index.html` in Edge or Chrome).
- **All the tests** (5 to 14 minutes):
  ```
  python tools/edge.py tests.html "await LES_TESTS.runAll(), document.getElementById('out').textContent" 2700
  ```
  The result ends with "N passed, 0 failed".

## 4. What carries over, and what doesn't
- **Claude's working rules** are in `CLAUDE.md`, which Claude reads automatically. The project's state and
  next steps are in `docs/HANDOFF.md` (section 0, plus the "Playable Life Mode" item).
- **The Play a Life design package** is in `Idea/Life simulation expansion/`. The rest of `Idea/` stays on the
  first laptop only.
- **The preview server** for the Claude app's browser pane is in `.claude/launch.json` (called `life-sim`).
- **Not on GitHub:** `Prompt for later.txt` (your private notes), the rest of `Idea/`, and Claude's own
  memory from the first laptop. The important rules from that memory are copied into `CLAUDE.md`.
