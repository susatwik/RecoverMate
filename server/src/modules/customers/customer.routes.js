const express = require("express");
const controller = require("./customer.controller");

const router = express.Router();

router.get("/", controller.getCustomers);
router.post("/", controller.createCustomer);

module.exports = router;
