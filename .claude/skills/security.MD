# AI Agent Context — Security Standards & Directives

> **Purpose**
>
> This document defines the mandatory security standards for this project.
>
> Every AI coding agent (Claude Code, Cursor, Gemini, etc.) must follow these directives when writing, reviewing, or refactoring code.
>
> Security is not optional and must never be sacrificed for speed, simplicity, or hackathon deadlines.

---

# Core Philosophy

This project handles clinical simulation data, educational content, and LLM-generated material. Security failures here are not cosmetic bugs — they can leak credentials, expose student/professor data, or compromise the entire platform.

Every implementation must treat security as a first-class requirement, at the same level as correctness and architecture.

If a solution is fast but insecure, it must be considered incorrect.

---

# Environment Variables & Secrets

## Never Hardcode Secrets

Never hardcode, inline, or commit:

- API Keys (Gemini, Claude, Anthropic, OpenAI, etc.)
- Database credentials
- JWT secrets
- Encryption keys
- OAuth client secrets
- Third-party service tokens
- Webhook secrets

All secrets must be read exclusively from environment variables.

## `.env` Handling

- Every environment file (`.env`, `.env.local`, `.env.production`, etc.) must be listed in `.gitignore`.
- Only `.env.example` (with placeholder values, never real ones) should be committed to the repository.
- Never print, log, or return environment variable values in API responses, error messages, or console output.
- Never expose environment variables to the frontend unless explicitly prefixed and intended for public use (e.g., Vite's `VITE_` prefix), and even then, only non-sensitive values (never secrets).

## Centralized Configuration

- Environment variables must be validated and centralized through a single configuration module (e.g., a NestJS `ConfigModule` with schema validation).
- Never access `process.env` directly scattered across the codebase.
- Validate required environment variables at application startup — fail fast if a required variable is missing, rather than failing silently later.

## Key Rotation & Exposure

- If a secret is ever accidentally committed, treat it as compromised: it must be rotated/revoked, not just removed from a future commit.
- Never share secrets in chat, documentation, tickets, or code comments — including in AI prompts sent to LLM providers.

---

# Authentication & Authorization

- Every protected route/endpoint must enforce authentication via Guards (NestJS) — never rely on frontend checks alone.
- Authorization (role-based access, e.g., Professor vs. Student) must be enforced on the backend, never assumed from frontend state.
- Passwords must be hashed using a strong, salted algorithm (e.g., bcrypt/argon2). Never store plaintext passwords.
- Tokens (JWT or session) must have sane expiration times and must be validated on every request.
- Never trust client-supplied user IDs, roles, or permissions — always derive identity from the validated auth token/session.

---

# Input Validation & Data Trust

Never trust:

- User input (forms, query params, headers)
- HTTP request bodies
- LLM responses (Gemini/Claude output)
- Database data assumed to be "already validated"
- External API responses

Rules:

- Validate all external input at application boundaries using DTOs and Zod/class-validator schemas.
- Reject unexpected or malformed payloads explicitly; never silently coerce or ignore invalid fields.
- Sanitize any user-generated content that will be rendered, stored, or forwarded to an LLM prompt.

---

# Injection Prevention

- Use Prisma exclusively for database access; avoid raw SQL. If raw SQL is unavoidable, always use parameterized queries — never string concatenation/interpolation with user input.
- Never build LLM prompts by unsafely concatenating untrusted user input in a way that allows prompt injection to override system instructions. Keep system/business instructions clearly separated from user-supplied content in prompt templates.
- Escape or sanitize any dynamic content rendered in the frontend to prevent XSS. Avoid `dangerouslySetInnerHTML` unless the content is sanitized (e.g., via a trusted sanitizer library).
- Validate file uploads (type, size, content) to prevent path traversal, malicious file execution, or oversized payloads.

---

# LLM-Specific Security

- Never pass raw, unvalidated user input directly into prompts without a defined template boundary.
- Never trust structured output from Gemini/Claude as safe-by-default — always parse and validate before persisting or rendering.
- Never allow LLM output to directly generate executable code, shell commands, or SQL that gets run without review/sandboxing.
- Rate-limit and monitor LLM API usage to prevent abuse (cost exhaustion, denial of service against the provider).
- Never leak internal system prompts, API keys, or infrastructure details through LLM responses returned to the client.

---

# API & Network Security

- Enforce HTTPS in all production environments.
- Configure CORS explicitly — never use a wildcard (`*`) origin in production.
- Apply rate limiting on public-facing endpoints (especially authentication and LLM-generation endpoints) to prevent brute-force and abuse.
- Set secure HTTP headers (e.g., via Helmet in NestJS): `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`.
- Never expose stack traces, internal error details, or Prisma error messages directly to the client in production — return sanitized, generic error responses instead.

---

# Data Protection

- Never expose Prisma models directly to the frontend — always map to explicit DTOs/response types, ensuring sensitive fields (password hashes, internal IDs, tokens) are excluded.
- Apply the principle of least privilege: database users, service accounts, and API keys should only have the permissions strictly required.
- Personally identifiable information (student/professor data) must be handled with care — avoid unnecessary logging or duplication of PII across services.
- Encrypt sensitive data at rest when required by the data's sensitivity level, and always in transit (TLS).

---

# Logging & Monitoring

- Never log sensitive information: passwords, tokens, API keys, full request bodies containing credentials, or PII.
- Log security-relevant events: failed authentication attempts, authorization failures, unusual LLM usage patterns.
- Ensure logs do not become a secondary leak vector — treat log output with the same sensitivity rules as API responses.

---

# Dependency Security

- Avoid introducing unnecessary third-party dependencies, especially for security-sensitive operations (auth, crypto, sanitization) — prefer well-established, actively maintained libraries.
- Keep dependencies up to date; flag known vulnerable packages when identified.
- Never disable security-relevant linting, type-checking, or dependency-audit tooling to "make the build pass."

---

# Development Practices

- Never bypass security checks with shortcuts like `--no-verify`, disabled guards, or commented-out validation, even temporarily, without explicit user instruction.
- Do not introduce debug endpoints, backdoors, or "temporary" admin bypasses that could be shipped to production.
- When in doubt about whether something is sensitive, treat it as sensitive.

---

# Security Review Checklist

Before considering a feature complete, verify:

- Are all secrets sourced from environment variables, never hardcoded?
- Is every external input validated at the boundary?
- Is authentication enforced on the backend for every protected route?
- Is authorization checked against the validated user identity, not client-supplied data?
- Are Prisma models mapped to DTOs before reaching the frontend?
- Is LLM output validated before use?
- Are error responses sanitized in production?
- Is any sensitive data being logged?
- Would this code survive a security audit before going to production?

---

# Final Rule

**When security and convenience conflict, security wins.**

If a proposed implementation exposes secrets, trusts unvalidated input, or bypasses authentication/authorization for the sake of speed, it must be considered incorrect — even if it works and even under hackathon time pressure.
