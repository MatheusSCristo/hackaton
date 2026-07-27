# AI Agent Specification — Slide Generation Service

> **Purpose**
>
> This document specifies the architecture, responsibilities, workflow, and implementation details of the Slide Generation Agent. This agent is responsible only for transforming a professor's request into a PowerPoint presentation. It is intentionally independent from the Clinical Case Recommendation Agent and any analytics modules.

---

# Goal

The objective of this service is to allow a professor to generate an educational presentation in less than one minute using natural language.

The MVP prioritizes:

- Low implementation complexity
- Low operational cost
- High reliability
- Easy maintenance
- Clean architecture

Beautiful visual design is **not** a priority for this hackathon.

---

# MVP Scope

The first version is intentionally simple.

The application will:

- Receive a prompt from the professor.
- Send the prompt to Gemini (or Claude).
- Receive a structured JSON response.
- Convert the JSON into PowerPoint slides.
- Export a valid `.pptx` file.

Nothing else.

No images.

No animations.

No custom themes.

No AI image generation.

No visual editing.

The objective is simply producing a usable lecture presentation.

---

# User Flow

Professor

↓

Open "Generate Lecture"

↓

Fill simple form

↓

Click Generate

↓

LLM generates lecture structure

↓

Backend validates JSON

↓

Slide Generator creates presentation

↓

Professor downloads PowerPoint (.pptx)

---

# User Interface

The interface should be extremely simple.

Fields:

- Lecture topic
- Learning objective (optional)
- Target audience
- Lecture duration
- Number of slides
- Additional instructions (optional)

Button:

Generate Presentation

While processing:

Display loading state.

After completion:

Display download button.

---

# Backend Flow

1. Receive request.

2. Validate user input.

3. Build prompt.

4. Send request to Gemini API.

5. Receive structured JSON.

6. Validate JSON schema.

7. Convert JSON into internal slide model.

8. Generate PowerPoint.

9. Return file to frontend.

---

# Why Structured JSON?

The LLM should never generate PowerPoint directly.

Instead, it generates structured data.

Advantages:

- Easier validation.
- Easier debugging.
- Model independent.
- Easier template changes.
- Cleaner architecture.

The frontend becomes responsible only for rendering.

---

# Expected JSON

The LLM should always return JSON.

Example:

```json
{
  "title": "Prostate Cancer",
  "subtitle": "Medical School",
  "slides": [
    {
      "title": "Introduction",
      "content": [
        "Definition",
        "Epidemiology",
        "Risk factors"
      ],
      "speakerNotes": "Introduce the disease."
    }
  ]
}
```

---

# Internal Slide Model

Internally every slide should contain:

```typescript
interface Slide {
    title: string;
    content: string[];
    speakerNotes?: string;
}
```

Presentation:

```typescript
interface Presentation {
    title: string;
    subtitle?: string;
    slides: Slide[];
}
```

This model should remain independent of PowerPoint generation.

---

# PowerPoint Generation

The JSON should be converted into a PowerPoint presentation.

Recommended library:

**PptxGenJS**

Reasons:

- Mature
- Lightweight
- Open source
- Generates native .pptx files
- Works well with Node.js
- No external service required

The generator simply maps each slide object into a PowerPoint slide.

---

# Initial Template

The first template should be intentionally minimal.

Each slide contains:

Title

Body

Bullet list

Footer (optional)

No images.

No icons.

No branding.

No animations.

Visual quality is not important during MVP.

---

# Prompt Strategy

The backend should construct the system prompt.

Example responsibilities:

- Explain the desired JSON schema.
- Define the educational tone.
- Limit slide quantity.
- Prevent Markdown output.
- Prevent plain text output.
- Require valid JSON.

The frontend should never build prompts.

---

# Validation Layer

Never trust LLM output directly.

Validate:

- Required fields
- Maximum slides
- Empty content
- JSON format
- String lengths

If validation fails:

Automatically retry once.

If retry also fails:

Return a friendly error.

---

# Architecture

Frontend

↓

Generate Lecture Form

↓

Backend

↓

Prompt Builder

↓

Gemini API

↓

Structured JSON

↓

JSON Validator

↓

Presentation Model

↓

PowerPoint Generator

↓

.pptx File

↓

Frontend Download

---

# Responsibilities

Frontend

- Collect professor input
- Display loading state
- Download presentation

Backend

- Build prompts
- Call Gemini
- Validate JSON
- Generate PowerPoint
- Return file

LLM

- Create lecture outline
- Generate slide titles
- Generate bullet points
- Generate speaker notes

---

# Future Features (Out of Scope)

These features should **not** be implemented in the MVP:

- Image generation
- Charts
- Smart diagrams
- Animations
- Editable themes
- Custom branding
- AI-generated illustrations
- Clinical case recommendations
- Analytics integration
- ENAMED insights

These modules will be implemented as independent agents later.

---

# Design Principles

The implementation should follow these principles:

- Keep the architecture modular.
- Keep the LLM stateless.
- Separate generation from rendering.
- Never mix business logic with UI.
- Keep slide rendering deterministic.
- Make PowerPoint generation replaceable.
- Allow future support for Google Slides and PDF.

---

# Success Criteria

The MVP is successful if:

- A professor can write a prompt.
- The system generates a valid JSON response.
- The JSON is converted into slides.
- A valid `.pptx` file is generated.
- The presentation is readable.
- Total generation time remains under approximately 30 seconds.

The emphasis is on proving the workflow and architecture, not producing visually polished presentations.