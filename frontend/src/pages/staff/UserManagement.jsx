import React, { useEffect, useRef, useState } from "react";

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
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  AddRounded,
  BadgeOutlined,
  CancelRounded,
  CheckCircleRounded,
  ContentCopyRounded,
  EmailOutlined,
  HomeOutlined,
  Inventory2Outlined,
  PersonAddAlt1Rounded,
  PersonOutlineRounded,
  PhoneOutlined,
  RefreshRounded,
  ScheduleRounded,
  SecurityRounded,
  StorefrontRounded,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import API from "../../api/accountAdmin";
import { colors } from "../../theme";

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  birthdate: "",
  gender: "",
  address: "",
  phone: "",
  contract_details: "",
};

const UserManagement = () => {
  const [tabValue, setTabValue] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState(INITIAL_FORM);

  const [alert, setAlert] = useState({
    show: false,
    message: "",
    severity: "success",
  });

  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [createdAccounts, setCreatedAccounts] = useState([]);

  // Additive: staff password reset request (needs admin approval)
  const [resetRequestLoadingId, setResetRequestLoadingId] = useState(null);

  const [showPassword, setShowPassword] = useState(false);

  const credentialsTimerRef = useRef(null);
  const alertTimerRef = useRef(null);

  const isClient = tabValue === 0;

  useEffect(() => {
    fetchCreatedAccounts();

    return () => {
      if (credentialsTimerRef.current) {
        clearTimeout(credentialsTimerRef.current);
      }

      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  const fetchCreatedAccounts = async () => {
    setAccountsLoading(true);

    try {
      const response = await API.get("/users/my-created");

      setCreatedAccounts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to fetch created accounts:", error);

      showAlert(
        error?.response?.data?.message || "Unable to load created accounts.",
        "error",
      );
    } finally {
      setAccountsLoading(false);
    }
  };

  const showAlert = (message, severity = "success") => {
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
    }, 5000);
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setShowPassword(false);
  };

  const handleFieldChange = (field) => (event) => {
    setFormData((previous) => ({
      ...previous,
      [field]: event.target.value,
    }));
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);

    setCreatedCredentials(null);
    setDialogOpen(false);

    resetForm();

    if (credentialsTimerRef.current) {
      clearTimeout(credentialsTimerRef.current);
      credentialsTimerRef.current = null;
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  // Additive: submit a password reset request for admin approval
  const handleRequestPasswordReset = async (account) => {
    if (!account?.id) return;
    if (
      !window.confirm(
        `Request a password reset for ${account.name} (${account.user_id || `#${account.id}`})?\n\nThis needs admin approval. Once approved, a temporary password will be generated and the user must change it on next login.`
      )
    ) {
      return;
    }

    setResetRequestLoadingId(account.id);

    try {
      const response = await API.post(`/users/${account.id}/request-password-reset`);
      showAlert(response.data?.message || "Password reset request submitted for admin approval.");
    } catch (error) {
      showAlert(
        error?.response?.data?.message || "Failed to submit password reset request.",
        "error",
      );
    } finally {
      setResetRequestLoadingId(null);
    }
  };

  const closeCreateDialog = () => {
    if (loading) return;

    setDialogOpen(false);
    setCreatedCredentials(null);
    resetForm();
  };

  const validateForm = () => {
    if (!formData.first_name.trim()) {
      return "First name is required.";
    }

    if (!formData.last_name.trim()) {
      return "Last name is required.";
    }

    if (!formData.email.trim()) {
      return "Email address is required.";
    }

    if (!/\S+@\S+\.\S+/.test(formData.email.trim())) {
      return "Please enter a valid email address.";
    }

    if (!formData.password) {
      return "Password is required.";
    }

    if (formData.password.length < 6) {
      return "Password must contain at least 6 characters.";
    }

    return null;
  };

  const handleCreate = async () => {
    const validationError = validateForm();

    if (validationError) {
      showAlert(validationError, "error");
      return;
    }

    setLoading(true);

    try {
      const clientMode = tabValue === 0;

      const fullName = `${formData.first_name.trim()} ${
        formData.middle_name.trim() ? `${formData.middle_name.trim()} ` : ""
      }${formData.last_name.trim()}`.trim();

      const payload = {
        ...formData,
        name: fullName,
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        contract_details: formData.contract_details.trim(),
      };

      const endpoint = clientMode ? "/users" : "/users/staff";

      const response = await API.post(endpoint, payload);

      const credentials = {
        ...response.data.credentials,
        name: fullName,
        user_id: response.data.user_id,
        role: clientMode ? "client" : "staff",
        status: clientMode ? "active" : "pending",
      };

      setCreatedCredentials(credentials);

      if (credentialsTimerRef.current) {
        clearTimeout(credentialsTimerRef.current);
      }

      credentialsTimerRef.current = setTimeout(() => {
        setCreatedCredentials(null);
      }, 10000);

      showAlert(
        clientMode
          ? "Client account created successfully."
          : "Staff account created successfully and is pending Admin approval.",
      );

      setDialogOpen(false);

      resetForm();

      await fetchCreatedAccounts();
    } catch (error) {
      console.error("Failed to create account:", error);

      showAlert(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to create account.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = async () => {
    if (!createdCredentials) return;

    const text = [
      `Account ID: ${createdCredentials.user_id || ""}`,
      `Name: ${createdCredentials.name || ""}`,
      `Email: ${createdCredentials.email || ""}`,
      `Password: ${createdCredentials.password || ""}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);

      showAlert("Credentials copied to clipboard.");
    } catch {
      showAlert("Unable to copy credentials.", "error");
    }
  };

  const getStatusChip = (status) => {
    const normalizedStatus = String(status || "").toLowerCase();

    if (normalizedStatus === "active") {
      return (
        <Chip
          icon={<CheckCircleRounded />}
          label="Active"
          size="small"
          sx={{
            bgcolor: "#D8F3E5",
            color: "#047857",
            border: "1px solid #D1FAE5",
            fontWeight: 700,
          }}
        />
      );
    }

    if (normalizedStatus === "pending") {
      return (
        <Chip
          icon={<ScheduleRounded />}
          label="Pending"
          size="small"
          sx={{
            bgcolor: "#FFFBEB",
            color: "#B45309",
            border: "1px solid #FDE68A",
            fontWeight: 700,
          }}
        />
      );
    }

    if (normalizedStatus === "suspended") {
      return (
        <Chip
          icon={<CancelRounded />}
          label="Suspended"
          size="small"
          sx={{
            bgcolor: "#FFF1F2",
            color: "#BE123C",
            border: "1px solid #FECDD3",
            fontWeight: 700,
          }}
        />
      );
    }

    return (
      <Chip
        icon={<CancelRounded />}
        label="Rejected"
        size="small"
        sx={{
          bgcolor: "#FEF2F2",
          color: "#B91C1C",
          border: "1px solid #FECACA",
          fontWeight: 700,
        }}
      />
    );
  };

  const getRoleChip = (role) => {
    const normalizedRole = String(role || "").toLowerCase();

    const clientRole = normalizedRole === "client" || normalizedRole === "user";

    return (
      <Chip
        icon={clientRole ? <PersonOutlineRounded /> : <BadgeOutlined />}
        label={clientRole ? "Client" : "Staff"}
        size="small"
        sx={{
          bgcolor: clientRole ? "#D8F3E5" : "#EFF6FF",
          color: clientRole ? "#047857" : "#1D4ED8",
          border: `1px solid ${clientRole ? "#D1FAE5" : "#DBEAFE"}`,
          fontWeight: 700,
        }}
      />
    );
  };

  const clientCount = createdAccounts.filter((account) => {
    const role = String(account.role || "").toLowerCase();

    return role === "client" || role === "user";
  }).length;

  const staffCount = createdAccounts.filter(
    (account) => String(account.role || "").toLowerCase() === "staff",
  ).length;

  const pendingCount = createdAccounts.filter(
    (account) => String(account.status || "").toLowerCase() === "pending",
  ).length;

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
      {/* HEADER */}
      <Box
        sx={{
          mb: 3.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: {
            xs: "stretch",
            md: "center",
          },
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
            User Management
          </Typography>

          <Typography
            sx={{
              mt: 0.8,
              color: "#617B6C",
              fontSize: 14,
            }}
          >
            Create and manage Client and Staff accounts.
          </Typography>
        </Box>

        <Stack
          direction="row"
          spacing={1.3}
          sx={{
            flexWrap: "wrap",
          }}
        >
          <Tooltip title="Refresh accounts">
            <IconButton
              onClick={fetchCreatedAccounts}
              disabled={accountsLoading}
              sx={{
                width: 46,
                height: 46,
                bgcolor: "var(--sh-glass-bg)",
                border: "1px solid #D5E5D9",

                "&:hover": {
                  bgcolor: "var(--sh-page-tint)",
                },
              }}
            >
              <RefreshRounded />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={isClient ? <PersonAddAlt1Rounded /> : <BadgeOutlined />}
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
              },
            }}
          >
            {isClient ? "Create Client" : "Create Staff"}
          </Button>
        </Stack>
      </Box>

      {/* STATS */}
      <Grid container spacing={2.2} sx={{ mb: 3 }}>
        {[
          {
            label: "Accounts Created",
            value: createdAccounts.length,
            icon: <StorefrontRounded />,
            color: "#047857",
            background: "#D8F3E5",
          },
          {
            label: "Clients",
            value: clientCount,
            icon: <PersonOutlineRounded />,
            color: "#059669",
            background: "#F0FDF4",
          },
          {
            label: "Staff",
            value: staffCount,
            icon: <BadgeOutlined />,
            color: "#2563EB",
            background: "#EFF6FF",
          },
          {
            label: "Pending Approval",
            value: pendingCount,
            icon: <ScheduleRounded />,
            color: "#D97706",
            background: "#FFFBEB",
          },
        ].map((item) => (
          <Grid item xs={12} sm={6} lg={3} key={item.label}>
            <Paper
              elevation={0}
              sx={{
                p: 2.4,
                height: "100%",
                borderRadius: 4,
                border: "1px solid #D5E5D9",
                bgcolor: "var(--sh-glass-bg)",
                transition: "all .2s ease",

                "&:hover": {
                  transform: "translateY(-3px)",
                  boxShadow: "0 14px 35px rgba(24,61,50,.06)",
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 3,
                    color: item.color,
                    bgcolor: item.background,
                  }}
                >
                  {item.icon}
                </Box>

                <Box>
                  <Typography
                    sx={{
                      color: "#617B6C",
                      fontSize: 12,
                      fontWeight: 650,
                    }}
                  >
                    {item.label}
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.2,
                      color: "#183D32",
                      fontSize: 24,
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

      {/* TABS */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          overflow: "hidden",
          borderRadius: 4,
          border: "1px solid #D5E5D9",
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            borderBottom: "1px solid #EDF3E8",

            "& .MuiTab-root": {
              py: 2,
              minHeight: 64,
              color: "#617B6C",
              fontWeight: 750,
              textTransform: "none",
            },

            "& .Mui-selected": {
              color: "#047857 !important",
            },

            "& .MuiTabs-indicator": {
              height: 3,
              bgcolor: "#059669",
            },
          }}
        >
          <Tab
            icon={<PersonAddAlt1Rounded />}
            iconPosition="start"
            label="Client Accounts"
          />

          <Tab
            icon={<BadgeOutlined />}
            iconPosition="start"
            label="Staff Accounts"
          />
        </Tabs>

        <Box
          sx={{
            p: {
              xs: 3,
              md: 4,
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: {
                xs: "column",
                md: "row",
              },
              alignItems: {
                xs: "flex-start",
                md: "center",
              },
              justifyContent: "space-between",
              gap: 3,
            }}
          >
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box
                sx={{
                  flexShrink: 0,
                  width: 62,
                  height: 62,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 4,

                  bgcolor: isClient ? "#D8F3E5" : "#EFF6FF",

                  color: isClient ? "#059669" : "#2563EB",
                }}
              >
                {isClient ? (
                  <PersonAddAlt1Rounded sx={{ fontSize: 32 }} />
                ) : (
                  <BadgeOutlined sx={{ fontSize: 32 }} />
                )}
              </Box>

              <Box>
                <Typography
                  sx={{
                    color: "#183D32",
                    fontSize: 18,
                    fontWeight: 850,
                  }}
                >
                  {isClient
                    ? "Create Client Accounts"
                    : "Create Staff Accounts"}
                </Typography>

                <Typography
                  sx={{
                    mt: 0.8,
                    maxWidth: 650,
                    color: "#617B6C",
                    fontSize: 13.5,
                    lineHeight: 1.7,
                  }}
                >
                  {isClient
                    ? "Client accounts created here are immediately active. These accounts can be created for walk-in customers and their credentials can be handed directly to them."
                    : "Staff accounts created here are placed under Pending status. The Administrator must approve the account before the staff member can sign in."}
                </Typography>
              </Box>
            </Stack>

            <Button
              variant="outlined"
              startIcon={<AddRounded />}
              onClick={openCreateDialog}
              sx={{
                flexShrink: 0,
                minHeight: 44,
                px: 2.2,
                borderRadius: 3,
                color: "#047857",
                borderColor: "#A7D7C6",
                textTransform: "none",
                fontWeight: 750,

                "&:hover": {
                  bgcolor: "#F0FDF4",
                  borderColor: "#059669",
                },
              }}
            >
              {isClient ? "New Client" : "New Staff"}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* CREATED CREDENTIALS */}
      {createdCredentials && (
        <Paper
          elevation={0}
          sx={{
            p: {
              xs: 2.5,
              md: 3,
            },
            mb: 3,
            borderRadius: 4,
            bgcolor: "#F0FDF4",
            border: "1px solid #A7F3D0",
          }}
        >
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{
              xs: "flex-start",
              sm: "center",
            }}
            sx={{ mb: 2.3 }}
          >
            <Stack direction="row" spacing={1.2} alignItems="center">
              <CheckCircleRounded
                sx={{
                  color: "#059669",
                }}
              />

              <Box>
                <Typography
                  sx={{
                    color: "#065F46",
                    fontSize: 17,
                    fontWeight: 850,
                  }}
                >
                  Account Created Successfully
                </Typography>

                <Typography
                  sx={{
                    color: "#617B6C",
                    fontSize: 12,
                  }}
                >
                  Copy and securely provide these credentials to the account
                  owner.
                </Typography>
              </Box>
            </Stack>

            {getStatusChip(createdCredentials.status)}
          </Stack>

          <Grid container spacing={2}>
            {[
              {
                label: "Account ID",
                value: createdCredentials.user_id || "—",
              },
              {
                label: "Name",
                value: createdCredentials.name || "—",
              },
              {
                label: "Email",
                value: createdCredentials.email || "—",
              },
              {
                label: "Temporary Password",
                value: createdCredentials.password || "—",
              },
            ].map((item) => (
              <Grid item xs={12} sm={6} key={item.label}>
                <Box
                  sx={{
                    p: 1.8,
                    bgcolor: "var(--sh-glass-bg)",
                    borderRadius: 3,
                    border: "1px solid #D1FAE5",
                  }}
                >
                  <Typography
                    sx={{
                      color: "#839B8C",
                      fontSize: 10.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                    }}
                  >
                    {item.label}
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.5,
                      color: "#183D32",
                      fontSize: 14,
                      fontWeight: 750,
                      wordBreak: "break-word",
                      fontFamily:
                        item.label === "Account ID" ||
                        item.label === "Temporary Password"
                          ? "monospace"
                          : "inherit",
                    }}
                  >
                    {item.value}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Button
            startIcon={<ContentCopyRounded />}
            onClick={copyCredentials}
            sx={{
              mt: 2.3,
              bgcolor: "#047857",
              color: "#FFFFFF",
              borderRadius: 3,
              px: 2.2,
              textTransform: "none",
              fontWeight: 800,

              "&:hover": {
                bgcolor: "#065F46",
              },
            }}
          >
            Copy Credentials
          </Button>
        </Paper>
      )}

      {/* ACCOUNT TABLE */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          border: "1px solid #D5E5D9",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: {
              xs: 2.5,
              md: 3,
            },
            py: 2.5,
            borderBottom: "1px solid #EDF3E8",
          }}
        >
          <Typography
            sx={{
              color: "#183D32",
              fontSize: 17,
              fontWeight: 850,
            }}
          >
            Accounts Created by You
          </Typography>

          <Typography
            sx={{
              mt: 0.4,
              color: "#839B8C",
              fontSize: 12,
            }}
          >
            Review all Client and Staff accounts you created.
          </Typography>
        </Box>

        {accountsLoading ? (
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
              size={34}
              sx={{
                color: "#059669",
              }}
            />

            <Typography
              sx={{
                color: "#617B6C",
                fontSize: 12.5,
              }}
            >
              Loading accounts...
            </Typography>
          </Box>
        ) : createdAccounts.length === 0 ? (
          <Box
            sx={{
              py: 7,
              px: 3,
              textAlign: "center",
            }}
          >
            <Inventory2Outlined
              sx={{
                mb: 1.5,
                color: "#CBD5E1",
                fontSize: 58,
              }}
            />

            <Typography
              sx={{
                color: "#365C4B",
                fontWeight: 750,
              }}
            >
              No accounts created yet
            </Typography>

            <Typography
              sx={{
                mt: 0.5,
                color: "#839B8C",
                fontSize: 12,
              }}
            >
              Create your first Client or Staff account.
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
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  borderBottom: "1px solid #D5E5D9",
                },

                "& td": {
                  borderBottom: "1px solid #EDF3E8",
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Account ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  {/* Additive: staff password reset request */}
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {createdAccounts.map((account) => (
                  <TableRow
                    key={account.id}
                    hover
                    sx={{
                      "&:last-child td": {
                        borderBottom: 0,
                      },
                    }}
                  >
                    <TableCell>
                      <Typography
                        sx={{
                          color: "#183D32",
                          fontFamily: "monospace",
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        {account.user_id || `#${account.id}`}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography
                        sx={{
                          color: "#365C4B",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {account.name || "—"}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography
                        sx={{
                          color: "#617B6C",
                          fontSize: 12.5,
                        }}
                      >
                        {account.email || "—"}
                      </Typography>
                    </TableCell>

                    <TableCell>{getRoleChip(account.role)}</TableCell>

                    <TableCell>{getStatusChip(account.status)}</TableCell>

                    <TableCell>
                      <Typography
                        sx={{
                          color: "#617B6C",
                          fontSize: 12.5,
                        }}
                      >
                        {account.created_at
                          ? new Date(account.created_at).toLocaleDateString(
                              "en-PH",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "—"}
                      </Typography>
                    </TableCell>

                    {/* Additive: request password reset (needs admin approval) */}
                    <TableCell align="right">
                      {String(account.role || "").toLowerCase() !== "admin" && (
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<SecurityRounded />}
                          onClick={() => handleRequestPasswordReset(account)}
                          disabled={resetRequestLoadingId === account.id}
                          sx={{
                            color: "#087F5B",
                            fontWeight: 700,
                            fontSize: 12,
                            textTransform: "none",
                            "&:hover": { bgcolor: "rgba(8,127,91,.08)" },
                          }}
                        >
                          {resetRequestLoadingId === account.id ? "Sending..." : "Request Reset"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* CREATE DIALOG */}
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
        <DialogTitle
          sx={{
            p: 0,
          }}
        >
          <Box
            sx={{
              p: {
                xs: 2.5,
                sm: 3,
              },
              color: "#FFFFFF",
              background: isClient
                ? "linear-gradient(135deg, #064E3B, #059669)"
                : "linear-gradient(135deg, #1E3A8A, #2563EB)",
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "rgba(255,255,255,.12)",
                  borderRadius: 3,
                  border: "1px solid rgba(255,255,255,.15)",
                }}
              >
                {isClient ? <PersonAddAlt1Rounded /> : <BadgeOutlined />}
              </Box>

              <Box>
                <Typography
                  sx={{
                    fontSize: 20,
                    fontWeight: 850,
                  }}
                >
                  {isClient ? "Create Client Account" : "Create Staff Account"}
                </Typography>

                <Typography
                  sx={{
                    mt: 0.3,
                    color: "rgba(255,255,255,.7)",
                    fontSize: 12,
                  }}
                >
                  {isClient
                    ? "Create an active account for a walk-in Client."
                    : "Create a Staff account for Admin approval."}
                </Typography>
              </Box>
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
          }}
        >
          <Typography
            sx={{
              mb: 2,
              color: "#839B8C",
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            Personal Information
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                required
                label="First Name"
                value={formData.first_name}
                onChange={handleFieldChange("first_name")}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Middle Name"
                value={formData.middle_name}
                onChange={handleFieldChange("middle_name")}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                required
                label="Last Name"
                value={formData.last_name}
                onChange={handleFieldChange("last_name")}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Birthdate"
                value={formData.birthdate}
                onChange={handleFieldChange("birthdate")}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Gender"
                value={formData.gender}
                onChange={handleFieldChange("gender")}
              >
                <MenuItem value="">Prefer not to say</MenuItem>

                <MenuItem value="male">Male</MenuItem>

                <MenuItem value="female">Female</MenuItem>

                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={formData.address}
                onChange={handleFieldChange("address")}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <HomeOutlined />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                placeholder="09XXXXXXXXX"
                value={formData.phone}
                onChange={handleFieldChange("phone")}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneOutlined />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                type="email"
                label="Email Address"
                value={formData.email}
                onChange={handleFieldChange("email")}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Typography
            sx={{
              mb: 2,
              color: "#839B8C",
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            Account Security
          </Typography>

          <TextField
            fullWidth
            required
            label="Temporary Password"
            type={showPassword ? "text" : "password"}
            value={formData.password}
            onChange={handleFieldChange("password")}
            helperText="Minimum 6 characters"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SecurityRounded />
                </InputAdornment>
              ),

              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    edge="end"
                    onClick={() => setShowPassword((previous) => !previous)}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {!isClient && (
            <>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Contract Details"
                placeholder="Optional employment or contract information..."
                value={formData.contract_details}
                onChange={handleFieldChange("contract_details")}
                sx={{ mt: 2 }}
              />

              <Alert
                severity="info"
                sx={{
                  mt: 2,
                  borderRadius: 3,
                }}
              >
                The Staff account will start as
                <strong> Pending</strong>. An Admin must approve it before the
                Staff member can log in.
              </Alert>
            </>
          )}

          {isClient && (
            <Alert
              severity="success"
              sx={{
                mt: 2,
                borderRadius: 3,
              }}
            >
              Client accounts created here will be immediately active.
            </Alert>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: {
              xs: 2.5,
              sm: 3.5,
            },
            pb: 3,
            pt: 0,
          }}
        >
          <Button
            onClick={closeCreateDialog}
            disabled={loading}
            sx={{
              minWidth: 100,
              borderRadius: 3,
              textTransform: "none",
              fontWeight: 700,
              color: "#617B6C",
            }}
          >
            Cancel
          </Button>

          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={loading}
            startIcon={loading ? null : <AddRounded />}
            sx={{
              minWidth: 160,
              minHeight: 44,
              borderRadius: 3,
              bgcolor: isClient ? "#047857" : "#2563EB",
              textTransform: "none",
              fontWeight: 800,

              "&:hover": {
                bgcolor: isClient ? "#065F46" : "#1D4ED8",
              },
            }}
          >
            {loading ? (
              <>
                <CircularProgress
                  size={19}
                  sx={{
                    color: "#FFFFFF",
                    mr: 1,
                  }}
                />
                Creating...
              </>
            ) : isClient ? (
              "Create Client"
            ) : (
              "Create Staff"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;
