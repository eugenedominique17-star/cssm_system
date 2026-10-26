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
  CalendarMonthOutlined,
  CancelRounded,
  CheckCircleRounded,
  CloseRounded,
  DeleteOutlineRounded,
  EditOutlined,
  HourglassTopRounded,
  LocalOfferRounded,
  PercentRounded,
  RefreshRounded,
  SearchRounded,
  SellOutlined,
  WarningAmberRounded,
} from "@mui/icons-material";

import API from "../../api/catalogMutations";
import { getCatalog } from "../../api/catalog";

const INITIAL_FORM = {
  title: "",
  description: "",
  product_id: "",
  discount_type: "percentage",
  discount_value: "",
  start_date: "",
  end_date: "",
};

const PromoManagement = () => {
  const [promos, setPromos] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPromo, setEditPromo] = useState(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promoToDelete, setPromoToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formData, setFormData] = useState(INITIAL_FORM);

  const [alert, setAlert] = useState({
    show: false,
    message: "",
    severity: "success",
  });

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
     FETCH PROMOS
  ========================================================= */

  const fetchPromos = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await getCatalog("promos");

        setPromos(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Failed to fetch promos:", error);

        showAlert(
          error?.response?.data?.message ||
            error?.response?.data?.error ||
            "Unable to load promotions.",
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
    fetchPromos();
    getCatalog("products", { active: true })
      .then(response => setProducts(Array.isArray(response.data) ? response.data : []))
      .catch(error => showAlert(error?.response?.data?.message || "Unable to load products for promotions.", "error"));

    return () => {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    };
  }, [fetchPromos]);

  /* =========================================================
     HELPERS
  ========================================================= */

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

  const formatShortDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDiscount = (promo) => {
    const value = Number(promo.discount_value || 0);

    if (promo.discount_type === "percentage") {
      return `${value}% OFF`;
    }

    if (promo.discount_type === "fixed") {
      return `₱${value.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} OFF`;
    }

    if (promo.discount_type === "bundle") {
      return value ? `Bundle ${value}` : "Bundle Deal";
    }

    return "Promotion";
  };

  const getComputedStatus = (promo) => {
    const backendStatus = String(promo.status || "").toLowerCase();

    if (backendStatus === "pending" || backendStatus === "rejected") {
      return backendStatus;
    }

    const now = new Date();
    const start = promo.start_date ? new Date(promo.start_date) : null;
    const end = promo.end_date ? new Date(promo.end_date) : null;

    if (end && now > end) {
      return "expired";
    }

    if (start && now < start) {
      return "scheduled";
    }

    return backendStatus || "active";
  };

  const getStatusChip = (promo) => {
    const status = getComputedStatus(promo);

    const configs = {
      active: {
        label: "Active",
        icon: <CheckCircleRounded />,
        color: "#047857",
        background: "#D8F3E5",
        border: "#A7F3D0",
      },

      pending: {
        label: "Pending",
        icon: <HourglassTopRounded />,
        color: "#B45309",
        background: "#FFFBEB",
        border: "#FDE68A",
      },

      scheduled: {
        label: "Scheduled",
        icon: <CalendarMonthOutlined />,
        color: "#2563EB",
        background: "#EFF6FF",
        border: "#DBEAFE",
      },

      expired: {
        label: "Expired",
        icon: <WarningAmberRounded />,
        color: "#617B6C",
        background: "var(--sh-page-tint)",
        border: "#D5E5D9",
      },

      rejected: {
        label: "Rejected",
        icon: <CancelRounded />,
        color: "#B91C1C",
        background: "#FEF2F2",
        border: "#FECACA",
      },
    };

    const config = configs[status] || configs.expired;

    return (
      <Chip
        size="small"
        icon={config.icon}
        label={config.label}
        sx={{
          bgcolor: config.background,
          color: config.color,
          border: `1px solid ${config.border}`,
          fontWeight: 750,

          "& .MuiChip-icon": {
            color: config.color,
          },
        }}
      />
    );
  };

  const getDiscountTypeChip = (type) => {
    const configs = {
      percentage: {
        label: "Percentage",
        icon: <PercentRounded />,
        color: "#7C3AED",
        background: "#F5F3FF",
      },

      fixed: {
        label: "Fixed Amount",
        icon: <SellOutlined />,
        color: "#2563EB",
        background: "#EFF6FF",
      },

      bundle: {
        label: "Bundle",
        icon: <LocalOfferRounded />,
        color: "#D97706",
        background: "#FFFBEB",
      },
    };

    const config = configs[type] || configs.percentage;

    return (
      <Chip
        size="small"
        icon={config.icon}
        label={config.label}
        sx={{
          bgcolor: config.background,
          color: config.color,
          fontWeight: 700,

          "& .MuiChip-icon": {
            color: config.color,
          },
        }}
      />
    );
  };

  /* =========================================================
     DIALOG
  ========================================================= */

  const handleOpenDialog = (promo = null) => {
    if (promo) {
      setEditPromo(promo);

      setFormData({
        title: promo.title || "",
        description: promo.description || "",
        product_id: promo.product_id ? String(promo.product_id) : "",
        discount_type: promo.discount_type || "percentage",
        discount_value:
          promo.discount_value !== null && promo.discount_value !== undefined
            ? String(promo.discount_value)
            : "",
        start_date: promo.start_date
          ? new Date(promo.start_date).toISOString().slice(0, 16)
          : "",
        end_date: promo.end_date
          ? new Date(promo.end_date).toISOString().slice(0, 16)
          : "",
      });
    } else {
      setEditPromo(null);
      setFormData(INITIAL_FORM);
    }

    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;

    setDialogOpen(false);
    setEditPromo(null);
    setFormData(INITIAL_FORM);
  };

  const handleFieldChange = (field) => (event) => {
    setFormData((previous) => ({
      ...previous,
      [field]: event.target.value,
    }));
  };

  /* =========================================================
     VALIDATION
  ========================================================= */

  const validateForm = () => {
    if (!formData.title.trim()) {
      return "Promo title is required.";
    }

    if (!formData.discount_type) {
      return "Please select a discount type.";
    }

    if (formData.discount_type !== "bundle" && formData.discount_value === "") {
      return "Discount value is required.";
    }

    const discountValue = Number(formData.discount_value);

    if (
      formData.discount_type !== "bundle" &&
      (!Number.isFinite(discountValue) || discountValue <= 0)
    ) {
      return "Discount value must be greater than zero.";
    }

    if (formData.discount_type === "percentage" && discountValue > 100) {
      return "Percentage discount cannot exceed 100%.";
    }

    if (!formData.start_date) {
      return "Start date is required.";
    }

    if (!formData.end_date) {
      return "End date is required.";
    }

    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);

    if (endDate <= startDate) {
      return "End date must be later than the start date.";
    }

    return null;
  };

  /* =========================================================
     SAVE
  ========================================================= */

  const handleSave = async () => {
    const validationError = validateForm();

    if (validationError) {
      showAlert(validationError, "error");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...formData,
        product_id: formData.product_id ? Number(formData.product_id) : null,

        title: formData.title.trim(),

        description: formData.description.trim(),

        discount_value:
          formData.discount_type === "bundle" && formData.discount_value === ""
            ? 0
            : Number(formData.discount_value),
      };

      if (editPromo) {
        await API.put(`/promos/${editPromo.id}`, payload);

        showAlert("Promo update submitted for Admin approval.");
      } else {
        await API.post("/promos", payload);

        showAlert("Promo submitted for Admin approval.");
      }

      setDialogOpen(false);
      setEditPromo(null);
      setFormData(INITIAL_FORM);

      await fetchPromos(true);
    } catch (error) {
      console.error("Failed to save promo:", error);

      showAlert(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to save promo.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const openDeleteDialog = (promo) => {
    setPromoToDelete(promo);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;

    setDeleteDialogOpen(false);
    setPromoToDelete(null);
  };

  const handleDelete = async () => {
    if (!promoToDelete) return;

    setDeleting(true);

    try {
      await API.delete(`/promos/${promoToDelete.id}`);

      showAlert("Promo deleted successfully.");

      setDeleteDialogOpen(false);
      setPromoToDelete(null);

      await fetchPromos(true);
    } catch (error) {
      console.error("Failed to delete promo:", error);

      showAlert(
        error?.response?.data?.message || "Failed to delete promo.",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  /* =========================================================
     FILTERS + STATS
  ========================================================= */

  const filteredPromos = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return promos.filter((promo) => {
      const status = getComputedStatus(promo);

      const matchesSearch =
        !keyword ||
        String(promo.title || "")
          .toLowerCase()
          .includes(keyword) ||
        String(promo.description || "")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [promos, search, statusFilter]);

  const activeCount = promos.filter(
    (promo) => getComputedStatus(promo) === "active",
  ).length;

  const pendingCount = promos.filter(
    (promo) => getComputedStatus(promo) === "pending",
  ).length;

  const scheduledCount = promos.filter(
    (promo) => getComputedStatus(promo) === "scheduled",
  ).length;

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: 450,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <CircularProgress size={44} thickness={4} sx={{ color: "#059669" }} />

        <Typography
          sx={{
            color: "#617B6C",
            fontSize: 13,
          }}
        >
          Loading promotions...
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
      }}
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <Box
        sx={{
          mb: 3.5,

          display: "flex",

          flexDirection: {
            xs: "column",
            md: "row",
          },

          alignItems: {
            xs: "stretch",
            md: "center",
          },

          justifyContent: "space-between",

          gap: 2,
        }}
      >
        <Box>
          <Typography
            sx={{
              color: "#183D32",

              fontSize: {
                xs: "1.85rem",
                md: "2.2rem",
              },

              fontWeight: 900,

              lineHeight: 1.15,

              letterSpacing: "-.04em",
            }}
          >
            Promo Management
          </Typography>

          <Typography
            sx={{
              mt: 0.8,
              color: "#617B6C",
              fontSize: 14,
            }}
          >
            Create, update and monitor store promotions and discounts.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.2}>
          <Tooltip title="Refresh promotions">
            <span>
              <IconButton
                disabled={refreshing}
                onClick={() => fetchPromos(true)}
                sx={{
                  width: 46,
                  height: 46,

                  bgcolor: "var(--sh-glass-bg)",

                  border: "1px solid #D5E5D9",

                  "&:hover": {
                    bgcolor: "#F0FDF4",
                    color: "#047857",
                  },
                }}
              >
                {refreshing ? (
                  <CircularProgress size={19} color="inherit" />
                ) : (
                  <RefreshRounded />
                )}
              </IconButton>
            </span>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => handleOpenDialog()}
            sx={{
              minHeight: 46,

              px: 2.5,

              bgcolor: "#047857",

              borderRadius: 3,

              textTransform: "none",

              fontWeight: 800,

              boxShadow: "0 8px 22px rgba(5,150,105,.18)",

              "&:hover": {
                bgcolor: "#065F46",
                transform: "translateY(-1px)",
              },
            }}
          >
            Add Promo
          </Button>
        </Stack>
      </Box>

      {/* ALERT */}

      {alert.show && (
        <Alert
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
          SUMMARY CARDS
      ====================================================== */}

      <Grid container spacing={2.2} sx={{ mb: 3 }}>
        {[
          {
            title: "Total Promos",
            value: promos.length,
            icon: <LocalOfferRounded />,
            color: "#2563EB",
            background: "#EFF6FF",
          },

          {
            title: "Active",
            value: activeCount,
            icon: <CheckCircleRounded />,
            color: "#059669",
            background: "#D8F3E5",
          },

          {
            title: "Pending Approval",
            value: pendingCount,
            icon: <HourglassTopRounded />,
            color: "#D97706",
            background: "#FFFBEB",
          },

          {
            title: "Scheduled",
            value: scheduledCount,
            icon: <CalendarMonthOutlined />,
            color: "#7C3AED",
            background: "#F5F3FF",
          },
        ].map((item) => (
          <Grid item xs={12} sm={6} lg={3} key={item.title}>
            <Paper
              elevation={0}
              sx={{
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

                      fontSize: 25,

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

      {/* =====================================================
          PROMO TABLE
      ====================================================== */}

      <Paper
        elevation={0}
        sx={{
          bgcolor: "var(--sh-glass-bg)",

          border: "1px solid #D5E5D9",

          borderRadius: 4,

          overflow: "hidden",
        }}
      >
        {/* FILTER HEADER */}

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
            alignItems={{
              xs: "stretch",
              md: "center",
            }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box
                sx={{
                  width: 42,
                  height: 42,

                  display: "grid",

                  placeItems: "center",

                  bgcolor: "#FFF7ED",

                  color: "#EA580C",

                  borderRadius: 2.5,
                }}
              >
                <LocalOfferRounded />
              </Box>

              <Box>
                <Typography
                  sx={{
                    color: "#183D32",

                    fontSize: 17,

                    fontWeight: 850,
                  }}
                >
                  Store Promotions
                </Typography>

                <Typography
                  sx={{
                    mt: 0.2,

                    color: "#839B8C",

                    fontSize: 11.5,
                  }}
                >
                  {filteredPromos.length} promo
                  {filteredPromos.length !== 1 ? "s" : ""} found
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
                value={search}
                placeholder="Search promotions..."
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
                <InputLabel>Status</InputLabel>

                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(event) => setStatusFilter(event.target.value)}
                  sx={{
                    borderRadius: 2.5,
                  }}
                >
                  <MenuItem value="all">All Statuses</MenuItem>

                  <MenuItem value="active">Active</MenuItem>

                  <MenuItem value="pending">Pending</MenuItem>

                  <MenuItem value="scheduled">Scheduled</MenuItem>

                  <MenuItem value="expired">Expired</MenuItem>

                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </Box>

        {/* CONTENT */}

        {filteredPromos.length === 0 ? (
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

                bgcolor: "#FFF7ED",

                color: "#EA580C",

                borderRadius: 4,
              }}
            >
              <LocalOfferRounded sx={{ fontSize: 40 }} />
            </Box>

            <Typography
              sx={{
                color: "#183D32",
                fontSize: 17,
                fontWeight: 850,
              }}
            >
              {promos.length === 0
                ? "No promotions yet"
                : "No matching promotions"}
            </Typography>

            <Typography
              sx={{
                mt: 0.8,
                color: "#617B6C",
                fontSize: 13,
              }}
            >
              {promos.length === 0
                ? "Create your first promotion and submit it for Admin approval."
                : "Try changing your search or status filter."}
            </Typography>

            {promos.length === 0 && (
              <Button
                variant="contained"
                startIcon={<AddRounded />}
                onClick={() => handleOpenDialog()}
                sx={{
                  mt: 2.5,

                  bgcolor: "#047857",

                  borderRadius: 3,

                  textTransform: "none",

                  fontWeight: 750,

                  "&:hover": {
                    bgcolor: "#065F46",
                  },
                }}
              >
                Create Promo
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>
                  {["Promotion", "Discount", "Type", "Period", "Status"].map(
                    (label) => (
                      <TableCell
                        key={label}
                        sx={{
                          bgcolor: "var(--sh-page-tint)",

                          color: "#617B6C",

                          fontSize: 10.5,

                          fontWeight: 800,

                          textTransform: "uppercase",

                          letterSpacing: ".05em",
                        }}
                      >
                        {label}
                      </TableCell>
                    ),
                  )}

                  <TableCell
                    align="right"
                    sx={{
                      bgcolor: "var(--sh-page-tint)",

                      color: "#617B6C",

                      fontSize: 10.5,

                      fontWeight: 800,

                      textTransform: "uppercase",
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredPromos.map((promo) => (
                  <TableRow key={promo.id} hover>
                    {/* PROMO */}

                    <TableCell>
                      <Stack direction="row" spacing={1.3} alignItems="center">
                        <Box
                          sx={{
                            width: 40,
                            height: 40,

                            flexShrink: 0,

                            display: "grid",

                            placeItems: "center",

                            bgcolor: "#FFF7ED",

                            color: "#EA580C",

                            borderRadius: 2.5,
                          }}
                        >
                          <LocalOfferRounded
                            sx={{
                              fontSize: 20,
                            }}
                          />
                        </Box>

                        <Box>
                          <Typography
                            sx={{
                              color: "#183D32",

                              fontSize: 13.5,

                              fontWeight: 800,
                            }}
                          >
                            {promo.title}
                          </Typography>

                          <Typography
                            sx={{
                              mt: 0.2,

                              maxWidth: 300,

                              overflow: "hidden",

                              textOverflow: "ellipsis",

                              whiteSpace: "nowrap",

                              color: "#839B8C",

                              fontSize: 11,
                            }}
                          >
                            {promo.description || "No description provided"}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    {/* DISCOUNT */}

                    <TableCell>
                      <Typography
                        sx={{
                          color: "#D97706",

                          fontSize: 14,

                          fontWeight: 900,
                        }}
                      >
                        {formatDiscount(promo)}
                      </Typography>
                    </TableCell>

                    {/* TYPE */}

                    <TableCell>
                      {getDiscountTypeChip(promo.discount_type)}
                    </TableCell>

                    {/* PERIOD */}

                    <TableCell>
                      <Box>
                        <Typography
                          sx={{
                            color: "#4C695A",

                            fontSize: 11.5,

                            fontWeight: 650,
                          }}
                        >
                          {formatShortDate(promo.start_date)}
                        </Typography>

                        <Typography
                          sx={{
                            color: "#839B8C",

                            fontSize: 10,
                          }}
                        >
                          to {formatShortDate(promo.end_date)}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* STATUS */}

                    <TableCell>{getStatusChip(promo)}</TableCell>

                    {/* ACTIONS */}

                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={0.7}
                        justifyContent="flex-end"
                      >
                        <Tooltip title="Edit promo">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(promo)}
                            sx={{
                              color: "#2563EB",

                              bgcolor: "#EFF6FF",

                              "&:hover": {
                                bgcolor: "#DBEAFE",
                              },
                            }}
                          >
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete promo">
                          <IconButton
                            size="small"
                            onClick={() => openDeleteDialog(promo)}
                            sx={{
                              color: "#DC2626",

                              bgcolor: "#FEF2F2",

                              "&:hover": {
                                bgcolor: "#FEE2E2",
                              },
                            }}
                          >
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* =====================================================
          ADD / EDIT PROMO DIALOG
      ====================================================== */}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="sm"
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
                "linear-gradient(135deg, #7C2D12 0%, #EA580C 55%, #F59E0B 100%)",
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 50,
                  height: 50,

                  display: "grid",

                  placeItems: "center",

                  bgcolor: "rgba(255,255,255,.13)",

                  border: "1px solid rgba(255,255,255,.15)",

                  borderRadius: 3,
                }}
              >
                <LocalOfferRounded />
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    fontSize: 20,
                    fontWeight: 850,
                  }}
                >
                  {editPromo ? "Edit Promotion" : "Create Promotion"}
                </Typography>

                <Typography
                  sx={{
                    mt: 0.3,

                    color: "rgba(255,255,255,.72)",

                    fontSize: 12,
                  }}
                >
                  {editPromo
                    ? "Update the promotion details and submit them for review."
                    : "Create a new store promotion for Admin approval."}
                </Typography>
              </Box>

              <IconButton
                onClick={closeDialog}
                disabled={saving}
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
          {/* BASIC INFO */}

          <Typography
            sx={{
              mb: 1.5,

              color: "#839B8C",

              fontSize: 10,

              fontWeight: 850,

              textTransform: "uppercase",

              letterSpacing: ".08em",
            }}
          >
            Promotion Details
          </Typography>

          <Stack spacing={2}>
            <TextField
              fullWidth
              required
              label="Promo Title"
              placeholder="e.g. Weekend Saver"
              value={formData.title}
              onChange={handleFieldChange("title")}
            />

            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Description"
              placeholder="Describe the promotion..."
              value={formData.description}
              onChange={handleFieldChange("description")}
            />

            <FormControl fullWidth>
              <InputLabel>Product picture</InputLabel>
              <Select
                value={formData.product_id}
                label="Product picture"
                onChange={handleFieldChange("product_id")}
              >
                <MenuItem value="">No linked product</MenuItem>
                {products.map(product => (
                  <MenuItem key={product.id} value={String(product.id)}>
                    {product.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Discount Type</InputLabel>

              <Select
                value={formData.discount_type}
                label="Discount Type"
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,

                    discount_type: event.target.value,

                    discount_value: "",
                  }))
                }
              >
                <MenuItem value="percentage">Percentage Discount</MenuItem>

                <MenuItem value="fixed">Fixed Amount</MenuItem>

                <MenuItem value="bundle">Bundle Deal</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              required={formData.discount_type !== "bundle"}
              type="number"
              label={
                formData.discount_type === "percentage"
                  ? "Discount Percentage"
                  : formData.discount_type === "fixed"
                    ? "Discount Amount"
                    : "Bundle Value (Optional)"
              }
              placeholder={
                formData.discount_type === "percentage"
                  ? "e.g. 10"
                  : formData.discount_type === "fixed"
                    ? "e.g. 50"
                    : "Optional value"
              }
              value={formData.discount_value}
              onChange={handleFieldChange("discount_value")}
              inputProps={{
                min: 0,

                max: formData.discount_type === "percentage" ? 100 : undefined,

                step: formData.discount_type === "percentage" ? 1 : 0.01,
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {formData.discount_type === "percentage" ? (
                      <PercentRounded
                        sx={{
                          color: "#839B8C",
                        }}
                      />
                    ) : formData.discount_type === "fixed" ? (
                      <Typography
                        sx={{
                          color: "#617B6C",

                          fontWeight: 800,
                        }}
                      >
                        ₱
                      </Typography>
                    ) : (
                      <LocalOfferRounded
                        sx={{
                          color: "#839B8C",
                        }}
                      />
                    )}
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          <Divider sx={{ my: 3 }} />

          {/* SCHEDULE */}

          <Typography
            sx={{
              mb: 1.5,

              color: "#839B8C",

              fontSize: 10,

              fontWeight: 850,

              textTransform: "uppercase",

              letterSpacing: ".08em",
            }}
          >
            Promotion Schedule
          </Typography>

          <Stack spacing={2}>
            <TextField
              fullWidth
              required
              type="datetime-local"
              label="Start Date"
              value={formData.start_date}
              onChange={handleFieldChange("start_date")}
              InputLabelProps={{
                shrink: true,
              }}
            />

            <TextField
              fullWidth
              required
              type="datetime-local"
              label="End Date"
              value={formData.end_date}
              onChange={handleFieldChange("end_date")}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Stack>

          {/* PREVIEW */}

          {formData.title && (
            <Paper
              elevation={0}
              sx={{
                mt: 3,

                p: 2.4,

                borderRadius: 4,

                bgcolor: "#FFF7ED",

                border: "1px solid #FED7AA",
              }}
            >
              <Stack direction="row" spacing={1.3} alignItems="flex-start">
                <Box
                  sx={{
                    width: 43,
                    height: 43,

                    flexShrink: 0,

                    display: "grid",

                    placeItems: "center",

                    bgcolor: "var(--sh-glass-bg)",

                    color: "#EA580C",

                    borderRadius: 2.5,
                  }}
                >
                  <LocalOfferRounded />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      color: "#9A3412",

                      fontSize: 10,

                      fontWeight: 850,

                      textTransform: "uppercase",

                      letterSpacing: ".07em",
                    }}
                  >
                    Promo Preview
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.35,

                      color: "#183D32",

                      fontSize: 15,

                      fontWeight: 850,
                    }}
                  >
                    {formData.title}
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.35,

                      color: "#EA580C",

                      fontSize: 16,

                      fontWeight: 900,
                    }}
                  >
                    {formData.discount_type === "percentage"
                      ? `${formData.discount_value || 0}% OFF`
                      : formData.discount_type === "fixed"
                        ? `₱${formData.discount_value || 0} OFF`
                        : "Bundle Deal"}
                  </Typography>

                  {formData.description && (
                    <Typography
                      sx={{
                        mt: 0.5,

                        color: "#617B6C",

                        fontSize: 11.5,

                        lineHeight: 1.6,
                      }}
                    >
                      {formData.description}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Paper>
          )}

          <Alert
            severity="info"
            sx={{
              mt: 2.5,
              borderRadius: 3,
            }}
          >
            {editPromo
              ? "Promo changes may require Admin approval before becoming active."
              : "New promotions are submitted for Admin approval before activation."}
          </Alert>
        </DialogContent>

        <DialogActions
          sx={{
            px: {
              xs: 2.5,
              sm: 3.5,
            },

            py: 2.5,

            borderTop: "1px solid #EDF3E8",
          }}
        >
          <Button
            onClick={closeDialog}
            disabled={saving}
            sx={{
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
            onClick={handleSave}
            disabled={saving}
            startIcon={
              saving ? null : editPromo ? <EditOutlined /> : <AddRounded />
            }
            sx={{
              minWidth: 180,

              minHeight: 44,

              bgcolor: "#EA580C",

              borderRadius: 3,

              textTransform: "none",

              fontWeight: 850,

              "&:hover": {
                bgcolor: "#C2410C",
              },
            }}
          >
            {saving ? (
              <>
                <CircularProgress
                  size={18}
                  sx={{
                    mr: 1,
                    color: "#FFFFFF",
                  }}
                />
                Saving...
              </>
            ) : editPromo ? (
              "Submit Update"
            ) : (
              "Submit for Approval"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================
          DELETE CONFIRMATION
      ====================================================== */}

      <Dialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
          },
        }}
      >
        <DialogContent
          sx={{
            pt: 4,
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,

              mx: "auto",

              mb: 2,

              display: "grid",

              placeItems: "center",

              bgcolor: "#FEF2F2",

              color: "#DC2626",

              borderRadius: 4,
            }}
          >
            <DeleteOutlineRounded
              sx={{
                fontSize: 31,
              }}
            />
          </Box>

          <Typography
            sx={{
              color: "#183D32",

              fontSize: 18,

              fontWeight: 850,
            }}
          >
            Delete Promotion?
          </Typography>

          <Typography
            sx={{
              mt: 1,

              color: "#617B6C",

              fontSize: 13,

              lineHeight: 1.6,
            }}
          >
            Are you sure you want to delete{" "}
            <strong>{promoToDelete?.title}</strong>? This action may not be
            reversible.
          </Typography>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 3,
          }}
        >
          <Button
            fullWidth
            disabled={deleting}
            onClick={closeDeleteDialog}
            sx={{
              color: "#617B6C",

              borderRadius: 3,

              textTransform: "none",

              fontWeight: 700,
            }}
          >
            Cancel
          </Button>

          <Button
            fullWidth
            variant="contained"
            color="error"
            disabled={deleting}
            onClick={handleDelete}
            sx={{
              borderRadius: 3,

              textTransform: "none",

              fontWeight: 800,
            }}
          >
            {deleting ? (
              <CircularProgress size={19} color="inherit" />
            ) : (
              "Delete Promo"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PromoManagement;
