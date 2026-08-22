# time in

A small, client-side time difference experience with a responsive orbital history field.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/`.

## Publish with GitHub Pages

This project includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

1. Create a public GitHub repository and push this project to `main` or `master`.
2. In the repository, open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push a change, or run **Deploy to GitHub Pages** from the repository’s **Actions** tab.

The workflow builds the static site and publishes it automatically. It also adjusts asset paths for both project sites (`username.github.io/repository`) and user sites (`username.github.io`).

History is stored locally in each visitor’s browser; no server or database is required.
