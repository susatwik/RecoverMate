const express = require("express");
const cors = require("cors");

const invoiceRoutes = require("./modules/invoices/invoice.routes");
const customerRoutes = require("./modules/customers/customer.routes");
const messageRoutes = require("./modules/messages/message.routes");
const ragRoutes = require("./modules/rag/rag.routes");
const reminderRoutes = require("./modules/reminders/reminder.routes");

const app = express();

app.use(cors());
app.use((req, _res, next) => {
  console.log("REQUEST:", req.method, req.url);
  next();
});
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    success: true,
    data: {
      name: "RecoverMate API",
      status: "ok",
    },
  });
});

app.use("/api/invoices", invoiceRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/rag", ragRoutes);
app.use("/api/reminders", reminderRoutes);

module.exports = app;
