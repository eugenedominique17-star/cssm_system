import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckCircleRounded,
  CancelRounded,
  AddRounded,
  CheckRounded,
  DeleteOutlineRounded,
  HourglassTopRounded,
  PointOfSaleRounded,
  RemoveRounded,
  RefreshRounded,
  SearchRounded,
  ShoppingCartRounded,
  ImageNotSupportedRounded,
} from "@mui/icons-material";
import API from "../../api/accountAdmin";
import { getCatalog } from "../../api/catalog";
import {
  cancelWalkInRequest,
  createSale,
  getPendingWalkInRequests,
  getTransactions,
} from "../../api/sales";

const statusConfig = {
  pending: { label: "Pending", color: "warning", icon: <HourglassTopRounded fontSize="small" /> },
  approved: { label: "Completed", color: "success", icon: <CheckCircleRounded fontSize="small" /> },
};

const OrderManagement = () => {
  const navigate = useNavigate();
  const [pendingOrders, setPendingOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [orderItems, setOrderItems] = useState([]);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [addedProductId, setAddedProductId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError("");
      const [pendingResponse, transactionsResponse, clientsResponse, productsResponse] = await Promise.all([
        getPendingWalkInRequests(),
        getTransactions(),
        API.get("/users?role=client"),
        getCatalog("products", { active: true }),
      ]);
      setPendingOrders(Array.isArray(pendingResponse.data) ? pendingResponse.data : []);
      setCompletedOrders(Array.isArray(transactionsResponse.data) ? transactionsResponse.data : []);
      setClients(Array.isArray(clientsResponse.data) ? clientsResponse.data.filter((client) => client.status === "active") : []);
      setProducts(Array.isArray(productsResponse.data) ? productsResponse.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load order management data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const refreshTimer = setInterval(() => loadOrders(true), 10000);
    return () => clearInterval(refreshTimer);
  }, [loadOrders]);

  const formatPrice = (price) => `₱${Number(price || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const query = search.trim().toLowerCase();
  const hasClientSearch = query.length > 0;
  const matchingClients = clients
    .filter((client) => !query || String(client.name || "").toLowerCase().includes(query))
    .sort((first, second) => String(first.name || "").localeCompare(String(second.name || "")));

  const visibleClients = hasClientSearch ? matchingClients : [];
  const selectedClient = clients.find((client) => String(client.id) === String(selectedClientId));
  const getClientIdentifier = (client) => client.user_id || client.email || `ID ${client.id}`;
  const total = orderItems.reduce((sum, item) => {
    const product = products.find((candidate) => String(candidate.id) === String(item.product_id));
    return sum + Number(product?.price || 0) * Number(item.quantity || 0);
  }, 0);

  const completedMatches = completedOrders.filter((order) => {
    if (!query) return false;
    const matchingIds = matchingClients.map((client) => String(client.id));
    return matchingIds.includes(String(order.user_id));
  });

  const removeProduct = (index) => setOrderItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const changeProduct = (index, field, value) => setOrderItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === "product_id" ? value : Math.max(1, Number(value) || 1) } : item));
  const addToOrder = (product) => {
    if (!selectedClientId || Number(product.stock) <= 0) return;
    setOrderItems((current) => {
      const existing = current.find((item) => String(item.product_id) === String(product.id));
      if (existing) {
        return current.map((item) => String(item.product_id) === String(product.id)
          ? { ...item, quantity: Math.min(Number(item.quantity) + 1, Number(product.stock)) }
          : item);
      }
      return [...current, { product_id: String(product.id), quantity: 1 }];
    });
    setAddedProductId(String(product.id));
    window.setTimeout(() => setAddedProductId((current) => current === String(product.id) ? null : current), 1100);
  };

  const cartQuantity = orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const getProductImage = (product) => product.image_url || product.image || "";

  const handleCancelOrder = async (orderId) => {
    try {
      setError("");
      setCancellingOrderId(orderId);
      await cancelWalkInRequest(orderId);
      await loadOrders(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to cancel this order.");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const submitGuidedOrder = async () => {
    if (!selectedClientId) return setError("Select a registered client first.");
    if (!orderItems.length || orderItems.some((item) => !item.product_id)) return setError("Add at least one product to the order.");
    const seen = new Set();
    for (const item of orderItems) {
      if (seen.has(String(item.product_id))) return setError("Use one row per product and adjust its quantity.");
      seen.add(String(item.product_id));
      const product = products.find((candidate) => String(candidate.id) === String(item.product_id));
      if (!product || Number(item.quantity) > Number(product.stock)) return setError(`Insufficient stock for ${product?.name || "the selected product"}.`);
    }
    setError("");
    setTenderedAmount("");
    setPaymentDialogOpen(true);
  };

  const confirmGuidedOrderPayment = async () => {
    const tendered = Number(tenderedAmount);
    if (!Number.isFinite(tendered) || tendered < total) {
      setError(`Payment must be at least ${formatPrice(total)}.`);
      return;
    }

    try {
      setCreatingOrder(true);
      setError("");
      await createSale({
        user_id: Number(selectedClientId),
        payment_method: "cash",
        tendered_amount: tendered,
        items: orderItems.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
        })),
      });
      setPaymentDialogOpen(false);
      setTenderedAmount("");
      setOrderItems([]);
      await loadOrders(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to process the walk-in order.");
    } finally {
      setCreatingOrder(false);
    }
  };

  const sections = useMemo(() => [
    { title: "Pending Orders", orders: pendingOrders, status: "pending" },
    { title: "Completed Orders", orders: completedMatches, status: "approved" },
  ].filter((section) => section.status !== "pending" || section.orders.length > 0), [pendingOrders, completedMatches]);

  if (loading) {
    return <Box sx={{ minHeight: 420, display: "grid", placeItems: "center" }}><CircularProgress sx={{ color: "#066649" }} /></Box>;
  }

  return (
    <Box className="page-container" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography sx={{ color: "#183D32", fontSize: { xs: "1.8rem", md: "2.2rem" }, fontWeight: 900, letterSpacing: "-.04em" }}>
            Order Management
          </Typography>
          <Typography sx={{ mt: 0.6, color: "#617B6C", fontSize: 14 }}>
            Find a registered client, guide the order, then collect payment to complete the sale.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={refreshing ? <CircularProgress size={18} /> : <RefreshRounded />} onClick={() => loadOrders(true)} disabled={refreshing} sx={{ alignSelf: { xs: "flex-start", md: "center" }, borderRadius: 2.5, textTransform: "none", fontWeight: 800 }}>
          Refresh Orders
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <Paper elevation={0} sx={{ p: 2, mb: 3, border: "1px solid #D5E5D9", borderRadius: 3 }}>
        <TextField fullWidth placeholder="Search registered client by name..." value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ color: "#617B6C" }} /></InputAdornment> }} />
      </Paper>

      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, mb: 3, border: "1px solid #D8F3E5", borderRadius: 3, bgcolor: "#EFF9F1" }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
          <Box><Typography sx={{ fontSize: 17, fontWeight: 900, color: "#134E4A" }}>1. Choose a registered client</Typography><Typography sx={{ mt: 0.4, color: "#066649", fontSize: 13 }}>Search by name, then guide the client through the product choices.</Typography></Box>
          {selectedClient && <Chip label={`Selected: ${selectedClient.name} · ${getClientIdentifier(selectedClient)}`} onDelete={() => { setSelectedClientId(""); setOrderItems([]); }} sx={{ alignSelf: { xs: "flex-start", md: "center" }, bgcolor: "var(--sh-glass-bg)", color: "#066649", fontWeight: 800 }} />}
        </Stack>
        {!hasClientSearch ? (
          <Typography sx={{ color: "#617B6C", fontSize: 13 }}>
            Type a client name to filter the registered clients.
          </Typography>
        ) : !visibleClients.length ? (
          <Typography sx={{ color: "#617B6C", fontSize: 13 }}>
            No registered client matches this name.
          </Typography>
        ) : (
          <Grid container spacing={1.2}>
            {visibleClients.map((client) => (
              <Grid item xs={12} sm={6} md={4} key={client.id}>
                <Button
                  fullWidth
                  variant={String(selectedClientId) === String(client.id) ? "contained" : "outlined"}
                  onClick={() => setSelectedClientId(String(client.id))}
                  sx={{ minHeight: 64, justifyContent: "flex-start", textAlign: "left", textTransform: "none", borderRadius: 2, fontWeight: 800, px: 1.5 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 850, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {client.name || "Unnamed client"}
                    </Typography>
                    <Typography sx={{ mt: 0.2, fontSize: 11, fontWeight: 700, opacity: 0.78, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {getClientIdentifier(client)}
                    </Typography>
                  </Box>
                </Button>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.7fr) minmax(300px, .8fr)" }, gap: 2.5, alignItems: "start", mb: 3 }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: "1px solid #D5E5D9", borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.8 }}><Box><Typography sx={{ fontSize: 17, fontWeight: 900 }}>2. Choose products</Typography><Typography sx={{ color: "#617B6C", fontSize: 13 }}>{selectedClient ? `Building an order for ${selectedClient.name}` : "Select a client first to start an order."}</Typography></Box><Chip label={`${cartQuantity} item${cartQuantity === 1 ? "" : "s"}`} icon={<ShoppingCartRounded />} size="small" sx={{ fontWeight: 800 }} /></Stack>
          {!products.length ? <Typography sx={{ py: 3, color: "#839B8C", textAlign: "center" }}>No active products available.</Typography> : <Grid container spacing={1.8}>{products.map((product) => { const image = getProductImage(product); const isAdded = addedProductId === String(product.id); const outOfStock = Number(product.stock) <= 0; return <Grid item xs={12} sm={6} md={4} key={product.id}><Card sx={{ height: "100%", border: "1px solid #D5E5D9", borderRadius: 2.5, overflow: "hidden", transition: "transform .2s ease, box-shadow .2s ease", "&:hover": { transform: "translateY(-3px)", boxShadow: "0 12px 24px rgba(24,61,50,.08)" } }}><Box sx={{ height: { xs: 150, sm: 135 }, bgcolor: "#EDF3E8", position: "relative", overflow: "hidden" }}>{image ? <Box component="img" src={image} alt={product.name} sx={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .35s ease", "&:hover": { transform: "scale(1.05)" } }} onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextSibling.style.display = "flex"; }} /> : null}<Stack sx={{ display: image ? "none" : "flex", position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", color: "#839B8C" }}><ImageNotSupportedRounded /><Typography sx={{ fontSize: 11 }}>No image</Typography></Stack><Chip label={outOfStock ? "Out of stock" : `${product.stock} in stock`} size="small" sx={{ position: "absolute", top: 8, left: 8, fontWeight: 800, bgcolor: "rgba(255,255,255,.9)", color: outOfStock ? "#B91C1C" : "#047857" }} /></Box><CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}><Typography sx={{ fontWeight: 850, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.name}</Typography><Typography sx={{ color: "#066649", fontWeight: 900, mt: .35 }}>{formatPrice(product.price)}</Typography><Button fullWidth size="small" variant={isAdded ? "contained" : "outlined"} startIcon={isAdded ? <CheckRounded /> : <AddRounded />} disabled={!selectedClient || outOfStock} onClick={() => addToOrder(product)} sx={{ mt: 1.2, textTransform: "none", fontWeight: 800, borderRadius: 1.8, ...(isAdded ? { bgcolor: "#066649" } : {}) }}>{isAdded ? "Added" : selectedClient ? "Add to order" : "Select client first"}</Button></CardContent></Card></Grid>; })}</Grid>}
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: "1px solid #D5E5D9", borderRadius: 3, position: { lg: "sticky" }, top: { lg: 20 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography sx={{ fontSize: 17, fontWeight: 900 }}>3. Review order</Typography><Typography sx={{ color: "#617B6C", fontSize: 13 }}>Process immediately when payment is received.</Typography></Box><ShoppingCartRounded sx={{ color: "#066649" }} /></Stack>
          {!orderItems.length ? <Typography sx={{ py: 4, color: "#839B8C", textAlign: "center", fontSize: 13 }}>Your guided order is empty.</Typography> : <Stack spacing={1.2} sx={{ mt: 2 }}>{orderItems.map((item, index) => { const product = products.find((candidate) => String(candidate.id) === String(item.product_id)); return <Box key={`${item.product_id}-${index}`} sx={{ p: 1.2, bgcolor: "var(--sh-page-tint)", borderRadius: 2 }}><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product?.name || "Product"}</Typography><Typography sx={{ color: "#617B6C", fontSize: 12 }}>{formatPrice(product?.price)} each</Typography></Box><IconButton size="small" onClick={() => changeProduct(index, "quantity", Number(item.quantity) - 1)} disabled={Number(item.quantity) <= 1}><RemoveRounded fontSize="small" /></IconButton><Typography sx={{ fontWeight: 800 }}>{item.quantity}</Typography><IconButton size="small" onClick={() => changeProduct(index, "quantity", Math.min(Number(item.quantity) + 1, Number(product?.stock || 1)))} disabled={!product || Number(item.quantity) >= Number(product.stock)}><AddRounded fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={() => removeProduct(index)} aria-label="Remove product"><DeleteOutlineRounded fontSize="small" /></IconButton></Stack><Typography sx={{ mt: .5, textAlign: "right", fontWeight: 850 }}>{formatPrice(Number(product?.price || 0) * Number(item.quantity || 0))}</Typography></Box>; })}</Stack>}
          <Divider sx={{ my: 2 }} /><Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}><Typography sx={{ fontWeight: 900 }}>Estimated total</Typography><Typography sx={{ color: "#066649", fontWeight: 900, fontSize: 18 }}>{formatPrice(total)}</Typography></Stack><Button fullWidth variant="contained" disabled={creatingOrder || !selectedClient || !orderItems.length} onClick={submitGuidedOrder} sx={{ bgcolor: "#066649", textTransform: "none", fontWeight: 800, py: 1.1 }}>{creatingOrder ? "Processing..." : "Collect Payment"}</Button>
        </Paper>
      </Box>

      <Dialog
        open={paymentDialogOpen}
        onClose={() => !creatingOrder && setPaymentDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, boxShadow: "0 18px 44px rgba(24,61,50, 0.14)" } }}
      >
        <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1, fontSize: "1.5rem", fontWeight: 900 }}>
          Collect Cash Payment
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1, overflowY: "auto" }}>
          <Typography sx={{ color: "#617B6C", fontSize: 14, mb: 1.5 }}>
            Enter the amount received before completing this client sale.
          </Typography>

          <Box
            sx={{
              maxHeight: 160,
              overflowY: "auto",
              borderTop: "1px solid #D5E5D9",
              borderBottom: "1px solid #D5E5D9",
              mb: 1.5,
            }}
          >
            {orderItems.map((item, index) => {
              const product = products.find(
                (candidate) => String(candidate.id) === String(item.product_id),
              );
              const quantity = Number(item.quantity || 0);
              const lineTotal = Number(product?.price || 0) * quantity;

              return (
                <Stack
                  key={`${item.product_id}-${index}`}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={2}
                  sx={{ py: 1, borderBottom: index < orderItems.length - 1 ? "1px solid #EDF3E8" : "none" }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: "#183D32", fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>
                      {product?.name || "Product"}
                    </Typography>
                    <Typography sx={{ color: "#617B6C", fontSize: 12 }}>
                      {quantity} × {formatPrice(product?.price)}
                    </Typography>
                  </Box>
                  <Typography sx={{ flexShrink: 0, color: "#365C4B", fontSize: 14, fontWeight: 700 }}>
                    {formatPrice(lineTotal)}
                  </Typography>
                </Stack>
              );
            })}
          </Box>

          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ color: "#111827", fontSize: 17, fontWeight: 900 }}>
                Total
              </Typography>
              <Typography sx={{ color: "#066649", fontSize: 19, fontWeight: 900 }}>
                {formatPrice(total)}
              </Typography>
            </Stack>

            <TextField
              autoFocus
              fullWidth
              type="number"
              label="Amount Tendered"
              value={tenderedAmount}
              onChange={(event) => setTenderedAmount(event.target.value)}
              variant="outlined"
              inputProps={{ min: 0, step: "0.01", style: { minWidth: 0, boxSizing: "border-box", fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: "#183D32", padding: "0 8px" } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ color: "#066649", fontSize: 20, fontWeight: 800, lineHeight: 1 }}>₱</Typography>
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: 0,
                "& .MuiOutlinedInput-root": {
                  display: "flex",
                  minWidth: 0,
                  width: "100%",
                  boxSizing: "border-box",
                  height: 54,
                  borderRadius: 2.5,
                  backgroundColor: "var(--sh-glass-bg)",
                  "& .MuiInputAdornment-root": { flexShrink: 0, marginRight: 0.5 },
                  "& .MuiOutlinedInput-input": { flex: 1, minWidth: 0, width: 0, height: "100%", boxSizing: "border-box" },
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#066649", borderWidth: 2 },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#0D665F" },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#066649", borderWidth: 2 },
                },
              }}
            />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ color: "#111827", fontSize: 17, fontWeight: 900 }}>
                Change
              </Typography>
              <Typography sx={{ color: "#B45309", fontSize: 19, fontWeight: 900 }}>
                {formatPrice(Math.max(0, Number(tenderedAmount || 0) - total))}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, justifyContent: "space-between" }}>
          <Button
            onClick={() => setPaymentDialogOpen(false)}
            disabled={creatingOrder}
            sx={{ color: "#066649", textTransform: "none", fontWeight: 700, px: 1.5 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmGuidedOrderPayment}
            disabled={creatingOrder || Number(tenderedAmount) < total}
            sx={{
              bgcolor: "#066649",
              textTransform: "none",
              fontWeight: 800,
              px: 2.5,
              boxShadow: "none",
              "&:hover": { bgcolor: "#0D665F", boxShadow: "none" },
              "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "rgba(17, 24, 39, 0.38)" },
            }}
          >
            {creatingOrder ? "Processing..." : "Confirm Payment"}
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={2.5}>
        {sections.map((section) => {
          const config = statusConfig[section.status];
          return (
            <Grid item xs={12} key={section.title}>
              <Paper elevation={0} sx={{ border: "1px solid #D5E5D9", borderRadius: 3, overflow: "hidden" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: { xs: 2, md: 2.5 }, pb: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center"><ShoppingCartRounded sx={{ color: "#066649" }} /><Typography sx={{ fontSize: 17, fontWeight: 900 }}>{section.title}</Typography></Stack>
                  <Chip label={section.orders.length} color={config.color} size="small" sx={{ fontWeight: 800 }} />
                </Stack>
                {section.orders.length === 0 ? (
                  <Typography sx={{ py: 2, color: "#839B8C", fontSize: 13 }}>{section.status === "approved" && !query ? "Search a registered client to view completed orders." : query ? "No matching orders." : "No orders in this section."}</Typography>
                ) : (
                  <Stack spacing={1} sx={{ px: { xs: 2, md: 2.5 }, pb: { xs: 2, md: 2.5 } }}>
                    {section.orders.map((order) => {
                      const items = Array.isArray(order.data?.items) ? order.data.items : [];
                      const customer = order.submitted_by_name || order.user_name || "Walk-in Customer";
                      return (
                        <Box key={`${section.status}-${order.id}`} sx={{ p: 1.6, border: "1px solid #EDF3E8", borderRadius: 2.5, bgcolor: "var(--sh-page-tint)" }}>
                          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                            <Box>
                              <Stack direction="row" spacing={1} alignItems="center"><Typography sx={{ fontWeight: 850 }}>#{order.id || order.receipt_number}</Typography><Chip icon={config.icon} label={config.label} color={config.color} size="small" sx={{ fontWeight: 750 }} /></Stack>
                              <Typography sx={{ mt: 0.5, color: "#365C4B", fontSize: 13, fontWeight: 700 }}>{customer}</Typography>
                              <Typography sx={{ mt: 0.3, color: "#617B6C", fontSize: 12 }}>{items.length ? items.map((item) => `${item.name || item.product_name || "Product"} x${item.quantity}`).join(", ") : `Receipt ${order.receipt_number || "—"}`}</Typography>
                            </Box>
                            <Stack direction={{ xs: "row", md: "column" }} spacing={1} alignItems={{ xs: "center", md: "flex-end" }}>
                              <Typography sx={{ color: "#617B6C", fontSize: 11 }}>{new Date(order.reviewed_at || order.created_at || Date.now()).toLocaleString("en-PH")}</Typography>
                              {section.status === "pending" && (
                                <Stack direction={{ xs: "row", md: "column" }} spacing={1} alignItems={{ xs: "center", md: "flex-end" }}>
                                  <Button size="small" variant="contained" startIcon={<PointOfSaleRounded />} onClick={() => navigate("/staff/receipts")} sx={{ bgcolor: "#066649", textTransform: "none", fontWeight: 800, borderRadius: 2 }}>Process in Receipts</Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    startIcon={<CancelRounded />}
                                    onClick={() => handleCancelOrder(order.id)}
                                    disabled={cancellingOrderId === order.id}
                                    sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}
                                  >
                                    {cancellingOrderId === order.id ? "Cancelling..." : "Cancel Order"}
                                  </Button>
                                </Stack>
                              )}
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default OrderManagement;
