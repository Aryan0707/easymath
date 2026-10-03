# EasyMath

Learn math from zero to advanced, with mental-math shortcuts, instant answers, graphs, and an optional AI helper.

## Run it

```bash
npm install                      # once (only needed for the AI helper's SDK)
node server.js                   # app only, no AI:        http://127.0.0.1:3000
ANTHROPIC_API_KEY=sk-ant-... node server.js   # with the AI helper (word problems, "why" questions, photos)
```

No server is needed for the app itself: any static file server works (`python3 -m http.server`). Without `server.js`, "Ask AI" and photo input show a friendly "not connected" message and everything else works.

The API key stays on the server and is never sent to the browser.

## Host it on GitHub Pages

The app is plain static files, so GitHub Pages can serve it for free over `https://` (which "Add to Home Screen" and offline mode need).

1. Push the repo, then open **Settings → Pages**.
2. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The site appears at `https://<your-username>.github.io/<repo-name>/`.

Everything works there except the AI helper, which needs `server.js` and your API key. Pages cannot run a server, so Ask AI shows its "not connected" message. To get the helper online, run `server.js` on a Node host instead (Render, Railway, Fly.io) and set `ANTHROPIC_API_KEY` there. Never commit the key.

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Turns the AI helper on |
| `MATH_MODEL` | `claude-opus-5-5` | Use `claude-haiku-4-5` for cheaper and faster answers |
| `MATH_EFFORT` | `low` | `low` / `medium` / `high` — how hard the model thinks |
| `PORT`, `HOST` | `3000`, `127.0.0.1` | `HOST=0.0.0.0` exposes it on your Wi-Fi (try it from a phone) |

## What's inside

| File | Purpose |
|---|---|
| `index.html`, `app.js` | The page shell and the Learn, Speed, Today, Answer, Progress tabs |
| `styles.css` | The design system: dark glass theme, colour tokens, components, motion |
| `icons.js` | The line-icon set (no emoji anywhere) |
| `engine.js` | Exact math engine (also used by the server as the AI's calculator) |
| `skills.js` | 12 levels in 3 difficulty tiers, 17 mental-math shortcuts and 4 recall drills (tables to 20×20, squares to 30², cubes to 12³, square roots to 30), each with explanations, visuals, wrong-answer diagnosis, teaching policies |
| `server.js` | Static server + `/api/ask` (Claude with a calculator tool), rate limit, security headers |
| `sw.js`, `manifest.webmanifest`, `icon-*` | Installable + offline (needs `https://` or `localhost`) |
| `test.js`, `test-server.js` | `npm test` — logic tests and server tests against a mock API |

## How it teaches

Each rule below is a deliberate choice, and each is covered by tests in `test.js`.

| Idea | What the app does |
|---|---|
| Retrieval practice | Every screen is a question, not a page to read. |
| Worked examples that fade | A new level opens with a step-by-step example. Question 1 is worked for you except the last step, question 2 gives only the first step, then you are on your own. |
| Fix it now | After a miss you see where it went wrong, then get "one like it" straight away. These retries are tracked apart from mastery. |
| Right difficulty | A 3-up, 1-down staircase over three tiers keeps most answers right but not all. Hinted answers don't count as clean. |
| Remembered, not just passed | A level is **Passed** at 4 of 5, but only **Solid** after a short review check at least 20 hours later. |
| Spaced review | Skills return on a 0, 1, 3, 7, 14 day schedule. Delayed checks are placed first in the daily drill. |
| Accuracy before speed | A shortcut's timed drill unlocks after 8 of 10 correct without the clock. Timed drills never offer retries. |
| Understanding, not tricks | Every shortcut has a "Why it works" explanation and a picture. |
| Named mistakes | Wrong answers are matched to a slip (such as forgetting to carry). Repeated slips get a targeted drill built to provoke them. |
| Number sense | An answer far off in size gets a size check. Big-number and percent lessons begin with an estimate. |
| Predict, then reveal | A worked example asks for your guess before showing the steps, then compares the two. |
| Know how sure you are | Level practice and untimed shortcut drills let you tap Sure / Not sure / Guess before answering. A confident mistake is called out and gets extra weight in the daily drill; a lucky guess is asked again later. |
| Explain it back | Twice per untimed shortcut drill (after the 3rd and 7th correct answer) you pick the real reason it works from three options. The wrong options are real misconceptions, not other shortcuts' explanations. |
| Mixed practice | From level 2 on, question 4 comes from an earlier level you passed (a shaky or due one first). It never counts toward the level's pass mark. |
| Short sessions | After about 15 minutes of practice with no real gap, the app suggests a break. Today has a daily calendar reminder (an `.ics` file, so no server or notifications are needed). |

### Is it working? (measuring with real learners)

Progress → **Is it sticking?** shows, per device: first-try accuracy without hints, accuracy within a day of starting a skill, accuracy a day or more later, and how often a retry fixes a miss. Everything stays on the device. To compare learners, ask each to use **Export backup** and read these fields in the JSON: `stats[skill].en/ec` (early tries/correct), `ln/lc` (later), `tn/tc` (retries), `mis` (slip counts).

### Recall drills ("Know it cold")

Speed → Know it cold has facts to know instantly instead of tricks. They use the same flow as the shortcuts: lesson, untimed practice, timed drill unlocked at 8 of 10, spaced review, slip tracking. To add one, append an entry with `group: "recall"` to the **end** of `METHODS` in `skills.js`, and a matching pair of wrong explanations to the end of `WHY_WRONG` (a test fails if they are missing). Saved progress points at methods by position, so never insert or reorder. The Speed tab groups by `group`, not by position, so a new shortcut (no `group`) can also go at the end and still appears under Shortcuts. Every question must evaluate to its answer and its worked steps must end on that answer; `npm test` enforces both.

Shortcuts added after the first 13: Squares near 100, Double & halve, Add left to right, Divide by 5. Typed questions in the Answer tab get the matching tip too (for example `97^2` or `14*35`).

## Tuning knobs

- **Mastery gate:** `isLevelPassed()` in `app.js` (default: 4 of 5 correct). **Solid** needs a review check at least 20 hours later (`levelState` in `skills.js`).
- **Difficulty staircase:** `nextTier()` in `skills.js` (default: 3 clean answers up, 1 miss down).
- **Speed unlock:** `SPEED_UNLOCK` in `app.js` (default: 8 of 10).
- **Daily goal / streak:** `GOAL` in `app.js` (default: 10 questions a day).
- **Review schedule:** `BOX_DAYS` in `app.js` (default: 0, 1, 3, 7, 14 days).
- **Break nudge:** `SESSION_BREAK` and `SESSION_GAP` in `skills.js` (default: 15 minutes of practice, reset by a 10 minute gap).
- **Mixed-in question:** `MIX_AT` in `levelQuiz()` in `app.js` (default: the 4th question).

## Not built yet

- Real accounts and cross-device sync (progress is saved per browser; use Progress → Export backup to move it).
- A native iOS app (the installable web app covers "Add to Home Screen" on iPhone).
