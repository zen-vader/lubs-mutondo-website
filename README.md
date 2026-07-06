# Lubs Mutondo — Quotes & Invoices API

A small backend that generates a quotation or invoice PDF and emails it to a client,
sent from `lubsmutondoltd@gmail.com`. Built to sit behind the Lubs Mutondo Limited
website (cart / checkout / "request a quote" form).

## What it does

`POST /api/quotes/send` with a customer + a list of items →
- builds a branded PDF (quotation or invoice)
- emails it to the customer's email address, with the PDF attached
- returns the generated document number

No domain, no database, no payment gateway required. Just Gmail + Node.

## 1. One-time Gmail setup

1. Log into `lubsmutondoltd@gmail.com`
2. Google Account → **Security** → turn on **2-Step Verification**
3. Google Account → **Security** → **App passwords** → create one named "Lubs Mutondo API"
4. Copy the 16-character password it gives you — this goes in `GMAIL_APP_PASSWORD` below (NOT your normal Gmail password)

## 2. Local setup

```bash
npm install
cp .env.example .env
# edit .env and fill in GMAIL_APP_PASSWORD, API_KEY, and payment details
npm run dev
```

Server runs at `http://localhost:3000`.

### Test it

```bash
curl -X POST http://localhost:3000/api/quotes/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: change-this-to-a-long-random-string" \
  -d '{
    "type": "quote",
    "customer": {
      "name": "Test Client",
      "email": "youremail@example.com",
      "phone": "+260970000000",
      "address": "Chelston, Lusaka"
    },
    "items": [
      { "name": "Standard Clay Bricks", "qty": 2, "unit": "per 1000 units", "unitPrice": 1850 },
      { "name": "Site Supervision Retainer", "qty": 1, "unit": "per month", "unitPrice": null }
    ],
    "notes": "Delivery to be arranged after confirmation."
  }'
```

Use your own email as `customer.email` for the first test so you can check what the client receives.
The second item (`unitPrice: null`) shows how "quote on request" line items work — they show as "TBC" instead of a price.

## 3. Deploy on Railway

1. Push this folder to a new GitHub repo (or use Railway's CLI to deploy the folder directly)
2. In Railway: **New Project → Deploy from GitHub repo**
3. Under **Variables**, add every value from `.env.example` with your real values (do not upload your actual `.env` file to GitHub)
4. Railway will detect `npm start` automatically. Once deployed, you'll get a URL like `https://lubs-mutondo-quotes-api-production.up.railway.app`
5. Test the same `curl` command above against that URL instead of localhost

## 4. Calling it from the website frontend

```js
async function sendQuotation(type, customer, items, notes) {
  const res = await fetch("https://YOUR-RAILWAY-URL/api/quotes/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "the same API_KEY value you set in Railway",
    },
    body: JSON.stringify({ type, customer, items, notes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send");
  return data; // { success: true, docNumber: "QT-20260705-1234" }
}
```

`type` is `"quote"` or `"invoice"`. `customer` needs at least `name` and `email`
(`phone` and `address` are optional but shown on the PDF if given).
`items` is a list of `{ name, qty, unit, unitPrice }` — set `unitPrice: null` for
anything priced after a site visit.

## Notes & limits

- Sending as a personal Gmail account is fine at this scale, but Gmail caps you at
  ~500 emails/day. If Lubs Mutondo outgrows that, the next step is a real domain +
  a service like Resend or SendGrid — the `mailer.js` file is the only thing that
  would need to change.
- The `API_KEY` check is intentionally simple (just a shared secret header). It stops
  casual abuse of your Gmail sending quota, not a determined attacker — don't put
  anything more sensitive behind it without adding proper auth later.
- SMS delivery (via Africa's Talking) is handled separately from this service.
