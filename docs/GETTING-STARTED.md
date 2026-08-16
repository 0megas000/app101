# Getting Started (no coding experience needed)

This guide gets the app running on a **Windows laptop** so you can click around it.
It assumes you have never used a terminal before. Total time: about 20 minutes,
most of it waiting for downloads.

macOS and Linux instructions are at the bottom — the steps are the same, only the
installers differ.

---

## What you are installing, and why

You need three things. Two are free programs; the third is this project.

| # | What | Why |
|---|---|---|
| 1 | **Node.js** | Runs the application |
| 2 | **PostgreSQL** | Stores the products, sales, and settings |
| 3 | **This project** | The dispenser software itself |

---

## Step 1 — Install Node.js

1. Go to **https://nodejs.org**
2. Click the big green button on the **left** — the one labelled **LTS**.
   *(LTS means "Long Term Support" — the stable version.)*
3. Open the downloaded file and click **Next** through the installer. The defaults
   are all fine. Click **Install** at the end.

Nothing visible happens after it finishes. That's normal — you'll confirm it worked in Step 4.

## Step 2 — Install PostgreSQL

1. Go to **https://www.postgresql.org/download/windows/**
2. Click **Download the installer**, then pick the newest version for Windows x86-64.
3. Run the installer and click **Next** through it.

> ### ⚠️ The one screen that matters
>
> Partway through it asks for a **password for the database superuser**.
>
> **Type a simple password and write it down.** You will need it in Step 5, and
> there is no easy way to recover it later. Something like `postgres123` is fine
> for a test laptop.

4. Keep clicking **Next**. When it offers **Stack Builder** at the end, **untick it**
   — you don't need it.

## Step 3 — Download the project

1. Go to **https://github.com/0megas000/app101**
2. Click the branch dropdown near the top left (it probably says **main**) and choose
   **`claude/preworkout-dispenser-platform-g82won`**.
3. Click the green **Code** button → **Download ZIP**.
4. Find the ZIP in your Downloads folder, **right-click → Extract All**, and extract it
   to somewhere easy like your **Desktop**.

You should now have a folder like `app101-claude-preworkout-dispenser-platform-g82won`
on your Desktop. Rename it to just **`app101`** to make life easier.

## Step 4 — Open a terminal in that folder

1. Open the `app101` folder so you can see `README.md`, `server`, `web`, and so on.
2. Click once in the **address bar** at the top of the window (where the folder path is).
3. Type `powershell` and press **Enter**.

A blue or black window opens. This is the terminal. It is already pointed at the right
folder, which is the part people usually get wrong.

**Check Node.js installed correctly** — type this and press Enter:

```
node --version
```

You should see something like `v22.11.0`. If you instead see "not recognized", restart
your laptop and try again — Windows sometimes needs a reboot after installing Node.

## Step 5 — Install and set up

Type each command and press **Enter**. Wait for each one to finish before the next.

**5a.** Download the pieces the project needs (takes a few minutes, prints a lot of text):

```
npm install
```

**5b.** Set everything up:

```
npm run setup
```

This one asks you a few questions:

| It asks | You do |
|---|---|
| `Host [localhost]` | Just press **Enter** |
| `Port [5432]` | Just press **Enter** |
| `Admin username [postgres]` | Just press **Enter** |
| `Admin password` | **Type the password from Step 2**, press Enter |
| `Start the app now? (y/n) [y]` | Press **Enter** |

It then creates the database, loads demo data (10 products, a month of pretend sales),
and starts the app. You'll see a wall of text ending with lines about `localhost:5173`.

If something goes wrong it stops and tells you what to fix in plain English.

## Step 6 — Open it

Open your web browser and go to:

**http://localhost:5173**

That's the customer kiosk. Tap anywhere to start.

For the operator dashboard, go to **http://localhost:5173/admin** and enter PIN **`1234`**.

---

## Using it day to day

**To stop the app:** click the terminal window and press **Ctrl + C**.

**To start it again later:** open the folder, type `powershell` in the address bar,
press Enter, then:

```
npm start
```

You only ever run `npm install` and `npm run setup` once.

---

## Things worth trying

**Watch the safety system work.** On the kiosk, tap to start, add **Static — Sour Gummy**
to your mix, then choose **2 scoops**. That's 400 mg of caffeine against a 300 mg limit, so
the machine refuses — and offers buttons that fix it for you. Tap "You could choose 1 scoop
instead" and it unblocks.

**Change the limit and watch the kiosk obey.** Go to the admin dashboard →
**Safety Rules** → change caffeine from 300 to 500 → **Save**. Back on the kiosk, 2 scoops
is now allowed. No restart needed. This is the point of the whole design: the safety numbers
are settings, not code.

**Break the machine on purpose.** Admin → **Machines** → scroll to *Simulate hardware
failure* → turn on **Dispenser jam**. Now buy something on the kiosk. It takes payment,
starts dispensing, then fails properly: the customer is told they weren't charged, and the
fault appears in the error log below. Turn it off when you're done.

**Look at the analytics.** Admin → **Interactions** shows a conversion funnel built from a
month of simulated customer behaviour.

**Run the automated test.** With the app running, open a *second* terminal in the same
folder and run `npm run test:e2e`. It drives a real browser through everything above
automatically and prints 32 green ticks.

---

## If something goes wrong

| What you see | What it means |
|---|---|
| `node` / `npm` `is not recognized` | Node.js isn't installed, or needs a reboot. Redo Step 1, restart the laptop. |
| `PostgreSQL is not running` | Open the Start menu, search **Services**, find `postgresql-x64-…`, right-click → **Start**. |
| `That username or password was not accepted` | Wrong password from Step 2. If it's lost, reinstall PostgreSQL and set a new one. |
| `Dependencies are not installed` | You skipped `npm install`. Run it, then `npm run setup` again. |
| Browser says "can't reach this page" | The app isn't running. Run `npm start` and wait for it to finish starting. |
| Something else | `npm run setup` is safe to run again — it reuses what already exists. |

---

## macOS

Same idea, easier install. In Terminal:

```bash
# Install Homebrew if you don't have it: https://brew.sh
brew install node postgresql@16
brew services start postgresql@16

cd ~/Desktop/app101
npm install
npm run setup      # leave the admin password blank and press Enter
```

## Linux (Ubuntu / Debian)

```bash
sudo apt update
sudo apt install -y nodejs npm postgresql
sudo service postgresql start
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"

cd ~/app101
npm install
npm run setup      # admin password: postgres
```

For an unattended install (useful when provisioning real machines), skip the questions
by supplying them up front:

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres npm run setup
npm start
```
