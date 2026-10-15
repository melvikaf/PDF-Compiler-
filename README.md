# Paperplane

A browser-based PDF combiner. Add PDFs, rearrange individual pages, and download the finished document. PDF contents are read and merged in the browser; this app has no PDF upload endpoint, server-side processing, analytics, or cloud storage.

## Run locally

```sh
npm install
npm run dev
```

## Build and deploy

```sh
npm run build
npm run preview
```

The production site is the `dist/` directory. For Vercel, import the repository and use `npm run build` as the build command and `dist` as the output directory.

## Privacy

- PDF parsing and merging happen in the browser with `pdf-lib`; there is no upload API, backend, cloud storage, account, or analytics.
- The app does not load external fonts, scripts, or PDF services. Vercel deployments receive a restrictive Content Security Policy and other security headers from `vercel.json`.
- The hosting provider still serves the application and can see ordinary request metadata such as IP address and visit time. Security headers do not prevent that.
- For the strongest practical privacy, deploy only code you have reviewed, keep dependencies updated, and use the app offline after it has loaded. Check the browser's Network panel to confirm no document data is sent.
- This project has not been security-assessed or approved for regulated healthcare use. Do not use it with real patient information without your organization's privacy/security approval.
