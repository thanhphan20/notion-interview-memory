## ADDED Requirements

### Requirement: Lapses Tile Shows Recent Failed Reviews

The Lapses tile SHALL list all cards whose most-recent review within the last 7 days was rated `again` or `hard`, sorted by most-recent review first.

#### Scenario: User has 3 recent lapses

- **WHEN** the user has 3 cards rated `again` or `hard` within the last 7 days and no other lapses
- **THEN** the Lapses tile shows a count of 3 and lists those 3 cards

#### Scenario: Card was rated `again` 10 days ago

- **WHEN** a card was rated `again` 10 days ago and rated `good` 2 days ago
- **THEN** the card does NOT appear in the Lapses list (most-recent review is `good` and within window)

#### Scenario: Card was rated `again` 10 days ago with no newer review

- **WHEN** a card was rated `again` 10 days ago and has no more recent review
- **THEN** the card does NOT appear in the Lapses list (outside the 7-day window)

### Requirement: One-Click Re-Drill from Lapses

The Lapses tile SHALL provide a "Drill now" action that opens an open-recall practice session filtered to only the currently-listed lapse cards.

#### Scenario: User clicks "Drill now"

- **WHEN** the user clicks "Drill now" on the Lapses tile
- **THEN** the system opens an open-recall session containing exactly the cards currently in the Lapses list

### Requirement: Re-Drill Ratings Apply Full FSRS Updates

Ratings recorded during a re-drill session SHALL apply the same FSRS update as any other review, including clamping when an Interview Date is set.

#### Scenario: User rates a card during re-drill

- **WHEN** the user submits a rating during a re-drill session
- **THEN** the system applies the standard FSRS update, records the review in `reviews`, and clamps `scheduledDays` if an Interview Date is set

### Requirement: Lapses Window is Configurable via Query

The lapses API SHALL accept an optional `windowDays` query parameter to override the default 7-day window.

#### Scenario: Client requests a 14-day window

- **WHEN** the client sends `GET /api/lapses?windowDays=14`
- **THEN** the server returns lapses from the last 14 days instead of the default 7
