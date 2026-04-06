const express = require("express");
const controller = require("./rag.controller");

const router = express.Router();

router.get("/policies", controller.getPolicies);
router.post("/policies/upload", controller.uploadMiddleware, controller.uploadPolicy);

module.exports = router;
