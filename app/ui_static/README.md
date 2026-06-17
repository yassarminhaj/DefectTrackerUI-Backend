# Defect Tracker — Static UI

Static HTML/CSS/JS front-end for a defect tracking tool. Pure client-side — no build step required. Open `index.html` in a browser to start (it redirects to `dashboard.html`).

> **Working on this project?** Read [`UI_CHANGELOG.md`](./UI_CHANGELOG.md) first — it captures every UI change with the *why*, *intent*, and *concept* behind it, plus the decisions we deliberately rejected. The change-log workflow is mandatory and is described in [`CLAUDE.md`](./CLAUDE.md).

## Pages

- `index.html` — Landing / redirect to dashboard
- `dashboard.html` — Overview dashboard
- `login.html` — Login screen
- `defect_list.html` — List of defects
- `defect_detail.html` — Defect detail view
- `defect_create.html` — Create a new defect
- `projects.html` — Projects view
- `environments.html` — Environments management
- `users.html` — Users management
- `reports.html` — Reports view
- `status_workflow.html` — Defect status workflow

## Stack

- HTML5
- CSS via [normalize.css](https://necolas.github.io/normalize.css/) and [Skeleton](http://getskeleton.com/) (CDN-loaded)
- Custom styles in `css/app.css`
- Client-side logic in `js/app.js`

## Running locally

No build required. Either:

1. Open `index.html` directly in your browser, or
2. Serve the folder with any static server, e.g.:

   ```bash
   python -m http.server 8000
   ```

   Then open <http://localhost:8000>.

## Project structure

```
static-ui/
├── css/
│   └── app.css
├── js/
│   └── app.js
├── index.html
├── dashboard.html
├── login.html
├── defect_list.html
├── defect_detail.html
├── defect_create.html
├── projects.html
├── environments.html
├── users.html
├── reports.html
└── status_workflow.html
```

## License

TBD
