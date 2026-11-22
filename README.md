# Global Video Game Sales & Gaming Trend Analysis

Static website for the Data Science & Visualization project. No build step, so Vercel serves it as is.

```
index.html     page content
styles.css     styling
script.js      interactive dashboard (SVG charts, filters, tooltips)
data.js        all numbers behind the dashboard, computed from the CSV with pandas
assets/        original charts (webp), presentation (pptx), vgsales.csv, games.js (explorer data)
vercel.json    clean URLs + asset caching
```

## Deploy to Vercel

**Option A: GitHub (recommended)**
1. Create a new GitHub repo and push this folder's contents (`index.html` at the repo root).
2. Go to vercel.com/new and import the repo.
3. Framework Preset: **Other**. Leave Build Command and Output Directory empty. Click **Deploy**.

**Option B: Vercel CLI**
```
npm i -g vercel
cd vgsales-site
vercel          # preview
vercel --prod   # production
```

Preview locally: `python3 -m http.server 8000` and open http://localhost:8000
