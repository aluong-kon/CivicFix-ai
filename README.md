# CivicFix AI

CivicFix AI turns community photos, voice reports, and location data into verified, prioritized incidents so organizations know what needs attention first.

Built for the GOMYCODE x NVIDIA Real World AI Impact Award, September 2026.

## The Problem

Communities report infrastructure failures constantly: broken roads, failed water points, drainage problems, sanitation issues, failed lighting. These reports arrive scattered, duplicated, and unranked. Organizations cannot tell which reports describe the same incident, which are most severe, or which to act on first. Real problems go unaddressed while staff sort through noise manually.

## The Solution

A resident submits a photo, a voice note, and a location for any infrastructure problem. NVIDIA AI analyzes the submission end to end:

1. Classifies the problem type from the photo and voice note
2. Detects duplicate reports describing the same incident
3. Assesses severity from visual and audio evidence
4. Generates a prioritized action queue with confidence scores

A human verification step sits before any action is dispatched. The system assists judgment, it does not replace it.

## Demo

The demo runs the pipeline against 247 prepared reports and answers, live, which problems demand action first, with the reasoning shown alongside the answer.

Demo video: [link]
Presentation: [link]

## Who This Is For

Municipalities, NGOs, humanitarian agencies, and utilities managing infrastructure across dispersed communities, including refugee camps and informal settlements. Built and tested against Kenya context, designed to scale across Africa.

## Tech Stack

Fill in your exact stack here. Suggested structure below, replace with what you actually used.

- AI / ML: [NVIDIA model or API name]
- Backend: [FastAPI / other]
- Database: [PostgreSQL / Supabase]
- Frontend: [framework]
- Other services: [any additional APIs, datasets, or tools]

## Project Structure

Replace this with your actual repository layout.

```
civicfix-ai/
  backend/
  frontend/
  data/
  docs/
  README.md
```

## Setup

Fill in the actual steps once your stack is finalized. Example shape below.

```bash
git clone [repo url]
cd civicfix-ai
# install dependencies
# set environment variables
# run the app
```

## AI Use Disclosure

CivicFix AI uses NVIDIA AI for multimodal analysis across the pipeline: image analysis on submitted photos, audio processing on voice notes, duplicate detection across incoming reports, and severity scoring that feeds the prioritization queue. [Name the exact NVIDIA model or API used, and any other models, datasets, or APIs.] The AI performs the classification, deduplication, and ranking that the system is built around. A human verification step remains before any action is dispatched.

## Team

Miles & Makuei

- Aluong Yak Kon
- Makuei Geu

## Next Steps

Pilot CivicFix AI with a local authority or NGO partner in Kakuma to validate the prioritization model against real response outcomes, then expand data sources and language coverage for wider deployment across refugee settlements and municipalities in the region.

## License

[Add your license here, or state "All rights reserved" if undecided.]
