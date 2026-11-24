# Seenetrica Apps Script backend

`Code.gs` is the Google Apps Script source used by `/api/data`.

Favorites use a `favorites` sheet with `id`, `kind`, `item_id`, `name`,
`image_url`, `sort_order`, and `created_at` columns. After deploying the updated
script, the sheet is created automatically on the first favorite save. Movie
favorites reference library movie IDs; actor favorites reference TMDB person IDs.
Each list keeps its own manually chosen order.

Franchise folders add `entry_type` and `parent_id` columns to that same sheet.
The updated script appends these columns automatically on the next favorite
write, preserving existing rows. Empty `parent_id` means the main favorites
list. Each franchise's children have an independent order. Copying a Series
timeline appends references to its movies in that order; it does not create a
live link to the source timeline. Removing a franchise removes only its favorite
entries, not movie records or Series data.

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
