# CLAUDE.md

# AI Development Context

This repository is developed with Claude Code as the primary AI engineering assistant.

Before performing **any task**, always read the project documentation in the following order.

---

# 1. Company Context (Highest Priority)

Read first:

`.claude/docs/about-company.MD`

This document explains:

- Company background
- Business model
- Product
- Clinical simulation workflow
- Core business
- Educational philosophy

This document provides the business context required for every implementation.

---

# 2. Challenge Context

Read second:

`.claude/docs/challenge and-proposed-solution.MD`

This document explains:

- Hackathon objectives
- Business problem
- Product vision
- Proposed solution
- MVP scope
- Analytics vision
- ENAMED correlation
- Long-term strategy

Every implementation must align with this document.

---

# 3. Current Project Specification

Read:

`.claude/projects/slide-generate.MD`

This file describes the feature currently being developed.

It includes:

- Functional requirements
- Architecture
- User flow
- Technical decisions
- Expected outputs
- Responsibilities
- Future evolution

Do not implement features outside this scope unless explicitly requested.

---

# 4. Engineering Standards

Read:

`.claude/skills/code-quality.MD`

This document defines:

- Architecture standards
- SOLID principles
- Clean Architecture
- Naming conventions
- Folder organization
- Dependency rules
- Code quality requirements
- Testing philosophy

Every generated file must follow these standards.

---

# 5. Project Stack

Read:

`.claude/skills/stack.MD`

This document defines the project's official technology stack.

Follow it strictly.

Never introduce alternative frameworks or libraries when an official solution already exists.

---

# 6. Security Standards

Read:

`.claude/skills/security.MD`

This document defines:

- Environment variable and secrets handling
- Authentication and authorization rules
- Input validation and injection prevention
- LLM-specific security directives
- API, network, and data protection standards
- Logging, monitoring, and dependency security

Every implementation must comply with these security directives, with no exceptions for speed or convenience.

---

# Development Rules

Always prioritize:

- Readability
- Strong typing
- Modular architecture
- Separation of concerns
- Maintainability
- Scalability
- Reusability

Business logic must remain independent from frameworks.

Never sacrifice architecture quality for speed.

---

# Feature Development Process

Whenever implementing a feature, follow this workflow.

1. Understand the business objective.
2. Read the relevant documentation.
3. Design the architecture.
4. Break the feature into small tasks.
5. Implement incrementally.
6. Validate types.
7. Review architecture.
8. Ensure consistency with existing code.

Never skip architectural planning.

---

# Implementation Guidelines

Before writing code:

- Identify which business domain owns the feature.
- Reuse existing abstractions whenever possible.
- Avoid duplicated logic.
- Keep components small.
- Keep functions focused.
- Prefer composition over inheritance.
- Respect module boundaries.

---

# LLM Guidelines

When interacting with Gemini or Claude APIs:

- Keep prompts centralized.
- Never hardcode prompts inside controllers or UI.
- Validate every AI response.
- Never trust LLM output directly.
- Always parse structured responses.
- Retry safely when parsing fails.

---

# Frontend Guidelines

- Use Chakra UI v3 exclusively.
- Use React Query for server state.
- Use Zustand only for client state.
- Use React Hook Form + Zod for forms.
- Never hardcode translated strings.
- Always use i18n keys.

---

# Backend Guidelines

- Use NestJS conventions.
- Keep controllers thin.
- Keep business logic inside services/domain.
- Use Prisma exclusively for persistence.
- Keep infrastructure isolated.
- Never expose ORM models directly to the frontend.

---

# Decision Making

If multiple implementations are possible:

1. Prefer the simplest architecture.
2. Prefer the most maintainable solution.
3. Prefer consistency with the existing codebase.
4. Prefer reusable abstractions.
5. Prefer explicit code over clever code.

---

# If Documentation Conflicts

Priority order is:

1. Security directives (non-negotiable, always override other guidance)
2. Current user instructions
3. Project specification (`projects`)
4. Challenge documentation
5. Company documentation
6. Stack rules
7. Code quality rules

---

# Important

Do **not** rewrite the project architecture unless explicitly requested.

Respect the existing folder structure.

Respect existing naming conventions.

Prefer extending the current architecture instead of replacing it.

Always explain architectural decisions when introducing new abstractions.

When a task is ambiguous, make the smallest reasonable assumption that preserves the project's architecture.

Your goal is to behave like a senior software engineer working on a production-ready codebase, not like a code generator.