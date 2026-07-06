import express from "express";
import { getCatalogue } from "../lib/catalogue.js";

const router = express.Router();

// GET /api/catalogue - returns the list of products/services clients can pick from.
router.get("/", (req, res) => {
  try {
    const catalogue = getCatalogue();
    res.json({ products: catalogue });
  } catch (err) {
    console.error("Failed to load catalogue:", err);
    res.status(500).json({ error: "Failed to load catalogue" });
  }
});

export default router;
