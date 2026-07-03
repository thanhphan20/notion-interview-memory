## ADDED Requirements

### Requirement: Home Dashboard is a Split Layout

The home screen SHALL be a split dashboard containing the following elements in order from top to bottom: Countdown, Heatmap tile, Lapses tile, Due Queue.

#### Scenario: User opens the app

- **WHEN** the user navigates to the root route
- **THEN** the system renders the four dashboard elements in the specified vertical order

### Requirement: Countdown Combines Multiple Readiness Signals

The Countdown element SHALL display three values in a single glanceable readout: days until Interview Date, running sprint-score average, and percentage of green heatmap tiles.

#### Scenario: All signals are available

- **WHEN** the user has set an Interview Date, run at least one sprint, and has non-cold tags
- **THEN** the Countdown displays days-until, sprint-score average (out of 20), and green-tile percentage

#### Scenario: No sprints have been run

- **WHEN** the user has set an Interview Date but never completed a sprint
- **THEN** the Countdown displays days-until and green-tile percentage; sprint-score average shows "—"

#### Scenario: No Interview Date is set

- **WHEN** the user has never set an Interview Date
- **THEN** the Countdown displays a prompt to set a date; other signals are still visible if available

### Requirement: Dashboard Payload is a Single API Response

The dashboard SHALL load its data from a single API endpoint `GET /api/dashboard` returning countdown, heatmap tiles, lapses list, and due queue in one payload.

#### Scenario: Client fetches dashboard data

- **WHEN** the client sends `GET /api/dashboard`
- **THEN** the server responds with a JSON payload containing `countdown`, `heatmap`, `lapses`, and `dueQueue` fields
