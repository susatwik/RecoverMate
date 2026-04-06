const express = require("express");
const controller = require("./invoice.controller");

const router = express.Router();

router.post(
  "/upload",
  (req, _res, next) => {
    console.log("UPLOAD ROUTE HIT");
    next();
  },
  controller.uploadMiddleware,
  controller.uploadInvoice
);
router.get("/", controller.getInvoices);
router.get("/:id", controller.getInvoice);
router.post("/", controller.createInvoice);
router.post("/:id/mark-paid", controller.markInvoicePaid);
router.patch("/:id/status", controller.updateStatus);

module.exports = router;
