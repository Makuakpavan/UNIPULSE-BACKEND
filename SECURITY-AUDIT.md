# Security Audit & Remediation

This file summarizes an initial security review and recommended actions before promoting staging to production.

Findings
- Committed `.env` was present in the repository previously. Any secrets committed must be considered leaked and rotated immediately (MongoDB, Cloudinary, API keys).
- Project uses several third-party services (MongoDB Atlas, Cloudinary, Redis, SMTP). Ensure separate staging accounts/credentials.
- No Docker image scanning or dependency automation configured.

Immediate actions (high priority)
- Rotate any credentials that were committed to the repo (MongoDB user, Cloudinary keys). Create new secrets and remove the old ones.
- Remove any tracked `.env` from git history (use `git rm --cached .env` and rotate credentials). Consider using `git filter-repo` or `bfg` to scrub history if secrets were pushed to remote.
- Add secrets to a secret manager (Render environment variables or GitHub Secrets) and never commit them.

Recommended improvements
- Enable `npm audit` regularly, and add Dependabot or Renovate for dependency updates.
- Run `npm audit` and fix critical vulnerabilities:
  ```bash
  npm audit --audit-level=high
  npm audit fix
  ```
- Use a CSP and secure headers; Helmet is present but confirm CSP configuration for content sources.
- Ensure TLS is enforced on Render (Render provides HTTPS by default) and redirect HTTP to HTTPS.
- Use strong JWT secrets (>=32 bytes) and rotate periodically.
- Limit administrative access to production resources via IP allowlists and least privilege IAM.
- Ensure Cloudinary uploads use unsigned/upload preset with strict upload foldering and access controls when possible.
- Scan uploaded files for malware (optional) and validate file types/sizes server-side (already implemented). Consider integrating virus scanning for high-risk files.
- Rate-limit sensitive endpoints more strictly (auth endpoints, password reset, webhook endpoints).

Operational recommendations
- Monitoring & Alerts: integrate Sentry or LogRocket for errors; export logs to centralized service and set alerts for 5xxs and high error rates.
- Backups: enable automated backups for MongoDB and verify restore process.
- Secrets Management: use Render secrets and GitHub Secrets; for production consider AWS Secrets Manager or Vault.
- CI/CD: restrict who can merge to `staging` and `main` branches; require PR reviews and passing tests.

Commands to run locally
- Check outdated deps:
  ```bash
  npm outdated
  ```
- Audit vulnerabilities:
  ```bash
  npm audit
  ```

Next steps
- Rotate secrets immediately if you haven't done so.
- Configure Dependabot and schedule weekly dependency review.
- Decide whether to use separate Cloudinary account for staging or rely on folder prefix (folder prefix is implemented; separate account preferred).
