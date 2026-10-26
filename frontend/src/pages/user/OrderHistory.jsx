import React, { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  InputAdornment,
  Stack,
} from "@mui/material";
import {
  Receipt,
  PointOfSale,
  LocalPrintshop,
  Search,
  CheckCircle,
  Cancel,
  StorefrontRounded,
} from "@mui/icons-material";
import { getMyTransactions, getTransactionDetail } from "../../api/sales";
import { colors } from "../../theme";
import { useOrderStatusSSE } from "../../hooks/useOrderStatusSSE";

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ severity: "", message: "" });
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reorderingOrderId, setReorderingOrderId] = useState(null);
  // Real-time notification state (from SSE)
  const [liveNotification, setLiveNotification] = useState(null);

  // Refresh orders list from the server (called after SSE update)
  const refreshRequests = useCallback(async () => {
    try {
      const res = await getMyTransactions();
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Silent refresh failure — existing data remains
    }
  }, []);

  // Handle incoming real-time order status update
  const handleOrderStatusUpdate = useCallback((data) => {
    setLiveNotification({
      status: data.status,
      message: data.message,
      receipt_number: data.receipt_number,
      total_amount: data.total_amount,
      cashier_name: data.cashier_name,
      completed_at: data.completed_at,
      submissionId: data.submissionId,
      ts: Date.now(),
    });
    refreshRequests();
  }, [refreshRequests]);

  // Subscribe to SSE
  useOrderStatusSSE({ onUpdate: handleOrderStatusUpdate });

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await getMyTransactions();
        setOrders(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
        setNotice({
          severity: "error",
          message: error.response?.data?.message || "Failed to load receipts.",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const handleView = async (id) => {
    try {
      const response = await getTransactionDetail(id);
      setSelectedOrder(response.data);
      setViewDialog(true);
    } catch (error) {
      console.error("Failed to fetch order details:", error);
    }
  };

  const formatPrice = (price) => `₱${parseFloat(price).toFixed(2)}`;
  const getChangeAmount = (transaction) => transaction.change_amount ?? Math.max(
    0,
    Number(transaction.tendered_amount) - Number(transaction.total_amount),
  );

  const filteredOrders = orders.filter((order) => {
    const query = searchTerm.trim().toLowerCase();
    const orderDate = order.created_at && Number.isFinite(Date.parse(order.created_at))
      ? new Date(order.created_at).toISOString().slice(0, 10)
      : "";
    const searchableText = [
      order.receipt_number,
      order.product_summary,
      ...(Array.isArray(order.items)
        ? order.items.map((item) => item.product_name)
        : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!query || searchableText.includes(query)) &&
      (paymentFilter === "all" || order.payment_method === paymentFilter) &&
      (!startDate || (orderDate && orderDate >= startDate)) &&
      (!endDate || (orderDate && orderDate <= endDate))
    );
  });


  const renderReceiptHtml = (t) => {
    if (!t) return "";

    const items = Array.isArray(t.items) ? t.items : [];
    const customerName = t.user_name || t.customer_name || "Walk-in Customer";
    const staffName = t.staff_name || "Staff User";
    const cashRows = t.tendered_amount == null
      ? ""
      : `
        <div class="info-row"><div class="label">Cash Received</div><div class="value">${formatPrice(t.tendered_amount)}</div></div>
        <div class="info-row"><div class="label">Change</div><div class="value">${formatPrice(getChangeAmount(t))}</div></div>
      `;
    const receiptDate = t.created_at
      ? new Date(t.created_at).toLocaleString("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "—";

    const itemRows = items
      .map((item) => {
        const name = item.product_name || "Item";
        const qty = Number(item.quantity || 0);
        const subtotal = Number(item.subtotal ?? item.unit_price ?? 0);
        return `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom: 12px;">
            <div style="flex:1; min-width:0;">
              <div style="font-size: 12.5px; font-weight: 750; color: #183D32;">${name}</div>
              <div style="font-size: 10.5px; color: #839B8C; margin-top: 2px;">Qty: ${qty}</div>
            </div>
            <div style="font-size: 12.5px; font-weight: 750; color: #365C4B; white-space: nowrap;">${formatPrice(subtotal)}</div>
          </div>
        `;
      })
      .join("");

    return `
      <html>
        <head>
          <title>Receipt ${t.receipt_number || ""}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: "Plus Jakarta Sans", Arial, sans-serif;
              background: #F7F5EC;
              color: #111827;
              margin: 0;
              padding: 24px;
            }
            .receipt {
              width: 100%;
              max-width: 430px;
              margin: 0 auto;
              background: #fff;
              border: 1px solid #D5E5D9;
              border-radius: 16px;
              padding: 24px;
            }
            .icon-wrap {
              display: flex; justify-content: center; margin: 4px 0 10px;
            }
            .icon-box {
              width: 54px; height: 54px; border-radius: 12px; background: #D8F3E5; display: flex; align-items: center; justify-content: center; color: #059669; font-size: 28px;
            }
            .brand { text-align: center; font-size: 21px; font-weight: 900; color: #183D32; margin-top: 8px; }
            .subtitle { text-align: center; font-size: 10.5px; color: #617B6C; margin-top: 2px; }
            .receipt-no {
              display: inline-block; background: #F7F5EC; border-radius: 6px; padding: 4px 10px; font-family: monospace; font-size: 12px; font-weight: 750; color: #365C4B; margin-top: 12px;
            }
            .divider { border-top: 1px solid #D5E5D9; margin: 16px 0; }
            .info-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
            .label { font-size: 11.5px; color: #839B8C; }
            .value { max-width: 65%; font-size: 11.5px; font-weight: 700; color: #365C4B; text-align: right; }
            .section-label { font-size: 10px; font-weight: 850; letter-spacing: .08em; color: #617B6C; margin-bottom: 12px; text-transform: uppercase; }
            .items { margin-top: 4px; }
            .total-row { display: flex; justify-content: space-between; align-items: center; }
            .total-label { font-size: 14px; font-weight: 800; color: #365C4B; }
            .total-value { font-size: 24px; font-weight: 900; color: #047857; }
            .footer { color: #617B6C; font-size: 11px; font-weight: 700; text-align: center; }
            .footer-note { color: #cbd5e1; font-size: 9.5px; margin-top: 4px; }
            @media print {
              body { background: #fff; padding: 0; }
              .receipt { border: none; border-radius: 0; max-width: 100%; padding: 16px; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="icon-wrap" style="margin-bottom: 12px;">
              <div class="icon-box">🏪</div>
            </div>
            <div class="brand">StoreHub</div>
            <div class="subtitle">Convenience Store</div>
            <div class="icon-wrap"><div class="receipt-no">${t.receipt_number || `#${t.id}`}</div></div>

            <div class="divider"></div>

            <div class="info-row"><div class="label">Date</div><div class="value">${receiptDate}</div></div>
            <div class="info-row"><div class="label">Cashier</div><div class="value">${staffName}</div></div>
            <div class="info-row"><div class="label">Customer</div><div class="value">${customerName}</div></div>
            <div class="info-row"><div class="label">Payment</div><div class="value">${t.payment_method || "Cash"}</div></div>

            <div class="divider"></div>

            <div class="section-label">Items</div>
            <div class="items">${itemRows || "<div style='color:#617B6C;'>No items found.</div>"}</div>

            <div class="divider"></div>

            <div class="total-row">
              <div class="total-label">TOTAL</div>
              <div class="total-value">${formatPrice(t.total_amount)}</div>
            </div>
            ${cashRows}
            <div class="divider"></div>
            <div class="footer">
              <div>Thank you for shopping with StoreHub!</div>
              <div class="footer-note">Please keep this receipt for your records.</div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const t = selectedOrder;
    if (!t) return;

    const win = window.open("", "_blank", "width=500,height=760");
    if (!win) return;

    win.document.write(renderReceiptHtml(t));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          py: 12,
        }}
      >
        <CircularProgress size={48} sx={{ color: colors.primary }} />
      </Box>
    );
  }

  return (
    <Box className="page-container">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" className="page-title" sx={{ mb: 1 }}>
          Payment & Billing Receipts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View your completed purchase receipts and payment records.
        </Typography>
      </Box>

      {notice.message && (
        <Alert
          severity={notice.severity}
          onClose={() => setNotice({ severity: "", message: "" })}
          sx={{ mb: 2 }}
        >
          {notice.message}
        </Alert>
      )}

      {/* ── Real-time live notification banner ── */}
      {liveNotification && (
        <Alert
          key={liveNotification.ts}
          severity={["approved", "completed"].includes(liveNotification.status) ? "success" : "warning"}
          icon={
            ["approved", "completed"].includes(liveNotification.status)
              ? <CheckCircle fontSize="inherit" />
              : <Cancel fontSize="inherit" />
          }
          onClose={() => setLiveNotification(null)}
          sx={{
            mb: 2,
            borderRadius: 2,
            fontWeight: 600,
            animation: "fadeInSlide 0.35s ease",
            "@keyframes fadeInSlide": {
              from: { opacity: 0, transform: "translateY(-8px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          <strong>
            {["approved", "completed"].includes(liveNotification.status) ? "✅ Purchase Completed!" : "❌ Order Cancelled"}
          </strong>
          {" "}{liveNotification.message}
          {liveNotification.receipt_number && (
            <span style={{ marginLeft: 8, opacity: 0.75, fontSize: "0.85em" }}>
              · Receipt: {liveNotification.receipt_number}
            </span>
          )}
          {liveNotification.total_amount && (
            <span style={{ marginLeft: 8, opacity: 0.75, fontSize: "0.85em" }}>
              · Total: ₱{parseFloat(liveNotification.total_amount).toFixed(2)}
            </span>
          )}
          {liveNotification.cashier_name && (
            <span style={{ marginLeft: 8, opacity: 0.75, fontSize: "0.85em" }}>
              · Cashier: {liveNotification.cashier_name}
            </span>
          )}
          {liveNotification.completed_at && (
            <span style={{ marginLeft: 8, opacity: 0.75, fontSize: "0.85em" }}>
              · {new Date(liveNotification.completed_at).toLocaleString("en-PH")}
            </span>
          )}
        </Alert>
      )}


      <Paper
        sx={{
          mb: 3,
          borderRadius: 3,
          border: "1px solid #D5E5D9",
          bgcolor: "var(--sh-page-tint)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 1.75,
            borderBottom: "1px solid #D5E5D9",
            bgcolor: "var(--sh-page-tint)",
          }}
        >
          <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#183D32" }}>
            Completed Orders
          </Typography>
          <Typography variant="body2" sx={{ color: "#617B6C", mt: 0.3 }}>
            Showing {filteredOrders.length} of {orders.length} completed purchase
            {orders.length === 1 ? "" : "s"} with receipt details
          </Typography>
        </Box>

        {orders.length === 0 ? (
          <Paper
            sx={{
              p: 6,
              textAlign: "center",
              borderRadius: 0,
              background:
                "linear-gradient(135deg, rgba(0,168,150,0.04) 0%, rgba(252,163,17,0.04) 100%)",
              border: "none",
            }}
          >
            <Box
              sx={{
                bgcolor: "rgba(0,168,150,0.1)",
                borderRadius: 3,
                p: 2,
                display: "inline-flex",
                mb: 2,
                color: colors.primary,
              }}
            >
              <Receipt sx={{ fontSize: 48 }} />
            </Box>
            <Typography variant="h6" fontWeight={600} color="text.secondary">
              No receipts yet.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Visit our store to make a purchase! Your payment receipts
              will appear here.
            </Typography>
          </Paper>
        ) : (
          <>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 1.5,
                p: 2,
                borderBottom: "1px solid #D5E5D9",
              }}
            >
              <TextField
                size="small"
                label="Search receipt or product"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                select
                size="small"
                label="Payment method"
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
              >
                <MenuItem value="all">All payments</MenuItem>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="pos">POS</MenuItem>
              </TextField>
              <TextField
                size="small"
                type="date"
                label="From date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                size="small"
                type="date"
                label="To date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <TableContainer
              component={Paper}
              sx={{ boxShadow: "none", borderRadius: 0 }}
            >
              <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Receipt #</TableCell>
                  <TableCell>Products</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell>Cashier</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                      <Typography color="text.secondary">
                        No purchases match these filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box
                          sx={{
                            bgcolor: "rgba(252,163,17,0.1)",
                            borderRadius: 1.5,
                            p: 0.5,
                            display: "flex",
                            color: colors.secondary,
                          }}
                        >
                          <PointOfSale fontSize="small" />
                        </Box>
                        <Typography variant="body2" fontWeight={600}>
                          {order.receipt_number}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#4C695A",
                          lineHeight: 1.6,
                          wordBreak: "break-word",
                        }}
                      >
                        {order.product_summary ||
                          "No product details available"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ color: colors.primary }}
                      >
                        {formatPrice(order.total_amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.payment_method}
                        size="small"
                        color={
                          order.payment_method === "cash"
                            ? "success"
                            : "primary"
                        }
                        sx={{ fontWeight: 600, textTransform: "capitalize" }}
                      />
                    </TableCell>
                    <TableCell>{order.staff_name || "Not recorded"}</TableCell>
                    <TableCell>
                      <Chip
                        label="Completed"
                        size="small"
                        color="success"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(order.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => handleView(order.id)}
                        startIcon={<Receipt />}
                      >
                        View Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>


      <Dialog
        open={viewDialog}
        onClose={() => setViewDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Receipt Details</DialogTitle>
        <DialogContent sx={{ p: "28px !important", bgcolor: "var(--sh-page-tint)" }}>
          {selectedOrder && (
            <Paper
              elevation={0}
              sx={{
                maxWidth: 430,
                mx: "auto",
                p: { xs: 2.5, sm: 3.5 },
                bgcolor: "var(--sh-glass-bg)",
                border: "1px solid #D5E5D9",
                borderRadius: 4,
              }}
            >
              <Box sx={{ textAlign: "center", mb: 3 }}>
                <Box
                  sx={{
                    width: 54,
                    height: 54,
                    mx: "auto",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "#D8F3E5",
                    borderRadius: 3,
                  }}
                >
                  <StorefrontRounded sx={{ color: "#059669", fontSize: 31 }} />
                </Box>
                <Typography sx={{ mt: 1, color: "#183D32", fontSize: 21, fontWeight: 900, letterSpacing: "-.03em" }}>
                  StoreHub
                </Typography>
                <Typography sx={{ mt: 0.2, color: "#617B6C", fontSize: 10.5 }}>
                  Convenience Store
                </Typography>
                <Chip
                  size="small"
                  label={selectedOrder.receipt_number || `#${selectedOrder.id}`}
                  sx={{ mt: 1.5, bgcolor: "var(--sh-page-tint)", fontFamily: "monospace", fontWeight: 750 }}
                />
              </Box>

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: "grid", gap: 1.2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography sx={{ color: "#839B8C", fontSize: 11.5 }}>Date</Typography>
                  <Typography sx={{ maxWidth: "65%", color: "#365C4B", fontSize: 11.5, fontWeight: 700, textAlign: "right" }}>
                    {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    }) : "—"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography sx={{ color: "#839B8C", fontSize: 11.5 }}>Cashier</Typography>
                  <Typography sx={{ maxWidth: "65%", color: "#365C4B", fontSize: 11.5, fontWeight: 700, textAlign: "right" }}>
                    {selectedOrder.staff_name || "Staff"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography sx={{ color: "#839B8C", fontSize: 11.5 }}>Customer</Typography>
                  <Typography sx={{ maxWidth: "65%", color: "#365C4B", fontSize: 11.5, fontWeight: 700, textAlign: "right" }}>
                    {selectedOrder.user_name || "Walk-in Customer"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography sx={{ color: "#839B8C", fontSize: 11.5 }}>Payment</Typography>
                  <Typography sx={{ maxWidth: "65%", color: "#365C4B", fontSize: 11.5, fontWeight: 700, textAlign: "right" }}>
                    {selectedOrder.payment_method || "Cash"}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2.3 }} />

              <Typography sx={{ mb: 1.5, color: "#617B6C", fontSize: 10, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".08em" }}>
                Items
              </Typography>

              <Box sx={{ display: "grid", gap: 1.5 }}>
                {selectedOrder.items?.map((item, idx) => (
                  <Box key={item.id || idx} sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
                    <Box>
                      <Typography sx={{ color: "#183D32", fontSize: 12.5, fontWeight: 750 }}>
                        {item.product_name}
                      </Typography>
                      <Typography sx={{ mt: 0.2, color: "#839B8C", fontSize: 10.5 }}>
                        Qty: {item.quantity}
                      </Typography>
                    </Box>
                    <Typography sx={{ color: "#365C4B", fontSize: 12.5, fontWeight: 750 }}>
                      {formatPrice(item.subtotal)}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 2.5 }} />

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ color: "#365C4B", fontSize: 14, fontWeight: 800 }}>TOTAL</Typography>
                <Typography sx={{ color: "#047857", fontSize: 24, fontWeight: 900 }}>
                  {formatPrice(selectedOrder.total_amount)}
                </Typography>
              </Box>
              {selectedOrder.tendered_amount != null && (
                <Box sx={{ display: "grid", gap: 0.8, mt: 1.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                    <Typography sx={{ color: "#617B6C", fontSize: 12 }}>Cash Received</Typography>
                    <Typography sx={{ color: "#365C4B", fontSize: 12, fontWeight: 750 }}>
                      {formatPrice(selectedOrder.tendered_amount)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                    <Typography sx={{ color: "#617B6C", fontSize: 12 }}>Change</Typography>
                    <Typography sx={{ color: "#047857", fontSize: 12, fontWeight: 850 }}>
                      {formatPrice(getChangeAmount(selectedOrder))}
                    </Typography>
                  </Box>
                </Box>
              )}
              <Divider sx={{ my: 2.5 }} />
              <Box sx={{ textAlign: "center" }}>
                <Typography sx={{ color: "#617B6C", fontSize: 11, fontWeight: 700 }}>
                  Thank you for shopping with StoreHub!
                </Typography>
                <Typography sx={{ mt: 0.5, color: "#CBD5E1", fontSize: 9.5 }}>
                  Please keep this receipt for your records.
                </Typography>
              </Box>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<LocalPrintshop />}
            onClick={handlePrint}
            disabled={!selectedOrder}
          >
            Print
          </Button>
          <Button onClick={() => setViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrderHistory;
