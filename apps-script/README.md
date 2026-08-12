# Seenetrica Apps Script backend

`Code.gs` is the Google Apps Script source used by `/api/data`.

## Deploying a change

1. Replace the Apps Script project's `Code.gs` with this file.
2. Keep the existing Script Properties (`API_SECRET` and Cloudinary values).
3. In Apps Script, open **Deploy > Manage deployments**, edit the web-app
   deployment, select **New version**, and deploy it.
4. Keep **Execute as** set to the script owner and preserve the existing web-app
   access setting.
5. If Google creates a different `/exec` URL, update `APPS_SCRIPT_URL` in Vercel
   and redeploy the Vercel project.

The reliability patch reuses one Spreadsheet object per execution, caches read
snapshots briefly, and invalidates both read caches after every successful write.
The cache contains data only; API secrets and PINs are never stored in it.
