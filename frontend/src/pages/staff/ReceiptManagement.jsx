import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  AddRounded,
  CloseRounded,
  DeleteOutlineRounded,
  LocalAtmRounded,
  PersonOutlineRounded,
  PointOfSaleRounded,
  PrintRounded,
  ReceiptLongRounded,
  RefreshRounded,
  RemoveRounded,
  SearchRounded,
  ShoppingCartOutlined,
  StorefrontRounded,
  VisibilityRounded,
  Inventory2Outlined,
  CheckCircleRounded,
  WarningAmberRounded,
} from "@mui/icons-material";

import API from "../../api/axios";

const INITIAL_FORM = {
  user_id: "",
  payment_method: "cash",
  items: [
    {
      product_id: "",
      quantity: 1,
    },
  ],
};

const ReceiptManagement = () => {
  const checkoutRequest = useRef(null);
  const checkoutBusy = useRef(false);
  const [transactions, setTransactions] = useState([]);
  const [walkInRequests, setWalkInRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [walkInRequestId, setWalkInRequestId] = useState(null);
  const [tenderedAmount, setTenderedAmount] = useState("");

  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [clientSearch, setClientSearch] = useState("");

  const [alert, setAlert] = useState({
    show: false,
    message: "",
    severity: "success",
  });

  const [formData, setFormData] = useState(INITIAL_FORM);

  const alertTimerRef = useRef(null);

  /* =========================================================
     ALERT
  ========================================================= */

  const showAlert = useCallback((message, severity = "success") => {
    setAlert({
      show: true,
      message,
      severity,
    });

    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
    }

    alertTimerRef.current = setTimeout(() => {
      setAlert({
        show: false,
        message: "",
        severity: "success",
      });
    }, 4500);
  }, []);

  /* =========================================================
     FETCH DATA
  ========================================================= */

  const fetchData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [transactionsResponse, productsResponse, usersResponse, walkInResponse] =
          await Promise.all([
            API.get("/transactions"),
            API.get("/products?active=true"),
            API.get("/users?role=client"),
            API.get("/transactions/walk-in-requests/pending"),
          ]);

        setTransactions(
          Array.isArray(transactionsResponse.data)
            ? transactionsResponse.data
            : [],
        );

        setProducts(
          Array.isArray(productsResponse.data) ? productsResponse.data : [],
        );

        setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
        setWalkInRequests(
          Array.isArray(walkInResponse.data) ? walkInResponse.data : [],
        );
      } catch (error) {
        console.error("Failed to load receipt data:", error);

        showAlert(
          error?.response?.data?.message ||
            "Unable to load receipt information.",
          "error",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showAlert],
  );

  useEffect(() => {
    fetchData();

    const refreshTimer = setInterval(() => fetchData(true), 10000);

    return () => {
      clearInterval(refreshTimer);
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    };
  }, [fetchData]);

  /* =========================================================
     FORMATTERS
  ========================================================= */

  const formatPrice = (price) =>
    `₱${Number(price || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  /* =========================================================
     HELPERS
  ========================================================= */

  const getProduct = (productId) =>
    products.find((product) => String(product.id) === String(productId));

  const getSelectedProductIds = () =>
    formData.items.map((item) => String(item.product_id)).filter(Boolean);

  const resetForm = () => {
    checkoutRequest.current = null;
    setWalkInRequestId(null);
    setTenderedAmount("");
    setFormData({
      user_id: "",
      payment_method: "cash",
      items: [
        {
          product_id: "",
          quantity: 1,
        },
      ],
    });
  };

  /* =========================================================
     CREATE DIALOG
  ========================================================= */

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openWalkInRequest = (request) => {
    const requestItems = Array.isArray(request.data?.items) ? request.data.items : [];
    setFormData({
      user_id: request.submitted_by || "",
      payment_method: "cash",
      items: requestItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    });
    setWalkInRequestId(request.id);
    setTenderedAmount("");
    setDialogOpen(true);
  };

  const closeCreateDialog = () => {
    if (creating) return;

    setDialogOpen(false);
    resetForm();
  };

  /* =========================================================
     CART
  ========================================================= */

  const handleAddItem = () => {
    setFormData((previous) => ({
      ...previous,
      items: [
        ...previous.items,
        {
          product_id: "",
          quantity: 1,
        },
      ],
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData((previous) => {
      if (previous.items.length <= 1) {
        return previous;
      }

      return {
        ...previous,
        items: previous.items.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  };

  const handleItemChange = (index, field, value) => {
    setFormData((previous) => {
      const updatedItems = [...previous.items];

      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value,
      };

      if (field === "product_id") {
        updatedItems[index].quantity = 1;
      }

      return {
        ...previous,
        items: updatedItems,
      };
    });
  };

  const changeQuantity = (index, amount) => {
    const item = formData.items[index];

    const currentQuantity = Math.max(1, Number(item.quantity) || 1);

    const nextQuantity = Math.max(1, currentQuantity + amount);

    const product = getProduct(item.product_id);

    if (
      product &&
      Number.isFinite(Number(product.stock)) &&
      nextQuantity > Number(product.stock)
    ) {
      showAlert(
        `Only ${product.stock} units of ${product.name} are available.`,
        "warning",
      );

      return;
    }

    handleItemChange(index, "quantity", nextQuantity);
  };

  const calculateLineTotal = (item) => {
    const product = getProduct(item.product_id);

    if (!product) return 0;

    return Number(product.price || 0) * Number(item.quantity || 0);
  };

  const calculateTotal = () =>
    formData.items.reduce((total, item) => total + calculateLineTotal(item), 0);

  const totalItemQuantity = formData.items.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0,
  );

  /* =========================================================
     VALIDATION
  ========================================================= */

  const validateReceipt = () => {
    const selectedPaymentMethod = formData.payment_method || "cash";

    if (!formData.user_id) {
      return "Select a registered client account before creating a receipt.";
    }

    if (!["cash"].includes(selectedPaymentMethod)) {
      return "Only cash payment is supported in this store flow.";
    }

    if (!formData.items.length) {
      return "Please add at least one product.";
    }

    if (formData.items.some((item) => !item.product_id)) {
      return "Please select a product for every item.";
    }

    const selectedIds = formData.items.map((item) => String(item.product_id));

    const uniqueIds = new Set(selectedIds);

    if (uniqueIds.size !== selectedIds.length) {
      return "The same product cannot be added twice. Update the quantity instead.";
    }

    for (const item of formData.items) {
      const product = getProduct(item.product_id);

      if (!product) {
        return "One selected product is no longer available.";
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        return `Enter a valid quantity for ${product.name}.`;
      }

      if (Number(product.stock) <= 0) {
        return `${product.name} is out of stock.`;
      }

      if (quantity > Number(product.stock)) {
        return `Insufficient stock for ${product.name}. Only ${product.stock} available.`;
      }
    }

    return null;
  };

  /* =========================================================
     CREATE RECEIPT
  ========================================================= */

  const handleCreateReceipt = async () => {
    if (checkoutBusy.current) return;
    const selectedPaymentMethod = formData.payment_method || "cash";
    const validationError = validateReceipt();

    if (validationError) {
      showAlert(validationError, "error");
      return;
    }

    if (!["cash"].includes(selectedPaymentMethod)) {
      showAlert("Only cash payment is supported in this store flow.", "error");
      return;
    }

    if (!Number.isFinite(Number(tenderedAmount)) || Number(tenderedAmount) < calculateTotal()) {
      showAlert(
        `Please enter a valid tendered amount of at least ${formatPrice(calculateTotal())}.`,
        "error",
      );
      return;
    }

    checkoutBusy.current = true;
    setCreating(true);

    try {
      const payload = {
        user_id: Number(formData.user_id),
        payment_method: selectedPaymentMethod,
        tendered_amount: Number(tenderedAmount),
        items: formData.items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
        })),
      };

      const signature = JSON.stringify(payload);
      if (!checkoutRequest.current || checkoutRequest.current.signature !== signature) {
        checkoutRequest.current = { signature, id: crypto.randomUUID() };
      }
      payload.request_id = checkoutRequest.current.id;

      const response = walkInRequestId
        ? await API.post(`/transactions/walk-in-requests/${walkInRequestId}/complete`, {
            payment_method: selectedPaymentMethod,
            tendered_amount: Number(tenderedAmount),
          })
        : await API.post("/transactions", payload);

      showAlert(
        response?.data?.receipt_number
          ? `Receipt ${response.data.receipt_number} created successfully.`
          : "Receipt created successfully.",
      );

      setDialogOpen(false);
      checkoutRequest.current = null;
      resetForm();

      await fetchData(true);
    } catch (error) {
      console.error("Failed to create receipt:", error);

      showAlert(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to create receipt.",
        "error",
      );
    } finally {
      checkoutBusy.current = false;
      setCreating(false);
    }
  };

  /* =========================================================
     VIEW RECEIPT
  ========================================================= */

  const handleViewReceipt = async (id) => {
    setViewLoading(true);
    setViewDialog(true);
    setSelectedTransaction(null);

    try {
      const response = await API.get(`/transactions/${id}`);

      setSelectedTransaction(response.data);
    } catch (error) {
      console.error("Failed to load receipt:", error);

      setViewDialog(false);

      showAlert(
        error?.response?.data?.message || "Failed to load receipt.",
        "error",
      );
    } finally {
      setViewLoading(false);
    }
  };

  /* =========================================================
     PRINT
  ========================================================= */

  const handlePrint = () => {
    window.print();
  };

  /* =========================================================
     STATISTICS
  ========================================================= */

  const totalSales = transactions.reduce(
    (total, transaction) => total + Number(transaction.total_amount || 0),
    0,
  );

  const walkInCount = transactions.filter(
    (transaction) => !transaction.user_name,
  ).length;

  const registeredClientCount = transactions.length - walkInCount;

  /* =========================================================
     SEARCH + FILTER
  ========================================================= */

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesSearch =
        !query ||
        String(transaction.receipt_number || "")
          .toLowerCase()
          .includes(query) ||
        String(transaction.user_name || "walk-in")
          .toLowerCase()
          .includes(query);

      const matchesCustomer =
        customerFilter === "all" ||
        (customerFilter === "registered" && transaction.user_name) ||
        (customerFilter === "walkin" && !transaction.user_name);

      return matchesSearch && matchesCustomer;
    });
  }, [transactions, search, customerFilter]);

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    const activeClients = users.filter((user) => user.status === "active");
    if (!query) return activeClients;

    return activeClients.filter((user) =>
      [user.name, user.email, user.user_id, user.id]
        .some((value) => String(value || "").toLowerCase().includes(query)),
    );
  }, [users, clientSearch]);

  const clientSpendingSummary = useMemo(() => {
    const transactionsByClient = transactions.reduce((summary, transaction) => {
      if (transaction.user_id == null) return summary;

      const clientId = String(transaction.user_id);
      const current = summary[clientId] || {
        transactionCount: 0,
        totalSpent: 0,
      };

      current.transactionCount += 1;
      current.totalSpent += Number(transaction.total_amount || 0);
      summary[clientId] = current;
      return summary;
    }, {});

    return users
      .map((user) => {
        const clientId = String(user.id);
        const spending = transactionsByClient[clientId];

        return {
          ...user,
          transactionCount: spending?.transactionCount || 0,
          totalSpent: spending?.totalSpent || 0,
        };
      })
      .sort((first, second) => second.totalSpent - first.totalSpent);
  }, [transactions, users]);

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: 450,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <CircularProgress
          size={44}
          thickness={4}
          sx={{
            color: "#059669",
          }}
        />

        <Typography
          sx={{
            color: "#617B6C",
            fontSize: 13,
          }}
        >
          Loading receipt management...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100%",
        bgcolor: "var(--sh-page-tint)",
        p: {
          xs: 2,
          sm: 3,
        },

        "@media print": {
          bgcolor: "var(--sh-glass-bg)",
          p: 0,

          "& .no-print": {
            display: "none !important",
          },

          "& .receipt-print": {
            position: "absolute",
            inset: 0,
            width: "100%",
            border: "none !important",
            boxShadow: "none !important",
          },
        },
      }}
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <Box
        className="no-print"
        sx={{
          mb: 3.5,

          display: "flex",

          alignItems: {
            xs: "stretch",
            md: "center",
          },

          justifyContent: "space-between",

          flexDirection: {
            xs: "column",
            md: "row",
          },

          gap: 2,
        }}
      >
        <Box>
          <Typography
            sx={{
              color: "#183D32",

              fontSize: {
                xs: "1.8rem",
                md: "2.2rem",
              },

              fontWeight: 900,

              lineHeight: 1.2,

              letterSpacing: "-.04em",
            }}
          >
            Receipt Management
          </Typography>

          <Typography
            sx={{
              mt: 0.8,

              color: "#617B6C",

              fontSize: 14,
            }}
          >
            Process cashier transactions and manage generated customer receipts.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.2}>
          <Tooltip title="Refresh receipts">
            <span>
              <IconButton
                onClick={() => fetchData(true)}
                disabled={refreshing}
                sx={{
                  width: 46,
                  height: 46,

                  bgcolor: "var(--sh-glass-bg)",

                  border: "1px solid #D5E5D9",

                  boxShadow: "0 4px 12px rgba(24,61,50,.03)",

                  "&:hover": {
                    bgcolor: "#F0FDF4",
                    color: "#047857",
                  },
                }}
              >
                {refreshing ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <RefreshRounded />
                )}
              </IconButton>
            </span>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={openCreateDialog}
            sx={{
              minHeight: 46,

              px: 2.5,

              bgcolor: "#047857",

              borderRadius: 3,

              textTransform: "none",

              fontWeight: 800,

              boxShadow: "0 8px 20px rgba(5,150,105,.18)",

              "&:hover": {
                bgcolor: "#065F46",

                transform: "translateY(-1px)",
              },
            }}
          >
            New Receipt
          </Button>
        </Stack>
      </Box>

      {/* =====================================================
          ALERT
      ====================================================== */}

      {alert.show && (
        <Alert
          className="no-print"
          severity={alert.severity}
          onClose={() =>
            setAlert((previous) => ({
              ...previous,
              show: false,
            }))
          }
          sx={{
            mb: 3,
            borderRadius: 3,
          }}
        >
          {alert.message}
        </Alert>
      )}

      {/* =====================================================
          KPI CARDS
      ====================================================== */}

      <Grid className="no-print" container spacing={2.2} sx={{ mb: 3 }}>
        {[
          {
            title: "Total Receipts",
            value: transactions.length,
            icon: <ReceiptLongRounded />,
            color: "#2563EB",
            background: "#EFF6FF",
          },

          {
            title: "Total Sales",
            value: formatPrice(totalSales),
            icon: <LocalAtmRounded />,
            color: "#059669",
            background: "#D8F3E5",
          },

          {
            title: "Client Sales",
            value: registeredClientCount,
            icon: <PersonOutlineRounded />,
            color: "#7C3AED",
            background: "#F5F3FF",
          },

        ].map((item) => (
          <Grid item xs={12} sm={6} lg={3} key={item.title}>
            <Paper
              elevation={0}
              sx={{
                position: "relative",
                overflow: "hidden",

                p: 2.4,

                height: "100%",

                bgcolor: "var(--sh-glass-bg)",

                border: "1px solid #D5E5D9",

                borderRadius: 4,

                transition: "all .22s ease",

                "&:hover": {
                  transform: "translateY(-4px)",

                  boxShadow: "0 16px 36px rgba(24,61,50,.07)",
                },
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 50,
                    height: 50,

                    flexShrink: 0,

                    display: "grid",

                    placeItems: "center",

                    bgcolor: item.background,

                    color: item.color,

                    borderRadius: 3,
                  }}
                >
                  {item.icon}
                </Box>

                <Box>
                  <Typography
                    sx={{
                      color: "#617B6C",

                      fontSize: 11.5,

                      fontWeight: 700,
                    }}
                  >
                    {item.title}
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.2,

                      color: "#183D32",

                      fontSize: item.title === "Total Sales" ? 20 : 25,

                      fontWeight: 900,
                    }}
                  >
                    {item.value}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {walkInRequests.length > 0 && (
        <Paper
          className="no-print"
          elevation={0}
          sx={{
            mb: 3,
            p: { xs: 2, md: 2.5 },
            borderRadius: 4,
            border: "1px solid #FDE68A",
            bgcolor: "#FFFBEB",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1.5}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography sx={{ color: "#92400E", fontSize: 17, fontWeight: 850 }}>
                Pending Walk-in Requests
              </Typography>
              <Typography sx={{ color: "#B45309", fontSize: 12.5, mt: 0.3 }}>
                Load a client request into the cashier form when they arrive at the store.
              </Typography>
            </Box>
            <Chip label={`${walkInRequests.length} pending`} size="small" sx={{ alignSelf: { xs: "flex-start", sm: "center" }, fontWeight: 800, color: "#92400E", bgcolor: "#FEF3C7" }} />
          </Stack>

          <Stack spacing={1}>
            {walkInRequests.map((request) => (
              <Stack
                key={request.id}
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
                spacing={1}
                sx={{ p: 1.5, bgcolor: "var(--sh-glass-bg)", border: "1px solid #FDE68A", borderRadius: 2 }}
              >
                <Box>
                  <Typography sx={{ color: "#183D32", fontSize: 13.5, fontWeight: 800 }}>
                    Request #{request.id} · {request.submitted_by_name || "Client"}
                  </Typography>
                  <Typography sx={{ color: "#617B6C", fontSize: 11.5, mt: 0.25 }}>
                    {Array.isArray(request.data?.items) ? request.data.items.length : 0} product type(s) · {formatDate(request.created_at)}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => openWalkInRequest(request)}
                  sx={{ alignSelf: { xs: "flex-start", sm: "center" }, bgcolor: "#B45309", textTransform: "none", fontWeight: 800, "&:hover": { bgcolor: "#92400E" } }}
                >
                  Load to Cashier
                </Button>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      {/* =====================================================
          CLIENT SPENDING SUMMARY
      ====================================================== */}

      {users.length > 0 && (
        <Paper
          className="no-print"
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: 4,
            border: "1px solid #D1FAE5",
            overflow: "hidden",
            bgcolor: "var(--sh-glass-bg)",
          }}
        >
          <Box
            sx={{
              px: { xs: 2.5, md: 3 },
              py: 2.4,
              borderBottom: "1px solid #D8F3E5",
              bgcolor: "#F0FDF4",
            }}
          >
            <Typography sx={{ color: "#065F46", fontSize: 17, fontWeight: 850 }}>
              Client Spending Summary
            </Typography>
            <Typography sx={{ mt: 0.25, color: "#047857", fontSize: 11.5 }}>
              One total per registered client from completed transactions.
            </Typography>
          </Box>

          <TableContainer>
            <Table
              sx={{
                minWidth: 620,
                "& th": {
                  bgcolor: "#FAFFFC",
                  color: "#617B6C",
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  borderBottom: "1px solid #D1FAE5",
                },
                "& td": {
                  borderBottom: "1px solid #EDF3E8",
                  py: 1.5,
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Identifier</TableCell>
                  <TableCell>Completed Transactions</TableCell>
                  <TableCell>Total Spent</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clientSpendingSummary.map((client) => (
                  <TableRow key={client.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PersonOutlineRounded sx={{ color: "#839B8C", fontSize: 18 }} />
                        <Typography sx={{ color: "#365C4B", fontSize: 13, fontWeight: 750 }}>
                          {client.name || "Unnamed client"}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: "#617B6C", fontSize: 12.5 }}>
                        {client.email || client.user_id || `#${client.id}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: "#365C4B", fontSize: 13, fontWeight: 750 }}>
                        {client.transactionCount}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: "#047857", fontSize: 14, fontWeight: 900 }}>
                        {formatPrice(client.totalSpent)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* =====================================================
          RECEIPT HISTORY
      ====================================================== */}

      <Paper
        className="no-print"
        elevation={0}
        sx={{
          borderRadius: 4,

          border: "1px solid #D5E5D9",

          overflow: "hidden",

          bgcolor: "var(--sh-glass-bg)",
        }}
      >
        {/* TITLE + FILTERS */}

        <Box
          sx={{
            px: {
              xs: 2.5,
              md: 3,
            },

            py: 2.4,

            borderBottom: "1px solid #EDF3E8",
          }}
        >
          <Stack
            direction={{
              xs: "column",
              md: "row",
            }}
            justifyContent="space-between"
            alignItems={{
              xs: "stretch",
              md: "center",
            }}
            spacing={2}
          >
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box
                sx={{
                  width: 42,
                  height: 42,

                  display: "grid",

                  placeItems: "center",

                  bgcolor: "#D8F3E5",

                  color: "#059669",

                  borderRadius: 2.5,
                }}
              >
                <ReceiptLongRounded />
              </Box>

              <Box>
                <Typography
                  sx={{
                    color: "#183D32",

                    fontSize: 17,

                    fontWeight: 850,
                  }}
                >
                  Receipt History
                </Typography>

                <Typography
                  sx={{
                    mt: 0.2,

                    color: "#839B8C",

                    fontSize: 11.5,
                  }}
                >
                  {filteredTransactions.length} transaction
                  {filteredTransactions.length !== 1 ? "s" : ""} found
                </Typography>
              </Box>
            </Stack>

            <Stack
              direction={{
                xs: "column",
                sm: "row",
              }}
              spacing={1.2}
            >
              <TextField
                size="small"
                placeholder="Search receipt or client..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded
                        sx={{
                          color: "#839B8C",
                        }}
                      />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  minWidth: {
                    sm: 240,
                  },

                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2.5,
                  },
                }}
              />

              <FormControl
                size="small"
                sx={{
                  minWidth: 160,
                }}
              >
                <InputLabel>Customer Type</InputLabel>

                <Select
                  value={customerFilter}
                  label="Customer Type"
                  onChange={(event) => setCustomerFilter(event.target.value)}
                  sx={{
                    borderRadius: 2.5,
                  }}
                >
                  <MenuItem value="all">All Customers</MenuItem>

                  <MenuItem value="registered">Registered Clients</MenuItem>

                  <MenuItem value="walkin">Walk-in Customers</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </Box>

        {filteredTransactions.length === 0 ? (
          <Box
            sx={{
              py: 8,

              px: 3,

              textAlign: "center",
            }}
          >
            <Box
              sx={{
                width: 78,
                height: 78,

                mx: "auto",

                mb: 2,

                display: "grid",

                placeItems: "center",

                borderRadius: 4,

                bgcolor: "#D8F3E5",

                color: "#059669",
              }}
            >
              <ReceiptLongRounded
                sx={{
                  fontSize: 40,
                }}
              />
            </Box>

            <Typography
              sx={{
                color: "#183D32",

                fontSize: 17,

                fontWeight: 850,
              }}
            >
              {transactions.length === 0
                ? "No receipts yet"
                : "No matching receipts"}
            </Typography>

            <Typography
              sx={{
                mt: 0.8,

                color: "#617B6C",

                fontSize: 13,
              }}
            >
              {transactions.length === 0
                ? "Create your first transaction to generate a receipt."
                : "Try changing your search or customer filter."}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table
              sx={{
                minWidth: 850,

                "& th": {
                  bgcolor: "var(--sh-page-tint)",

                  color: "#617B6C",

                  fontSize: 10.5,

                  fontWeight: 800,

                  textTransform: "uppercase",

                  letterSpacing: ".05em",

                  borderBottom: "1px solid #D5E5D9",
                },

                "& td": {
                  borderBottom: "1px solid #EDF3E8",

                  py: 1.7,
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Receipt Number</TableCell>

                  <TableCell>Customer</TableCell>

                  <TableCell>Amount</TableCell>

                  <TableCell>Payment</TableCell>

                  <TableCell>Date</TableCell>

                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <Box
                          sx={{
                            width: 36,
                            height: 36,

                            display: "grid",

                            placeItems: "center",

                            flexShrink: 0,

                            bgcolor: "#FFF7ED",

                            color: "#EA580C",

                            borderRadius: 2.2,
                          }}
                        >
                          <PointOfSaleRounded
                            sx={{
                              fontSize: 19,
                            }}
                          />
                        </Box>

                        <Typography
                          sx={{
                            color: "#183D32",

                            fontFamily: "monospace",

                            fontWeight: 800,

                            fontSize: 13,
                          }}
                        >
                          {transaction.receipt_number || `#${transaction.id}`}
                        </Typography>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PersonOutlineRounded
                          sx={{
                            fontSize: 18,

                            color: "#839B8C",
                          }}
                        />

                        <Typography
                          sx={{
                            color: "#365C4B",

                            fontSize: 13,

                            fontWeight: 650,
                          }}
                        >
                          {transaction.user_name || "Walk-in Customer"}
                        </Typography>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Typography
                        sx={{
                          color: "#047857",

                          fontSize: 13.5,

                          fontWeight: 850,
                        }}
                      >
                        {formatPrice(transaction.total_amount)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        icon={<LocalAtmRounded />}
                        label="Cash"
                        sx={{
                          bgcolor: "#D8F3E5",

                          color: "#047857",

                          fontWeight: 750,

                          "& .MuiChip-icon": {
                            color: "#059669",
                          },
                        }}
                      />
                    </TableCell>

                    <TableCell>
                      <Typography
                        sx={{
                          color: "#617B6C",

                          fontSize: 12.5,
                        }}
                      >
                        {formatDate(transaction.created_at)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityRounded />}
                        onClick={() => handleViewReceipt(transaction.id)}
                        sx={{
                          borderRadius: 2.5,

                          textTransform: "none",

                          fontWeight: 750,

                          color: "#047857",

                          borderColor: "#A7D7C6",

                          "&:hover": {
                            bgcolor: "#F0FDF4",

                            borderColor: "#059669",
                          },
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* =====================================================
          CREATE RECEIPT
      ====================================================== */}

      <Dialog
        open={dialogOpen}
        onClose={closeCreateDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 5,
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle sx={{ p: 0 }}>
          <Box
            sx={{
              px: {
                xs: 2.5,
                sm: 3.5,
              },

              py: 3,

              color: "#FFFFFF",

              background:
                "linear-gradient(135deg, #064E3B 0%, #047857 55%, #059669 100%)",
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 50,
                  height: 50,

                  display: "grid",

                  placeItems: "center",

                  bgcolor: "rgba(255,255,255,.12)",

                  border: "1px solid rgba(255,255,255,.15)",

                  borderRadius: 3,
                }}
              >
                <PointOfSaleRounded />
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    fontSize: 20,

                    fontWeight: 850,
                  }}
                >
                  New Store Transaction
                </Typography>

                <Typography
                  sx={{
                    mt: 0.3,

                    color: "rgba(255,255,255,.68)",

                    fontSize: 12,
                  }}
                >
                  Create a receipt for a registered or walk-in customer.
                </Typography>
              </Box>

              <IconButton
                onClick={closeCreateDialog}
                disabled={creating}
                sx={{
                  color: "#FFFFFF",

                  bgcolor: "rgba(255,255,255,.08)",

                  "&:hover": {
                    bgcolor: "rgba(255,255,255,.15)",
                  },
                }}
              >
                <CloseRounded />
              </IconButton>
            </Stack>
          </Box>
        </DialogTitle>

        <DialogContent
          sx={{
            px: {
              xs: 2.5,
              sm: 3.5,
            },

            py: "28px !important",

            bgcolor: "var(--sh-page-tint)",
          }}
        >
          {/* CUSTOMER */}

          <Typography
            sx={{
              mb: 1.5,

              color: "#839B8C",

              fontSize: 10.5,

              fontWeight: 800,

              textTransform: "uppercase",

              letterSpacing: ".08em",
            }}
          >
            Customer
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                size="small"
                label="Search registered client"
                placeholder="Name, email, or account ID"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded sx={{ color: "#839B8C" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 1.2 }}
              />
              <FormControl fullWidth>
                <InputLabel>Client</InputLabel>

                <Select
                  value={formData.user_id}
                  label="Client"
                  required
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,

                      user_id: event.target.value,
                    }))
                  }
                >
                  {filteredClients.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name} — {user.email || user.user_id || `#${user.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {clientSearch.trim() && filteredClients.length === 0 && (
                <Typography sx={{ mt: 0.8, color: "#B45309", fontSize: 12 }}>
                  No registered client found.
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={formData.payment_method || "cash"}
                  label="Payment Method"
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      payment_method: event.target.value,
                    }))
                  }
                  sx={{
                    bgcolor: "#D8F3E5",
                    borderRadius: 2,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#D1FAE5",
                    },
                  }}
                >
                  <MenuItem value="cash">Cash</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* CART */}

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography
                sx={{
                  color: "#183D32",

                  fontSize: 16,

                  fontWeight: 850,
                }}
              >
                Cart Items
              </Typography>

              <Typography
                sx={{
                  mt: 0.3,

                  color: "#839B8C",

                  fontSize: 11.5,
                }}
              >
                {totalItemQuantity} item
                {totalItemQuantity !== 1 ? "s" : ""} currently in cart
              </Typography>
            </Box>

            <Button
              size="small"
              startIcon={<AddRounded />}
              onClick={handleAddItem}
              disabled={
                formData.items.length >=
                products.filter((product) => Number(product.stock) > 0).length
              }
              sx={{
                color: "#047857",

                textTransform: "none",

                fontWeight: 750,
              }}
            >
              Add Item
            </Button>
          </Stack>

          <Stack spacing={1.5}>
            {formData.items.map((item, index) => {
              const product = getProduct(item.product_id);

              const selectedIds = getSelectedProductIds();

              return (
                <Paper
                  key={index}
                  elevation={0}
                  sx={{
                    p: 2,

                    borderRadius: 3,

                    border: "1px solid #D5E5D9",

                    bgcolor: "var(--sh-glass-bg)",

                    transition: "all .2s ease",

                    "&:hover": {
                      borderColor: "#CFE7DE",
                    },
                  }}
                >
                  <Grid container spacing={1.5} alignItems="center">
                    {/* PRODUCT */}

                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Product</InputLabel>

                        <Select
                          value={item.product_id}
                          label="Product"
                          onChange={(event) =>
                            handleItemChange(
                              index,
                              "product_id",
                              event.target.value,
                            )
                          }
                        >
                          {products.map((productItem) => {
                            const alreadySelected =
                              selectedIds.includes(String(productItem.id)) &&
                              String(item.product_id) !==
                                String(productItem.id);

                            const noStock = Number(productItem.stock) <= 0;

                            return (
                              <MenuItem
                                key={productItem.id}
                                value={productItem.id}
                                disabled={alreadySelected || noStock}
                              >
                                {productItem.name} —{" "}
                                {formatPrice(productItem.price)} · Stock:{" "}
                                {productItem.stock}
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </FormControl>
                    </Grid>

                    {/* QUANTITY */}

                    <Grid item xs={7} md={3}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                          height: 40,

                          border: "1px solid #D5E5D9",

                          borderRadius: 2.5,

                          overflow: "hidden",
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => changeQuantity(index, -1)}
                          disabled={Number(item.quantity) <= 1}
                        >
                          <RemoveRounded fontSize="small" />
                        </IconButton>

                        <Typography
                          sx={{
                            minWidth: 30,

                            textAlign: "center",

                            color: "#183D32",

                            fontWeight: 800,

                            fontSize: 13,
                          }}
                        >
                          {item.quantity}
                        </Typography>

                        <IconButton
                          size="small"
                          onClick={() => changeQuantity(index, 1)}
                          disabled={
                            product
                              ? Number(item.quantity) >= Number(product.stock)
                              : true
                          }
                        >
                          <AddRounded fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Grid>

                    {/* SUBTOTAL */}

                    <Grid item xs={4} md={2}>
                      <Box
                        sx={{
                          textAlign: "right",
                        }}
                      >
                        <Typography
                          sx={{
                            color: "#839B8C",

                            fontSize: 9.5,

                            fontWeight: 700,

                            textTransform: "uppercase",
                          }}
                        >
                          Subtotal
                        </Typography>

                        <Typography
                          sx={{
                            mt: 0.2,

                            color: "#047857",

                            fontSize: 13.5,

                            fontWeight: 850,
                          }}
                        >
                          {formatPrice(calculateLineTotal(item))}
                        </Typography>
                      </Box>
                    </Grid>

                    {/* DELETE */}

                    <Grid item xs={1}>
                      <Tooltip title="Remove">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={formData.items.length === 1}
                            onClick={() => handleRemoveItem(index)}
                          >
                            <DeleteOutlineRounded />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Grid>
                  </Grid>

                  {product && (
                    <Stack
                      direction="row"
                      spacing={0.7}
                      alignItems="center"
                      sx={{
                        mt: 1.3,
                      }}
                    >
                      {Number(product.stock) <= 5 ? (
                        <WarningAmberRounded
                          sx={{
                            color: "#D97706",

                            fontSize: 15,
                          }}
                        />
                      ) : (
                        <CheckCircleRounded
                          sx={{
                            color: "#059669",

                            fontSize: 15,
                          }}
                        />
                      )}

                      <Typography
                        sx={{
                          color:
                            Number(product.stock) <= 5 ? "#D97706" : "#617B6C",

                          fontSize: 10.5,

                          fontWeight: 650,
                        }}
                      >
                        {product.stock} unit
                        {Number(product.stock) !== 1 ? "s" : ""} available
                      </Typography>
                    </Stack>
                  )}
                </Paper>
              );
            })}
          </Stack>

          {/* SUMMARY */}

          <Box
            sx={{
              mt: 3,

              p: 2.5,

              borderRadius: 4,

              background: "linear-gradient(135deg, #D8F3E5 0%, #F0FDF4 100%)",

              border: "1px solid #D1FAE5",
            }}
          >
            <Stack spacing={1.3}>
              <Stack direction="row" justifyContent="space-between">
                <Typography
                  sx={{
                    color: "#617B6C",

                    fontSize: 12.5,
                  }}
                >
                  Number of items
                </Typography>

                <Typography
                  sx={{
                    color: "#365C4B",

                    fontWeight: 750,

                    fontSize: 12.5,
                  }}
                >
                  {totalItemQuantity}
                </Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between">
                <Typography
                  sx={{
                    color: "#617B6C",

                    fontSize: 12.5,
                  }}
                >
                  Payment Method
                </Typography>

                <Typography
                  sx={{
                    color: "#365C4B",

                    fontWeight: 750,

                    fontSize: 12.5,
                  }}
                >
                  {formData.payment_method === "cash" ? "Cash" : "Cash"}
                </Typography>
              </Stack>

              <Divider />

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <ShoppingCartOutlined
                    sx={{
                      color: "#059669",
                    }}
                  />

                  <Typography
                    sx={{
                      color: "#365C4B",

                      fontSize: 14,

                      fontWeight: 750,
                    }}
                  >
                    Total Amount
                  </Typography>
                </Stack>

                <Typography
                  sx={{
                    color: "#047857",

                    fontSize: 26,

                    fontWeight: 900,

                    letterSpacing: "-.03em",
                  }}
                >
                  {formatPrice(calculateTotal())}
                </Typography>
              </Stack>
            </Stack>
          </Box>

          <Paper
            elevation={0}
            sx={{ mt: 2, p: 2, border: "1px solid #D5E5D9", borderRadius: 3, bgcolor: "var(--sh-glass-bg)" }}
          >
            <Typography sx={{ color: "#365C4B", fontSize: 13, fontWeight: 800, mb: 1 }}>
              Cash Calculator
            </Typography>
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Amount Tendered"
                  value={tenderedAmount}
                  onChange={(event) => setTenderedAmount(event.target.value)}
                  inputProps={{ min: 0, step: "0.01" }}
                  InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography sx={{ color: Number(tenderedAmount) >= calculateTotal() ? "#047857" : "#B45309", fontSize: 16, fontWeight: 900 }}>
                  Change: {formatPrice(Math.max(0, Number(tenderedAmount || 0) - calculateTotal()))}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </DialogContent>

        <DialogActions
          sx={{
            px: {
              xs: 2.5,
              sm: 3.5,
            },

            py: 2.5,

            bgcolor: "var(--sh-glass-bg)",

            borderTop: "1px solid #EDF3E8",
          }}
        >
          <Button
            onClick={closeCreateDialog}
            disabled={creating}
            sx={{
              minWidth: 100,

              color: "#617B6C",

              borderRadius: 3,

              textTransform: "none",

              fontWeight: 700,
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={handleCreateReceipt}
            disabled={
              creating ||
              calculateTotal() <= 0 ||
              Number(tenderedAmount) < calculateTotal()
            }
            startIcon={creating ? null : <ReceiptLongRounded />}
            sx={{
              minWidth: 180,

              minHeight: 45,

              bgcolor: "#047857",

              borderRadius: 3,

              textTransform: "none",

              fontWeight: 800,

              boxShadow: "0 8px 20px rgba(5,150,105,.16)",

              "&:hover": {
                bgcolor: "#065F46",
              },
            }}
          >
            {creating ? (
              <>
                <CircularProgress
                  size={18}
                  sx={{
                    mr: 1,

                    color: "#FFFFFF",
                  }}
                />
                Processing...
              </>
            ) : (
              "Complete Sale"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================
          RECEIPT PREVIEW
      ====================================================== */}

      <Dialog
        open={viewDialog}
        onClose={() => !viewLoading && setViewDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 5,
          },
        }}
      >
        <DialogTitle
          className="no-print"
          sx={{
            px: 3,

            py: 2.5,

            borderBottom: "1px solid #EDF3E8",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <Box
              sx={{
                width: 42,
                height: 42,

                display: "grid",

                placeItems: "center",

                bgcolor: "#D8F3E5",

                color: "#059669",

                borderRadius: 2.5,
              }}
            >
              <ReceiptLongRounded />
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography
                sx={{
                  color: "#183D32",

                  fontWeight: 850,

                  fontSize: 18,
                }}
              >
                Receipt Preview
              </Typography>

              <Typography
                sx={{
                  mt: 0.2,

                  color: "#839B8C",

                  fontSize: 11,
                }}
              >
                Review or print this transaction.
              </Typography>
            </Box>

            <IconButton onClick={() => setViewDialog(false)}>
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent
          sx={{
            p: "28px !important",

            bgcolor: "var(--sh-page-tint)",
          }}
        >
          {viewLoading ? (
            <Box
              sx={{
                py: 7,

                display: "flex",

                flexDirection: "column",

                alignItems: "center",

                gap: 1.5,
              }}
            >
              <CircularProgress
                sx={{
                  color: "#059669",
                }}
              />

              <Typography
                sx={{
                  color: "#617B6C",

                  fontSize: 12,
                }}
              >
                Loading receipt...
              </Typography>
            </Box>
          ) : (
            selectedTransaction && (
              <Paper
                className="receipt-print"
                elevation={0}
                sx={{
                  maxWidth: 430,

                  mx: "auto",

                  p: {
                    xs: 2.5,
                    sm: 3.5,
                  },

                  bgcolor: "var(--sh-glass-bg)",

                  border: "1px solid #D5E5D9",

                  borderRadius: 4,
                }}
              >
                {/* STORE */}

                <Box
                  sx={{
                    textAlign: "center",

                    mb: 3,
                  }}
                >
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
                    <StorefrontRounded
                      sx={{
                        color: "#059669",

                        fontSize: 31,
                      }}
                    />
                  </Box>

                  <Typography
                    sx={{
                      mt: 1,

                      color: "#183D32",

                      fontSize: 21,

                      fontWeight: 900,

                      letterSpacing: "-.03em",
                    }}
                  >
                    StoreHub
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.2,

                      color: "#617B6C",

                      fontSize: 10.5,
                    }}
                  >
                    Convenience Store
                  </Typography>

                  <Chip
                    size="small"
                    label={
                      selectedTransaction.receipt_number ||
                      `#${selectedTransaction.id}`
                    }
                    sx={{
                      mt: 1.5,

                      bgcolor: "var(--sh-page-tint)",

                      fontFamily: "monospace",

                      fontWeight: 750,
                    }}
                  />
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* META */}

                <Stack spacing={1}>
                  {[
                    ["Date", formatDate(selectedTransaction.created_at)],

                    ["Cashier", selectedTransaction.staff_name || "Staff"],

                    [
                      "Customer",
                      selectedTransaction.user_name || "Walk-in Customer",
                    ],

                    ["Payment", "Cash"],
                  ].map(([label, value]) => (
                    <Stack
                      key={label}
                      direction="row"
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <Typography
                        sx={{
                          color: "#839B8C",

                          fontSize: 11.5,
                        }}
                      >
                        {label}
                      </Typography>

                      <Typography
                        sx={{
                          maxWidth: "65%",

                          color: "#365C4B",

                          fontSize: 11.5,

                          fontWeight: 700,

                          textAlign: "right",
                        }}
                      >
                        {value}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>

                <Divider sx={{ my: 2.3 }} />

                {/* ITEMS */}

                <Typography
                  sx={{
                    mb: 1.5,

                    color: "#617B6C",

                    fontSize: 10,

                    fontWeight: 850,

                    textTransform: "uppercase",

                    letterSpacing: ".08em",
                  }}
                >
                  Items
                </Typography>

                <Stack spacing={1.5}>
                  {selectedTransaction.items?.map((item, index) => (
                    <Box key={item.id || index}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        spacing={2}
                      >
                        <Box>
                          <Typography
                            sx={{
                              color: "#183D32",

                              fontSize: 12.5,

                              fontWeight: 750,
                            }}
                          >
                            {item.product_name}
                          </Typography>

                          <Typography
                            sx={{
                              mt: 0.2,

                              color: "#839B8C",

                              fontSize: 10.5,
                            }}
                          >
                            Qty: {item.quantity}
                          </Typography>
                        </Box>

                        <Typography
                          sx={{
                            color: "#365C4B",

                            fontSize: 12.5,

                            fontWeight: 750,
                          }}
                        >
                          {formatPrice(item.subtotal)}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Stack>

                <Divider sx={{ my: 2.5 }} />

                {/* TOTAL */}

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography
                    sx={{
                      color: "#365C4B",

                      fontSize: 14,

                      fontWeight: 800,
                    }}
                  >
                    TOTAL
                  </Typography>

                  <Typography
                    sx={{
                      color: "#047857",

                      fontSize: 24,

                      fontWeight: 900,
                    }}
                  >
                    {formatPrice(selectedTransaction.total_amount)}
                  </Typography>
                </Stack>

                {selectedTransaction.tendered_amount != null && (
                  <Stack spacing={0.8} sx={{ mt: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography sx={{ color: "#617B6C", fontSize: 12 }}>
                        Cash Received
                      </Typography>
                      <Typography sx={{ color: "#365C4B", fontSize: 12, fontWeight: 750 }}>
                        {formatPrice(selectedTransaction.tendered_amount)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography sx={{ color: "#617B6C", fontSize: 12 }}>
                        Change
                      </Typography>
                      <Typography sx={{ color: "#047857", fontSize: 12, fontWeight: 850 }}>
                        {formatPrice(
                          selectedTransaction.change_amount ?? Math.max(
                            0,
                            Number(selectedTransaction.tendered_amount) -
                              Number(selectedTransaction.total_amount),
                          ),
                        )}
                      </Typography>
                    </Stack>
                  </Stack>
                )}

                <Divider sx={{ my: 2.5 }} />

                <Box
                  sx={{
                    textAlign: "center",
                  }}
                >
                  <Typography
                    sx={{
                      color: "#617B6C",

                      fontSize: 11,

                      fontWeight: 700,
                    }}
                  >
                    Thank you for shopping with StoreHub!
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.5,

                      color: "#CBD5E1",

                      fontSize: 9.5,
                    }}
                  >
                    Please keep this receipt for your records.
                  </Typography>
                </Box>
              </Paper>
            )
          )}
        </DialogContent>

        <DialogActions
          className="no-print"
          sx={{
            px: 3,

            pb: 3,
          }}
        >
          <Button
            onClick={() => setViewDialog(false)}
            sx={{
              color: "#617B6C",

              borderRadius: 3,

              textTransform: "none",

              fontWeight: 700,
            }}
          >
            Close
          </Button>

          <Button
            variant="contained"
            startIcon={<PrintRounded />}
            onClick={handlePrint}
            disabled={!selectedTransaction}
            sx={{
              bgcolor: "#047857",

              borderRadius: 3,

              textTransform: "none",

              fontWeight: 800,

              "&:hover": {
                bgcolor: "#065F46",
              },
            }}
          >
            Print Receipt
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReceiptManagement;
