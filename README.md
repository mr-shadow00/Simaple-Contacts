# Simple Contacts

A minimal, self-hosted contacts app — just names, phone numbers, emails, addresses, and notes. No calendar, no CRM, no build step. Every device that opens the same URL sees and edits the same contact list.

This version needs **no terminal and no building** — it runs directly on the official `node` image with your code just mounted in as files.

## What's in this folder

```
contacts-app/
├── app/                  ← the app itself, goes in ZimaOS's file manager
│   ├── server.js
│   └── public/
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── data/                 ← empty folder; this is where contacts.json will be saved
└── docker-compose.yml    ← paste this into ZimaOS's "Custom Install"
```

## Installing on ZimaOS, using only the web UI

**1. Copy the files onto ZimaOS**

Open the ZimaOS **Files** app and create a folder, for example:
`/DATA/AppData/simple-contacts/`

Inside it, upload:
- the `app` folder (with `server.js` and `public/` inside it)
- an empty `data` folder

So you end up with `/DATA/AppData/simple-contacts/app/server.js` and `/DATA/AppData/simple-contacts/data/` (empty, for now).

*(If your ZimaOS uses a different root than `/DATA`, just note the actual path shown in the Files app — you'll use it in step 3.)*

**2. Open the Custom Install screen**

In the ZimaOS App Store, choose **Install a Custom App** (sometimes labeled **Custom Install** on the app card, or a "Docker Compose" tab in the install dialog).

**3. Paste the compose file**

Open `docker-compose.yml` from this folder, copy its contents, and paste it into the Docker Compose box. Before submitting, check the two `source:` paths under `volumes:` — they need to match wherever you actually put the `app` and `data` folders in step 1. They're currently set to:
```
/DATA/AppData/simple-contacts/app
/DATA/AppData/simple-contacts/data
```
Edit those two lines if your folder path is different.

**4. Submit / Install**

ZimaOS will pull the standard `node:20-alpine` image (no custom build needed) and start the container.

**5. Open it**

Visit `http://<your-zimaos-ip>:8088` from any device on your network — phone, laptop, tablet. That's your contacts app. Open the same address from another device and you'll see the same contacts.

If port 8088 is already taken by something else, change the `published:` value in the compose file before installing.

## Backups

Use the "⋯" menu in the app to **Export** a JSON backup any time, or **Import** one back in. Your live data also just sits as a plain file at `data/contacts.json` in the folder you made in step 1, so you can copy it directly from the Files app too.

## Scope, on purpose

No calendars, no tasks, no file storage, no CardDAV/CalDAV — just contacts, per what you asked for. If down the road you want your phone's native Contacts app to sync directly with this server (instead of visiting it in a browser), that needs CardDAV support added, which is a separate, bigger project — happy to help with that later if you want it.
