## ADDED Requirements

### Requirement: Interview Date is a Single Global Setting

The system SHALL allow the user to set exactly one Interview Date at a time. The date is stored globally and applies to all cards, tags, and sessions.

#### Scenario: User sets an Interview Date

- **WHEN** the user submits a valid future ISO 8601 date to `POST /api/interview-date`
- **THEN** the system stores the date in the settings table and returns HTTP 200 with the updated countdown payload

#### Scenario: User clears the Interview Date

- **WHEN** the user submits `{ "date": null }` to `POST /api/interview-date`
- **THEN** the system removes the stored date and countdown status becomes `unset`

### Requirement: Interview Date Drives Schedule Clamping

When an Interview Date is set, the FSRS scheduler SHALL clamp `scheduledDays` output such that no card is scheduled beyond `interview_date - 1 day`.

#### Scenario: FSRS proposes an interval past the Interview Date

- **WHEN** FSRS computes `scheduledDays = 14` and only 8 days remain until the Interview Date
- **THEN** the system clamps `scheduledDays` to `7` and sets `dueAt` to `interview_date - 1 day`

#### Scenario: FSRS proposes an interval within the runway

- **WHEN** FSRS computes `scheduledDays = 3` and 8 days remain until the Interview Date
- **THEN** the system leaves `scheduledDays` unchanged

#### Scenario: No Interview Date is set

- **WHEN** the Interview Date is null and FSRS computes any `scheduledDays`
- **THEN** the system leaves the value unchanged (no clamping applied)

### Requirement: Date-Passed User Prompt

When the Interview Date has passed, the system SHALL prompt the user with a modal offering three explicit actions: set a new date, pause reviews, or enter browse mode.

#### Scenario: User opens the app after the Interview Date has passed

- **WHEN** the user loads the dashboard and `daysUntil < 0`
- **THEN** the system renders a modal with three actions: "Set new date", "Pause reviews", "Browse mode"

#### Scenario: User selects "Set new date"

- **WHEN** the user submits a new future date from the modal
- **THEN** the system updates the stored date, closes the modal, and refreshes the countdown

#### Scenario: User selects "Pause reviews"

- **WHEN** the user selects "Pause reviews"
- **THEN** the system clears the Interview Date and stops clamping scheduler output; the countdown status becomes `unset`
