## ADDED Requirements

### Requirement: Fixed Sprint Shape

Every Sprint SHALL contain exactly 20 items with approximately equal split between MCQs and open-recall cards (10 ± 1 of each) and 70% of items drawn from red or yellow heatmap tags when such tags exist.

#### Scenario: Deck has red and yellow tags

- **WHEN** the user starts a sprint and the heatmap has at least one red or yellow tag with enough items
- **THEN** the system selects 14 items from red/yellow tags and 6 items from green tags, split 50/50 between MCQ and open-recall formats

#### Scenario: Deck has only green tags

- **WHEN** the user starts a sprint and all heatmap tags are green
- **THEN** the system selects 20 items evenly from green tags, split 50/50 between MCQ and open-recall

#### Scenario: Deck has fewer than 20 items total

- **WHEN** the user starts a sprint and the deck contains fewer than 20 eligible items
- **THEN** the system returns HTTP 400 with error code `INSUFFICIENT_DECK`

### Requirement: Sprint Applies Full FSRS Updates

Open-recall ratings recorded during a Sprint SHALL apply the same FSRS update as any other review, including clamping when an Interview Date is set.

#### Scenario: User rates a card during a sprint

- **WHEN** the user submits a rating for an open-recall card in `POST /api/sprints/:id/complete`
- **THEN** the system applies the FSRS update, records the review in the `reviews` table, and updates the card's schedule with clamping if applicable

### Requirement: Sprint MCQ Answers Record to mcq_reviews

MCQ answers recorded during a Sprint SHALL be written to the `mcq_reviews` table using the same schema and logic as standalone MCQ practice.

#### Scenario: User answers an MCQ during a sprint

- **WHEN** the user submits an MCQ answer in `POST /api/sprints/:id/complete`
- **THEN** the system inserts a row in `mcq_reviews` with the selected index, correctness, and timestamp

### Requirement: Sprint Score Definition

The Sprint score SHALL be the total count of open-recall ratings equal to `good` or `easy` plus MCQ answers marked correct, out of 20.

#### Scenario: User completes a sprint with 8 good/easy and 7 correct MCQs

- **WHEN** the sprint completes with 8 open-recall ratings of `good` or `easy` and 7 correct MCQ answers
- **THEN** the recorded sprint score is `15`

### Requirement: Sprint Score Feeds Countdown

The running average of the last 10 sprint scores SHALL be surfaced in the dashboard Countdown. No standalone chart or dedicated view is required.

#### Scenario: User has completed 6 sprints

- **WHEN** the dashboard renders the Countdown
- **THEN** the sprint-score field shows the mean of all 6 sprint scores

#### Scenario: User has completed 15 sprints

- **WHEN** the dashboard renders the Countdown
- **THEN** the sprint-score field shows the mean of only the 10 most-recent sprint scores
