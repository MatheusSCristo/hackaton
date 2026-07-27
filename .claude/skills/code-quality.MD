# AI Engineering Standards
## Architecture, Code Quality & Development Guidelines

> **Purpose**
>
> This document defines the engineering standards that every AI coding agent must follow while contributing to this project.
>
> The goal is to produce production-quality software that is maintainable, modular, scalable, testable, and easy to evolve.
>
> These guidelines are intentionally **technology-agnostic** and should be followed regardless of the programming language or framework being used.

---

# Core Philosophy

This project must be developed as if it were intended for production, not merely a hackathon prototype.

Although some business features may be simplified for demonstration purposes, **code quality must never be compromised**.

Every implementation should prioritize:

- Readability
- Maintainability
- Simplicity
- Extensibility
- Predictability
- Low coupling
- High cohesion

Code should be easy for another senior engineer to understand without additional explanations.

---

# Engineering Principles

Always follow these principles.

## SOLID

Follow SOLID principles whenever applicable.

- Single Responsibility Principle
- Open/Closed Principle
- Liskov Substitution Principle
- Interface Segregation Principle
- Dependency Inversion Principle

---

## KISS

Keep implementations simple.

Never introduce complexity unless there is a clear business justification.

Simple solutions are preferred over clever solutions.

---

## DRY

Avoid duplicated logic.

If similar behavior appears multiple times, create reusable abstractions.

---

## YAGNI

Do not implement features that are not currently required.

Avoid speculative abstractions.

Build only what is necessary while keeping future extensions easy.

---

## Composition over Inheritance

Prefer composition whenever possible.

Avoid deep inheritance trees.

---

# Code Organization

The project must be organized by business domains rather than technical layers whenever possible.

Prefer:

```
LectureGeneration/
Presentation/
Analytics/
ClinicalCases/
Professor/
Students/
Shared/
Infrastructure/
```

Avoid:

```
Controllers/
Services/
Repositories/
Utils/
Models/
```

at the root level without domain separation.

Business capabilities should own their internal implementation.

---

# Modular Architecture

Every module should be independent.

Modules should communicate through clearly defined interfaces.

No module should directly depend on another module's internal implementation.

Only public contracts should be exposed.

---

# Separation of Concerns

Every class, function or module should have a single responsibility.

Examples:

Presentation generation

≠

Prompt generation

≠

PowerPoint rendering

≠

LLM communication

≠

Analytics

≠

Persistence

Never mix responsibilities.

---

# Dependency Direction

Business logic must never depend directly on:

- Frameworks
- UI libraries
- Databases
- External APIs
- HTTP clients

Instead, depend on abstractions.

Infrastructure should depend on business logic—not the other way around.

---

# Domain First

Business rules are the most important part of the application.

Frameworks are implementation details.

The domain should remain framework-independent whenever possible.

---

# Naming

Choose names that describe business concepts.

Avoid generic names.

Good examples:

LectureGenerator

PresentationBuilder

ClinicalCaseRecommendationEngine

SlideRenderer

ProfessorAnalyticsService

Avoid:

Manager

Helper

Processor

Handler

Utils

Common

Misc

---

# Functions

Functions should be:

Small

Focused

Predictable

Prefer functions under approximately 30 lines whenever practical.

A function should answer only one question.

If a function needs comments to explain what it does, it is probably too complex.

---

# Classes

Classes should represent one concept.

Avoid "God Objects."

Large classes usually indicate multiple responsibilities.

Split them into smaller components.

---

# File Size

Files should remain reasonably small.

If a file becomes difficult to navigate, split it into multiple components.

Large files usually indicate poor separation of responsibilities.

---

# Folder Structure

Every feature should contain its own:

```
Feature/

Application/

Domain/

Infrastructure/

Presentation/

Tests/
```

or an equivalent modular organization.

Avoid global folders shared by unrelated business features.

---

# Business Logic

Business rules must never be implemented inside:

Controllers

Routes

Views

UI Components

Database Models

Infrastructure classes

Business logic belongs inside the domain layer.

---

# Frontend Principles

Frontend should focus only on:

Displaying information

Collecting user input

Managing UI state

Calling application services

Rendering results

Business decisions should remain outside the UI.

---

# Backend Principles

Backend should orchestrate business rules.

Responsibilities include:

Validation

Authorization

Workflow orchestration

Persistence

External integrations

Business calculations

Avoid placing business rules inside controllers.

---

