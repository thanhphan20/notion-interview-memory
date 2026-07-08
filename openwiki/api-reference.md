# API Reference

This page documents all REST API endpoints exposed by the app. The API is used by the React UI but can also be called directly for testing or scripting.

## Base URL

All endpoints are relative to `http://localhost:3000/api`.

## Response Format

All responses are JSON. Errors return a JSON object with an `error` field and HTTP status 400+ (typically 400 or 404).

```json
{
  "error": "message describing the error"
}
```

## Endpoints by Category

### Dashboard & Overview

#### GET `/dashboard`

Returns the full dashboard payload: countdown, heatmap, lapses, and due queue.

**Query Parameters**:
- `now` (optional): ISO 8601 timestamp for testing; defaults to current time

**Response**:

```json
{
  "countdown": {
    "daysUntilInterview": 14,
    "sprintAverage": 78.5,
    "percentGreen": 65
  },
  "heatmap": [
    {
      "tag": "data-structures",
      "retentionRate": 0.85,
      "status": "green",
      "trend": "↗",
      "cardCount": 12
    },
    {
      "tag": "algorithms",
      "retentionRate": 0.45,
      "status": "red",
      "trend": "↘",
      "cardCount": 8
    }
  ],
  "lapses": [
    {
      "id": 5,
      "cardId": 5,
      "question": "What is the time complexity of merge sort?",
      "tags": ["algorithms"],
      "lastReviewedAt": "2026-07-02T14:30:00Z",
      "rating": "again"
    }
  ],
  "dueQueue": [
    {
      "id": 1,
      "question": "Describe binary search tree...",
      "tags": ["data-structures"]
    }
  ]
}
```

**Status Codes**:
- `200`: Success
- `400`: Error (database, computation)

---

#### GET `/lapses`

Returns cards with recent lapses (rated `'again'` or `'hard'` within a time window).

**Query Parameters**:
- `windowDays` (optional): Number of days to look back; defaults to 7
- `now` (optional): ISO 8601 timestamp for testing

**Response**:

```json
[
  {
    "id": 5,
    "cardId": 5,
    "question": "What is the time complexity of merge sort?",
    "expectedAnswer": "O(n log n) in all cases...",
    "rubric": ["mentions O(n log n)", "explains divide and conquer"],
    "tags": ["algorithms"],
    "lastReviewedAt": "2026-07-02T14:30:00Z",
    "rating": "again"
  }
]
```

---

### Interview Date Management

#### GET `/interview-date`

Get the current interview date and updated countdown.

**Response**:

```json
{
  "interviewDate": "2026-08-15",
  "countdown": {
    "daysUntilInterview": 42,
    "sprintAverage": 72,
    "percentGreen": 55
  }
}
```

Or, if no interview date is set:

```json
{
  "interviewDate": null,
  "countdown": {
    "daysUntilInterview": null,
    "sprintAverage": 72,
    "percentGreen": 55
  }
}
```

---

#### POST `/interview-date`

Set or clear the interview date. Clamping affects all future reviews.

**Request Body**:

```json
{
  "date": "2026-08-15"
}
```

Or, to clear:

```json
{
  "date": null
}
```

**Response**: Same as `GET /interview-date` with updated date.

**Status Codes**:
- `200`: Success
- `400`: Invalid date format (must be YYYY-MM-DD or null)

---

### Cards & Drafts

#### GET `/state`

**Testing only**: Returns whole-app state snapshot (all cards, drafts, reviews, notes, MCQs, MCQ reviews).

Used internally by the mock API client for UI development. Real implementation may differ.

**Response**:

```json
{
  "stats": {
    "totalNotes": 10,
    "draftCount": 3,
    "cardCount": 25,
    "reviewCount": 87,
    "mcqReviewCount": 42,
    "dueCount": 5
  },
  "notes": [...],
  "drafts": [...],
  "dueCards": [...],
  "reviews": [...],
  "mcqs": [...],
  "mcqReviews": [...]
}
```

---

#### GET `/cards`

List all cards.

**Query Parameters**: None

**Response**:

