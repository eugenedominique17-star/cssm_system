import React, { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  ApprovalRounded,
  CancelRounded,
  CheckCircleRounded,
  DescriptionOutlined,
  Inventory2Outlined,
  LocalOfferOutlined,
  PendingActionsRounded,
  RefreshRounded,
  ScheduleRounded,
  SecurityRounded,
  UpdateRounded,
} from "@mui/icons-material";

import { getMySubmissions } from "../../api/submissions";

const StaffSubmissions = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchSubmissions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await getMySubmissions();

      let user = null;

      try {
        const storedUser = localStorage.getItem("user");

        if (storedUser) {
          user = JSON.parse(storedUser);
        }
      } catch (parseError) {
        console.error("Failed to parse user data:", parseError);
      }

      if (!user?.id) {
        setSubmissions([]);
        setError("Unable to identify the current staff account.");
        return;
      }

      const allSubmissions = Array.isArray(response.data) ? response.data : [];

      const mySubmissions = allSubmissions.filter(
        (submission) => String(submission.submitted_by) === String(user.id),
      );

      setSubmissions(mySubmissions);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to load your submissions.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

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

  const getTypeChip = (type) => {
    const normalizedType = String(type || "").toLowerCase();

    const configs = {
      product: {
        label: "Product",
        color: "#2563EB",
        background: "#EFF6FF",
        border: "#DBEAFE",
        icon: <Inventory2Outlined />,
      },
      promo: {
        label: "Promotion",
        color: "#7C3AED",
        background: "#F5F3FF",
        border: "#EDE9FE",
        icon: <LocalOfferOutlined />,
      },
      stock_update: {
        label: "Stock Update",
        color: "#D97706",
        background: "#FFFBEB",
        border: "#FDE68A",
        icon: <UpdateRounded />,
      },
      // Additive: password reset request type
      password_reset: {
        label: "Password Reset",
        color: "#DC2626",
        background: "#FEF2F2",
        border: "#FECACA",
        icon: <SecurityRounded />,
      },
    };

    const config = configs[normalizedType] || {
      label: normalizedType.replaceAll("_", " ") || "Unknown",
      color: "#4C695A",
      background: "var(--sh-page-tint)",
      border: "#D5E5D9",
      icon: <DescriptionOutlined />,
    };

    return (
      <Chip
        icon={config.icon}
        label={config.label}
        size="small"
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

  const getStatusChip = (status) => {
    const normalizedStatus = String(status || "").toLowerCase();

    const configs = {
      pending: {
        label: "Pending",
        color: "#B45309",
        background: "#FFFBEB",
        border: "#FDE68A",
        icon: <ScheduleRounded />,
      },
      approved: {
        label: "Approved",
        color: "#047857",
        background: "#D8F3E5",
        border: "#A7F3D0",
        icon: <CheckCircleRounded />,
      },
      rejected: {
        label: "Rejected",
        color: "#B91C1C",
        background: "#FEF2F2",
        border: "#FECACA",
        icon: <CancelRounded />,
      },
    };

    const config = configs[normalizedStatus] || {
      label: normalizedStatus || "Unknown",
      color: "#4C695A",
      background: "var(--sh-page-tint)",
      border: "#D5E5D9",
      icon: <DescriptionOutlined />,
    };

    return (
      <Chip
        icon={config.icon}
        label={config.label}
        size="small"
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

  const pendingCount = submissions.filter(
    (item) => String(item.status).toLowerCase() === "pending",
  ).length;

  const approvedCount = submissions.filter(
    (item) => String(item.status).toLowerCase() === "approved",
  ).length;

  const rejectedCount = submissions.filter(
    (item) => String(item.status).toLowerCase() === "rejected",
  ).length;

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: 420,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <CircularProgress size={42} thickness={4} sx={{ color: "#059669" }} />

        <Typography
          sx={{
            color: "#617B6C",
            fontSize: 13,
          }}
        >
          Loading your submissions...
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
      {/* HEADER */}
      <Box
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
            My Submissions
          </Typography>

          <Typography
            sx={{
              mt: 0.8,
              color: "#617B6C",
              fontSize: 14,
            }}
          >
            Track the review status of your product, promotion and stock
            submissions.
          </Typography>
        </Box>

        <Tooltip title="Refresh submissions">
          <span>
            <IconButton
              onClick={() => fetchSubmissions(true)}
              disabled={refreshing}
              sx={{
                alignSelf: {
                  xs: "flex-start",
                  md: "center",
                },
                width: 46,
                height: 46,
                bgcolor: "var(--sh-glass-bg)",
                border: "1px solid #D5E5D9",
                boxShadow: "0 5px 16px rgba(24,61,50,.04)",

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
      </Box>

      {/* ERROR */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError("")}
          sx={{
            mb: 3,
            borderRadius: 3,
          }}
        >
          {error}
        </Alert>
      )}

      {/* SUMMARY CARDS */}
      <Grid container spacing={2.2} sx={{ mb: 3 }}>
        {[
          {
            label: "Total Submissions",
            value: submissions.length,
            icon: <DescriptionOutlined />,
            color: "#2563EB",
            background: "#EFF6FF",
          },
          {
            label: "Pending Review",
            value: pendingCount,
            icon: <PendingActionsRounded />,
            color: "#D97706",
            background: "#FFFBEB",
          },
          {
            label: "Approved",
            value: approvedCount,
            icon: <CheckCircleRounded />,
            color: "#059669",
            background: "#D8F3E5",
          },
          {
            label: "Rejected",
            value: rejectedCount,
            icon: <CancelRounded />,
            color: "#DC2626",
            background: "#FEF2F2",
          },
        ].map((item) => (
          <Grid item xs={12} sm={6} lg={3} key={item.label}>
            <Paper
              elevation={0}
              sx={{
                p: 2.4,
                height: "100%",
                borderRadius: 4,
                bgcolor: "var(--sh-glass-bg)",
                border: "1px solid #D5E5D9",
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
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 3,
                    bgcolor: item.background,
                    color: item.color,
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

      {/* CONTENT */}
      {submissions.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: {
              xs: 4,
              md: 7,
            },
            textAlign: "center",
            borderRadius: 4,
            bgcolor: "var(--sh-glass-bg)",
            border: "1px solid #D5E5D9",
            background: "linear-gradient(145deg, #FFFFFF 0%, #F0FDF4 100%)",
          }}
        >
          <Box
            sx={{
              width: 76,
              height: 76,
              mx: "auto",
              mb: 2.5,
              display: "grid",
              placeItems: "center",
              borderRadius: 4,
              bgcolor: "#D8F3E5",
              color: "#059669",
            }}
          >
            <DescriptionOutlined
              sx={{
                fontSize: 38,
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
            No submissions yet
          </Typography>

          <Typography
            sx={{
              mt: 1,
              maxWidth: 520,
              mx: "auto",
              color: "#617B6C",
              fontSize: 13.5,
              lineHeight: 1.7,
            }}
          >
            When you submit products, promotions, or stock updates for Admin
            review, they will appear here.
          </Typography>
        </Paper>
      ) : (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 4,
            border: "1px solid #D5E5D9",
            overflow: "hidden",
            bgcolor: "var(--sh-glass-bg)",
          }}
        >
          {/* TABLE HEADER */}
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
            <Stack direction="row" alignItems="center" spacing={1}>
              <ApprovalRounded
                sx={{
                  color: "#059669",
                  fontSize: 22,
                }}
              />

              <Box>
                <Typography
                  sx={{
                    color: "#183D32",
                    fontSize: 16.5,
                    fontWeight: 850,
                  }}
                >
                  Submission History
                </Typography>

                <Typography
                  sx={{
                    mt: 0.2,
                    color: "#839B8C",
                    fontSize: 11.5,
                  }}
                >
                  Latest review status and Admin feedback.
                </Typography>
              </Box>
            </Stack>
          </Box>

          <TableContainer>
            <Table
              sx={{
                minWidth: 900,

                "& th": {
                  bgcolor: "var(--sh-page-tint)",
                  color: "#617B6C",
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  borderBottom: "1px solid #D5E5D9",
                  py: 1.7,
                },

                "& td": {
                  borderBottom: "1px solid #EDF3E8",
                  py: 1.8,
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Admin Notes</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Reviewed</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {submissions.map((submission) => (
                  <TableRow
                    key={submission.id}
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
                        #{submission.id}
                      </Typography>
                    </TableCell>

                    <TableCell>{getTypeChip(submission.type)}</TableCell>

                    <TableCell>{getStatusChip(submission.status)}</TableCell>

                    <TableCell
                      sx={{
                        maxWidth: 300,
                      }}
                    >
                      {submission.admin_notes ? (
                        <Typography
                          sx={{
                            color: "#4C695A",
                            fontSize: 12.5,
                            lineHeight: 1.6,
                            whiteSpace: "normal",
                          }}
                        >
                          {submission.admin_notes}
                        </Typography>
                      ) : (
                        <Typography
                          sx={{
                            color: "#CBD5E1",
                            fontSize: 12,
                            fontStyle: "italic",
                          }}
                        >
                          No notes yet
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Typography
                        sx={{
                          color: "#617B6C",
                          fontSize: 12.5,
                        }}
                      >
                        {formatDate(submission.created_at)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography
                        sx={{
                          color: submission.reviewed_at ? "#617B6C" : "#CBD5E1",
                          fontSize: 12.5,
                        }}
                      >
                        {formatDate(submission.reviewed_at)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default StaffSubmissions;
