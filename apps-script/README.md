# Seenetrica Apps Script backend

`Code.gs` is the Google Apps Script source used by `/api/data`.

## Deploying a change

1. Replace the Apps Script project's `Code.gs` with this file.
2. Keep the existing `API_SECRET` Script Property. Category icon upload signing
   and cleanup run in the Vercel data proxy, so Apps Script no longer needs
   Cloudinary properties or the `script.external_request` OAuth scope.
3. In Apps Script, open **Deploy > Manage deployments**, edit the web-app
   deployment, select **New version**, and deploy it.
4. Keep **Execute as** set to the script owner and preserve the existing web-app
   access setting.
5. If Google creates a different `/exec` URL, update `APPS_SCRIPT_URL` in Vercel
   and redeploy the Vercel project.

The Vercel project must define `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
and `CLOUDINARY_API_SECRET` for category icon upload and cleanup.

The reliability patch reuses one Spreadsheet object per execution, caches read
snapshots briefly, and invalidates both read caches after every successful write.
The cache contains data only; API secrets and PINs are never stored in it.
