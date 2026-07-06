import express from "express";
import { validateRequestBody, createAndSendDocument } from "../lib/documentService.js";

const router = express.Router();

// POST /api/quotes/send - internal/staff endpoint, protected by x-api-key
// (see server.js). Accepts full control over type, dueDate, paymentStatus, etc.
router.post("/send", async (req, res) => {
  try {
    const { type, customer, items, notes, dueDate, paymentStatus } = req.body;

    const validationError = validateRequestBody({ type, customer, items, dueDate, paymentStatus });
    if (validationError) {
      return res.status(validationError.status).json({ error: validationError.error });
    }

    const result = await createAndSendDocument({ type, customer, items, notes, dueDate, paymentStatus });
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Failed to send document:", err);
    res.status(500).json({ error: "Failed to send email. Please try again." });
  }
});

export default router;
