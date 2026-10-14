import React, { useState, useEffect } from "react";

import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Chip,
  Alert,
  Modal,
  Divider,
  Grid,
  Card,
  Avatar,
  IconButton,
  Tooltip,
} from "@mui/material";

import {
  Edit,
  Block,
  Badge,
  Person,
  AdminPanelSettings,
  CheckCircle,
  Cancel,
  Close,
  Visibility,
  LockReset,
  Add,
} from "@mui/icons-material";

import API from "../../api/axios";
import { colors } from "../../theme";

const AccountManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    role: "client",
    status: "active",
    contact_number: "",
    address: "",
    birthdate: "",
    gender: "",
    contract_details: "",
  });

  const [alert, setAlert] = useState({
    show: false,
    message: "",
    severity: "success",
  });

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [resetState, setResetState] = useState({
    open: false,
    user: null,
    loading: false,
    credentials: null,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  /* =========================================================
     DATA
  ========================================================= */

  const fetchUsers = async () => {
    try {
      const response = await API.get("/users");
      setUsers(response.data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditUser(user);

      setFormData({
        first_name:
          user.first_name || (user.name ? user.name.split(" ")[0] : ""),

        middle_name:
          user.middle_name ||
          (user.name && user.name.split(" ").length > 2
            ? user.name.split(" ").slice(1, -1).join(" ")
            : ""),

        last_name:
          user.last_name ||
          (user.name ? user.name.split(" ").slice(1).join(" ") : ""),

        email: user.email,
        role: user.role,
        status: user.status,
        contact_number: user.contact_number || "",
        address: user.address || "",
        birthdate: user.birthdate ? String(user.birthdate).split("T")[0] : "",
        gender: user.gender || "",
        contract_details: user.contract_details || "",
      });
    } else {
      setEditUser(null);

      setFormData({
        first_name: "",
        middle_name: "",
        last_name: "",
        email: "",
        role: "client",
        status: "active",
        contact_number: "",
        address: "",
        birthdate: "",
        gender: "",
        contract_details: "",
      });
    }

    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        name: [formData.first_name, formData.middle_name, formData.last_name]
          .filter(Boolean)
          .join(" "),
      };

      if (editUser) {
        await API.put(`/users/${editUser.id}`, payload);

        showAlert("User updated successfully!");
      } else {
        const endpoint = formData.role === "staff" ? "/users/staff" : "/users";

        await API.post(endpoint, payload);

        showAlert("User created successfully!");
      }

      setDialogOpen(false);
      fetchUsers();
    } catch (error) {
      showAlert(
        error.response?.data?.message || "Failed to save user.",
        "error",
      );
    }
  };

  const handleApprove = async (id) => {
    try {
      await API.put(`/users/${id}/approve`);

      showAlert("User approved successfully!");
      fetchUsers();
    } catch (error) {
      showAlert(
        error.response?.data?.message || "Failed to approve user.",
        "error",
      );
    }
  };

  const handleReject = async (id) => {
    try {
      await API.put(`/users/${id}/reject`);

      showAlert("User rejected successfully.");
      fetchUsers();
    } catch (error) {
      showAlert(
        error.response?.data?.message || "Failed to reject user.",
        "error",
      );
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this user?")) {
      return;
    }

    try {
      await API.put(`/users/${id}/deactivate`);

      showAlert("User deactivated successfully!");
      fetchUsers();
    } catch (error) {
      showAlert(
        error.response?.data?.message || "Failed to deactivate user.",
        "error",
      );
    }
  };

  const showAlert = (message, severity = "success") => {
    setAlert({
      show: true,
      message,
      severity,
    });

    setTimeout(() => {
      setAlert({
        show: false,
        message: "",
        severity: "success",
      });
    }, 3000);
  };

  const handleOpenDetails = (user) => {
    setSelectedUser(user);
    setDetailsOpen(true);
  };

  const handleOpenReset = (user) => {
    setResetState({
      open: true,
      user,
      loading: false,
      credentials: null,
    });
  };

  const handleCloseReset = () => {
    setResetState({
      open: false,
      user: null,
      loading: false,
      credentials: null,
    });
  };

  const handleResetPassword = async () => {
    if (!resetState.user) return;

    setResetState((prev) => ({
      ...prev,
      loading: true,
    }));

    try {
      const response = await API.put(
        `/users/${resetState.user.id}/reset-password`,
      );

      setResetState((prev) => ({
        ...prev,
        loading: false,
        credentials: response.data.credentials,
      }));

      fetchUsers();
    } catch (error) {
      showAlert(
        error.response?.data?.message || "Failed to reset password.",
        "error",
      );

      setResetState((prev) => ({
        ...prev,
        loading: false,
      }));
    }
  };

  /* =========================================================
     UI HELPERS
  ========================================================= */

  const getRoleChip = (role) => {
    const commonSx = {
      height: 27,
      fontWeight: 700,
      fontSize: "0.72rem",
      textTransform: "capitalize",

      "& .MuiChip-icon": {
        fontSize: 16,
      },
    };

    if (role === "admin") {
      return (
        <Chip
          icon={<AdminPanelSettings />}
          label="Admin"
          size="small"
          sx={{
            ...commonSx,
            bgcolor: "#FEF2F2",
            color: "#B91C1C",
            border: "1px solid #FECACA",
          }}
        />
      );
    }

    if (role === "staff") {
      return (
        <Chip
          icon={<Badge />}
          label="Staff"
          size="small"
          sx={{
            ...commonSx,
            bgcolor: "#FFFBEB",
            color: "#B45309",
            border: "1px solid #FDE68A",
          }}
        />
      );
    }

    return (
      <Chip
        icon={<Person />}
        label="Client"
        size="small"
        sx={{
          ...commonSx,
          bgcolor: "#EFF6FF",
          color: "#1D4ED8",
          border: "1px solid #BFDBFE",
        }}
      />
    );
  };

  const getStatusChip = (status) => {
    const styles = {
      active: {
        bgcolor: "#D8F3E5",
        color: "#047857",
        border: "#A7F3D0",
      },

      pending: {
        bgcolor: "#FFFBEB",
        color: "#B45309",
        border: "#FDE68A",
      },

      rejected: {
        bgcolor: "#FEF2F2",
        color: "#B91C1C",
        border: "#FECACA",
      },
    };

    const style = styles[status] || {
      bgcolor: "var(--sh-page-tint)",
      color: "#6B817C",
      border: "#DCEBE7",
    };

    return (
      <Chip
        label={status}
        size="small"
        sx={{
          height: 27,
          px: 0.2,
          bgcolor: style.bgcolor,
          color: style.color,
          border: `1px solid ${style.border}`,
          fontWeight: 700,
          fontSize: "0.72rem",
          textTransform: "capitalize",
        }}
      />
    );
  };

  const actionButtonSx = {
    height: 31,

    minWidth: "auto",

    px: 1.05,
    py: 0,

    borderRadius: "8px",

    textTransform: "none",

    fontSize: "0.72rem",

    fontWeight: 700,

    whiteSpace: "nowrap",

    lineHeight: 1,

    "& .MuiButton-startIcon": {
      mr: 0.45,

      "& svg": {
        fontSize: 16,
      },
    },
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "10px",
      fontSize: "0.88rem",
    },

    "& .MuiInputLabel-root": {
      fontSize: "0.88rem",
    },
  };

  const sectionLabelSx = {
    mb: 1.4,

    color: "#58736C",

    fontSize: "0.72rem",

    fontWeight: 800,

    letterSpacing: "0.07em",

    textTransform: "uppercase",
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: 400,

          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress
          size={42}
          thickness={3.5}
          sx={{
            color: colors.primary,
          }}
        />
      </Box>
    );
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <Box
      className="page-container"
      sx={{
        width: "100%",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 8% 5%, rgba(200,238,217,.18), transparent 24%), linear-gradient(180deg, #FBFFFD 0%, #EFF5E7 100%)",

        maxWidth: 1600,

        mx: "auto",

        px: {
          xs: 1.5,
          sm: 2,
          lg: 2.5,
        },

        py: {
          xs: 1.5,
          md: 2,
        },
      }}
    >
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <Box
        sx={{
          mb: 2.5,

          display: "flex",

          flexDirection: {
            xs: "column",
            sm: "row",
          },

          alignItems: {
            xs: "stretch",
            sm: "center",
          },

          justifyContent: "space-between",

          gap: 1.5,
        }}
      >
        <Box>
          <Typography
            className="page-title"
            sx={{
              color: "#173F3A",

              fontSize: {
                xs: "1.55rem",
                md: "1.8rem",
              },

              lineHeight: 1.2,

              fontWeight: 800,

              letterSpacing: "-0.025em",
            }}
          >
            Account Management
          </Typography>

          <Typography
            sx={{
              mt: 0.45,

              color: "#6B817C",

              fontSize: "0.82rem",

              lineHeight: 1.5,
            }}
          >
            Manage client and staff accounts, roles, and account status.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog(null)}
          sx={{
            minHeight: 40,

            px: 2,

            alignSelf: {
              xs: "flex-start",
              sm: "center",
            },

            borderRadius: "10px",

            bgcolor: colors.primary,

            textTransform: "none",

            fontSize: "0.82rem",

            fontWeight: 750,

            boxShadow: "0 5px 14px rgba(6,102,73,0.16)",

            "&:hover": {
              bgcolor: "#07543E",

              boxShadow: "0 7px 18px rgba(6,102,73,0.20)",
            },
          }}
        >
          Create Account
        </Button>
      </Box>

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <Grid
        container
        spacing={1.5}
        sx={{
          mb: 2.5,
        }}
      >
        {[
          {
            label: "Total Accounts",
            value: users.length,
            background: "linear-gradient(135deg, #066649, #27AE80)",
          },
          {
            label: "Active",
            value: users.filter((user) => user.status === "active").length,
            background: "linear-gradient(135deg, #15806F, #34C6A8)",
          },
          {
            label: "Pending",
            value: users.filter((user) => user.status === "pending").length,
            background: "linear-gradient(135deg, #D6A34A, #F2C66D)",
          },
          {
            label: "Rejected",
            value: users.filter((user) => user.status === "rejected").length,
            background: "linear-gradient(135deg, #C96A6A, #E89A8F)",
          },
        ].map((item) => (
          <Grid item xs={6} sm={6} md={3} key={item.label}>
            <Card
              sx={{
                minHeight: 86,

                px: 2,
                py: 1.6,

                display: "flex",
                flexDirection: "column",
                justifyContent: "center",

                color: "#FFFFFF",

                background: item.background,

                borderRadius: "18px",

                boxShadow: "0 12px 30px rgba(17,94,89,0.08)",
              }}
            >
              <Typography
                sx={{
                  color: "rgba(255,255,255,0.78)",

                  fontSize: "0.72rem",

                  fontWeight: 600,
                }}
              >
                {item.label}
              </Typography>

              <Typography
                sx={{
                  mt: 0.25,

                  fontSize: "1.45rem",

                  fontWeight: 800,

                  lineHeight: 1.15,
                }}
              >
                {item.value}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* =====================================================
          ALERT
      ===================================================== */}

      {alert.show && (
        <Alert
          severity={alert.severity}
          sx={{
            mb: 2,

            py: 0.25,

            borderRadius: "10px",

            fontSize: "0.82rem",
          }}
        >
          {alert.message}
        </Alert>
      )}

      {/* =====================================================
          TABLE
      ===================================================== */}

      <TableContainer
        component={Paper}
        sx={{
          borderRadius: "14px",

          border: "1px solid #E8EEF2",

          boxShadow: "0 5px 18px rgba(17,94,89,0.05)",

          overflow: "auto",
        }}
      >
        <Table
          size="small"
          sx={{
            minWidth: 1040,
          }}
        >
          <TableHead>
            <TableRow
              sx={{
                bgcolor: "var(--sh-page-tint)",

                "& th": {
                  py: 1.25,

                  px: 1.5,

                  color: "#58736C",

                  borderBottom: "1px solid #D5E5D9",

                  fontSize: "0.68rem",

                  fontWeight: 800,

                  letterSpacing: "0.045em",

                  textTransform: "uppercase",

                  whiteSpace: "nowrap",
                },
              }}
            >
              <TableCell>User ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>

              <TableCell
                align="right"
                sx={{
                  minWidth: 390,
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                sx={{
                  transition: "background-color .15s ease",

                  "&:hover": {
                    bgcolor: "#F8FDFB",
                  },

                  "& td": {
                    py: 1.05,
                    px: 1.5,

                    borderBottom: "1px solid #EDF3E8",
                  },

                  "&:last-child td": {
                    borderBottom: 0,
                  },
                }}
              >
                {/* USER ID */}

                <TableCell>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",

                      gap: 1,
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,

                        background: "linear-gradient(135deg, #27AE80, #066649)",

                        color: "#FFFFFF",

                        fontSize: "0.72rem",

                        fontWeight: 800,
                      }}
                    >
                      {user.name?.charAt(0)?.toUpperCase() || "U"}
                    </Avatar>

                    <Typography
                      sx={{
                        color: "#58736C",

                        fontFamily: "monospace",

                        fontSize: "0.76rem",

                        fontWeight: 700,

                        whiteSpace: "nowrap",
                      }}
                    >
                      {user.user_id || `#${user.id}`}
                    </Typography>
                  </Box>
                </TableCell>

                {/* NAME */}

                <TableCell>
                  <Typography
                    sx={{
                      color: "#173F3A",

                      fontSize: "0.8rem",

                      fontWeight: 700,

                      whiteSpace: "nowrap",
                    }}
                  >
                    {user.name}
                  </Typography>
                </TableCell>

                {/* EMAIL */}

                <TableCell>
                  <Typography
                    sx={{
                      color: "#6B817C",

                      fontSize: "0.77rem",

                      whiteSpace: "nowrap",
                    }}
                  >
                    {user.email}
                  </Typography>
                </TableCell>

                {/* ROLE */}

                <TableCell>{getRoleChip(user.role)}</TableCell>

                {/* STATUS */}

                <TableCell>{getStatusChip(user.status)}</TableCell>

                {/* CREATED */}

                <TableCell>
                  <Typography
                    sx={{
                      color: "#6B817C",

                      fontSize: "0.74rem",

                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(user.created_at).toLocaleDateString()}
                  </Typography>
                </TableCell>

                {/* ACTIONS */}

                <TableCell align="right">
                  <Box
                    sx={{
                      display: "flex",

                      alignItems: "center",

                      justifyContent: "flex-end",

                      gap: 0.55,

                      flexWrap: "nowrap",
                    }}
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Visibility />}
                      onClick={() => handleOpenDetails(user)}
                      sx={{
                        ...actionButtonSx,

                        color: "#066649",

                        borderColor: "#99D8CE",

                        "&:hover": {
                          bgcolor: "#EFF9F1",

                          borderColor: "#087F5B",
                        },
                      }}
                    >
                      View
                    </Button>

                    {user.status !== "active" && (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CheckCircle />}
                          onClick={() => handleApprove(user.id)}
                          sx={{
                            ...actionButtonSx,

                            color: "#047857",

                            borderColor: "#A7F3D0",

                            "&:hover": {
                              bgcolor: "#D8F3E5",

                              borderColor: "#10B981",
                            },
                          }}
                        >
                          Approve
                        </Button>

                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Cancel />}
                          onClick={() => handleReject(user.id)}
                          sx={{
                            ...actionButtonSx,

                            color: "#B45309",

                            borderColor: "#FDE68A",

                            "&:hover": {
                              bgcolor: "#FFFBEB",

                              borderColor: "#F59E0B",
                            },
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {user.role !== "admin" && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LockReset />}
                        onClick={() => handleOpenReset(user)}
                        sx={{
                          ...actionButtonSx,

                          color: "#066649",

                          borderColor: "#99D8CE",

                          "&:hover": {
                            bgcolor: "#EFF9F1",

                            borderColor: "#087F5B",
                          },
                        }}
                      >
                        Reset
                      </Button>
                    )}

                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={() => handleOpenDialog(user)}
                      sx={{
                        ...actionButtonSx,

                        color: "#58736C",

                        borderColor: "#C9DFD9",

                        "&:hover": {
                          bgcolor: "var(--sh-page-tint)",

                          borderColor: "#8CA39D",
                        },
                      }}
                    >
                      Edit
                    </Button>

                    {user.role !== "admin" && user.status === "active" && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Block />}
                        onClick={() => handleDeactivate(user.id)}
                        sx={{
                          ...actionButtonSx,

                          color: "#DC2626",

                          borderColor: "#FECACA",

                          "&:hover": {
                            bgcolor: "#FEF2F2",

                            borderColor: "#EF4444",
                          },
                        }}
                      >
                        Deactivate
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* =====================================================
          CREATE / EDIT DIALOG
      ===================================================== */}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "16px",

            maxHeight: "90vh",

            boxShadow: "0 24px 70px rgba(17,94,89,0.16)",
          },
        }}
      >
        <DialogTitle
          sx={{
            px: 2.5,
            py: 2,

            borderBottom: "1px solid #D5E5D9",
          }}
        >
          <Typography
            sx={{
              color: "#173F3A",

              fontSize: "1.05rem",

              fontWeight: 800,
            }}
          >
            {editUser ? "Edit User" : "Create New Account"}
          </Typography>

          <Typography
            sx={{
              mt: 0.3,

              color: "#6B817C",

              fontSize: "0.75rem",
            }}
          >
            {editUser
              ? "Update the account information below."
              : "Enter the information for the new account."}
          </Typography>
        </DialogTitle>

        <DialogContent
          sx={{
            px: 2.5,
            py: "22px !important",
          }}
        >
          {/* PERSONAL INFORMATION */}

          <Typography sx={sectionLabelSx}>Personal Information</Typography>

          <Grid
            container
            spacing={1.5}
            sx={{
              mb: 2.5,
            }}
          >
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="First Name"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    first_name: e.target.value,
                  })
                }
                required
                sx={fieldSx}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Middle Name"
                value={formData.middle_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    middle_name: e.target.value,
                  })
                }
                sx={fieldSx}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Last Name"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    last_name: e.target.value,
                  })
                }
                required
                sx={fieldSx}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Birthdate"
                type="date"
                value={formData.birthdate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    birthdate: e.target.value,
                  })
                }
                InputLabelProps={{
                  shrink: true,
                }}
                inputProps={{
                  max: new Date().toISOString().split("T")[0],
                }}
                sx={fieldSx}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={fieldSx}>
                <InputLabel>Gender</InputLabel>

                <Select
                  value={formData.gender}
                  label="Gender"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      gender: e.target.value,
                    })
                  }
                >
                  <MenuItem value="">Prefer not to say</MenuItem>

                  <MenuItem value="Male">Male</MenuItem>

                  <MenuItem value="Female">Female</MenuItem>

                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider sx={{ mb: 2.2 }} />

          {/* CONTACT */}

          <Typography sx={sectionLabelSx}>Contact & Address</Typography>

          <Grid
            container
            spacing={1.5}
            sx={{
              mb: 2.5,
            }}
          >
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Contact Number"
                value={formData.contact_number}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contact_number: e.target.value,
                  })
                }
                placeholder="09XX XXX XXXX"
                sx={fieldSx}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email: e.target.value,
                  })
                }
                required
                sx={fieldSx}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: e.target.value,
                  })
                }
                multiline
                rows={2}
                sx={fieldSx}
              />
            </Grid>
          </Grid>

          <Divider sx={{ mb: 2.2 }} />

          {/* ACCOUNT */}

          <Typography sx={sectionLabelSx}>Account Details</Typography>

          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={fieldSx}>
                <InputLabel>Role</InputLabel>

                <Select
                  value={formData.role}
                  label="Role"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value,
                    })
                  }
                >
                  <MenuItem value="admin">Admin</MenuItem>

                  <MenuItem value="staff">Staff</MenuItem>

                  <MenuItem value="client">Client</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" sx={fieldSx}>
                <InputLabel>Status</InputLabel>

                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value,
                    })
                  }
                >
                  <MenuItem value="active">Active</MenuItem>

                  <MenuItem value="pending">Pending</MenuItem>

                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {formData.role === "staff" && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Contract Details"
                  value={formData.contract_details}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contract_details: e.target.value,
                    })
                  }
                  placeholder="Employment terms, schedule, contract duration..."
                  multiline
                  rows={2}
                  sx={fieldSx}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions
          sx={{
            px: 2.5,
            py: 1.7,

            gap: 0.8,

            borderTop: "1px solid #D5E5D9",
          }}
        >
          <Button
            onClick={() => setDialogOpen(false)}
            variant="outlined"
            sx={{
              minHeight: 38,

              px: 2,

              borderRadius: "9px",

              borderColor: "#C9DFD9",

              color: "#58736C",

              textTransform: "none",

              fontSize: "0.8rem",

              fontWeight: 700,

              "&:hover": {
                bgcolor: "var(--sh-page-tint)",

                borderColor: "#8CA39D",
              },
            }}
          >
            Cancel
          </Button>

          <Button
            onClick={handleSave}
            variant="contained"
            sx={{
              minHeight: 38,

              px: 2.2,

              borderRadius: "9px",

              bgcolor: colors.primary,

              textTransform: "none",

              fontSize: "0.8rem",

              fontWeight: 700,

              boxShadow: "none",

              "&:hover": {
                bgcolor: "#07543E",
                boxShadow: "none",
              },
            }}
          >
            {editUser ? "Save Changes" : "Create Account"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================
          USER DETAILS
      ===================================================== */}

      <Modal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          p: 2,
        }}
      >
        <Box
          sx={{
            bgcolor: "var(--sh-glass-bg)",

            width: "100%",
            maxWidth: 570,

            maxHeight: "88vh",

            overflowY: "auto",

            borderRadius: "16px",

            boxShadow: "0 25px 70px rgba(17,94,89,0.18)",
          }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 1.8,

              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",

              borderBottom: "1px solid #D5E5D9",
            }}
          >
            <Box>
              <Typography
                sx={{
                  color: "#173F3A",

                  fontSize: "1.05rem",

                  fontWeight: 800,
                }}
              >
                User Details
              </Typography>

              <Typography
                sx={{
                  mt: 0.2,

                  color: "#6B817C",

                  fontSize: "0.72rem",
                }}
              >
                Account and personal information
              </Typography>
            </Box>

            <Tooltip title="Close">
              <IconButton
                size="small"
                onClick={() => setDetailsOpen(false)}
                sx={{
                  color: "#6B817C",

                  bgcolor: "var(--sh-page-tint)",

                  "&:hover": {
                    bgcolor: "#EDF6F3",
                  },
                }}
              >
                <Close fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {selectedUser && (
            <Box
              sx={{
                px: 2.5,
                py: 2.2,
              }}
            >
              <Box
                sx={{
                  mb: 2,

                  p: 1.7,

                  display: "flex",
                  alignItems: "center",

                  gap: 1.3,

                  bgcolor: "#EFF9F1",

                  border: "1px solid #D8F3E5",

                  borderRadius: "12px",
                }}
              >
                <Avatar
                  sx={{
                    width: 42,
                    height: 42,

                    background: "linear-gradient(135deg, #27AE80, #066649)",

                    fontSize: "0.9rem",

                    fontWeight: 800,
                  }}
                >
                  {selectedUser.name?.charAt(0)?.toUpperCase() || "U"}
                </Avatar>

                <Box>
                  <Typography
                    sx={{
                      color: "#173F3A",

                      fontSize: "0.9rem",

                      fontWeight: 800,
                    }}
                  >
                    {selectedUser.name}
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.15,

                      color: "#6B817C",

                      fontFamily: "monospace",

                      fontSize: "0.72rem",
                    }}
                  >
                    {selectedUser.user_id || `#${selectedUser.id}`}
                  </Typography>
                </Box>
              </Box>

              <Grid container spacing={1.5}>
                {[
                  {
                    label: "Email",
                    value: selectedUser.email,
                    xs: 12,
                  },

                  {
                    label: "First Name",
                    value: selectedUser.first_name,
                    xs: 6,
                  },

                  {
                    label: "Middle Name",
                    value: selectedUser.middle_name,
                    xs: 6,
                  },

                  {
                    label: "Last Name",
                    value: selectedUser.last_name,
                    xs: 12,
                  },

                  {
                    label: "Phone",
                    value: selectedUser.phone || selectedUser.contact_number,
                    xs: 6,
                  },

                  {
                    label: "Birthdate",
                    value: selectedUser.birthdate
                      ? new Date(selectedUser.birthdate).toLocaleDateString()
                      : null,
                    xs: 6,
                  },

                  {
                    label: "Gender",
                    value: selectedUser.gender,
                    xs: 6,
                  },

                  {
                    label: "Address",
                    value: selectedUser.address,
                    xs: 12,
                  },
                ]
                  .filter((item) => item.value)
                  .map((item) => (
                    <Grid item xs={12} sm={item.xs} key={item.label}>
                      <Box
                        sx={{
                          minHeight: 55,

                          p: 1.35,

                          bgcolor: "var(--sh-page-tint)",

                          border: "1px solid #EEF2F6",

                          borderRadius: "10px",
                        }}
                      >
                        <Typography
                          sx={{
                            color: "#8CA39D",

                            fontSize: "0.62rem",

                            fontWeight: 750,

                            letterSpacing: "0.04em",

                            textTransform: "uppercase",
                          }}
                        >
                          {item.label}
                        </Typography>

                        <Typography
                          sx={{
                            mt: 0.35,

                            color: "#355D55",

                            fontSize: "0.78rem",

                            fontWeight: 600,

                            lineHeight: 1.45,

                            overflowWrap: "anywhere",
                          }}
                        >
                          {item.value}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}

                <Grid item xs={6}>
                  <Box
                    sx={{
                      minHeight: 55,

                      p: 1.35,

                      bgcolor: "var(--sh-page-tint)",

                      border: "1px solid #EEF2F6",

                      borderRadius: "10px",
                    }}
                  >
                    <Typography
                      sx={{
                        mb: 0.6,

                        color: "#8CA39D",

                        fontSize: "0.62rem",

                        fontWeight: 750,

                        letterSpacing: "0.04em",

                        textTransform: "uppercase",
                      }}
                    >
                      Role
                    </Typography>

                    {getRoleChip(selectedUser.role)}
                  </Box>
                </Grid>

                <Grid item xs={6}>
                  <Box
                    sx={{
                      minHeight: 55,

                      p: 1.35,

                      bgcolor: "var(--sh-page-tint)",

                      border: "1px solid #EEF2F6",

                      borderRadius: "10px",
                    }}
                  >
                    <Typography
                      sx={{
                        mb: 0.6,

                        color: "#8CA39D",

                        fontSize: "0.62rem",

                        fontWeight: 750,

                        letterSpacing: "0.04em",

                        textTransform: "uppercase",
                      }}
                    >
                      Status
                    </Typography>

                    {getStatusChip(selectedUser.status)}
                  </Box>
                </Grid>

                <Grid item xs={6}>
                  <Box
                    sx={{
                      minHeight: 55,

                      p: 1.35,

                      bgcolor: "var(--sh-page-tint)",

                      border: "1px solid #EEF2F6",

                      borderRadius: "10px",
                    }}
                  >
                    <Typography
                      sx={{
                        color: "#8CA39D",

                        fontSize: "0.62rem",

                        fontWeight: 750,

                        textTransform: "uppercase",
                      }}
                    >
                      Created
                    </Typography>

                    <Typography
                      sx={{
                        mt: 0.35,

                        color: "#355D55",

                        fontSize: "0.75rem",

                        fontWeight: 600,
                      }}
                    >
                      {new Date(selectedUser.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                </Grid>

                {selectedUser.updated_at && (
                  <Grid item xs={6}>
                    <Box
                      sx={{
                        minHeight: 55,

                        p: 1.35,

                        bgcolor: "var(--sh-page-tint)",

                        border: "1px solid #EEF2F6",

                        borderRadius: "10px",
                      }}
                    >
                      <Typography
                        sx={{
                          color: "#8CA39D",

                          fontSize: "0.62rem",

                          fontWeight: 750,

                          textTransform: "uppercase",
                        }}
                      >
                        Updated
                      </Typography>

                      <Typography
                        sx={{
                          mt: 0.35,

                          color: "#355D55",

                          fontSize: "0.75rem",

                          fontWeight: 600,
                        }}
                      >
                        {new Date(selectedUser.updated_at).toLocaleString()}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}

          <Box
            sx={{
              px: 2.5,
              py: 1.6,

              display: "flex",

              justifyContent: "flex-end",

              gap: 0.8,

              borderTop: "1px solid #D5E5D9",
            }}
          >
            <Button
              onClick={() => setDetailsOpen(false)}
              variant="outlined"
              sx={{
                minHeight: 37,

                px: 1.8,

                borderRadius: "9px",

                borderColor: "#C9DFD9",

                color: "#58736C",

                textTransform: "none",

                fontSize: "0.78rem",

                fontWeight: 700,
              }}
            >
              Close
            </Button>

            {selectedUser && (
              <Button
                onClick={() => {
                  setDetailsOpen(false);
                  handleOpenDialog(selectedUser);
                }}
                variant="contained"
                startIcon={<Edit />}
                sx={{
                  minHeight: 37,

                  px: 1.8,

                  borderRadius: "9px",

                  bgcolor: colors.primary,

                  textTransform: "none",

                  fontSize: "0.78rem",

                  fontWeight: 700,

                  boxShadow: "none",

                  "&:hover": {
                    bgcolor: "#07543E",
                    boxShadow: "none",
                  },
                }}
              >
                Edit User
              </Button>
            )}
          </Box>
        </Box>
      </Modal>

      {/* =====================================================
          RESET PASSWORD
      ===================================================== */}

      <Dialog
        open={resetState.open}
        onClose={handleCloseReset}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "15px",

            boxShadow: "0 24px 70px rgba(17,94,89,0.18)",
          },
        }}
      >
        <DialogTitle
          sx={{
            px: 2.5,
            py: 1.8,

            borderBottom: "1px solid #D5E5D9",
          }}
        >
          <Typography
            sx={{
              color: "#173F3A",

              fontSize: "1rem",

              fontWeight: 800,
            }}
          >
            Reset Password
          </Typography>

          {!resetState.credentials && (
            <Typography
              sx={{
                mt: 0.25,

                color: "#6B817C",

                fontSize: "0.72rem",
              }}
            >
              Generate a temporary password for this account.
            </Typography>
          )}
        </DialogTitle>

        <DialogContent
          sx={{
            px: 2.5,

            py: "20px !important",
          }}
        >
          {!resetState.credentials ? (
            <>
              <Typography
                sx={{
                  color: "#58736C",

                  fontSize: "0.8rem",

                  lineHeight: 1.6,
                }}
              >
                Generate a new temporary password for{" "}
                <Box
                  component="span"
                  sx={{
                    color: "#173F3A",
                    fontWeight: 750,
                  }}
                >
                  {resetState.user?.name}
                </Box>
                ?
              </Typography>

              <Box
                sx={{
                  mt: 1.5,

                  p: 1.5,

                  bgcolor: "var(--sh-page-tint)",

                  border: "1px solid #D5E5D9",

                  borderRadius: "10px",
                }}
              >
                <Typography
                  sx={{
                    color: "#6B817C",

                    fontSize: "0.72rem",

                    lineHeight: 1.55,
                  }}
                >
                  Temporary password pattern:{" "}
                  <Box
                    component="span"
                    sx={{
                      color: "#173F3A",

                      fontFamily: "monospace",

                      fontWeight: 800,
                    }}
                  >
                    {resetState.user?.role}
                    123
                  </Box>
                </Typography>

                <Typography
                  sx={{
                    mt: 0.6,

                    color: "#6B817C",

                    fontSize: "0.72rem",

                    lineHeight: 1.55,
                  }}
                >
                  The user must change it on the next login.
                </Typography>
              </Box>
            </>
          ) : (
            <>
              <Alert
                severity="success"
                sx={{
                  mb: 1.5,

                  borderRadius: "9px",

                  fontSize: "0.76rem",
                }}
              >
                Password reset successfully.
              </Alert>

              {[
                {
                  label: "Account ID",
                  value: resetState.credentials.user_id,
                },
                {
                  label: "Email",
                  value: resetState.credentials.email,
                },
                {
                  label: "Temporary Password",
                  value: resetState.credentials.password,
                },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    py: 1.15,

                    display: "flex",

                    alignItems: "center",

                    justifyContent: "space-between",

                    gap: 2,

                    borderBottom: "1px solid #EDF3E8",

                    "&:last-child": {
                      borderBottom: 0,
                    },
                  }}
                >
                  <Typography
                    sx={{
                      color: "#6B817C",

                      fontSize: "0.72rem",
                    }}
                  >
                    {item.label}
                  </Typography>

                  <Typography
                    sx={{
                      color: "#173F3A",

                      fontSize: "0.75rem",

                      fontWeight: 800,

                      fontFamily:
                        item.label !== "Email" ? "monospace" : "inherit",

                      textAlign: "right",

                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 2.5,
            py: 1.6,

            gap: 0.7,

            borderTop: "1px solid #D5E5D9",
          }}
        >
          <Button
            onClick={handleCloseReset}
            variant={resetState.credentials ? "outlined" : "text"}
            sx={{
              minHeight: 36,

              px: 1.7,

              borderRadius: "8px",

              color: "#58736C",

              borderColor: "#C9DFD9",

              textTransform: "none",

              fontSize: "0.77rem",

              fontWeight: 700,
            }}
          >
            {resetState.credentials ? "Done" : "Cancel"}
          </Button>

          {!resetState.credentials && (
            <Button
              onClick={handleResetPassword}
              variant="contained"
              disabled={resetState.loading}
              startIcon={<LockReset />}
              sx={{
                minHeight: 36,

                px: 1.8,

                borderRadius: "8px",

                bgcolor: colors.primary,

                textTransform: "none",

                fontSize: "0.77rem",

                fontWeight: 700,

                boxShadow: "none",

                "&:hover": {
                  bgcolor: "#07543E",

                  boxShadow: "none",
                },
              }}
            >
              {resetState.loading ? "Resetting..." : "Reset Password"}
            </Button>
          )}

          {resetState.credentials && (
            <Button
              variant="contained"
              startIcon={<Visibility />}
              onClick={() => {
                const c = resetState.credentials;

                navigator.clipboard?.writeText(
                  `Account ID: ${c.user_id}\nEmail: ${c.email}\nPassword: ${c.password}`,
                );

                showAlert("Credentials copied to clipboard!");
              }}
              sx={{
                minHeight: 36,

                px: 1.8,

                borderRadius: "8px",

                bgcolor: colors.primary,

                textTransform: "none",

                fontSize: "0.77rem",

                fontWeight: 700,

                boxShadow: "none",
              }}
            >
              Copy Credentials
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountManagement;