# API Design

APIs should be:

Consistent

Predictable

Versionable

Well documented

Strongly typed

Avoid exposing internal implementation details.

---

# Type Safety

Use strong typing everywhere.

Avoid:

Dynamic objects

Magic dictionaries

Unknown structures

Loose typing

Define explicit contracts.

Every DTO should be strongly typed.

Every response should have a defined schema.

---

# Validation

Validate all external input.

Never trust:

User input

HTTP requests

LLM responses

Database data

External APIs

Validation should happen at application boundaries.

---

# Error Handling

Errors should be explicit.

Never silently ignore failures.

Provide meaningful messages.

Differentiate between:

Business errors

Validation errors

Infrastructure errors

Unexpected errors

---

# Logging

Log meaningful events.

Do not log excessive noise.

Log:

Errors

External API failures

Important business events

Performance bottlenecks

Avoid logging sensitive information.

---

# Configuration

Never hardcode:

API Keys

URLs

Secrets

Environment values

Configuration should be externalized.

---

# Constants

Avoid magic values.

Create named constants.

Bad:

```
if(score > 75)
```

Good:

```
const PASSING_SCORE = 75
```

---

# Testing

Code should be designed for testing.

Prefer dependency injection.

Avoid static dependencies.

Avoid hidden state.

Business rules should be testable without infrastructure.

---

# External Services

Wrap every external service.

Never call providers directly from business logic.

Example:

Good

LectureGenerationService

↓

LLMProvider Interface

↓

GeminiProvider

ClaudeProvider

OpenAIProvider

Bad

Business logic

↓

Gemini SDK

---

# LLM Integration

The language model should behave like a replaceable dependency.

Never scatter prompts across the project.

Centralize:

Prompt templates

Prompt builders

Output parsers

Response validators

---

# Prompt Engineering

Prompts are business assets.

Treat them as source code.

Version them.

Document them.

Keep them reusable.

---

# JSON Parsing

Never trust LLM output.

Always validate:

Required fields

Types

Ranges

Missing values

Invalid formats

Unexpected properties

---

# Async Operations

Use asynchronous operations responsibly.

Avoid unnecessary sequential execution.

Parallelize independent tasks whenever possible.

---

# Performance

Optimize only when necessary.

Prioritize:

Correctness

Readability

Maintainability

Avoid premature optimization.

---

# Reusability

If a component can reasonably be reused by another feature, extract it.

Otherwise, keep it local.

Avoid creating "shared" abstractions too early.

---

# Documentation

Every important module should explain:

Purpose

Responsibilities

Inputs

Outputs

Dependencies

Assumptions

Avoid documenting obvious code.

Document decisions.

---

# Clean Code

Write code that explains itself.

Prefer:

Good naming

Small functions

Clear abstractions

Strong typing

Avoid excessive comments.

---

# Comments

**Default to writing no comments.**

Code must be self-explanatory through naming, small functions, and clear abstractions. If a piece of code needs a comment to be understood, rewrite the code instead of explaining it.

Do not write comments that describe what the code does — that is what good naming and readable code already communicate. Do not add docstrings, header banners, or section dividers as comments.

The only acceptable exception is a comment capturing a non-obvious **why**: a hidden constraint, a workaround for a specific external bug, or a subtlety that would surprise a future reader and cannot be expressed through code alone. Even then, keep it to a single short line. When in doubt, omit it.

This rule applies to every file generated for this project, in every language and every layer (backend, frontend, scripts, configuration).

---

# Code Reviews

Before considering a task complete, verify:

- Is this the simplest solution?
- Is the code easy to understand?
- Is it modular?
- Can it be tested?
- Is it strongly typed?
- Is there duplicated logic?
- Is business logic isolated?
- Are responsibilities well separated?
- Would another senior engineer understand this quickly?
- Can this evolve without large refactoring?

---

# Definition of Done

A feature is only considered complete if:

- Business requirements are satisfied.
- Code follows this document.
- Strong typing is implemented.
- Validation exists.
- Errors are handled.
- Architecture remains modular.
- No unnecessary coupling exists.
- No dead code exists.
- No duplicated logic exists.
- External dependencies are abstracted.
- The implementation is easy to extend.
- Another engineer could maintain it without additional explanation.

---

# Final Principle

Every implementation should answer the following question:

> **"If this hackathon project became a real production product tomorrow, would this code still be acceptable?"**

If the answer is **no**, redesign the implementation before writing code.