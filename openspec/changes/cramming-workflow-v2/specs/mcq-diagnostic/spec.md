## ADDED Requirements

### Requirement: MCQ Diagnostic Sessions Have Fixed Shape

Every MCQ Diagnostic session SHALL contain exactly 15 MCQs drawn with weighting biased toward stale or cold tags — those with fewest recent reviews or lowest coverage relative to the deck.

#### Scenario: Deck has cold tags

- **WHEN** the user starts an MCQ diagnostic and the deck contains cold tags (average card has < 3 reviews)
- **THEN** at least 60% of the 15 MCQs are drawn from cold tags when enough MCQs exist in those tags

#### Scenario: Deck has no cold tags

- **WHEN** all tags are non-cold at diagnostic start time
- **THEN** MCQs are weighted toward tags with the oldest most-recent review timestamps

#### Scenario: Not enough MCQs exist

- **WHEN** the deck contains fewer than 15 MCQs total
- **THEN** the system returns HTTP 400 with error code `INSUFFICIENT_MCQS`

### Requirement: Diagnostic Ends With a Weakness Report

Every completed MCQ Diagnostic session SHALL produce a Weakness Report that ranks tags by wrong-answer rate (descending) across the session's questions.

#### Scenario: User completes a diagnostic with mixed results

- **WHEN** the user answered 4/4 correct on Networking, 2/4 correct on System Design, and 1/4 correct on Databases within a diagnostic
- **THEN** the Weakness Report lists tags in order: Databases (75% wrong), System Design (50% wrong), Networking (0% wrong)

### Requirement: Weakness Report Offers One-Click Drill Handoff

The Weakness Report SHALL include a "Drill these tags" button that opens an open-recall session filtered to cards from the top-ranked weak tags.

#### Scenario: User clicks "Drill these tags"

- **WHEN** the user clicks "Drill these tags" from a completed Weakness Report
- **THEN** the system opens an open-recall practice session filtered to cards tagged with the report's top-N weakest tags (default N=2 or all tags with any wrong answer)

### Requirement: MCQs Are Not FSRS-Scheduled

MCQs SHALL NOT have per-question FSRS schedules; individual MCQs are not marked "due" and do not accumulate `stability` or `difficulty` state.

#### Scenario: User completes an MCQ

- **WHEN** the user answers an MCQ in any session
- **THEN** the system records the review in `mcq_reviews` but does not update or create any per-MCQ scheduling record
