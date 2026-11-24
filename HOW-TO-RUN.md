# How to run Traffix

The app lives in the `web/` folder. It has two parts:

- **Simulator** (`http://localhost:3000`): two copies of the lot side by side, without and with Traffix.
- **Driver app** (`http://localhost:3000/phone`): the phone screens from the Figma designs.

## 1. Install Node.js (once)

Install **Node.js 20 or newer** (the LTS version) from https://nodejs.org.

Check it worked:

```bash
node -v
```

It should print `v20` or higher.

## 2. Get the code

If you don't have the repo yet:

```bash
git clone https://github.com/yusufgokce/traffix.git
cd traffix
```

If you already have it:

```bash
cd traffix
git checkout main
git pull
```

## 3. Add the env file

The Supabase keys are shared in our Discord. They are **not** in the repo.

1. Download the env file from Discord.
2. Put it in the `web` folder and name it exactly `.env.local`. The full path is `traffix/web/.env.local`.
3. It should look like this, with real values after the `=`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
   ```

Tips:

- Files starting with `.` are hidden. On Mac, press **Cmd + Shift + .** in Finder to see them. On Windows, File Explorer → **View** → **Show** → **Hidden items**.
- On Windows, make sure the file isn't saved as `.env.local.txt`. Turn on **File name extensions** in the same View menu to check.
- Never commit this file or post the keys anywhere public. Git already ignores it.

No env file? The app still runs. Only **Save run** and using a real phone need it.

## 4. Install and start

```bash
cd web
npm install
npm run dev
```

`npm install` is only needed the first time and after someone adds a package.

Then open **http://localhost:3000**.

## 5. Use it

1. Pick a lot from the dropdown at the top right (Costco Kirkham Dr or Lot 01).
2. Pick a scenario: **Quiet**, **Rush** or **Full**.
3. Press **Play**. Change the speed with 1x to 20x.
4. Scroll on a lot to zoom, drag to pan, and double-click to fit the whole lot again.
5. Click **Open driver app**, enter a plate like `ABCD 123`, and follow your car through the lot.
6. Click **Save run** to store the results in Supabase.

To open the driver app on a real phone (same Wi-Fi, env file needed):

1. Find your computer's IP. On Mac: `ipconfig getifaddr en0`. On Windows: `ipconfig`, then look for the IPv4 address.
2. On the phone, open `http://<that-ip>:3000/phone`.

## 6. Tests and numbers

Run these from the `web` folder:

```bash
npm test          # engine tests
npm run compare   # with vs without numbers for every scenario
```

## Problems

| What you see | Fix |
|---|---|
| `Could not read package.json` | You're in the wrong folder. Run `cd web` first. |
| `command not found: npm` | Node.js isn't installed. Go back to step 1. |
| `Port 3000 is in use` | Another copy is running. Close it, or open the URL it prints (for example `localhost:3001`). |
| **Save run** is greyed out | `web/.env.local` is missing or misnamed. Restart `npm run dev` after adding it. |
| Page shows an error after pulling new code | Stop the server (Ctrl + C), run `npm install`, then `npm run dev`. |
| Driver app says "Simulator not running" | Keep the simulator tab open and press Play. |

More detail on how the simulator works is in [`web/README.md`](web/README.md).
