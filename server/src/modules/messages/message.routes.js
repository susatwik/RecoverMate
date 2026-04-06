const express = require("express");
const controller = require("./message.controller");

const router = express.Router();

router.get("/", controller.getMessages);
router.post("/ai", controller.sendAiMessage);
router.post("/reply", controller.simulateReply);

module.exports = router;
