#!/bin/sh
# Boots n8n with LendLoop's credential and workflows:
#  1. loads the shared HMAC secrets written by convex-init (Docker setup)
#  2. builds the SMTP credential from env and imports it into n8n's
#     encrypted credential store (the file is deleted straight away)
#  3. imports the exported workflows from /workflows and publishes them
#  4. starts n8n and, on first boot, creates the owner account from
#     N8N_OWNER_EMAIL / N8N_OWNER_PASSWORD so the editor needs no setup
#  5. marks the container ready once the workflows' webhooks are live
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

rm -f /tmp/lendloop-ready
n8n start &
n8n_pid=$!
trap 'kill -TERM "$n8n_pid" 2>/dev/null' INT TERM

# After start: create the owner account (first boot only), then wait until
# the request webhook is registered and drop the marker the compose
# healthcheck looks for. /healthz alone turns green before workflows are
# activated.
node -e '
  const base = "http://localhost:5678";
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (m) => console.log("[bootstrap] " + m);
  (async () => {
    // /healthz answers before the REST API is mounted, so poll the API.
    let settings = null;
    for (let i = 0; i < 300 && !settings; i++) {
      try {
        const res = await fetch(base + "/rest/settings");
        if (res.ok && res.headers.get("content-type")?.includes("json")) settings = await res.json();
      } catch {}
      if (!settings) await wait(1000);
    }
    const { N8N_OWNER_EMAIL: email, N8N_OWNER_PASSWORD: password } = process.env;
    if (email && password) {
      if (settings?.data?.userManagement?.showSetupOnFirstLoad) {
        const res = await fetch(base + "/rest/owner/setup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, firstName: "LendLoop", lastName: "Admin" }),
        });
        log("n8n owner account " + (res.ok ? "created: " + email : "not created: " + res.status + " " + (await res.text()).slice(0, 200)));
      }
    }
    for (let i = 0; i < 300; i++) {
      // An unsigned POST is rejected with 401 by the workflow itself, so
      // anything but 404 means the webhook is live.
      const res = await fetch(base + "/webhook/lendloop/request-events", { method: "POST" }).catch(() => null);
      if (res && res.status !== 404) {
        require("fs").writeFileSync("/tmp/lendloop-ready", "");
        log("workflows active");
        return;
      }
      await wait(1000);
    }
    log("request webhook never became active");
  })().catch((e) => log("post-start step failed: " + e.message));
' &

wait "$n8n_pid"
