// Builds a document number like QT-20260705-4821 or INV-20260705-0193
export function generateDocNumber(type) {
  const prefix = type === "invoice" ? "INV" : "QT";
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}-${y}${m}${d}-${rand}`;
}
