# Enable repo pre-commit hook (blocks secrets and deploy zips)
git config core.hooksPath .githooks
Write-Host "Git hooks enabled. Pre-commit will run scripts/check-no-secrets.mjs on each commit."
