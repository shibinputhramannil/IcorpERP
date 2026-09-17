# ICORP ERP Git Workflow

This rule applies only to the ICORP ERP repository.

Repository:
C:\Assignment\erp\IcorpERP

Never access, modify, copy, move, delete, or commit anything from:
C:\Assignment\CRM

## Automatic Git workflow

After completing a requested development task or phase:

1. Run the required verification commands.
2. For backend changes:
   - python manage.py check
   - python manage.py test
3. For frontend changes:
   - npm run build
4. If relevant, run the project's live/API verification tests.
5. If verification fails, STOP.
   Do not commit or push failing work.
6. Review:
   - git status
   - git diff --stat
7. Make sure there are no secrets or credentials in the changes.
8. Stage the completed ICORP ERP changes.
9. Create a descriptive commit.
10. Push the commit to:
    origin main

## Commit format

Use:

Phase X: <short description>

Examples:

Phase 5: Complete purchase module
Phase 6: Add finance foundation
Phase 7: Integrate AI assistant

## Safety rules

Never commit:

- .env files
- passwords
- API keys
- access tokens
- private keys
- database credentials
- secrets

Never use:

- git push --force
- git reset --hard
- git clean -fd
- destructive Git commands

Do not amend an existing commit unless explicitly requested.

Do not overwrite or discard unrelated user changes.

If unrelated changes are present, STOP and ask before committing.

Do not commit or push if required tests or builds fail.

After a successful commit and push, report:

- verification result
- commit hash
- commit message
- push result

The goal is automatic checkpointing of completed ICORP ERP work while preserving repository safety.