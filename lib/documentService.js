import { generateDocPdf } from "./pdf.js";
import { sendMail } from "./mailer.js";
import { generateDocNumber } from "./docNumber.js";
import { getProductById } from "./catalogue.js";

export const PAYMENT_STATUSES = ["unpaid", "paid", "overdue"];
const DEFAULT_INVOICE_DUE_DAYS = Number(process.env.INVOICE_DUE_DAYS) || 14;

/**
 * Turns the raw items array from the request into a normalized array of
 * {name, unit, unitPrice, qty}. Items with a productId are resolved against
 * the catalogue - the server's price always wins, so a client can never
 * override a catalogue product's price by sending its own unitPrice.
 * Items without a productId are treated as manual/custom line items and
 * used as-is (name required, unitPrice may be omitted/null for "TBC").
 *
 * Throws an Error with a `.status` of 400 if a productId doesn't exist
 * or a manual item is missing a name.
 */
export function resolveItems(items) {
  return items.map((item) => {
    if (item.productId) {
      const product = getProductById(item.productId);
      if (!product) {
        const err = new Error(`Unknown productId: ${item.productId}`);
        err.status = 400;
        throw err;
      }
      return {
        name: product.name,
        unit: product.unit,
        unitPrice: product.unitPrice,
        qty: item.qty || 1,
      };
    }
    if (!item.name) {
      const err = new Error("each item requires either a productId or a name");
      err.status = 400;
      throw err;
    }
    return {
      name: item.name,
      unit: item.unit,
      unitPrice: item.unitPrice,
      qty: item.qty || 1,
    };
  });
}

function buildEmailHtml({ type, docNumber, customerName, itemsHtml, company, dueDate, paymentStatus }) {
  const title = type === "invoice" ? "Invoice" : "Quotation";

  const statusColors = {
    unpaid: "#B8860B",
    paid: "#2E7D32",
    overdue: "#B24B32",
  };
  const dueDateLine = type === "invoice" && dueDate
    ? `<p style="font-size:13px;">Payment is due by <b>${new Date(dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</b>. Status: <b style="color:${statusColors[paymentStatus] || "#5B6B77"};text-transform:uppercase;">${paymentStatus}</b></p>`
    : "";

  return `
  <div style="font-family:Arial,sans-serif;color:#16232E;max-width:560px;margin:0 auto;">
    <h2 style="color:#B24B32;margin-bottom:4px;">${company.name}</h2>
    <p style="color:#5B6B77;font-size:13px;margin-top:0;">${company.address || ""}<br>${company.phone || ""} &middot; ${company.email || ""}</p>
    <hr style="border:none;border-top:2px solid #16232E;margin:16px 0;">
    <p>Hi ${customerName || "there"},</p>
    <p>Please find your <b>${title.toLowerCase()}</b> (No. <b>${docNumber}</b>) attached as a PDF. A summary is below:</p>
    ${dueDateLine}
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
      <tr style="border-bottom:2px solid #16232E;">
        <th style="text-align:left;padding:6px 4px;">Item</th>
        <th style="text-align:right;padding:6px 4px;">Qty</th>
        <th style="text-align:right;padding:6px 4px;">Price</th>
      </tr>
      ${itemsHtml}
    </table>
    <p style="font-size:13px;color:#5B6B77;">If you have any questions, just reply to this email or call us at ${company.phone || ""}.</p>
    <p style="font-size:13px;">Thank you for choosing ${company.name}.</p>
  </div>`;
}

/**
 * Validates a request body shape shared by both the staff and public routes.
 * Returns { error, status } on failure, or null if the body is valid.
 */
export function validateRequestBody({ type, customer, items, dueDate, paymentStatus }) {
  if (!["quote", "invoice"].includes(type)) {
    return { status: 400, error: "type must be 'quote' or 'invoice'" };
  }
  if (!customer || !customer.name || !customer.email) {
    return { status: 400, error: "customer.name and customer.email are required" };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { status: 400, error: "items must be a non-empty array" };
  }
  if (dueDate !== undefined && isNaN(new Date(dueDate).getTime())) {
    return { status: 400, error: "dueDate must be a valid date string (e.g. '2026-07-19')" };
  }
  if (paymentStatus !== undefined && !PAYMENT_STATUSES.includes(paymentStatus)) {
    return { status: 400, error: `paymentStatus must be one of: ${PAYMENT_STATUSES.join(", ")}` };
  }
  return null;
}

/**
 * Builds the PDF, builds the email, sends it, and returns a summary object.
 * Shared by both the internal (/send) and public (/public-request) routes so
 * the two never drift out of sync.
 *
 * Throws an Error with `.status` set for any validation-style failure
 * (bad productId, etc.) - callers should catch and respond with that status.
 */
export async function createAndSendDocument({ type, customer, items, notes, dueDate, paymentStatus }) {
  const resolvedItems = resolveItems(items);

  const company = {
    name: process.env.COMPANY_NAME || "Lubs Mutondo Limited",
    address: process.env.COMPANY_ADDRESS || "",
    phone: process.env.COMPANY_PHONE || "",
    email: process.env.COMPANY_EMAIL || process.env.GMAIL_USER,
  };

  const docNumber = generateDocNumber(type);
  const date = new Date();
  const validUntil = type === "quote" ? new Date(date.getTime() + 14 * 24 * 60 * 60 * 1000) : undefined;

  const invoiceDueDate = type === "invoice"
    ? (dueDate ? new Date(dueDate) : new Date(date.getTime() + DEFAULT_INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000))
    : undefined;
  const invoicePaymentStatus = type === "invoice" ? (paymentStatus || "unpaid") : undefined;

  const payment = type === "invoice"
    ? {
        mobileMoney: process.env.PAYMENT_MOBILE_MONEY || "",
        bankDetails: process.env.PAYMENT_BANK_DETAILS || "",
      }
    : undefined;

  const pdfBuffer = await generateDocPdf({
    type,
    docNumber,
    date,
    validUntil,
    dueDate: invoiceDueDate,
    paymentStatus: invoicePaymentStatus,
    company,
    customer,
    items: resolvedItems,
    notes,
    payment,
  });

  const itemsHtml = resolvedItems.map((item) => {
    const qty = item.qty || 1;
    const priced = item.unitPrice !== null && item.unitPrice !== undefined;
    const priceLabel = priced ? `K${Number(item.unitPrice * qty).toLocaleString("en-ZM", { minimumFractionDigits: 2 })}` : "TBC";
    return `<tr style="border-bottom:1px solid #E4DFCF;">
      <td style="padding:6px 4px;">${item.name}</td>
      <td style="padding:6px 4px;text-align:right;">${qty}</td>
      <td style="padding:6px 4px;text-align:right;">${priceLabel}</td>
    </tr>`;
  }).join("");

  const html = buildEmailHtml({
    type,
    docNumber,
    customerName: customer.name,
    itemsHtml,
    company,
    dueDate: invoiceDueDate,
    paymentStatus: invoicePaymentStatus,
  });

  await sendMail({
    to: customer.email,
    subject: `${type === "invoice" ? "Invoice" : "Quotation"} ${docNumber} from ${company.name}`,
    html,
    attachment: {
      filename: `${docNumber}.pdf`,
      content: pdfBuffer,
    },
  });

  return {
    success: true,
    docNumber,
    ...(type === "invoice" ? { dueDate: invoiceDueDate.toISOString().slice(0, 10), paymentStatus: invoicePaymentStatus } : {}),
  };
}
