# Patient360 — Product Overview

> **Document Purpose**
>
> This document provides contextual information about the Patient360 platform for AI coding assistants (Claude Code, Cursor, etc.) during the hackathon. It summarizes the platform's purpose, business model, target audience, and, most importantly, how a clinical case simulation works.
>
> **Note:** This document is based on publicly available information about Patient360 and a general understanding of how the platform operates. Some implementation details may be simplified and should be adjusted according to internal knowledge.

---

# What is Patient360?

Patient360 is a Brazilian health technology company focused on medical education.

Its primary product is a clinical simulation platform that allows healthcare students and professionals to practice clinical reasoning through virtual patients.

The platform aims to bridge the gap between theoretical education and real-world clinical practice by providing a safe environment where learners can make decisions without risking patient safety.

---

# Mission

To improve healthcare education through digital learning experiences based on realistic clinical simulations.

---

# Problem It Solves

Traditional healthcare education has several limitations:

- Limited exposure to real patients during training.
- Difficulty ensuring every student experiences the same clinical scenarios.
- Risk associated with learning directly on real patients.
- Low repeatability of clinical cases.

Patient360 addresses these challenges by providing virtual clinical cases that can be practiced repeatedly in a controlled environment.

---

# Target Audience

The platform serves multiple customer segments.

## Educational Institutions

Including:

- Medical schools
- Nursing schools
- Physical Therapy programs
- Pharmacy programs
- Dentistry schools
- Other healthcare-related programs

**Primary goal:**

Provide students with practical clinical training.

---

## Hospitals

Hospitals use the platform for:

- Internal staff training
- Continuing medical education
- Clinical protocol standardization

---

## Healthcare Industry

Examples include:

- Pharmaceutical companies
- Medical device manufacturers

**Primary goals:**

- Employee training
- Medical education initiatives
- Commercial team education

---

# Core Business

The company's core product is a virtual clinical case simulation platform.

Each case represents a virtual patient with a specific medical condition.

The learner assumes the role of a healthcare professional and is responsible for managing the entire consultation, from the first interaction to diagnosis and treatment.

Learning occurs through clinical decision-making.

---

# Virtual Patient Concept

A virtual patient is a digital representation of a real patient.

Each patient contains comprehensive clinical information, including:

- Age
- Sex
- Medical history
- Symptoms
- Clinical signs
- Laboratory and imaging results
- Disease progression

During the simulation, the patient only reveals information in response to questions asked by the learner.

This encourages clinical reasoning instead of simply presenting all available information upfront.

---

# Clinical Case Workflow

A typical simulation follows the workflow below.

---

## 1. Case Presentation

The learner receives the patient's initial information.

Examples:

- Age
- Sex
- Chief complaint
- Initial clinical context

Example:

> Female, 54 years old.
>
> Chest pain for the past two hours.

At this stage, no diagnosis has been established.

---

## 2. Medical History (Anamnesis)

The learner conducts the patient interview.

They choose which questions to ask.

Examples include:

- Symptom onset
- Pain intensity
- Aggravating factors
- Relieving factors
- Previous medical conditions
- Current medications
- Allergies
- Family history
- Lifestyle habits

The patient's responses depend entirely on the questions asked.

---

## 3. Physical Examination

After collecting the medical history, the learner performs a physical examination.

Examples:

- Vital signs
- Cardiac auscultation
- Pulmonary auscultation
- Inspection
- Palpation
- Neurological examination

Only the findings corresponding to the selected examinations are revealed.

---

## 4. Differential Diagnosis

Based on the collected information, the learner formulates diagnostic hypotheses.

Examples:

- Acute Myocardial Infarction
- Angina
- Pulmonary Embolism
- Pneumonia

At this stage, the diagnosis is still provisional.

---

## 5. Ordering Diagnostic Tests

The learner decides which tests to request.

Examples:

- Complete Blood Count (CBC)
- Electrocardiogram (ECG)
- Troponin
- Chest X-ray
- CT Scan
- Arterial Blood Gas
- C-Reactive Protein (CRP)

Each diagnostic test may include:

- Cost
- Time to obtain results
- Clinical findings

---

## 6. Interpreting Test Results

Once results become available, the learner analyzes the collected evidence.

Expected actions include:

- Eliminating unlikely diagnoses
- Strengthening likely hypotheses
- Identifying the correct diagnosis

---

## 7. Final Diagnosis

The learner selects the diagnosis they believe best explains the patient's condition.

Depending on the platform configuration, multiple differential diagnoses may also be evaluated.

---

## 8. Clinical Management

After establishing the diagnosis, the learner defines the appropriate treatment plan.

Possible actions include:

- Prescribing medications
- Recommending therapies
- Referring to specialists
- Hospital admission
- Patient discharge
- Clinical guidance and education

---

## 9. Educational Feedback

At the end of the simulation, the platform provides detailed feedback.

This may include:

- Correct clinical decisions
- Incorrect decisions
- Unnecessary diagnostic tests
- Missed diagnostic opportunities
- Inappropriate treatment choices
- Clinical reasoning explanations
- Scientific references and guidelines

The goal is to reinforce learning and improve future performance.

---

# Educational Philosophy

The platform is designed to develop:

- Clinical reasoning
- Critical thinking
- Medical decision-making
- Evidence-based practice

Rather than simply testing theoretical knowledge, Patient360 simulates the complete clinical workflow.

---

# Clinical Case Flow

```text
Virtual Patient

↓

Chief Complaint

↓

Medical History (Anamnesis)

↓

Physical Examination

↓

Differential Diagnosis

↓

Diagnostic Tests

↓

Test Results

↓

Final Diagnosis

↓

Treatment Plan

↓

Educational Feedback
```

---

# Benefits

## For Students

- Unlimited practice opportunities
- Safe environment for learning from mistakes
- Development of clinical reasoning

---

## For Educational Institutions

- Standardized learning experience
- Performance tracking
- Scalable clinical education

---

## For Hospitals

- Continuous professional education
- Workforce training
- Protocol standardization

---

# Typical Platform Modules

A clinical simulation platform generally consists of the following components:

- Clinical Case Library
- Simulation Engine
- Virtual Patient System
- Medical Interview Module
- Physical Examination Module
- Diagnostic Test Module
- Diagnosis Module
- Treatment Module
- Assessment Engine
- Educational Feedback Engine
- Performance Dashboard
- Administration Portal
- Reporting System

---

# Key Concepts

## Clinical Case

A complete simulated patient scenario.

---

## Virtual Patient

A digital representation of a real patient.

---

## Medical History (Anamnesis)

The structured collection of patient history.

---

## Physical Examination

Evaluation of clinical signs and physical findings.

---

## Differential Diagnosis

A list of potential conditions explaining the patient's presentation.

---

## Final Diagnosis

The confirmed clinical conclusion based on the available evidence.

---

## Clinical Management

The treatment and care plan defined by the learner.

---

## Educational Feedback

Detailed performance analysis and learning recommendations.

---

# Summary

Patient360 is a healthcare education platform built around clinical simulation.

Its primary value proposition is enabling healthcare students and professionals to strengthen their clinical reasoning by interacting with virtual patients and managing the complete care process—from history taking and physical examination to diagnosis, treatment planning, and reflective feedback—in a safe, repeatable, and evidence-based learning environment.