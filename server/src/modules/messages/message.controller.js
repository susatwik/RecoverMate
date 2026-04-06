const { sendError, sendSuccess } = require("../../shared/http/response");
const messageService = require("./message.service");

async function getMessages(req, res) {
  try {
    const { invoiceId } = req.query;

    if (!invoiceId) {
      return sendError(res, "invoiceId is required", 400);
    }

    const messages = await messageService.getMessagesForInvoice(invoiceId);
    return sendSuccess(res, messages);
  } catch (error) {
    return sendError(res, error.message);
  }
}

async function sendAiMessage(req, res) {
  try {
    const { invoiceId, customerId, text } = req.body;

    if (!text || (!invoiceId && !customerId)) {
      return sendError(res, "text and invoiceId or customerId are required", 400);
    }

    const result = await messageService.sendAiMessage({
      invoiceId,
      customerId,
      text,
    });

    return sendSuccess(res, result, 201);
  } catch (error) {
    const status =
      error.message === "Invoice not found" ||
      error.message === "No active invoice found for customer"
        ? 404
        : error.message === "invoiceId or customerId is required"
          ? 400
          : 500;
    return sendError(res, error.message, status);
  }
}

async function simulateReply(req, res) {
  try {
    const { invoiceId, customerId, text } = req.body;

    if (!text || (!invoiceId && !customerId)) {
      return sendError(res, "text and invoiceId or customerId are required", 400);
    }

    const result = await messageService.simulateUserReply({
      invoiceId,
      customerId,
      text,
    });

    return sendSuccess(res, result, 201);
  } catch (error) {
    const status =
      error.message === "Invoice not found" ||
      error.message === "No active invoice found for customer"
        ? 404
        : error.message === "invoiceId or customerId is required"
          ? 400
          : 500;
    return sendError(res, error.message, status);
  }
}

module.exports = {
  getMessages,
  sendAiMessage,
  simulateReply,
};
