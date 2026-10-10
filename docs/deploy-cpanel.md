# Deploying to cPanel

SheetSmith runs as a cPanel **Node.js app** (Passenger). Needs Node 22.18+ (pick 22.x or 24.x in the version list).

## One-time setup

1. **Domain.** Create a subdomain (e.g. `sheets.example.com`) in cPanel > Domains, and make sure AutoSSL has issued its certificate.
2. **Clone the repo.** cPanel > *Git Version Control* > Create, clone URL `https://github.com/andyboltondev/sheetsmith.git`, path `sheetsmith` (so `~/sheetsmith`, outside `public_html`). Or over SSH: `git clone <url> ~/sheetsmith`.
3. **Create the app.** cPanel > *Setup Node.js App* > Create Application:
   - Node.js version: 22.x or newer
   - Application mode: Production
   - Application root: `sheetsmith`
   - Application URL: your subdomain
   - Startup file: `app.cjs`
   - Environment variable: `ALLOWED_HOSTS` = `sheets.example.com` (your exact hostname, no scheme)
4. **Install dependencies.** On the app page, press *Run NPM Install*, then *Restart*.
5. Open the URL. Try the sample character, then a real D&D Beyond import. D&D Beyond may rate-limit shared hosting IPs, so test early.

## Auto-deploy from GitHub

Pushes to `main` run the Check workflow; if it passes, the Deploy workflow (`.github/workflows/deploy.yml`) SSHes into the server and runs `scripts/deploy.sh` (fetch, hard reset to `origin/main`, `npm ci --omit=dev`, touch `tmp/restart.txt`).

1. **SSH access.** Many hosts need it enabled (cPanel > *SSH Access*, or ask support). Confirm `ssh user@host` works.
2. **Deploy key.** Make a dedicated key locally: `ssh-keygen -t ed25519 -f sheetsmith_deploy -N ""`. In cPanel > SSH Access > Import Key, upload the public key (`.pub`) and *Authorize* it.
3. **GitHub secrets.** Repo > Settings > Secrets and variables > Actions:
   - `DEPLOY_SSH_KEY`: contents of the private key file
   - `DEPLOY_HOST`: server hostname
   - `DEPLOY_USER`: cPanel username
   - `DEPLOY_PORT`: SSH port (often 22; some hosts use another)
   - `DEPLOY_APP_DIR`: `/home/<user>/sheetsmith`
4. Delete the local private key once saved. Run the workflow once from the Actions tab (*Deploy* > Run workflow) to test.

If the script can't find Node, set `NODE_ENV_ACTIVATE` to the `source .../activate` path shown on the Node.js app page.

**No SSH on your plan?** In cPanel > Git Version Control press *Update from Remote* after each push, then *Run NPM Install* and *Restart* in the Node.js app page. Or ask me to wire up the cPanel API webhook instead.
