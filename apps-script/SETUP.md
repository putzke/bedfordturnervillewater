# Connect the survey to a Google Sheet (about 5 minutes)

1. Create a new Google Sheet. Name it "Bedford Turnerville Survey Responses".
2. In the Sheet, choose **Extensions > Apps Script**.
3. Delete the starter code, paste in all of `Code.gs` from this folder, and save.
4. Choose **Deploy > New deployment**. Click the gear and pick **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy** and approve the permissions prompt. (If Google warns the app is unverified, choose Advanced > Go to project.)
6. Copy the **Web app URL** (ends in `/exec`).
7. Open `assets/js/config.js`, paste the URL between the quotes for `ENDPOINT`, save, commit and push.
8. Test: open the live survey, finish it, and confirm a row appears on the **Responses** tab.

The Sheet creates two tabs on the first submission:
- **Responses**: anonymous answers only.
- **Updates list**: emails from people who opted in. It is not linked to any response row.

If you change `Code.gs` later, use **Deploy > Manage deployments > Edit > New version** so the URL stays the same.
Keep the Sheet itself private. Only the web app URL is public, and it can only add rows.

## QR codes
`qr/` holds one code per channel (`?src=` tags the Channel column): mailer, flyer, booth, poster. If the domain changes, tell Claude and the codes get regenerated.
