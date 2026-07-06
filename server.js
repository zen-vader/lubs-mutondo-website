import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import quotesRouter from "./routes/quotes.js";
import publicQuotesRouter from "./routes/publicQuotes.js";
import catalogueRouter from "./routes/catalogue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
}));

// Basic protection so random visitors can't use the STAFF endpoint to spam
// email through your Gmail account. Only applies to /api/quotes (the
// internal "/send" route used by curl/your own tools) - NOT to
// /api/catalogue (public product list) or /api/public/quotes (the public
// website's request form), which are protected differently instead of by a
// shared secret a browser could leak.
app.use("/api/quotes", (req, res, next) => {
  const key = req.header("x-api-key");
  if (!process.env.API_KEY || key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  next();
});

// Limit to 20 send-requests per 15 minutes per IP - generous for real staff
// use, tight enough to stop abuse of your email quota.
const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/quotes", sendLimiter);

app.use("/api/quotes", quotesRouter);
app.use("/api/public/quotes", publicQuotesRouter);
app.use("/api/catalogue", catalogueRouter);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Lubs Mutondo quotes API running on port ${PORT}`);
});