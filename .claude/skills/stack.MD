# AI Agent Context — Project Technology Stack & Development Standards

> **Purpose**
>
> This document defines the official technology stack used by the project. Every AI coding agent (Claude Code, Cursor, Gemini, etc.) must follow these standards when generating code.
>
> Unless explicitly instructed otherwise, all implementations should strictly adhere to this stack and its ecosystem.
>
> **Do not introduce alternative frameworks or libraries** when an equivalent already exists in the project.

---

# General Principles

This project prioritizes:

- Type safety
- Maintainability
- Modular architecture
- Scalability
- Reusability
- Consistent code style
- High developer experience

Whenever possible:

- Follow existing project conventions.
- Reuse existing abstractions.
- Avoid introducing unnecessary dependencies.
- Prefer consistency over personal preference.

---

# Backend Stack

## Runtime

- Node.js

---

## Framework

### NestJS

The backend is built using **NestJS**.

Every new feature should follow NestJS best practices.

Prefer:

- Modules
- Controllers
- Services
- Providers
- Dependency Injection
- Guards
- Pipes
- DTOs
- Interceptors
- Exception Filters

Avoid bypassing NestJS architecture.

Business logic should **never** live inside controllers.

Controllers should only:

- Receive requests
- Validate input
- Delegate execution
- Return responses

---

## Language

TypeScript

Always enable and leverage strict typing.

Avoid:

- any
- unknown (unless absolutely necessary)
- implicit types

Prefer explicit interfaces and reusable types.

---

## ORM

### Prisma ORM

Database access must be performed exclusively through Prisma.

Best practices:

- Keep Prisma queries isolated.
- Never spread Prisma calls across the codebase.
- Abstract database operations behind repositories or services when appropriate.
- Avoid raw SQL unless absolutely necessary.
- Prefer Prisma transactions when multiple writes are involved.
- Use Prisma's generated types whenever possible.

---

## Database

### PostgreSQL

Primary relational database.

Guidelines:

- Normalize data appropriately.
- Use foreign keys.
- Prefer UUIDs when consistent with the existing project.
- Create proper indexes.
- Avoid unnecessary joins.
- Keep migrations clean and deterministic.

---

# Backend Architecture

Preferred flow:

```
Controller

↓

DTO Validation

↓

Application Service

↓

Domain Logic

↓

Repository / Prisma

↓

Database
```

Never:

```
Controller

↓

Prisma

↓

Database
```

Business rules should remain independent from persistence.

---

# Frontend Stack

## Framework

React

The application is built with modern React.

Prefer:

- Functional Components
- Hooks
- Composition

Avoid:

- Class Components
- Legacy React APIs

---

## Build Tool

Vite

All project configuration should remain compatible with Vite.

Do not introduce Webpack-specific solutions.

---

## Language

TypeScript

Strict typing is mandatory.

Avoid:

```ts
any
```

Always create:

- Interfaces
- Types
- Enums (when appropriate)

Prefer inferred types when they improve readability.

---

# UI Library

## Chakra UI v3

The project uses **Chakra UI v3** as its design system.

This is one of the most important project conventions.

Every visual component should use Chakra components.

Examples:

- Box
- Flex
- Stack
- VStack
- HStack
- Grid
- GridItem
- Text
- Heading
- Button
- Input
- Card
- Table
- Dialog
- Menu
- Drawer

Avoid:

- Raw HTML elements for layout
- Custom CSS for common layouts
- Reinventing Chakra components

For example:

Instead of:

```tsx
<div className="container">
```

Prefer:

```tsx
<Box>
```

Instead of:

```tsx
<section>
```

Prefer:

```tsx
<Stack>
```

Instead of custom spacing:

Use Chakra spacing tokens.

---

# Styling

Prefer Chakra's styling system.

Use:

- Props
- Theme Tokens
- Responsive Props

Avoid:

- Inline CSS
- CSS Modules (unless already established)
- Styled Components
- Emotion custom wrappers (unless required by Chakra)

Do not create custom styling systems.

---

# Icons

Library:

Lucide React

Use Lucide icons consistently.

Do not introduce additional icon libraries.

---

# Forms

## React Hook Form

All forms should use:

