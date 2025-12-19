# Spelling Bee Party Dashboard

A web application for hosting a 2-team spelling bee party with score tracking, word slides, and fun transitions.

## Quick Start

### Setup (macOS)

1. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application:**
   ```bash
   python app.py
   ```

4. **Open in your browser:**
   - **Control Panel** (for you): http://localhost:5001/control
   - **Display View** (for TV): http://localhost:5001/display

**Note:** If port 5001 is also in use, you can change it in `app.py` (last line) or disable AirPlay Receiver in System Preferences.

## Features

- **Word Slides**: Navigate through words with large, readable typography
- **Score Tracking**: Track scores for Team A and Team B
- **Round-Based Scoring**: Points vary by round (1pt, 2pt, 5pt, 10pt, 15pt)
- **Steal Mechanics**: Each team can attempt up to 2 steals per round
- **Image Support**: Add images via URL or local upload
- **Bad PowerPoint Mode**: Cheesy transitions and effects (optional)
- **Sound Effects**: Placeholder support for sound effects
- **Keyboard Shortcuts**: Quick controls for fast-paced gameplay

## Loading Words

### Option A: Google Sheets CSV URL (Preferred)

1. In Google Sheets, go to **File → Share → Publish to web**
2. Choose **CSV** format
3. Copy the published URL
4. Paste it into the "Google Sheets CSV URL" field in the Control Panel
5. Click "Load from URL"

### Option B: Local CSV File

1. Export your Google Sheet as CSV
2. Place it in the project folder
3. Use the file path in the app (or modify the code to use a file picker)

### Option C: Use Sample Data

Click "Load Sample" to use the included `sample_words.csv` file.

## CSV Format

Your CSV should have columns: `Word` and `Context/Sentence`

Round headers should be formatted like:
- `Round 1 (1 pt)`
- `Round 2 (2 pt)`
- `Round 3 (5 pt)`
- `Round 4 (10 pt)`
- `F*** You (15 pt)`

Words can include context separated by a pipe `|` or in the Context column:
- `Ornament | A decoration. "That ornament has been in the family since 1974."`

## Keyboard Shortcuts (Control View)

- **←** Previous word
- **→** Next word
- **C** Mark as Correct
- **X** Mark as Incorrect
- **S** Steal Success
- **F** Steal Fail
- **R** Toggle Reveal/Hide word

## Sound Effects

Place sound effect files in `static/sounds/`:
- `next.mp3` - Played when advancing to next word
- `funny.mp3` - Played when word is spelled correctly (funny/success sound)
- `fart.mp3` - Played when word is spelled incorrectly (fart noise for laughs!)
- `steal.mp3` - Played when steal is successful

If files are missing, the app will continue to work silently. Check out `static/sounds/README.md` for sound effect sources.

## Scoring Rules

- Points are awarded based on the current word's round point value
- If a team spells correctly: add points to that team
- If a team misses: no points, other team can attempt a steal
- Each team can perform at most 2 steals per round
- Use "Start New Round" to reset steal counts

## State Persistence

Game state is saved to `state.json` in the project root. This includes:
- Current word index
- Team scores
- Current team turn
- Steal counts
- Word images
- Settings

Refreshing the page will preserve all state.

## Project Structure

```
SpellingBee/
├── app.py                 # Flask application
├── requirements.txt       # Python dependencies
├── sample_words.csv      # Sample word data
├── state.json            # Game state (created at runtime)
├── templates/
│   ├── display.html      # TV display view
│   └── control.html      # Control panel view
├── static/
│   ├── css/
│   │   ├── display.css   # Display view styles
│   │   └── control.css   # Control view styles
│   ├── js/
│   │   ├── display.js    # Display view logic
│   │   └── control.js    # Control view logic
│   ├── sounds/           # Sound effect files (add your own)
│   └── uploads/          # Uploaded images (created at runtime)
└── README.md             # This file
```

## Troubleshooting

- **Port already in use**: Change the port in `app.py` (last line)
- **CSV won't load**: Check that your CSV URL is published correctly, or try exporting as CSV and using Option B
- **Images not showing**: Check browser console for errors, ensure image URLs are accessible
- **State not persisting**: Ensure the app has write permissions in the project directory

## License

Free to use for your party!

