import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOGUE_PATH = path.join(__dirname, "../data/catalogue.json");

/**
 * Reads the catalogue fresh from disk each call. The file is tiny and this
 * keeps things simple: edit data/catalogue.json and changes apply immediately,
 * no server restart or cache-busting needed.
 */
export function getCatalogue() {
  const raw = fs.readFileSync(CATALOGUE_PATH, "utf-8");
  return JSON.parse(raw);
}

export function getProductById(id) {
  return getCatalogue().find((p) => p.id === id);
}
