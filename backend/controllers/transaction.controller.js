const Joi = require("joi");
const { randomUUID } = require("crypto");
const { isExpired, storeDate } = require("../utils/expiry");
const TransactionModel = require("../models/transaction.model");
const ProductModel = require("../models/product.model");
const SubmissionModel = require("../models/submission.model");
const UserModel = require("../models/user.model");
const { sendToUser } = require("../sse");

const normalizeOrderItems = (items = []) => {
  const byProduct = new Map();

  for (const item of items) {
    const productId = Number(item?.product_id);
    const quantity = Number(item?.quantity);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error("Each item must include a valid product_id.");
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Each item quantity must be a positive integer.");
    }

    const current = byProduct.get(productId) || 0;
    if (current + quantity > 2147483647) throw new Error("Item quantity is too large.");
    byProduct.set(productId, current + quantity);
  }

  return Array.from(byProduct.entries()).map(([product_id, quantity]) => ({
    product_id,
    quantity,
  }));
};

const transactionSchema = Joi.object({
  request_id: Joi.string().uuid().optional(),
  user_id: Joi.number().integer().positive().required(),
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.number().integer().positive().max(2147483647).required(),
        quantity: Joi.number().integer().min(1).max(2147483647).required(),
      }),
    )
    .min(1)
    .required(),
  payment_method: Joi.string().valid("cash", "pos").required(),
  tendered_amount: Joi.number().min(0).precision(2).strict().optional(),
});

const walkInSchema = transactionSchema.fork(["user_id", "payment_method"], (field) => field.optional());
const receiptNumber = () => `REC-${storeDate().replace(/-/g, "")}-${randomUUID().replace(/-/g, "").slice(0, 20)}`;

const controller = {};

controller.normalizeOrderItems = normalizeOrderItems;

