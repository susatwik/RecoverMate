const express = require("express");
const controller = require("./reminder.controller");

const router = express.Router();

router.post("/invoices/:invoiceId/send", controller.sendReminder);
router.post("/run-overdue", controller.runOverdueReminders);

module.exports = router;