React Hook Form

Responsibilities:

- Form state
- Validation integration
- Submission
- Error handling

Avoid local state for complex forms.

---

## Validation

Use:

Zod

Validation should happen through schemas.

Example flow:

```
Form

↓

React Hook Form

↓

Zod Schema

↓

Validated Data

↓

API
```

Avoid manual validation whenever possible.

---

# API Communication

Library:

Axios

Create a centralized API client.

Avoid scattered Axios instances.

Prefer:

```
api/

axios.ts

lectureApi.ts

analyticsApi.ts
```

instead of inline requests.

---

# Data Fetching

Library:

TanStack Query (React Query)

All server state should be managed with React Query.

Use:

- useQuery
- useMutation
- Query Keys
- Cache Invalidation
- Optimistic Updates (when appropriate)

Avoid manual loading state management when React Query already provides it.

---

# Routing

Library:

React Router DOM

Organize routes by feature.

Prefer nested routing when appropriate.

Avoid deeply coupled route structures.

---

# Global State

Library:

Zustand

Use Zustand only for true client-side global state.

Examples:

- Theme
- Authentication
- User Preferences
- UI State
- Temporary Presentation State

Do NOT use Zustand for server state.

Server state belongs to React Query.

---

# Internationalization

Library:

i18next (react-i18next)

The application is fully multilingual.

All user-facing text must be translatable.

Never hardcode strings inside components.

Use translation keys.

Example:

Instead of:

```tsx
<Button>Create</Button>
```

Prefer:

```tsx
<Button>{t("lecture.create")}</Button>
```

---

# Supported Languages

The project supports:

- Portuguese
- English
- Spanish
- French
- German
- Russian

Every new feature must respect internationalization.

This includes:

- Labels
- Buttons
- Errors
- Validation messages
- Notifications
- API responses (when applicable)

---

# Folder Organization (Frontend)

Prefer organization by feature.

Example:

```
src/

features/

lecture-generation/

components/

hooks/

pages/

services/

schemas/

types/

utils/

analytics/

clinical-cases/

shared/

components/

hooks/

layouts/

providers/

services/

types/

theme/

routes/
```

Avoid organizing the entire application by file type.

---

# Component Philosophy

Components should be:

Small

Reusable

Composable

Focused

Avoid components larger than a few hundred lines.

Split complex UI into smaller building blocks.

---

# Hooks

Extract business logic into custom hooks.

Example:

```
useGeneratePresentation()

useProfessorAnalytics()

useClinicalCaseSearch()
```

Avoid putting complex logic directly inside components.

---

# API Layer

Never call Axios directly inside components.

Preferred architecture:

```
Component

↓

Custom Hook

↓

API Service

↓

Axios Client

↓

Backend
```

---

# Type Sharing

Create centralized types.

Avoid duplicated interfaces.

Prefer:

```
types/

presentation.ts

analytics.ts

professor.ts

student.ts
```

---

# Error Handling

Errors should be:

Predictable

Typed

User-friendly

Provide meaningful feedback.

---

# Notifications

Centralize notifications.

Avoid scattered alert logic.

Prefer reusable notification helpers.

---

# Theme

Use Chakra's theme system.

Never hardcode:

- Colors
- Font sizes
- Border radius
- Shadows
- Spacing

Use design tokens whenever possible.

---

# AI Integration

The frontend should never communicate directly with the LLM.

Flow:

```
React

↓

Backend API

↓

NestJS

↓

Gemini / Claude

↓

Response

↓

Frontend
```

The backend owns:

- Prompt generation
- LLM communication
- Validation
- Parsing

The frontend only consumes structured responses.

---

# Development Philosophy

When generating code:

Always ask:

- Is this reusable?
- Is this typed?
- Is this modular?
- Does this follow the project's architecture?
- Does this use the project's official libraries?
- Can another developer understand this immediately?

If multiple implementation options exist:

Choose the one that best matches the current stack rather than introducing new technologies.

---

# Final Rule

**Consistency is more important than novelty.**

Every implementation should look as if it were written by the same senior engineering team.

If a solution introduces unnecessary libraries, breaks established conventions, or bypasses the project's architecture, it should be considered incorrect—even if it technically works.