# Design Guide — Notion Interview Memory

## What This App Does

A private local web app that helps people memorize interview knowledge through **active recall practice**, powered by their own Notion notes.

The core loop: **Sync Notion notes → Generate practice questions → Approve what's useful → Answer due cards → Self-grade → Repeat on a spaced schedule.**

## Users

- **Single user** (private, localhost-only, no accounts or auth)
- Uses Notion to collect interview prep notes (system design, algorithms, languages, etc.)
- Wants to practice answering out loud or in writing before real interviews

## Visual Tone

- **Dark theme** — professional, focused, study-friendly
- **Minimal** — no decorative flourishes; typography and spacing do the work
- **Color palette** (existing CSS custom properties):
  - Background: `#1e1e2e`
  - Panels: `#252538`
  - Text: `#cdd6f4`
  - Muted: `#a6adc8`
  - Primary accent: `#cba6f7` (muted purple)
  - Danger: `#f38ba8` (soft red)
  - Borders: `#313244`

## Layout Structure

```
┌──────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────────────────────────────┐  │
│  │ Sidebar  │  │  Top Bar: Due | Drafts | Reviews  │  │
│  │ 280px    │  │         + Refresh btn             │  │
│  │          │  ├────────────────────────────────────┤  │
│  │ LOGO     │  │                                    │  │
│  │ tagline  │  │    Main Content Area               │  │
│  │          │  │    (switches by nav selection)     │  │
│  │ Nav:     │  │                                    │  │
│  │ ● Practice│  │  One of 5 views:                  │  │
│  │ ● Drafts  │  │  Practice | Drafts | Notes        │  │
│  │ ● Notes   │  │  History | Settings               │  │
│  │ ● History │  │                                    │  │
│  │ ● Settings│  │                                    │  │
│  └──────────┘  └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Page-by-Page

### 1. Practice View (primary screen)
- Shows **one due card at a time** (no list — focus on one question)
- Question displayed prominently as heading
- Tags shown as small chips (e.g., "System Design", "Database")
- Large textarea where user types their answer
- Two action buttons below textarea: **AI Critique** | **Show Answer**
- After clicking "Show Answer": expected answer + rubric bullet points appear
- If AI Critique was requested: a summary panel appears with suggested rating and missing key points
- **Four self-grade buttons** at the bottom: **Again** (red) | **Hard** | **Good** | **Easy**
- When no cards are due: show a centered empty state message

### 2. Drafts View
- Vertical stack of draft cards, each containing:
  - Question text
  - Expected answer (short paragraph)
  - Rubric (bullet list)
  - Tags
  - **Approve** / **Reject** buttons
- Empty state when no drafts pending

### 3. Notes View
- Vertical stack of synced Notion notes, each containing:
  - Title
  - Content preview (truncated to ~220 chars)
  - Tags
  - **Generate Drafts** button
  - **Open Notion** link (external)
- **Sync Notion** button in the section header
- Empty state when no notes synced

### 4. History View
- Vertical stack of past reviews, each showing:
  - Rating badge (AGAIN/HARD/GOOD/EASY — uppercase, bold)
  - User's answer text
  - AI feedback summary (if any)
  - Timestamp
- Latest reviews first
- Empty state when no reviews exist

### 5. Settings View
- Form with labeled inputs in a vertical stack:
  - **Notion token** (password field, pre-filled)
  - **Notion database ID** (text)
  - **Title property** (text, default "Name")
  - **Topic property** (text, default "Topic")
  - **Topic filters** (comma-separated)
  - **AI provider** (dropdown: "Offline deterministic" / "OpenAI-compatible")
  - **AI API key** (password)
  - **AI base URL** (text, placeholder "https://api.openai.com/v1")
  - **AI model** (text, placeholder "gpt-4.1-mini")
- **Save Settings** button at bottom

## Interaction Patterns

| Pattern | Behavior |
|---|---|
| Status messages | Toast-like bar below top bar, auto-dismisses after 5s. Green for success, red for errors. |
| Loading | No spinners — buttons become status toasts ("Syncing Notion...", "Generating drafts...") |
| Refresh | Top-bar button re-fetches all state from API |
| Navigation | Sidebar buttons switch the main content view; active nav is highlighted |
| Practice flow | User types → optionally critiques → shows answer → self-grades → next card auto-loads |
| Answer key | Hidden until user clicks "Show Answer"; answer + rubric appear below textarea |
| AI Critique | Appears as a distinct left-bordered panel, separate from the answer key |
| Self-grade | Four buttons, user picks exactly one → review is saved, card moves to next due date |
| Approve/Reject | Each action updates state and re-fetches drafts list |

## Responsive/Sizing

- Content area max-width: 900px, centered
- Sidebar fixed at 280px
- The app runs in a desktop browser at localhost — mobile responsive is not a priority for v1

## Stitch Design System

A complete design system was generated via **Google Stitch MCP** for this project.

- **Stitch Project ID**: `3599442098969646687`
- **Design System Asset**: `assets/32b0af4437734cb8a2855e7b56016776`
- **Screens generated**: Practice Dashboard, Drafts, Notes, History, Settings

### Screenshots (download URLs)
- **Practice Dashboard**: [Screenshot](https://lh3.googleusercontent.com/aida/AP1WRLsoFN-Zyb53tvWy2ikym6cHVMQiAE7Dy5Ql7UA6A6wiiCMm8vXwu1Jk_0p1UmsyHGmJKyfdnjE87iwZ6jU7v5dt6DS1UACBCVcJ4a4idrIffGWM6Y6NJXKbQgnq1g6DclW_h-yZ1yxZNunWlnreSy-Zvt7bvX9EelwOZq_SjcuWI1BX1yY3RUK5vgU1Adj4YWOOcTrPD40vJs2wRe8zVTWfUcAM27oBfIwJbZTQ4ZYbwiu3NMdlbZ37Zw)
- **Drafts**: [Screenshot](https://lh3.googleusercontent.com/aida/AP1WRLtuVBteEN5zO_oO9H05St4-OuT1pMa9p-RiurUu7m_BEuUgJ5PElQn84PonzOzOKlc0nr9fyKzRHFPZsnuaAho6qFK9aTkZWfjsT0FdvE6HIPK56F9wf5GRFfms4VNdFOaVIGovQP-VRpV7bmFB0l_m_I8-G1tg-0FHqEgkrAqBOVBpv1GOSekLC4g2EwMcZDKS_WQxy8vImfW6wxgkg-1lR_Jti3uHmKkSWvA_oz46Q20lBAzJWJdeGVg)
- **Notes**: [Screenshot](https://lh3.googleusercontent.com/aida/AP1WRLvzo_l9xiRS528Ld2NzNp0XIVFz89Ki6bFQ2SpsTrBqdDL3dqxwOWmkRGDX_EPw0eabAQL3h6IlLjB-OL4-XJPRk3HtTltcl5Jb-71uUCcUwJEASmvmqjkpmjWZ1agU1EJKJRKh8E8dNOFrAnh_bZySY0NBChD-bjyJo3BYq8hh41P7gghvcnSnTQddve_UZGwSjN2Dw7XF2cTkju3oKbyhJ8hBRuJUzET-9M8ZvqO4iKay5R7qR7H8yYk)
- **History**: [Screenshot](https://lh3.googleusercontent.com/aida/AP1WRLvslB7_AaU0hPH7pgPV475_JeMho7da4febd7tVa5TOVRc61h-PsebKkp5UP_qTXUKxHxlCRCct4AbocIdiTUyweWErFt0ntsYiOg5Pux7JvOAYofn_RMpAiwFDAEB8PN-60UJM2Ui6TAEfcnZXw4W-dzmQoTNdlYczioqDf1Db1ZqRNAJ7cfym-y5yRrwwFbT87Z6QwfOs_QmQmtDZoTDluDQYxLw2O5OfG494gBOkhnQT-VGC4yJLBp4)
- **Settings**: [Screenshot](https://lh3.googleusercontent.com/aida/AP1WRLs-nnXb3cbx0iSXNIgcmGdCje7fwQBpQzqGEQcF5bOVzZmQkDj6XS5afBD99G9K-ePk3cn2vHaRROOguZbnl3y1rb0jODVPHo233ES8lt-GF1t3SlX7EBeum8EOMu7DbEUoo-TtoFhZDqeR3nuyqxRM6Pqd97jsOKqWczob1iO0FRBIPnx-KZaDMkU4TKc0PWdqZopR0F_YfyQp_RfUj00yywXX_LPmcH72WoCYX1ijbrGouTfO4-oB2A)

### Design Tokens Applied to `globals.css`

The following Material-based dark theme tokens from the Stitch design system are now in use:

| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#151217` | Base canvas |
| `--panel` | `#211e24` | Surface containers |
| `--panel-high` | `#2c292e` | Elevated surfaces, nav active bg |
| `--panel-highest` | `#373339` | Modal/popover level |
| `--text` | `#e7e0e7` | Primary text |
| `--text-variant` | `#cdc3d1` | Secondary text |
| `--muted` | `#968e9a` | Labels, metadata |
| `--primary` | `#cba6f7` | Accent / actions |
| `--border` | `#4a444f` | Borders, dividers |
| `--danger` | `#ffb4ab` | Destructive actions |

**Typography**: Inter font family, 16px body at 1.6 line-height, 4px spacing grid.

## Current Implementation Notes

The existing UI is a working functional prototype. The CSS has been updated with the Stitch-generated design tokens. A designer's polish pass could improve:
- Typography hierarchy (question vs answer vs rubric vs metadata)
- Card/padding consistency
- Button states (hover, active, disabled)
- Empty state illustrations or improved copy
- Transitions between views
- Spacing rhythm in the practice workflow
- Overall visual polish within the established dark theme
