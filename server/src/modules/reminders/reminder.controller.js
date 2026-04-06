const { sendError, sendSuccess } = require("../../shared/http/response");
const reminderService = require("./reminder.service");

async function sendReminder(req, res) {
  try {
    const result = await reminderService.sendReminderForInvoice(req.params.invoiceId);
    return sendSuccess(res, result);
  } catch (error) {
    const status = error.message === "Invoice not found" ? 404 : 500;
    return sendError(res, error.message, status);
  }
}

async function runOverdueReminders(_req, res) {
  try {
    const results = await reminderService.runOverdueReminders();
    return sendSuccess(res, results);
  } catch (error) {
    return sendError(res, error.message);
  }
}

module.exports = {
  sendReminder,
  runOverdueReminders,
};
