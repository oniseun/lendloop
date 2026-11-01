#!/bin/sh
# Boots n8n with LendLoop's credential and workflows:
#  1. loads the shared HMAC secrets written by convex-init (Docker setup)
#  2. builds the SMTP credential from env and imports it into n8n's
#     encrypted credential store (the file is deleted straight away)
#  3. imports the exported workflows from /workflows and publishes them
#  4. starts n8n and, on first boot, creates the owner account from
#     N8N_OWNER_EMAIL / N8N_OWNER_PASSWORD so the editor needs no setup
# Re-importing on every boot keeps the repo as the source of truth. Set
# LENDLOOP_IMPORT_ON_BOOT=false to keep edits made in the n8n editor.
set -eu

if [ -f /shared/n8n.env ]; then
  set -a
  . /shared/n8n.env
  set +a
fi

if [ "${LENDLOOP_IMPORT_ON_BOOT:-true}" = "true" ]; then
  cred_file="$(mktemp)"
  node -e '
    const env = process.env;
    console.log(JSON.stringify([{
      id: "lendloopSmtpCred",
      name: "LendLoop SMTP",
      type: "smtp",
      data: {
        host: env.SMTP_HOST || "mailpit",
        port: Number(env.SMTP_PORT || 1025),
        user: env.SMTP_USER || "",
        password: env.SMTP_PASSWORD || "",
        secure: env.SMTP_SECURE === "true",
        disableStartTls: env.SMTP_SECURE !== "true" && !env.SMTP_USER,
      },
    }]));
  ' > "$cred_file"
  n8n import:credentials --input="$cred_file"
  rm -f "$cred_file"

  n8n import:workflow --separate --input=/workflows
  for id in lendloopErrorWf1 lendloopRequestW lendloopOverdueW; do
    n8n publish:workflow --id="$id"
  done
fi

n8n start &
n8n_pid=$!
trap 'kill -TERM "$n8n_pid" 2>/dev/null' INT TERM

if [ -n "${N8N_OWNER_EMAIL:-}" ] && [ -n "${N8N_OWNER_PASSWORD:-}" ]; then
  node -e '
    const base = "http://localhost:5678";
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      for (let i = 0; i < 120; i++) {
        try { if ((await fetch(base + "/healthz")).ok) break; } catch {}
        await wait(1000);
      }
      const settings = await (await fetch(base + "/rest/settings")).json();
      if (!settings.data?.userManagement?.showSetupOnFirstLoad) return;
      const res = await fetch(base + "/rest/owner/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: process.env.N8N_OWNER_EMAIL,
          password: process.env.N8N_OWNER_PASSWORD,
          firstName: "LendLoop",
          lastName: "Admin",
        }),
      });
      console.log("[bootstrap] n8n owner account " + (res.ok ? "created" : "not created: " + res.status));
    })().catch((e) => console.log("[bootstrap] owner setup skipped: " + e.message));
  ' || true
fi

wait "$n8n_pid"
