# FillIn

A distraction-free, AI-assisted English sentence completion trainer for macOS.
Focused on listening and context, not just vocabulary memorization.

## Features

- **Cloze Test**: Fill in the blanks (phrases) based on context.
- **Audio Support**:
  - High-quality Neural TTS (Edge TTS) for English and Japanese.
  - Sound effects for correct/incorrect answers.
  - Non-blocking audio playback.
- **Input**:
  - Voice recognition (Speak your answer).
  - Text input (Type your answer).
- **Data Management**:
  - Manage your vocabulary in `data/vocab.csv`.
  - Sync data between CSV and the internal database.

## Installation

1. **Prerequisites**:
    - Python 3.12+
    - `uv` (Project manager)
    - `ffmpeg` (for audio processing, e.g., `brew install ffmpeg`)

2. **Setup**:

    ```bash
    uv sync
    ```

3. **Run the App**:

    ```bash
    uv run streamlit run src/main.py
    ```

## Usage

### Managing Vocabulary

The app uses an internal database for speed, but you can manage your data in CSV.

1. **Edit Data**: Open `data/vocab.csv` and add/edit rows.
    - Columns: `Japanese`, `English`, `Target Word (Optional)`, `Proficiency`
2. **Import Changes**:
    Run this command to update the app with your CSV changes:

    ```bash
    uv run python scripts/sync_data.py import data/vocab.csv
    ```

3. **Export Data**:
    If you made changes in the DB (future feature) and want to save to CSV:

    ```bash
    uv run python scripts/sync_data.py export data/vocab.csv
    ```

## Structure

- `src/`: Source code (UI, Services, Database).
- `data/`: Database (`app.db`), CSV (`vocab.csv`), and Sound files.
- `scripts/`: Utility scripts (`sync_data.py`).
- `tests/`: Testing scripts.