```json
[
  {
    "id": 1,
    "noteId": 42,
    "sourceDraftId": 12,
    "question": "Describe the time complexity of searching in a binary search tree.",
    "expectedAnswer": "O(log n) average case; O(n) worst case if unbalanced.",
    "rubric": ["mentions time complexity", "distinguishes average vs worst"],
    "tags": ["data-structures", "algorithms"],
    "createdAt": "2026-07-01T14:40:00Z"
  }
]
```

---

#### POST `/cards/:id/review`

Submit an open-recall review (user answer + self-grade).

**Request Body**:

```json
{
  "answer": "O(log n) in balanced case, O(n) worst case.",
  "rating": "good",
  "elapsedSeconds": 92
}
```

**Response**:

```json
{
  "review": {
    "id": 142,
    "cardId": 1,
    "userAnswer": "O(log n) in balanced case, O(n) worst case.",
    "aiFeedback": null,
    "rating": "good",
    "elapsedSeconds": 92,
    "reviewedAt": "2026-07-03T10:15:00Z"
  },
  "schedule": {
    "cardId": 1,
    "dueAt": "2026-07-07T10:15:00Z",
    "stability": 2.1,
    "difficulty": 3.8,
    "elapsedDays": 2,
    "scheduledDays": 4,
    "reps": 2,
    "lapses": 0,
    "state": "review",
    "lastReviewedAt": "2026-07-03T10:15:00Z"
  },
  "nextCard": {
    "id": 2,
    "question": "...",
    ...
  }
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid rating, card not found, etc.

---

#### POST `/cards/:id/critique`

Request AI critique for a user's answer (optional, advisory only).

**Request Body**:

```json
{
  "answer": "O(log n) in balanced case..."
}
```

**Response**:

```json
{
  "critique": {
    "summary": "Good understanding of average case, but you missed the worst case scenario.",
    "missingKeyPoints": ["Red-Black tree balancing", "AVL tree self-correction"],
    "suggestedRating": "good"
  }
}
```

**Status Codes**:
- `200`: Success
- `400`: Answer too long, AI provider error, etc.
- `503`: AI provider unavailable

**Important**: The user's self-selected rating is final. The `suggestedRating` is advisory only.

---

### Drafts

#### GET `/drafts`

List all card drafts (pending approval).

**Response**:

```json
[
  {
    "id": 12,
    "noteId": 42,
    "question": "What is a red-black tree?",
    "expectedAnswer": "A self-balancing binary search tree...",
    "rubric": ["explains self-balancing", "mentions rotation", "mentions color property"],
    "tags": ["data-structures"],
    "status": "draft",
    "createdAt": "2026-07-02T10:00:00Z"
  }
]
```

---

#### POST `/drafts/:id/approve`

Approve a draft → creates a card + schedule. Card enters practice immediately.

**Request Body**: None

**Response**:

```json
{
  "card": {
    "id": 25,
    "noteId": 42,
    "sourceDraftId": 12,
    "question": "What is a red-black tree?",
    "expectedAnswer": "A self-balancing binary search tree...",
    "rubric": ["explains self-balancing", "mentions rotation"],
    "tags": ["data-structures"],
    "createdAt": "2026-07-02T10:05:00Z"
  },
  "schedule": {
    "cardId": 25,
    "dueAt": "2026-07-02T10:05:00Z",
    "stability": 0.4,
    "difficulty": 5,
    "elapsedDays": 0,
    "scheduledDays": 0,
    "reps": 0,
    "lapses": 0,
    "state": "new",
    "lastReviewedAt": null
  }
}
```

**Status Codes**:
- `200`: Success
- `404`: Draft not found
- `400`: Draft already approved/rejected

---

#### POST `/drafts/:id/reject`

Reject a draft → deletes it permanently.

**Request Body**: None

**Response**: `{}`

**Status Codes**:
- `200`: Success
- `404`: Draft not found

---

### Notion Sync

#### POST `/notion/sync`

Sync Notion database: fetch pages from user's configured Notion database and create/update notes.

**Request Body**: None (uses settings stored in database)

**Response**:

```json
{
  "imported": 5,
  "updated": 2,
  "notes": [
    {
      "id": 42,
      "notionPageId": "abc-123-def-456",
      "title": "Binary Search Tree Basics",
      "content": "# Binary Search Tree...",
      "sourceUrl": "https://notion.so/abc-123-def-456",
      "tags": ["data-structures", "algorithms"],
      "notionLastEditedTime": "2026-07-01T14:30:00Z",
      "syncedAt": "2026-07-03T10:00:00Z"
    }
  ]
}
```

**Status Codes**:
- `200`: Success
- `400`: Notion configuration missing, API error
- `401`: Notion token invalid

---

### Notes

#### GET `/notes`

List all synced notes.

**Response**:

```json
[
  {
    "id": 42,
    "notionPageId": "abc-123-def-456",
    "title": "Binary Search Tree Basics",
    "content": "# Binary Search Tree...",
    "sourceUrl": "https://notion.so/abc-123-def-456",
    "tags": ["data-structures", "algorithms"],
    "notionLastEditedTime": "2026-07-01T14:30:00Z",
    "syncedAt": "2026-07-03T10:00:00Z"
  }
]
```

---

#### POST `/notes/:id/generate`

Generate drafts and MCQs from a single note using AI.

**Request Body**: None

**Response**:

```json
{
  "drafts": [
    {
      "id": 12,
      "noteId": 42,
      "question": "What is a red-black tree?",
      "expectedAnswer": "...",
      "rubric": [...],
      "tags": ["data-structures"],
      "status": "draft",
      "createdAt": "2026-07-02T10:00:00Z"
    }
  ],
  "mcqs": [
    {
      "id": 102,
      "noteId": 42,
      "question": "Which of the following is a property of red-black trees?",
      "options": ["..."],
      "correctIndex": 0,
      "explanation": "...",
      "tags": ["data-structures"],
      "createdAt": "2026-07-02T10:00:00Z"
    }
  ]
}
```

**Status Codes**:
- `200`: Success
- `404`: Note not found
- `400`: AI provider error

---

#### POST `/notes/generate-all`

Generate drafts and MCQs from all notes at once.

**Request Body**: None

**Response**: Same schema as `/notes/:id/generate`, but with `drafts[]` and `mcqs[]` from all notes combined.

---

#### POST `/mcqs/generate`

Generate MCQs only (no open-recall drafts).

**Query Parameters**:
- `topics` (optional): Comma-separated list of tags to focus on (e.g., `?topics=algorithms,data-structures`)

**Request Body**: None

**Response**:

```json
{
  "mcqs": [
    {
      "id": 102,
      "noteId": 42,
      "question": "...",
      "options": [...],
      "correctIndex": 0,
      "explanation": "...",
      "tags": ["data-structures"],
      "createdAt": "2026-07-02T10:00:00Z"
    }
  ]
}
```

---

### Multiple-Choice Questions (MCQs)

#### GET `/mcqs`

List all MCQs (auto-approved, ready for practice).

**Response**:

```json
[
  {
    "id": 102,
    "noteId": 42,
    "question": "Which of the following is a property of red-black trees?",
    "options": [
      "All paths from root to leaves have the same number of black nodes",
      "All leaves are always red",
      "It is not a binary search tree",
      "It has a maximum height of 10"
    ],
    "correctIndex": 0,
    "explanation": "Red-black trees maintain the invariant that every path has equal black-node count, ensuring O(log n) height.",
    "tags": ["data-structures"],
    "createdAt": "2026-07-02T10:00:00Z"
  }
]
```

---

#### POST `/mcqs/:id/review`

Submit an MCQ answer and record the review.

**Request Body**:

```json
{
  "selectedIndex": 0
}
```

**Response**:

```json
{
  "review": {
    "id": 8001,
    "mcqId": 102,
    "question": "Which of the following is a property of red-black trees?",
    "options": [...],
    "correctIndex": 0,
    "selectedIndex": 0,
    "correct": true,
    "reviewedAt": "2026-07-03T10:30:00Z"
  },
  "nextMcq": {
    "id": 103,
    "question": "...",
    ...
  }
}
```

**Status Codes**:
- `200`: Success
- `404`: MCQ not found
- `400`: Invalid selectedIndex

---

### MCQ Diagnostics (15-Question Weakness Scanner)

#### POST `/mcq-diagnostics/start`

Start a diagnostic session: select 15 MCQs weighted toward cold/stale tags.

**Request Body**: None

**Response**:

```json
{
  "diagnostic": {
    "id": 501,
    "startedAt": "2026-07-03T10:00:00Z",
    "completedAt": null,
    "mcqIds": [102, 103, 104, ...],
    "score": null,
    "weaknessReport": null
  }
}
```

---

#### POST `/mcq-diagnostics/:id/complete`

Complete a diagnostic session and generate weakness report.

**Request Body**: None

**Response**:

```json
{
  "diagnostic": {
    "id": 501,
    "startedAt": "2026-07-03T10:00:00Z",
    "completedAt": "2026-07-03T10:12:00Z",
    "mcqIds": [102, 103, ...],
    "score": 11,
    "weaknessReport": [
      {
        "tag": "concurrency",
        "wrongCount": 3,
        "total": 5
      },
      {
        "tag": "networking",
        "wrongCount": 2,
        "total": 4
      }
    ]
  },
  "drillTags": ["concurrency", "networking"]
}
```

**Weakness Report**:
- Sorted by wrong rate descending
- Includes tags with 2+ wrong answers
- Capped at 3 drill-target tags

---

### Sprints (20-Item Timed Sessions)

#### POST `/sprints/start`

Start a sprint: select 20 items (10 open-recall cards + 10 MCQs) weighted 70/30 to red/yellow tags.

**Request Body**: None (uses current card + MCQ pools)

**Response**:

```json
{
  "sprint": {
    "id": 301,
    "startedAt": "2026-07-03T14:00:00Z",
    "completedAt": null,
    "cardIds": [1, 2, 3, ...],
    "mcqIds": [102, 103, ...],
    "score": null,
    "tagBreakdown": null
  },
  "items": [
    {
      "type": "card",
      "cardId": 1,
      "question": "...",
      "tags": ["data-structures"]
    },
    {
      "type": "mcq",
      "mcqId": 102,
      "question": "...",
      "options": [...],
      "tags": ["algorithms"]
    }
  ]
}
```

**Status Codes**:
- `200`: Success
- `400`: Insufficient cards or MCQs to form a 20-item sprint

---

#### POST `/sprints/:id/complete`

Complete a sprint: record all answers and compute score + tag breakdown.

**Request Body**:

```json
{
  "answers": [
    {
      "type": "card",
      "cardId": 1,
      "answer": "...",
      "rating": "good"
    },
    {
      "type": "mcq",
      "mcqId": 102,
      "selectedIndex": 0
    }
  ]
}
```

**Response**:

```json
{
  "sprint": {
    "id": 301,
    "startedAt": "2026-07-03T14:00:00Z",
    "completedAt": "2026-07-03T14:25:00Z",
    "cardIds": [...],
    "mcqIds": [...],
    "score": 16,
    "tagBreakdown": [
      {
        "tag": "data-structures",
        "score": 9,
        "total": 12
      },
      {
        "tag": "algorithms",
        "score": 7,
        "total": 8
      }
    ]
  }
}
```

**Status Codes**:
- `200`: Success
- `404`: Sprint not found
- `400`: Mismatched answer count

---

### Settings & Configuration

#### GET `/settings`

Get current app settings (Notion configuration, AI configuration).

**Response**:

```json
{
  "notion": {
    "databaseUrl": "https://notion.so/...",
    "topicFilter": "system-design"
  },
  "ai": {
    "provider": "openai",
    "model": "gpt-4-mini",
    "apiKey": "***",
    "baseUrl": "https://api.openai.com",
    "compressInput": true,
    "maxInputTokens": 2000,
    "fallbackStrategy": "failover",
    "fallbacks": []
  }
}
```

---

#### POST `/settings`

Save app settings.

**Request Body**:

```json
{
  "notion": {
    "databaseUrl": "https://notion.so/...",
    "topicFilter": "system-design"
  },
  "ai": {
    "provider": "openai",
    "model": "gpt-4-mini",
    "apiKey": "sk-...",
    "baseUrl": "https://api.openai.com",
    "compressInput": true,
    "maxInputTokens": 2000
  }
}
```

**Response**: Same as `GET /settings` with updated values.

**Status Codes**:
- `200`: Success
- `400`: Invalid configuration

---

#### GET `/settings/models`

List available AI models for a given provider (pricing, context tokens, etc.).

**Query Parameters**:
- `provider` (required): `'openai'`, `'groq'`, `'openrouter'`, etc.
- `apiKey` (optional): Some providers need API key to fetch live model list

**Response**:

```json
[
  {
    "id": "gpt-4o",
    "label": "GPT-4o",
    "priceIn": 15,
    "priceOut": 60,
    "contextTokens": 128000
  },
  {
    "id": "gpt-4-mini",
    "label": "GPT-4 Mini",
    "priceIn": 0.15,
    "priceOut": 0.60,
    "contextTokens": 128000
  }
]
```

---

#### POST `/settings/ping`

Test connectivity to AI provider(s).

**Request Body**:

```json
{
  "ai": {
    "provider": "openai",
    "model": "gpt-4-mini",
    "apiKey": "sk-...",
    "baseUrl": "https://api.openai.com"
  }
}
```

**Response**:

```json
[
  {
    "label": "OpenAI (gpt-4-mini)",
    "provider": "openai",
    "ok": true,
    "message": "Success"
  },
  {
    "label": "Fallback 1",
    "provider": "groq",
    "ok": false,
    "message": "Connection timeout"
  }
]
```

One entry per provider in the chain (primary + fallbacks).

---

## Error Handling

### Common Error Responses

**Invalid Request** (400):

```json
{
  "error": "Invalid rating: must be 'again', 'hard', 'good', or 'easy'"
}
```

**Not Found** (404):

```json
{
  "error": "Card with id 999 not found"
}
```

**AI Provider Error** (503):

```json
{
  "error": "OpenAI API error: rate limit exceeded"
}
```

---

## Rate Limiting

No built-in rate limiting. The app is single-user and local.

---

## Authentication

No authentication. The app is local-first and single-user.

---

## Pagination

No pagination. Endpoints return full result sets.

---

## Field Descriptions

### Common Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Auto-increment primary key |
| `tags` | string[] | Topic/category tags |
| `createdAt` | string | ISO 8601 timestamp of creation |
| `reviewedAt` | string | ISO 8601 timestamp of review |
| `dueAt` | string | ISO 8601 timestamp when card is next due |

### Rating

One of: `'again'`, `'hard'`, `'good'`, `'easy'`

- `'again'` = completely forgot; reschedule for immediate retry
- `'hard'` = struggled; shorter interval before next review
- `'good'` = correct but with effort; normal interval
- `'easy'` = obvious; longer interval

### Status (Heatmap Tiles)

- `'green'` = retention >= 80% (well-learned)
- `'yellow'` = retention 50–80% (adequate)
- `'red'` = retention < 50% (needs work)
- `'cold'` = < 3 reviews per card (not enough data)

---

## Example Workflows

### Complete Open-Recall Practice Session

```bash
# 1. Get due cards
curl http://localhost:3000/api/dashboard | jq '.dueQueue'

# 2. Answer first card
curl -X POST http://localhost:3000/api/cards/1/review \
  -H "Content-Type: application/json" \
  -d '{"answer":"my answer","rating":"good","elapsedSeconds":45}'

# 3. (optional) Request critique before grading
curl -X POST http://localhost:3000/api/cards/1/critique \
  -H "Content-Type: application/json" \
  -d '{"answer":"my answer"}'

# 4. Repeat for more cards or check updated dashboard
curl http://localhost:3000/api/dashboard
```

### Run a Complete Diagnostic

```bash
# 1. Start diagnostic
curl -X POST http://localhost:3000/api/mcq-diagnostics/start

# 2. Answer each MCQ (11 more times)
curl -X POST http://localhost:3000/api/mcqs/102/review \
  -H "Content-Type: application/json" \
  -d '{"selectedIndex":0}'

# 3. Complete diagnostic and get weakness report
curl -X POST http://localhost:3000/api/mcq-diagnostics/501/complete
```

---

## Testing Endpoints

All endpoints can be tested with `curl`, Postman, or your HTTP client of choice. For integration testing, see [Testing Guide](./testing.md).
