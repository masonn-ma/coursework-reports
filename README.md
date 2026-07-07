# coursework-reports
Centralized repositiory to hold past reports from various courseworks

## Updating the dashboard

Add course folders and report PDFs under `reports/`, then run:

```sh
node scripts/update-reports-json.js
```

The script refreshes `reports.json` for GitHub Pages while preserving existing titles, presentation links, and scores.
