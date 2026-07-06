import PDFDocument from "pdfkit";

const INK = "#16232E";
const RUST = "#B24B32";
const STEEL = "#3D6E8C";
const GREY = "#5B6B77";

function formatMoney(n) {
  if (n === null || n === undefined) return "TBC";
  return "K" + Number(n).toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Generates a quotation or invoice PDF and resolves with a Buffer.
 *
 * @param {Object} opts
 * @param {"quote"|"invoice"} opts.type
 * @param {string} opts.docNumber
 * @param {Date|string} opts.date
 * @param {Date|string} [opts.validUntil] - quotes only
 * @param {Object} opts.company - {name, address, phone, email}
 * @param {Object} opts.customer - {name, email, phone, address}
 * @param {Array}  opts.items - [{name, qty, unit, unitPrice}] unitPrice may be null for "quote on request" lines
 * @param {string} [opts.notes]
 * @param {Object} [opts.payment] - {mobileMoney, bankDetails} - invoices only
 * @returns {Promise<Buffer>}
 */
export function generateDocPdf(opts) {
  const {
    type,
    docNumber,
    date,
    validUntil,
    company,
    customer,
    items,
    notes,
    payment,
  } = opts;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const docTitle = type === "invoice" ? "INVOICE" : "QUOTATION";

    // --- Header ---
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(18).text(company.name, 50, 50);
    doc.font("Helvetica").fontSize(9).fillColor(GREY);
    doc.text(company.address || "", 50, 72);
    doc.text(`${company.phone || ""}   ${company.email || ""}`, 50, 86);

    doc.font("Helvetica-Bold").fontSize(22).fillColor(RUST).text(docTitle, 300, 50, { width: 245, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor(GREY);
    doc.text(`No: ${docNumber}`, 300, 78, { width: 245, align: "right" });
    doc.text(`Date: ${formatDate(date)}`, 300, 91, { width: 245, align: "right" });
    if (type === "quote" && validUntil) {
      doc.text(`Valid until: ${formatDate(validUntil)}`, 300, 104, { width: 245, align: "right" });
    }

    doc.moveTo(50, 125).lineTo(545, 125).lineWidth(1.5).strokeColor(INK).stroke();

    // --- Bill To ---
    let y = 142;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(GREY).text("BILL TO", 50, y);
    y += 14;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(customer.name || "-", 50, y);
    y += 15;
    doc.font("Helvetica").fontSize(9.5).fillColor(GREY);
    if (customer.address) { doc.text(customer.address, 50, y); y += 13; }
    if (customer.phone) { doc.text(customer.phone, 50, y); y += 13; }
    if (customer.email) { doc.text(customer.email, 50, y); y += 13; }

    y += 14;

    // --- Items table header ---
    const colDesc = 50, colQty = 330, colUnitPrice = 390, colTotal = 470;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(GREY);
    doc.text("DESCRIPTION", colDesc, y);
    doc.text("QTY", colQty, y, { width: 50, align: "right" });
    doc.text("UNIT PRICE", colUnitPrice, y, { width: 70, align: "right" });
    doc.text("TOTAL", colTotal, y, { width: 75, align: "right" });
    y += 12;
    doc.moveTo(50, y).lineTo(545, y).lineWidth(1).strokeColor(INK).stroke();
    y += 8;

    let subtotal = 0;
    let hasTbc = false;

    doc.font("Helvetica").fontSize(10).fillColor(INK);
    items.forEach((item) => {
      const qty = item.qty || 1;
      const priced = item.unitPrice !== null && item.unitPrice !== undefined;
      const lineTotal = priced ? qty * item.unitPrice : null;
      if (priced) subtotal += lineTotal;
      else hasTbc = true;

      const rowHeight = 20;
      if (y + rowHeight > 760) {
        doc.addPage();
        y = 50;
      }

      doc.font("Helvetica-Bold").fontSize(10).text(item.name, colDesc, y, { width: 270 });
      if (item.unit) {
        doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text(item.unit, colDesc, y + 12, { width: 270 });
        doc.fillColor(INK);
      }
      doc.font("Helvetica").fontSize(10).text(String(qty), colQty, y, { width: 50, align: "right" });
      doc.text(priced ? formatMoney(item.unitPrice) : "TBC", colUnitPrice, y, { width: 70, align: "right" });
      doc.font("Helvetica-Bold").text(priced ? formatMoney(lineTotal) : "TBC", colTotal, y, { width: 75, align: "right" });

      y += item.unit ? 28 : 20;
      doc.moveTo(50, y - 4).lineTo(545, y - 4).lineWidth(0.5).strokeColor("#D8D3C4").stroke();
    });

    y += 10;

    // --- Totals ---
    doc.font("Helvetica").fontSize(10).fillColor(GREY);
    doc.text("Subtotal", 390, y, { width: 70, align: "right" });
    doc.font("Helvetica-Bold").fillColor(INK).text(formatMoney(subtotal), colTotal, y, { width: 75, align: "right" });
    y += 18;

    if (hasTbc) {
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(GREY)
        .text("Items marked TBC are priced after a site visit / confirmation call.", 50, y, { width: 495 });
      y += 18;
    }

    doc.moveTo(390, y).lineTo(545, y).lineWidth(1).strokeColor(INK).stroke();
    y += 6;
    doc.font("Helvetica-Bold").fontSize(12).fillColor(RUST).text("TOTAL DUE", 390, y, { width: 70, align: "right" });
    doc.text(formatMoney(subtotal), colTotal, y, { width: 75, align: "right" });
    y += 30;

    // --- Notes ---
    if (notes) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(GREY).text("NOTES", 50, y);
      y += 13;
      doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(notes, 50, y, { width: 495 });
      y += 40;
    }

    // --- Payment instructions (invoice only) ---
    if (type === "invoice" && payment) {
      if (y > 700) { doc.addPage(); y = 50; }
      doc.rect(50, y, 495, 60).fillColor("#F4F1E8").fill();
      doc.fillColor(RUST).font("Helvetica-Bold").fontSize(9).text("HOW TO PAY", 62, y + 10);
      doc.fillColor(INK).font("Helvetica").fontSize(9);
      doc.text(payment.mobileMoney || "", 62, y + 24, { width: 470 });
      doc.text(payment.bankDetails || "", 62, y + 38, { width: 470 });
      y += 74;
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(GREY)
        .text("Please send proof of payment to " + (company.email || "") + " or via SMS to confirm your order.", 50, y, { width: 495 });
      y += 20;
    } else if (type === "quote") {
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(GREY)
        .text("This quotation is an estimate and not a demand for payment. Contact us to confirm and convert to an order.", 50, y, { width: 495 });
      y += 20;
    }

    doc.font("Helvetica").fontSize(8).fillColor(GREY)
      .text(`${company.name} — generated ${formatDate(new Date())}`, 50, 780, { width: 495, align: "center" });

    doc.end();
  });
}