controller.create = async (req, res) => {
  try {
    const { error } = transactionSchema.validate(req.body);
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    const { user_id, items, payment_method, tendered_amount, request_id } = req.body;
    const stableReceipt = request_id ? `REC-${request_id}` : null;
    if (stableReceipt) {
      const prior = await TransactionModel.findReplay(stableReceipt, req.user.id, req.body);
      if (prior) return res.status(200).json({ message: 'Transaction already recorded.', transactionId: prior.id, receipt_number: stableReceipt });
    }

    const client = await UserModel.findById(user_id);
    if (!client || client.role !== "client" || client.status !== "active") {
      return res.status(400).json({
        message: "An active registered client account is required.",
      });
    }

    let normalizedItems;
    try {
      normalizedItems = normalizeOrderItems(items);
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    // Generate receipt number
    const receipt_number = stableReceipt || receiptNumber();

    // Calculate total and validate stock
    let total_amount = 0;
    const transactionItems = [];

    for (const item of normalizedItems) {
      const product = await ProductModel.getById(item.product_id);
      if (!product)
        return res
          .status(404)
          .json({ message: `Product ID ${item.product_id} not found.` });
      if (product.status !== "active")
        return res
          .status(400)
          .json({ message: `Product "${product.name}" is not available.` });
      if (isExpired(product.expiry_date))
        return res.status(400).json({ message: `Product "${product.name}" has expired and cannot be sold.` });
      if (product.stock < item.quantity)
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });

      const subtotal = (Math.round(Number(product.price) * 100) * Number(item.quantity)) / 100;
      total_amount += subtotal;
      transactionItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(product.price),
        subtotal,
      });
    }

    total_amount = Math.round(total_amount * 100) / 100;
    const tenderedAmount = Number(tendered_amount);
    if (payment_method === "cash" && (!Number.isFinite(tenderedAmount) || tenderedAmount < total_amount)) {
      return res.status(400).json({
        message: `Payment must be at least ${total_amount.toFixed(2)}.`,
      });
    }

    const transactionId = await TransactionModel.create({
      receipt_number,
      user_id,
      staff_id: req.user.id,
      total_amount,
      payment_method,
      ...(payment_method === "cash" ? {
        tendered_amount: tenderedAmount,
        change_amount: Math.round((tenderedAmount - total_amount) * 100) / 100,
      } : {}),
      items: transactionItems,
    });

    sendToUser(user_id, "order_status_update", {
      status: "completed",
      receipt_number,
      total_amount,
      cashier_name: req.user.name || "Staff",
      completed_at: new Date().toISOString(),
      message: "Your purchase has been completed.",
    });

    res.status(201).json({
      message: "Transaction created successfully.",
      transactionId,
      receipt_number,
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

controller.getAll = async (req, res) => {
  try {
    const transactions = await TransactionModel.getAll();
    res.json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

controller.getById = async (req, res) => {
  try {
    const transaction = await TransactionModel.getById(req.params.id);
    if (!transaction)
      return res.status(404).json({ message: "Transaction not found." });
    if (
      req.user.role === "client" &&
      Number(transaction.user_id) !== Number(req.user.id)
    ) {
      return res
        .status(403)
        .json({ message: "You are not allowed to view this transaction." });
    }
    res.json(transaction);
  } catch (error) {
    console.error("Get transaction error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

controller.getMyTransactions = async (req, res) => {
  try {
    const transactions = await TransactionModel.getByUserId(req.user.id);
    res.json(transactions);
  } catch (error) {
    console.error("Get my transactions error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

controller.getByStaff = async (req, res) => {
  try {
    const transactions = await TransactionModel.getByStaffId(req.user.id);
    res.json(transactions);
  } catch (error) {
    console.error("Get staff transactions error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

controller.createWalkInRequest = async (req, res) => {
  try {
    const { error } = walkInSchema.validate({ items: req.body.items });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    let normalizedItems;
    try {
      normalizedItems = normalizeOrderItems(req.body.items);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const requestItems = [];
    for (const item of normalizedItems) {
      const product = await ProductModel.getById(item.product_id);
      if (!product)
        return res
          .status(404)
          .json({ message: `Product ID ${item.product_id} not found.` });
      if (product.status !== "active")
        return res
          .status(400)
          .json({ message: `Product "${product.name}" is not available.` });
      if (isExpired(product.expiry_date))
        return res.status(400).json({ message: `Product "${product.name}" has expired and cannot be sold.` });
      if (product.stock < item.quantity)
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });
      requestItems.push({
        product_id: product.id,
        quantity: item.quantity,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
      });
    }

    const submissionId = await SubmissionModel.create({
      type: "walk_in_order",
      data: { items: requestItems },
      submitted_by: req.user.id,
    });

    res.status(201).json({
      message:
        "Walk-in order request submitted. Please pay at the store counter.",
      submissionId,
    });
  } catch (error) {
    console.error("Create walk-in request error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

controller.getPendingWalkInRequests = async (req, res) => {
  try {
    const submissions = await SubmissionModel.getAll("pending");
    res.json(
      submissions.filter((submission) => submission.type === "walk_in_order"),
    );
  } catch (error) {
    console.error("Get pending walk-in requests error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

controller.getCancelledWalkInRequests = async (req, res) => {
  try {
    const submissions = await SubmissionModel.getByType(
      "walk_in_order",
      "cancelled",
    );
    res.json(submissions);
  } catch (error) {
    console.error("Get cancelled walk-in requests error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

controller.completeWalkInRequest = async (req, res) => {
  try {
    const submission = await SubmissionModel.getById(req.params.id);
    if (
      !submission ||
      submission.type !== "walk_in_order" ||
      submission.status !== "pending"
    ) {
      return res
        .status(404)
        .json({ message: "Pending walk-in request not found." });
    }

    const paymentMethod = req.body.payment_method || "cash";
    if (!["cash", "pos"].includes(paymentMethod)) {
      return res
        .status(400)
        .json({ message: "Payment method must be cash or pos." });
    }

    const items = Array.isArray(submission.data?.items)
      ? submission.data.items
      : [];
    if (!items.length) {
      return res
        .status(400)
        .json({ message: "This walk-in request has no items." });
    }

    const transactionItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = await ProductModel.getById(item.product_id);
      if (!product || product.status !== "active") {
        return res.status(400).json({
          message: `Product ID ${item.product_id} is no longer available.`,
        });
      }
      if (isExpired(product.expiry_date))
        return res.status(400).json({ message: `Product "${product.name}" has expired and cannot be sold.` });
      if (Number(product.stock) < Number(item.quantity)) {
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });
      }

      const subtotal = (Math.round(Number(product.price) * 100) * Number(item.quantity)) / 100;
      totalAmount += subtotal;
      transactionItems.push({
        product_id: product.id,
        quantity: Number(item.quantity),
        unit_price: Number(product.price),
        subtotal,
      });
    }

    totalAmount = Math.round(totalAmount * 100) / 100;
    const tenderedAmount = Number(req.body.tendered_amount);
    if (!Number.isFinite(tenderedAmount) || tenderedAmount < totalAmount) {
      return res.status(400).json({
        message: `Payment must be at least ${totalAmount.toFixed(2)}.`,
      });
    }

    const receipt = receiptNumber();
    const transactionId = await TransactionModel.create({
      receipt_number: receipt,
      user_id: submission.submitted_by,
      staff_id: req.user.id,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      tendered_amount: tenderedAmount,
      change_amount: Math.round((tenderedAmount - totalAmount) * 100) / 100,
      items: transactionItems,
      submission_id: req.params.id,
    });

    // Notify the client in real-time that their order has been completed
    sendToUser(submission.submitted_by, "order_status_update", {
      submissionId: Number(req.params.id),
      status: "approved",
      receipt_number: receipt,
      total_amount: totalAmount,
      message: "Your order has been completed! Please check your purchase history.",
    });

    res.status(201).json({
      message: "Walk-in sale completed successfully.",
      transactionId,
      receipt_number: receipt,
      total_amount: totalAmount,
      change: Math.round((tenderedAmount - totalAmount) * 100) / 100,
    });
  } catch (error) {
    console.error("Complete walk-in request error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

controller.getMyWalkInRequests = async (req, res) => {
  try {
    const requests = await SubmissionModel.getClientWalkInRequests(req.user.id);
    res.json(requests);
  } catch (error) {
    console.error("Get my walk-in requests error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

controller.cancelWalkInRequest = async (req, res) => {
  try {
    const submission = await SubmissionModel.getById(req.params.id);
    if (!submission || submission.type !== "walk_in_order") {
      return res
        .status(404)
        .json({ message: "Walk-in order request not found." });
    }

    const isClient = req.user.role === "client";
    if (isClient && Number(submission.submitted_by) !== Number(req.user.id)) {
      return res
        .status(403)
        .json({ message: "You are not allowed to cancel this order." });
    }

    if (submission.status !== "pending") {
      return res
        .status(409)
        .json({ message: "This order can no longer be cancelled." });
    }

    const cancellationMessage = isClient
      ? "Cancelled by client."
      : "Cancelled by staff.";

    const cancelled = await SubmissionModel.cancelPendingWalkIn(req.params.id, cancellationMessage);
    if (!cancelled) return res.status(409).json({ message: "This order can no longer be cancelled." });

    // Notify the client in real-time that their order has been cancelled
    sendToUser(submission.submitted_by, "order_status_update", {
      submissionId: Number(req.params.id),
      status: "cancelled",
      message: isClient
        ? "Your order has been cancelled."
        : "Your order was cancelled by staff.",
    });

    res.json({ message: "Order cancelled successfully." });
  } catch (error) {
    console.error("Cancel walk-in request error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

controller.createStaffWalkInRequest = async (req, res) => {
  try {
    const client = await UserModel.findById(req.body.user_id);
    if (!client || client.role !== "client" || client.status !== "active") {
      return res
        .status(400)
        .json({ message: "Select an active registered client." });
    }

    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) {
      return res
        .status(400)
        .json({ message: "Add at least one product to the order." });
    }

    const itemMap = new Map();
    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);
      if (
        !Number.isInteger(productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return res
          .status(400)
          .json({ message: "Each product must have a valid quantity." });
      }
      itemMap.set(productId, (itemMap.get(productId) || 0) + quantity);
    }

    const requestItems = [];
    for (const [productId, quantity] of itemMap) {
      const product = await ProductModel.getById(productId);
      if (!product)
        return res
          .status(404)
          .json({ message: `Product ID ${productId} not found.` });
      if (product.status !== "active")
        return res
          .status(400)
          .json({ message: `Product "${product.name}" is not available.` });
      if (isExpired(product.expiry_date))
        return res.status(400).json({ message: `Product "${product.name}" has expired and cannot be sold.` });
      if (Number(product.stock) < quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });
      }
      requestItems.push({
        product_id: product.id,
        quantity,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
      });
    }

    const submissionId = await SubmissionModel.create({
      type: "walk_in_order",
      data: { items: requestItems, guided_by_staff: req.user.id },
      submitted_by: client.id,
    });

    res
      .status(201)
      .json({ message: "Pending order created for the client.", submissionId });
  } catch (error) {
    console.error("Create staff walk-in request error:", error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Server error." });
  }
};

module.exports = controller;
