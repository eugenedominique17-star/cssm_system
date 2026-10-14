import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardMedia,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddShoppingCartRounded,
  ImageNotSupportedRounded,
  RemoveRounded,
  SearchRounded,
  ShoppingCartOutlined,
} from "@mui/icons-material";
import API from "../../api/axios";

const formatPrice = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function OrderManagement() {
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedClient, setSelectedClient] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const checkoutRequest = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productResponse, clientResponse] = await Promise.all([
        API.get("/products?active=true"),
        API.get("/users?role=client"),
      ]);
      setProducts(Array.isArray(productResponse.data) ? productResponse.data : []);
      setClients(Array.isArray(clientResponse.data) ? clientResponse.data : []);
    } catch (requestError) {
      console.error("Failed to load staff order data:", requestError);
      setError(
        requestError?.response?.data?.message ||
          "Unable to load products and client accounts. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const matchesSearch =
        !query ||
        [product.name, product.category, product.barcode]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [category, products, search]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => {
          const product = products.find((item) => String(item.id) === id);
          return product ? { product, quantity } : null;
        })
        .filter(Boolean),
    [cart, products],
  );
  const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const total = cartItems.reduce(
    (amount, item) => amount + Number(item.product.price || 0) * item.quantity,
    0,
  );

  const addToCart = (product) => {
    const stock = Number(product.stock ?? product.stock_quantity ?? 0);
    if (stock <= 0) return;
    setError("");
    setSuccess("");
    setCart((current) => {
      const currentQuantity = current[String(product.id)] || 0;
      if (currentQuantity >= stock) {
        setError(`Only ${stock} ${product.name} available in stock.`);
        return current;
      }
      return { ...current, [String(product.id)]: currentQuantity + 1 };
    });
  };

  const changeQuantity = (product, amount) => {
    const id = String(product.id);
    const stock = Number(product.stock ?? product.stock_quantity ?? 0);
    setCart((current) => {
      const nextQuantity = (current[id] || 0) + amount;
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: Math.min(nextQuantity, stock) };
    });
    setSuccess("");
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!cartItems.length) {
      setError("Add at least one product to the cart.");
      return;
    }
    if (!selectedClient) {
      setError("Choose an active client account before checking out.");
      return;
    }
    if (
      paymentMethod === "cash" &&
      (!Number.isFinite(Number(tenderedAmount)) || Number(tenderedAmount) < total)
    ) {
      setError(`Cash received must be at least ${formatPrice(total)}.`);
      return;
    }

    const payload = {
      user_id: Number(selectedClient),
      payment_method: paymentMethod,
      ...(paymentMethod === "cash" ? { tendered_amount: Number(tenderedAmount) } : {}),
      items: cartItems.map(({ product, quantity }) => ({
        product_id: Number(product.id),
        quantity,
      })),
    };
    const signature = JSON.stringify(payload);
    if (!checkoutRequest.current || checkoutRequest.current.signature !== signature) {
      checkoutRequest.current = { signature, id: crypto.randomUUID() };
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await API.post("/transactions", {
        ...payload,
        request_id: checkoutRequest.current.id,
      });
      const receiptNumber = response.data?.receipt_number;
      setSuccess(
        receiptNumber
          ? `Order completed. Receipt ${receiptNumber}.`
          : "Order completed successfully.",
      );
      checkoutRequest.current = null;
      setCart({});
      setTenderedAmount("");
      setSelectedClient("");
      await fetchData();
    } catch (requestError) {
      console.error("Failed to submit staff order:", requestError);
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Unable to complete this order. Check the details and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1500, mx: "auto", width: "100%" }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="#173F3A">
            Create an order
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Browse products, add them to the cart, then check out.
          </Typography>
        </Box>

        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}

        <Grid container spacing={2.5} alignItems="flex-start">
          <Grid item xs={12} lg={8}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  fullWidth
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products"
                  inputProps={{ "aria-label": "Search products" }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRounded />
                      </InputAdornment>
                    ),
                  }}
                />
                <FormControl sx={{ minWidth: { sm: 190 } }}>
                  <InputLabel id="order-category-label">Category</InputLabel>
                  <Select
                    labelId="order-category-label"
                    value={category}
                    label="Category"
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <MenuItem value="all">All categories</MenuItem>
                    {categories.map((value) => (
                      <MenuItem key={value} value={value}>{value}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              {loading ? (
                <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
                  <CircularProgress />
                </Box>
              ) : filteredProducts.length ? (
                <Grid container spacing={2}>
                  {filteredProducts.map((product) => {
                    const stock = Number(product.stock ?? product.stock_quantity ?? 0);
                    const quantityInCart = cart[String(product.id)] || 0;
                    const image = product.image_url || product.image;
                    return (
                      <Grid item xs={6} sm={4} key={product.id}>
                        <Card
                          variant="outlined"
                          sx={{
                            height: "100%",
                            borderRadius: 3,
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            borderColor: "#DCEBE7",
                          }}
                        >
                          <Box
                            sx={{
                              height: { xs: 145, sm: 185 },
                              bgcolor: "#F3F9F7",
                              display: "grid",
                              placeItems: "center",
                              overflow: "hidden",
                            }}
                          >
                            {image ? (
                              <CardMedia
                                component="img"
                                image={image}
                                alt={product.name}
                                sx={{ width: "100%", height: "100%", objectFit: "contain", p: 1.5 }}
                              />
                            ) : (
                              <Stack alignItems="center" spacing={0.5} color="text.secondary">
                                <ImageNotSupportedRounded />
                                <Typography variant="caption">No product photo</Typography>
                              </Stack>
                            )}
                          </Box>
                          <Stack spacing={1} sx={{ p: 1.5, flex: 1 }}>
                            <Box sx={{ minHeight: 54 }}>
                              <Typography fontWeight={700} lineHeight={1.25}>{product.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {product.category || "Uncategorized"}
                              </Typography>
                            </Box>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography fontWeight={800} color="#066649">
                                {formatPrice(product.price)}
                              </Typography>
                              <Chip
                                size="small"
                                label={stock > 0 ? `${stock} in stock` : "Out of stock"}
                                color={stock > 0 ? "success" : "default"}
                                variant="outlined"
                              />
                            </Stack>
                            <Button
                              fullWidth
                              variant="contained"
                              startIcon={<AddShoppingCartRounded />}
                              disabled={stock <= 0 || quantityInCart >= stock}
                              onClick={() => addToCart(product)}
                              sx={{ mt: "auto", bgcolor: "#066649", textTransform: "none", fontWeight: 700 }}
                            >
                              {quantityInCart ? `Add more (${quantityInCart})` : "Add to cart"}
                            </Button>
                          </Stack>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              ) : (
                <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
                  <Typography color="text.secondary">
                    {products.length ? "No products match your search." : "No active products are available."}
                  </Typography>
                </Paper>
              )}
            </Stack>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper
              variant="outlined"
              sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, position: { lg: "sticky" }, top: 20 }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ShoppingCartOutlined color="success" />
                  <Typography variant="h6" fontWeight={800}>Cart</Typography>
                  <Chip size="small" label={itemCount} sx={{ ml: "auto" }} />
                </Stack>
                <Divider />

                {cartItems.length ? (
                  <Stack spacing={1.5}>
                    {cartItems.map(({ product, quantity }) => (
                      <Stack key={product.id} direction="row" spacing={1.5} alignItems="center">
                        <Box
                          component="img"
                          src={product.image_url || product.image || ""}
                          alt=""
                          sx={{
                            width: 54,
                            height: 54,
                            borderRadius: 1.5,
                            objectFit: "contain",
                            bgcolor: "#F3F9F7",
                            display: product.image_url || product.image ? "block" : "none",
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700} noWrap>{product.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatPrice(product.price)} each
                          </Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                            <IconButton
                              size="small"
                              aria-label={`Remove one ${product.name}`}
                              onClick={() => changeQuantity(product, -1)}
                            >
                              <RemoveRounded fontSize="small" />
                            </IconButton>
                            <Typography variant="body2" fontWeight={700}>{quantity}</Typography>
                            <IconButton
                              size="small"
                              aria-label={`Add one ${product.name}`}
                              disabled={quantity >= Number(product.stock ?? product.stock_quantity ?? 0)}
                              onClick={() => changeQuantity(product, 1)}
                            >
                              <AddShoppingCartRounded fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Box>
                        <Typography fontWeight={700}>{formatPrice(Number(product.price) * quantity)}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <Stack alignItems="center" spacing={1} sx={{ py: 2.5 }} color="text.secondary">
                    <ShoppingCartOutlined />
                    <Typography variant="body2">Your cart is empty. Add products to get started.</Typography>
                  </Stack>
                )}

                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Total</Typography>
                  <Typography variant="h6" fontWeight={800}>{formatPrice(total)}</Typography>
                </Stack>

                <Box component="form" onSubmit={submitOrder}>
                  <Stack spacing={1.5}>
                    <FormControl fullWidth required>
                      <InputLabel id="order-client-label">Client</InputLabel>
                      <Select
                        labelId="order-client-label"
                        value={selectedClient}
                        label="Client"
                        onChange={(event) => setSelectedClient(event.target.value)}
                      >
                        {clients
                          .filter((client) => !client.status || client.status === "active")
                          .map((client) => (
                            <MenuItem key={client.id} value={client.id}>
                              {client.full_name || client.name || client.email}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth>
                      <InputLabel id="order-payment-label">Payment</InputLabel>
                      <Select
                        labelId="order-payment-label"
                        value={paymentMethod}
                        label="Payment"
                        onChange={(event) => setPaymentMethod(event.target.value)}
                      >
                        <MenuItem value="cash">Cash</MenuItem>
                        <MenuItem value="pos">POS / card</MenuItem>
                      </Select>
                    </FormControl>
                    {paymentMethod === "cash" && (
                      <TextField
                        fullWidth
                        required
                        type="number"
                        label="Cash received"
                        value={tenderedAmount}
                        onChange={(event) => setTenderedAmount(event.target.value)}
                        inputProps={{ min: total, step: "0.01" }}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                        }}
                      />
                    )}
                    <Button
                      type="submit"
                      fullWidth
                      size="large"
                      variant="contained"
                      disabled={!cartItems.length || submitting}
                      sx={{ bgcolor: "#066649", textTransform: "none", fontWeight: 800, py: 1.25 }}
                    >
                      {submitting ? <CircularProgress size={24} color="inherit" /> : "Complete order"}
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
