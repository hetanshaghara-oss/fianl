# Google Cloud Service Account Keys

Place your Google Cloud service account JSON key file in this directory.

Rename the file to `google-key.json` or update your `.env` configuration file to point to the correct filename:

```env
GOOGLE_APPLICATION_CREDENTIALS=./keys/google-key.json
```

## Security Warning
**NEVER** commit files in this directory to GitHub or any version control system. This folder is ignored by `.gitignore` to prevent leaking your private credentials.
