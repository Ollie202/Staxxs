# Staxx

A personal monthly wins tracker for logging earnings, setting goals, and visualizing income sources — with optional cloud sign-in so your data follows you across devices.

## Features

- Log monthly wins with project name, amount, and source category
- Set monthly earning goals with progress bars
- 5 chart types: Bar, Line, Area, Radar, Pie
- Source breakdown with yearly/monthly views
- Custom source categories (add/remove your own)
- Dark / Light theme toggle
- CSV Import & Export (clipboard, file download, file upload)
- Works fully offline — data saved in your browser via `localStorage`
- **Optional cloud sync** — sign in with Google or email/password to sync across devices (see [SETUP-AUTH.md](SETUP-AUTH.md))
- Year navigation to track across multiple years
- Reset controls for individual months or full year
- Fully responsive - works on mobile and desktop

## Project Structure

```
Staxx/
├── index.html       # The entire app (single file)
├── demo.html        # Demo version with sample data
├── SETUP-AUTH.md    # Guide to enable cloud sign-in (Supabase)
├── README.md
└── LICENSE
```

## How to Run

1. Clone the repository:
   ```bash
   git clone https://github.com/Ollie202/Wins-Tracker-App.git
   ```
2. Open `index.html` in your browser — no installation required.

> Note: cloud sign-in (Google especially) needs the app served over `http(s)`, not `file://`.
> Run a quick local server with `python -m http.server 8000`, then open http://localhost:8000.

## CSV Format

**Wins:**
```
Year,Month,Project,Amount,Source
2026,Jan,My Bounty,100,Bounties
2026,Feb,Content Deal,50,Content
```

**Goals:**
```
GOAL,Year,Month,Target
GOAL,2026,Jan,500
GOAL,2026,Feb,400
```

Export from one device, import on another - your data travels with you.

## Built With

- Vanilla JavaScript (no frameworks)
- Chart.js (via CDN)
- Browser `localStorage` for data persistence

## License

This project is open source and available under the [MIT License](LICENSE).
