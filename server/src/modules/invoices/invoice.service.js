const { GoogleGenAI } = require("@google/genai");
const pdfParse = require("pdf-parse");

const Invoice = require("./invoice.model");
const Customer = require("../customers/customer.model");
const { calculateRiskLevel } = require("../../shared/utils/risk");

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

function generateInvoiceNumber() {
  return `INV-${Date.now().toString().slice(-6)}`;
}

function shapeInvoice(invoice) {
  return {
    ...invoice.toObject(),
    riskLevel: calculateRiskLevel(invoice.dueDate),
  };
}

async function listInvoices() {
  const invoices = await Invoice.find()
    .populate("customer")
    .sort({ createdAt: -1 });

  return invoices.map(shapeInvoice);
}

async function getInvoiceById(id) {
  const invoice = await Invoice.findById(id).populate("customer");
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  return shapeInvoice(invoice);
}

async function createInvoice({ customerId, amount, dueDate, invoiceNumber }) {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error("Customer not found");
  }

  const invoice = await Invoice.create({
    customer: customerId,
    amount,
    dueDate,
    invoiceNumber: invoiceNumber || generateInvoiceNumber(),
    riskLevel: calculateRiskLevel(dueDate),
  });

  return getInvoiceById(invoice._id);
}

async function markInvoicePaid(id) {
  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  invoice.status = "PAID";
  invoice.paidAt = new Date();
  await invoice.save();

  return getInvoiceById(id);
}

async function updateInvoiceStatus(id, status) {
  const validStatuses = [
    "TO_CONTACT",
    "PROMISED",
    "DISPUTED",
    "PAID",
    "CALL_REQUIRED",
  ];

  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status");
  }

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  invoice.status = status;
  await invoice.save();

  return getInvoiceById(id);
}

async function findLatestActiveInvoiceForCustomer(customerId) {
  return Invoice.findOne({
    customer: customerId,
    status: { $ne: "PAID" },
  })
    .populate("customer")
    .sort({ createdAt: -1 });
}

async function incrementReminder(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  invoice.lastReminderDate = new Date();
  invoice.lastContactedAt = new Date();
  invoice.reminderCount += 1;
  await invoice.save();

  return getInvoiceById(invoiceId);
}

function normalizeExtractedInvoice(extractedData) {
  return {
    customerName:
      extractedData.customerName ||
      extractedData.clientName ||
      extractedData.client_name ||
      "",
    invoiceNumber: extractedData.invoiceNumber || "",
    dueDate: extractedData.dueDate || "",
    amount: extractedData.totalAmount || extractedData.amount || null,
  };
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const cleaned = String(value)
    .replace(/INR/gi, "")
    .replace(/[₹$,]/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split("T")[0];
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/(\d{1,2})(st|nd|rd|th)/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  const dayMonthYear = normalized.match(
    /(\d{1,2})[\s/-]([A-Za-z]{3,9})[\s,-]+(\d{4})/
  );
  if (dayMonthYear) {
    const reparsed = new Date(
      `${dayMonthYear[2]} ${dayMonthYear[1]}, ${dayMonthYear[3]}`
    );
    if (!Number.isNaN(reparsed.getTime())) {
      return reparsed.toISOString().split("T")[0];
    }
  }

  const monthDayYear = normalized.match(
    /([A-Za-z]{3,9})[\s.-]+(\d{1,2}),?[\s.-]+(\d{4})/
  );
  if (monthDayYear) {
    const reparsed = new Date(
      `${monthDayYear[1]} ${monthDayYear[2]}, ${monthDayYear[3]}`
    );
    if (!Number.isNaN(reparsed.getTime())) {
      return reparsed.toISOString().split("T")[0];
    }
  }

  return null;
}

function cleanupCustomerName(value) {
  if (!value) {
    return null;
  }

  const cleaned = String(value).replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function cleanupInvoiceNumber(value) {
  if (!value) {
    return null;
  }

  const cleaned = String(value).replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function finalizeExtractedInvoice(extractedData) {
  const normalized = normalizeExtractedInvoice(extractedData || {});

  return {
    customerName: cleanupCustomerName(normalized.customerName),
    invoiceNumber: cleanupInvoiceNumber(normalized.invoiceNumber),
    dueDate: normalizeDate(normalized.dueDate),
    amount: normalizeAmount(normalized.amount),
  };
}

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/{[\s\S]*}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }

    return null;
  }
}

