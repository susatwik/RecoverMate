const { GoogleGenAI } = require("@google/genai");

const AIInteraction = require("./ai.model");
const { normalizeDateFromText } = require("../../shared/utils/date");

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

async function logInteraction(payload) {
  return AIInteraction.create(payload);
}

async function classifyReply(message, context = {}) {
  if (!genAI) {
    return fallbackClassifyReply(message);
  }

  const today = new Date().toISOString().split("T")[0];
  const prompt = `You are classifying invoice recovery replies.
Current date: ${today}
Reply: "${message}"
Invoice number: "${context.invoiceNumber || ""}"
Amount due: "${context.amount || ""}"

Return only JSON:
{
  "type": "promise" | "dispute" | "info",
  "confidence": number,
  "promisedDate": "YYYY-MM-DD" | null
}`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const parsed = JSON.parse(result.text.replace(/```json|```/g, "").trim());
    await logInteraction({
      invoice: context.invoiceId,
      customer: context.customerId,
      purpose: "CLASSIFY_REPLY",
      inputText: message,
      outputText: JSON.stringify(parsed),
      metadata: parsed,
    });

    return parsed;
  } catch (_error) {
    return fallbackClassifyReply(message);
  }
}

function fallbackClassifyReply(message) {
  const lower = message.toLowerCase();
  const promisedDate = normalizeDateFromText(message);

  if (
    lower.includes("will pay") ||
    lower.includes("pay tomorrow") ||
    lower.includes("pay by") ||
    promisedDate
  ) {
    return {
      type: "promise",
      confidence: 0.6,
      promisedDate: promisedDate ? promisedDate.toISOString().split("T")[0] : null,
    };
  }

  if (
    lower.includes("dispute") ||
    lower.includes("wrong") ||
    lower.includes("incorrect") ||
    lower.includes("not my invoice")
  ) {
    return {
      type: "dispute",
      confidence: 0.6,
      promisedDate: null,
    };
  }

  return {
    type: "info",
    confidence: 0.5,
    promisedDate: null,
  };
}

async function generateReminderMessage(invoice) {
  const daysOverdue = Math.max(
    0,
    Math.ceil((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
  );

  if (!genAI) {
    return `Hi ${invoice.customer.name}, invoice ${invoice.invoiceNumber} for Rs. ${invoice.amount} is overdue by ${daysOverdue} day(s). Please share your payment update.`;
  }

  const prompt = `Write a concise payment reminder for:
Customer: ${invoice.customer.name}
Invoice: ${invoice.invoiceNumber}
Amount: Rs. ${invoice.amount}
Days overdue: ${daysOverdue}
Tone: professional and calm`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = result.text.trim();
    await logInteraction({
      invoice: invoice._id,
      customer: invoice.customer._id,
      purpose: "GENERATE_REMINDER",
      inputText: prompt,
      outputText: text,
    });
    return text;
  } catch (_error) {
    return `Hi ${invoice.customer.name}, invoice ${invoice.invoiceNumber} for Rs. ${invoice.amount} is overdue. Please confirm when payment will be completed.`;
  }
}

async function generateInfoReply(invoice) {
  const dueDate = new Date(invoice.dueDate).toLocaleDateString("en-IN");
  return `Invoice ${invoice.invoiceNumber} has an outstanding amount of Rs. ${invoice.amount} and is due on ${dueDate}. Current status is ${invoice.status.replace("_", " ")}.`;
}

module.exports = {
  classifyReply,
  generateReminderMessage,
  generateInfoReply,
};
