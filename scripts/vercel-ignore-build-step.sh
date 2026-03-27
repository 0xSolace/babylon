#!/usr/bin/env sh
# Vercel "Ignored Build Step" / vercel.json ignoreCommand.
#
# Vercel semantics (NOT normal shell): exit 0 = skip/cancel this deployment;
# exit 1 = continue and run the build. See:
# https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
#
# Goal: Git-triggered Production deployments always build. Everything else from
# Git is skipped; use the manual GitHub workflow for PR previews (CLI deploy
# typically bypasses this script).
#
# Ensure Project Settings → Environment Variables → "Automatically expose System
# Environment Variables" is enabled so these vars exist during this step.
#
# Add branch names to the for-loop if you need more Git-triggered preview
# branches (e.g. staging).

if [ "${VERCEL_ENV:-}" = "production" ] || [ "${VERCEL_TARGET_ENV:-}" = "production" ]; then
  exit 1
fi

ref="${VERCEL_GIT_COMMIT_REF:-}"
for b in production main; do
  if [ "$ref" = "$b" ]; then
    exit 1
  fi
done

exit 0
