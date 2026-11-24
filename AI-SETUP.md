# Setup help prompt

Stuck getting Traffix running? Copy everything in the box below into the AI assistant you use (it works best with one that can run commands on your computer). Then tell it what's going wrong.

```text
Help me run the Traffix project on my computer. Go one step at a time, wait for me
to confirm each step worked, and explain errors in plain words.

About the project:
- GitHub repo: https://github.com/yusufgokce/traffix (branch: main)
- The app is a Next.js 15 + TypeScript project in the `web/` folder.
- It needs Node.js 20 or newer.
- Commands are run from `web/`: `npm install`, then `npm run dev`.
  The simulator is at http://localhost:3000 and the driver app at /phone.
- Supabase keys go in `web/.env.local`, with two lines:
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  My team shares this file privately. The app still runs without it; only saving
  runs and using a real phone need it.
- Tests: `npm test`. Comparison numbers: `npm run compare`.
- Full instructions are in HOW-TO-RUN.md at the repo root.

Steps:
1. Check my operating system and whether Node.js 20+ and git are installed. If
   not, tell me how to install them.
2. Clone the repo, or pull the latest main if I already have it.
3. Help me put the env file at web/.env.local. Check that the name is exact (not
   .env.local.txt) and that both values are filled in. Never print the key values
   back to me or anywhere else.
4. Run `npm install` and `npm run dev` inside web/, and fix any errors.
5. Confirm http://localhost:3000 loads.

Rules:
- Don't change any project files or commit anything unless I ask. The only file
  you should create is web/.env.local, and only with the values I give you.
- Never commit, upload or paste the contents of web/.env.local.
- If a step fails, show me the exact error and what you think caused it before
  trying a fix.
```
