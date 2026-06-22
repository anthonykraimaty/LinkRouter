# Deployment (CI/CD to VPS)

Every push to `main` triggers `.github/workflows/deploy.yml`, which SSHes into
the VPS, pulls the latest code, and rebuilds the Docker Compose stack.

```
git push  ──►  GitHub Actions  ──SSH──►  VPS: git pull + docker compose up -d --build
```

---

## 1. One-time VPS setup

SSH into your server and run these once.

```bash
# Install Docker + the compose plugin (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh

# Clone the repo to the deploy directory
sudo mkdir -p /opt/routesmapper
sudo chown "$USER":"$USER" /opt/routesmapper
git clone https://github.com/anthonykraimaty/LinkRouter.git /opt/routesmapper
cd /opt/routesmapper

# Create the production .env (NOT in git). Use strong, unique values.
cat > .env <<'EOF'
POSTGRES_DB=routesmapper
POSTGRES_USER=routesmapper
POSTGRES_PASSWORD=<strong-random-password>
JWT_SECRET=<strong-random-secret>
APP_PORT=80
VITE_API_URL=/api
EOF
chmod 600 .env

# First manual boot to confirm it works
docker compose up -d --build
docker compose ps
```

The app is served on `http://<vps-ip>:${APP_PORT}` (port 80 by default).
Uploaded files persist in the `uploads` Docker volume across rebuilds.

> If the repo is private, the runner's git pull already works because it
> deploys over SSH using the local clone's existing credentials. For the
> initial `git clone` above on a private repo, use a deploy key or a PAT.

---

## 2. Generate an SSH key for GitHub Actions → VPS

Run **on your local machine** (or the VPS), then authorize the key on the VPS:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key -N ""

# Authorize the PUBLIC key on the VPS for the deploy user
ssh-copy-id -i deploy_key.pub <vps-user>@<vps-ip>
# (or append the contents of deploy_key.pub to ~/.ssh/authorized_keys on the VPS)
```

The **private** key (`deploy_key`, the whole file including the
`-----BEGIN/END-----` lines) goes into the `VPS_SSH_KEY` secret below.
Never commit it.

---

## 3. GitHub repository secrets

Add these under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name   | Value                                                         | Example                   |
| ------------- | ------------------------------------------------------------ | ------------------------- |
| `VPS_HOST`    | VPS IP address or hostname                                    | `203.0.113.42`            |
| `VPS_USER`    | SSH user on the VPS                                           | `deploy` or `root`        |
| `VPS_SSH_KEY` | The **private** SSH key (full contents of `deploy_key`)       | `-----BEGIN OPENSSH...`   |
| `VPS_PORT`    | SSH port                                                      | `22`                      |
| `VPS_APP_DIR` | Absolute path to the repo on the VPS                          | `/opt/routesmapper`       |

After adding the secrets, the next push to `main` deploys automatically.
You can also trigger a deploy manually: **Actions → Deploy to VPS → Run workflow**.

---

## 4. How a deploy runs

The workflow (`.github/workflows/deploy.yml`) on the VPS:

1. `git fetch --all --prune` then `git reset --hard origin/main`
   (server always matches GitHub exactly — local edits on the VPS are discarded).
2. `docker compose up -d --build --remove-orphans` (rebuilds changed images,
   restarts containers, applies DB migrations on backend startup).
3. `docker image prune -f` to clean dangling layers.

`concurrency` ensures only one deploy runs at a time; a newer push cancels an
in-progress deploy.

---

## 5. Troubleshooting

- **`Permission denied (publickey)`** — `VPS_SSH_KEY` must be the *private* key,
  and its *public* half must be in the VPS user's `~/.ssh/authorized_keys`.
- **`docker: command not found`** — Docker isn't installed for the deploy user,
  or the user isn't in the `docker` group (`sudo usermod -aG docker $USER`,
  then re-login).
- **`git reset` wipes server changes** — by design. Never edit code directly on
  the VPS; the `.env` and the `uploads` volume are untracked so they survive.
- **Check a deploy** — GitHub repo → **Actions** tab → latest run logs.
- **On the VPS** — `cd /opt/routesmapper && docker compose logs -f`.