function extractFallbackAmount(text) {
  const labelledPatterns = [
    /Total Amount Due[^0-9₹]*₹?\s?([\d,]+)/i,
    /(?:total amount due|amount due|net amount|grand total|total payable|final amount)[^\d₹$A-Z]*((?:₹|\$|INR)?\s?\d[\d,]*(?:\.\d{1,2})?)/i,
    /(?:total)[^\d₹$A-Z]*((?:₹|\$|INR)?\s?\d[\d,]*(?:\.\d{1,2})?)/i,
  ];

  for (const pattern of labelledPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = normalizeAmount(match[1]);
      if (amount !== null) {
        return amount;
      }
    }
  }

  const genericMatches = text.match(/(?:₹|\$|INR)?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g);
  if (!genericMatches?.length) {
    return null;
  }

  const parsedAmounts = genericMatches
    .map((value) => normalizeAmount(value))
    .filter((value) => value !== null);

  if (!parsedAmounts.length) {
    return null;
  }

  return Math.max(...parsedAmounts);
}

function extractFallbackDueDate(text) {
  const labelledPatterns = [
    /Due Date[:\s-]*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
    /Due Date[:\s-]*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    /due\s*date[:\s-]*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    /due\s*date[:\s-]*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
    /due\s*date[:\s-]*(\d{4}-\d{2}-\d{2})/i,
  ];

  for (const pattern of labelledPatterns) {
    const match = text.match(pattern);
    if (match) {
      const date = normalizeDate(match[1]);
      if (date) {
        return date;
      }
    }
  }

  return null;
}

