#!/bin/sh
# Boots n8n with LendLoop's credential and workflows:
#  1. builds the SMTP credential from env and imports it into n8n's
#     encrypted credential store (the file is deleted straight away)
#  2. imports the exported workflows from /workflows and publishes them
#  3. starts n8n
# Re-importing on every boot keeps the repo as the source of truth. Set
# LENDLOOP_IMPORT_ON_BOOT=false to keep edits made in the n8n editor.
set -eu

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

exec n8n start
