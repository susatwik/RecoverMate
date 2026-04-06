const Message = require("./message.model");
const Invoice = require("../invoices/invoice.model");
const invoiceService = require("../invoices/invoice.service");
const aiService = require("../ai/ai.service");
const ragService = require("../rag/rag.service");

async function getMessagesForInvoice(invoiceId) {
  return Message.find({ invoice: invoiceId }).sort({ createdAt: 1 });
}

async function createAiMessage({
  invoiceId,
  customerId,
  text,
  messageType = "note",
  metadata = {},
}) {
  return Message.create({
    invoice: invoiceId,
    customer: customerId,
    sender: "ai",
    text,
    messageType,
    metadata,
  });
}

async function createUserMessage({
  invoiceId,
  customerId,
  text,
  messageType = "reply",
  metadata = {},
}) {
  return Message.create({
    invoice: invoiceId,
    customer: customerId,
    sender: "user",
    text,
    messageType,
    metadata,
  });
}

async function resolveInvoice({ invoiceId, customerId }) {
  if (invoiceId) {
    const invoice = await Invoice.findById(invoiceId).populate("customer");
    if (!invoice) throw new Error("Invoice not found");
    return invoice;
  }

  if (!customerId) {
    throw new Error("invoiceId or customerId is required");
  }

  const invoice = await invoiceService.findLatestActiveInvoiceForCustomer(customerId);

  if (!invoice) {
    throw new Error("No active invoice found for customer");
  }

  return invoice;
}

async function simulateUserReply({ invoiceId, customerId, text }) {
  const invoice = await resolveInvoice({ invoiceId, customerId });

  const userMessage = await createUserMessage({
    invoiceId: invoice._id,
    customerId: invoice.customer._id,
    text,
  });

  const classification = await aiService.classifyReply(text, {
    invoiceId: invoice._id,
    customerId: invoice.customer._id,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
  });

  let aiReply;

  if (classification.type === "promise") {
    invoice.status = invoice.promiseCount >= 2 ? "CALL_REQUIRED" : "PROMISED";
    invoice.promiseCount += 1;
    invoice.promisedDate = classification.promisedDate
      ? new Date(classification.promisedDate)
      : invoice.promisedDate;
    await invoice.save();

    aiReply = await createAiMessage({
      invoiceId: invoice._id,
      customerId: invoice.customer._id,
      text: classification.promisedDate
        ? `Thanks, I have recorded your promise to pay by ${classification.promisedDate}.`
        : "Thanks, I have recorded your payment commitment and updated the invoice.",
      metadata: { classification },
    });
  } else if (classification.type === "dispute") {
    invoice.status = "DISPUTED";
    await invoice.save();

    const ragResult = await ragService.generateDisputeReply(text, invoice);
    aiReply = await createAiMessage({
      invoiceId: invoice._id,
      customerId: invoice.customer._id,
      text: ragResult.reply,
      messageType: "rag",
      metadata: {
        classification,
        matches: ragResult.matches,
      },
    });
  } else {
    const infoReplyText = await aiService.generateInfoReply(invoice);
    aiReply = await createAiMessage({
      invoiceId: invoice._id,
      customerId: invoice.customer._id,
      text: infoReplyText,
      metadata: { classification },
    });
  }

  const refreshedInvoice = await invoiceService.getInvoiceById(invoice._id);

  return {
    invoice: refreshedInvoice,
    classification,
    userMessage,
    aiMessage: aiReply,
  };
}

async function sendAiMessage({ invoiceId, customerId, text }) {
  const invoice = await resolveInvoice({ invoiceId, customerId });
  const aiMessage = await createAiMessage({
    invoiceId: invoice._id,
    customerId: invoice.customer._id,
    text,
  });

  return {
    invoiceId: invoice._id,
    message: aiMessage,
  };
}

module.exports = {
  getMessagesForInvoice,
  createAiMessage,
  createUserMessage,
  simulateUserReply,
  sendAiMessage,
};