function extractFallbackCustomerName(text) {
  const lineAfterBillTo = text.match(/Bill To[:\s]*\n?\s*([^\n]+)/i);
  if (lineAfterBillTo) {
    const value = cleanupCustomerName(lineAfterBillTo[1]);
    if (value) {
      return value;
    }
  }

  const sections = [
    /bill\s*to[:\s]*([^\n]+)/i,
    /customer\s*name[:\s]*([^\n]+)/i,
    /client\s*name[:\s]*([^\n]+)/i,
  ];

  for (const pattern of sections) {
    const match = text.match(pattern);
    if (match) {
      const value = cleanupCustomerName(match[1]);
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function extractFallbackInvoiceNumber(text) {
  const patterns = [
    /(INV[-\d]+)/i,
    /invoice\s*(?:no|number|#)[:\s-]*([A-Z0-9/-]+)/i,
    /bill\s*(?:no|number)[:\s-]*([A-Z0-9/-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = cleanupInvoiceNumber(match[1]);
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function extractInvoiceFromRegex(text) {
  return {
    customerName: extractFallbackCustomerName(text),
    invoiceNumber: extractFallbackInvoiceNumber(text),
    dueDate: extractFallbackDueDate(text),
    amount: extractFallbackAmount(text),
  };
}

async function extractInvoiceFromFile(file) {
  if (!file) {
    return {
      success: false,
      error: "No file uploaded",
      data: null,
    };
  }

  const buffer = file.buffer;
  const mimeType = file.mimetype;
  let text = "";
  let method = "TEXT";

  if (mimeType === "application/pdf") {
    try {
      const pdfData = await pdfParse(buffer);
      text = pdfData.text.trim();
    } catch (error) {
      console.error("[invoice-upload] pdf-parse failed:", error.message);
      text = "";
    }
  }

  const cleanedText = text.replace(/\s+/g, " ").trim();

  console.log("[invoice-upload] extracted text:");
  console.log(text || "[empty]");
  console.log("[invoice-upload] cleaned text:");
  console.log(cleanedText || "[empty]");

  if (!genAI) {
    return {
      success: false,
      error: "GEMINI_API_KEY is not configured",
      data: null,
    };
  }

  let contents;

  if (true) {
    method = "VISION";
    console.log("[invoice-upload] USING VISION MODE");
    contents = [
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType,
        },
      },
      {
        text: `Analyze this invoice image and extract structured data.

Focus on:
* Total Amount Due (final amount, not subtotal)
* Due Date
* Customer Name (from Bill To section)
* Invoice Number

Rules:
* Convert ₹64,900 → 64900
* Convert dates like '25 Jan 2026' → '2026-01-25'
* Ignore subtotal and tax, only return final payable amount

Return ONLY JSON:
{
  "customerName": string | null,
  "invoiceNumber": string | null,
  "dueDate": "YYYY-MM-DD" | null,
  "amount": number | null
}`,
      },
    ];
  }

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents,
    });

    const responseText = result.text.replace(/```json|```/g, "").trim();
    console.log("[invoice-upload] AI response:");
    console.log(responseText || "[empty]");

    let parsed = safeParseJSON(responseText);
    console.log("[invoice-upload] parsed JSON:");
    console.log(JSON.stringify(parsed, null, 2));

    if (
      !parsed ||
      (!parsed.amount &&
        !parsed.totalAmount &&
        !parsed.dueDate &&
        !parsed.customerName &&
        !parsed.invoiceNumber)
    ) {
      const retryResult = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType,
            },
          },
          {
            text: `Extract ONLY these values:
Amount, Due Date, Customer Name, Invoice Number.
Return JSON only.`,
          },
        ],
      });

      const retryText = retryResult.text.replace(/```json|```/g, "").trim();
      console.log("[invoice-upload] retry responseText:");
      console.log(retryText || "[empty]");
      parsed = safeParseJSON(retryText);
      console.log("[invoice-upload] retry parsed JSON:");
      console.log(JSON.stringify(parsed, null, 2));
    }

    const aiData = finalizeExtractedInvoice(parsed);
    const fallbackSource = text || responseText;
    console.log("[invoice-upload] fallback source:");
    console.log(fallbackSource || "[empty]");
    const fallbackData = extractInvoiceFromRegex(fallbackSource);
    const data = {
      customerName: aiData.customerName || fallbackData.customerName,
      invoiceNumber: aiData.invoiceNumber || fallbackData.invoiceNumber,
      dueDate: aiData.dueDate || fallbackData.dueDate,
      amount: aiData.amount ?? fallbackData.amount,
    };

    if (!data.amount) {
      const match = responseText.match(/₹\s?[\d,]+/);
      if (match) {
        data.amount = normalizeAmount(match[0]);
      }
    }

    console.log("[invoice-upload] final extracted values:");
    console.log(JSON.stringify(data, null, 2));

    if (!data.amount && !data.dueDate && !data.customerName && !data.invoiceNumber) {
      return {
        success: false,
        error: "AI could not extract usable invoice data",
        data: null,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("[invoice-upload] extraction failed:", error.message);
    const fallbackSource = text || "";
    console.log("[invoice-upload] fallback source:");
    console.log(fallbackSource || "[empty]");
    const fallbackData = extractInvoiceFromRegex(fallbackSource);

    console.log("[invoice-upload] final extracted values:");
    console.log(JSON.stringify(fallbackData, null, 2));

    if (
      fallbackData.amount ||
      fallbackData.dueDate ||
      fallbackData.customerName ||
      fallbackData.invoiceNumber
    ) {
      return {
        success: true,
        data: fallbackData,
      };
    }

    return {
      success: false,
      error: "Failed to extract invoice data",
      data: null,
    };
  }
}

module.exports = {
  listInvoices,
  getInvoiceById,
  createInvoice,
  markInvoicePaid,
  updateInvoiceStatus,
  findLatestActiveInvoiceForCustomer,
  incrementReminder,
  extractInvoiceFromFile,
};
