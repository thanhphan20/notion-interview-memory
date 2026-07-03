## ADDED Requirements

### Requirement: One Heatmap Tile Per Unique Tag

The Heatmap SHALL render exactly one tile per unique tag appearing on any card in the deck.

#### Scenario: Deck contains cards with three unique tags

- **WHEN** the user's deck contains cards tagged with `Databases`, `System Design`, and `Networking`
- **THEN** the Heatmap renders three tiles

### Requirement: Retention Rate Uses Only the Last 3 Reviews Per Card

The Heatmap SHALL compute retention rate for a tag as the percentage of cards in that tag whose most-recent review (within the last 3 reviews per card) was rated `good` or `easy`.

#### Scenario: Card has 5 lifetime reviews

- **WHEN** computing retention rate for a card with 5 reviews ordered by time (oldest to newest)
- **THEN** the system considers only the 3 most-recent reviews and checks whether the most-recent among them was `good` or `easy`

### Requirement: Cold Tags Render as Grey

A tag whose average card has fewer than 3 completed reviews SHALL render as a grey ("not measured") tile with no color-coded retention rate.

#### Scenario: New deck with no reviews

- **WHEN** the user has synced notes and generated cards but not completed any reviews
- **THEN** all Heatmap tiles render grey with status `not_measured`

#### Scenario: Tag has one card with 3 reviews and four cards with 1 review each

- **WHEN** computing the tile status (average review count = 1.4)
- **THEN** the tile renders grey because the average is below the 3-review threshold

### Requirement: Retention Rate Color Thresholds

Heatmap tile color SHALL be determined by retention rate using fixed thresholds: green ≥ 0.80, yellow 0.50–0.80 (exclusive), red < 0.50.

#### Scenario: Tag has 78% retention

- **WHEN** the computed retention rate is 0.78 for a non-cold tag
- **THEN** the tile renders yellow

#### Scenario: Tag has 82% retention

- **WHEN** the computed retention rate is 0.82 for a non-cold tag
- **THEN** the tile renders green

### Requirement: Rating-Average Trend Arrow

Each Heatmap tile SHALL display a trend arrow reflecting the delta between the mean rating of the last 3 reviews per card and the mean of the prior 3 reviews per card, averaged across all cards in the tag.

#### Scenario: Recent ratings improve

- **WHEN** the last-3-review average exceeds the prior-3-review average by any positive amount
- **THEN** the tile displays an upward trend arrow

#### Scenario: Recent ratings decline

- **WHEN** the last-3-review average is lower than the prior-3-review average
- **THEN** the tile displays a downward trend arrow

#### Scenario: Insufficient data for trend

- **WHEN** cards in the tag have fewer than 6 reviews each on average
- **THEN** the tile displays no trend arrow (neutral)
