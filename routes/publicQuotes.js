import express from "express";
import rateLimit from "express-rate-limit";
import { validateRequestBody, createAndSendDocument } from "../lib/documentService.js";

const router = express.Router();

// Tighter limit than the staff endpoint - this is open to the whole internet.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many requests. Please wait a minute and try again." },
});

// POST /api/public/quotes/request - used by the catalogue page on the public
// website. No API key (browsers can't keep secrets), so this is protected
// instead by:
//   1. A honeypot field ("company_website") that's hidden from real users via
//      CSS. Bots that blindly fill every field will fill this one; if it's
//      non-empty we silently pretend to succeed and drop the request.
//   2. Rate limiting (5 requests/minute per IP).
//   3. The email always goes to the address the requester themselves typed in
//      - this endpoint can only be used to quote/invoice yourself, never a
//      third party, which limits it as a spam vector against other people.
router.post("/request", publicLimiter, async (req, res) => {
  try {
    const { type, customer, items, notes, company_website } = req.body;

    // Honeypot tripped - pretend success, do nothing.
    if (company_website) {
      return res.json({ success: true, docNumber: "N/A" });
    }

    const validationError = validateRequestBody({ type, customer, items });
    if (validationError) {
      return res.status(validationError.status).json({ error: validationError.error });
    }

    // Public requests can't set dueDate/paymentStatus or backdate anything -
    // those stay staff-only defaults.
    const result = await createAndSendDocument({ type, customer, items, notes });
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Failed to send public document request:", err);
    res.status(500).json({ error: "Failed to send email. Please try again." });
  }
});

export default router;
