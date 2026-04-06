const multer = require("multer");

const { sendError, sendSuccess } = require("../../shared/http/response");
const invoiceService = require("./invoice.service");

const upload = multer({ storage: multer.memoryStorage() });

async function getInvoices(_req, res) {
  try {
    const invoices = await invoiceService.listInvoices();
    return sendSuccess(res, invoices);
  } catch (error) {
    return sendError(res, error.message);
  }
}

async function getInvoice(req, res) {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    return sendSuccess(res, invoice);
  } catch (error) {
    const status = error.message === "Invoice not found" ? 404 : 500;
    return sendError(res, error.message, status);
  }
}

async function createInvoice(req, res) {
  try {
    const { customerId, amount, dueDate, invoiceNumber } = req.body;

    if (!customerId || !amount || !dueDate) {
      return sendError(
        res,
        "customerId, amount, and dueDate are required",
        400
      );
    }

    const invoice = await invoiceService.createInvoice({
      customerId,
      amount: Number(amount),
      dueDate,
      invoiceNumber,
    });

    return sendSuccess(res, invoice, 201);
  } catch (error) {
    const status =
      error.message === "Customer not found" || error.message.includes("duplicate")
        ? 400
        : 500;
    return sendError(res, error.message, status);
  }
}

async function markInvoicePaid(req, res) {
  try {
    const invoice = await invoiceService.markInvoicePaid(req.params.id);
    return sendSuccess(res, invoice);
  } catch (error) {
    const status = error.message === "Invoice not found" ? 404 : 500;
    return sendError(res, error.message, status);
  }
}

async function updateStatus(req, res) {
  try {
    const invoice = await invoiceService.updateInvoiceStatus(
      req.params.id,
      req.body.status
    );
    return sendSuccess(res, invoice);
  } catch (error) {
    const status =
      error.message === "Invoice not found"
        ? 404
        : error.message === "Invalid status"
          ? 400
          : 500;
    return sendError(res, error.message, status);
  }
}

async function uploadInvoice(req, res) {
  try {
    console.log("FILE RECEIVED:", req.file);
    console.log("CALLING EXTRACTION FUNCTION");
    const extracted = await invoiceService.extractInvoiceFromFile(req.file);

    if (!extracted.success) {
      return res.status(200).json(extracted);
    }

    return res.status(200).json(extracted);
  } catch (error) {
    return sendError(res, error.message, 400);
  }
}

module.exports = {
  uploadMiddleware: upload.single("file"),
  getInvoices,
  getInvoice,
  createInvoice,
  markInvoicePaid,
  updateStatus,
  uploadInvoice,
};
