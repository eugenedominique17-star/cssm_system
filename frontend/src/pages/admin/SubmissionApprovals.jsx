import React, { useState, useEffect, useRef } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
} from "@mui/material";
import {
  CheckCircle,
  Cancel,
  Visibility,
  Description,
  SecurityRounded,
} from "@mui/icons-material";
import { getPendingSubmissions, reviewSubmission } from "../../api/submissions";
import { colors } from "../../theme";

const SubmissionApprovals = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({
    show: false,
    message: "",
    severity: "success",
  });
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");
  const alertTimer = useRef(null);

  useEffect(() => {
    fetchSubmissions();
    return () => clearTimeout(alertTimer.current);
  }, []);

  const fetchSubmissions = async () => {
    try {
      const response = await getPendingSubmissions();
      setSubmissions(response.data);
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const response = await reviewSubmission(id, "approved", adminNotes);
      if (response.data.credentials) {
        clearTimeout(alertTimer.current);
        const { user_id, password } = response.data.credentials;
        setAlert({ show: true, severity: 'success', message: `Password reset approved. Account: ${user_id}. Temporary password: ${password}. Copy and securely give this to the account owner before leaving this page.` });
      } else {
        showAlert("Submission approved!");
      }
      setViewDialog(false);
      setAdminNotes("");
      fetchSubmissions();
    } catch (error) {
      showAlert(error.response?.data?.message || "Failed to approve submission.", "error");
    }
  };

  const handleReject = async (id) => {
    const notes = prompt("Enter rejection reason (optional):");
    try {
      await reviewSubmission(id, "rejected", notes || "");
      showAlert("Submission rejected.");
      fetchSubmissions();
    } catch (error) {
      showAlert(error.response?.data?.message || "Failed to reject submission.", "error");
    }
  };

  const showAlert = (message, severity = "success") => {
    clearTimeout(alertTimer.current);
    setAlert({ show: true, message, severity });
    alertTimer.current = setTimeout(
      () => setAlert({ show: false, message: "", severity: "success" }),
      3000,
    );
  };

  const getTypeChip = (type) => {
    const styles = {
      product: { color: "#066649", bg: "#D8F3E5" },
      promo: { color: "#6D5D0B", bg: "#FEFCE8" },
      stock_update: { color: "#9A5B13", bg: "#FFF7ED" },
      password_reset: { color: "#B42318", bg: "#FFF1F0" },
    };
    const tone = styles[type] || { color: "#5F746E", bg: "#F3F7F5" };
    return (
      <Chip
        label={(type || "submission").replace("_", " ")}
        size="small"
        sx={{
          height: 27,
          bgcolor: tone.bg,
          color: tone.color,
          fontWeight: 800,
          textTransform: "capitalize",
          border: "1px solid rgba(6,102,73,.08)",
          "& .MuiChip-label": { px: 1.1, fontSize: ".69rem" },
        }}
      />
    );
  };

  const closeDialog = () => {
    setViewDialog(false);
    setSelectedSubmission(null);
    setAdminNotes("");
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "55vh", display: "grid", placeItems: "center" }}>
        <Stack alignItems="center" spacing={1.5}>
          <CircularProgress
            size={36}
            thickness={4.5}
            sx={{ color: colors?.primary || "#066649" }}
          />
          <Typography sx={{ color: "#6B817C", fontSize: ".76rem" }}>
            Loading submissions...
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      className="page-container"
      sx={{
        minHeight: "100%",
        p: { xs: 1.5, sm: 2, md: 2.5 },
        bgcolor: "#EFF5E7",
        color: "#173F3A",
      }}
    >
      <Box
        sx={{
          mb: 2.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 1.5,
        }}
      >
        <Box>
          <Typography
            sx={{
              color: "#066649",
              fontSize: ".62rem",
              fontWeight: 900,
              letterSpacing: ".12em",
              textTransform: "uppercase",
            }}
          >
            Admin Review
          </Typography>
          <Typography
            variant="h4"
            sx={{
              mt: 0.4,
              color: "#173F3A",
              fontWeight: 950,
              letterSpacing: "-.04em",
              fontSize: { xs: "1.55rem", md: "1.9rem" },
            }}
          >
            Submission Approvals
          </Typography>
          <Typography sx={{ mt: 0.55, color: "#6B817C", fontSize: ".78rem" }}>
            Review and approve staff submissions for products, promos and
            account requests.
          </Typography>
        </Box>
        <Paper
          elevation={0}
          sx={{
            px: 1.5,
            py: 1,
            borderRadius: "14px",
            bgcolor: "#D8F3E5",
            border: "1px solid #D9EEE8",
          }}
        >
          <Typography
            sx={{ color: "#6B817C", fontSize: ".62rem", fontWeight: 700 }}
          >
            Pending submissions
          </Typography>
          <Typography
            sx={{
              color: "#066649",
              fontSize: "1.25rem",
              fontWeight: 950,
              lineHeight: 1.2,
            }}
          >
            {submissions.length}
          </Typography>
        </Paper>
      </Box>

      {alert.show && (
        <Alert
          severity={alert.severity}
          sx={{
            mb: 2,
            borderRadius: "14px",
            border: "1px solid #DCEBE7",
            boxShadow: "0 8px 24px rgba(17,94,89,.05)",
          }}
        >
          {alert.message}
        </Alert>
      )}

      {submissions.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 6 },
            textAlign: "center",
            borderRadius: "22px",
            bgcolor: "var(--sh-glass-bg)",
            border: "1px solid #DCEBE7",
            boxShadow: "0 18px 45px rgba(17,94,89,.06)",
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              mx: "auto",
              mb: 2,
              display: "grid",
              placeItems: "center",
              borderRadius: "20px",
              bgcolor: "#D8F3E5",
              color: "#066649",
            }}
          >
            <Description sx={{ fontSize: 34 }} />
          </Box>
          <Typography
            sx={{ color: "#173F3A", fontWeight: 900, fontSize: "1rem" }}
          >
            All caught up
          </Typography>
          <Typography sx={{ mt: 0.7, color: "#6B817C", fontSize: ".75rem" }}>
            Staff submissions will appear here when they need your review.
          </Typography>
        </Paper>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: "20px",
            border: "1px solid #DCEBE7",
            boxShadow: "0 18px 45px rgba(17,94,89,.06)",
            overflowX: "auto",
          }}
        >
          <Table sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow
                sx={{
                  bgcolor: "#F0FAF7",
                  "& th": {
                    color: "#58736C",
                    fontSize: ".67rem",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    borderBottom: "1px solid #DCEBE7",
                    py: 1.5,
                  },
                }}
              >
                <TableCell>ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Submitted By</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {submissions.map((sub) => (
                <TableRow
                  key={sub.id}
                  sx={{
                    "& td": { borderBottom: "1px solid #EDF4F2", py: 1.45 },
                    "&:hover": { bgcolor: "#FBFEFD" },
                    "&:last-child td": { borderBottom: 0 },
                  }}
                >
                  <TableCell>
                    <Typography
                      sx={{
                        color: "#066649",
                        fontSize: ".75rem",
                        fontWeight: 900,
                      }}
                    >
                      #{sub.id}
                    </Typography>
                  </TableCell>
                  <TableCell>{getTypeChip(sub.type)}</TableCell>
                  <TableCell>
                    <Typography
                      sx={{
                        color: "#173F3A",
                        fontSize: ".77rem",
                        fontWeight: 800,
                      }}
                    >
                      {sub.submitted_by_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: "#6B817C", fontSize: ".72rem" }}>
                      {new Date(sub.created_at).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={0.7}
                      justifyContent="flex-end"
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setViewDialog(true);
                        }}
                        startIcon={<Visibility />}
                        sx={{
                          borderRadius: "10px",
                          textTransform: "none",
                          fontWeight: 800,
                          color: "#066649",
                          borderColor: "#BFDCD5",
                          "&:hover": {
                            borderColor: "#066649",
                            bgcolor: "#D8F3E5",
                          },
                        }}
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleApprove(sub.id)}
                        startIcon={<CheckCircle />}
                        sx={{
                          borderRadius: "10px",
                          textTransform: "none",
                          fontWeight: 800,
                          bgcolor: "#066649",
                          boxShadow: "none",
                          "&:hover": { bgcolor: "#07543E", boxShadow: "none" },
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleReject(sub.id)}
                        startIcon={<Cancel />}
                        sx={{
                          borderRadius: "10px",
                          textTransform: "none",
                          fontWeight: 800,
                          color: "#C2413A",
                          borderColor: "#F1C8C5",
                          "&:hover": {
                            bgcolor: "#FFF5F4",
                            borderColor: "#C2413A",
                          },
                        }}
                      >
                        Reject
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={viewDialog}
        onClose={closeDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "22px",
            border: "1px solid #DCEBE7",
            boxShadow: "0 28px 80px rgba(17,94,89,.16)",
          },
        }}
      >
        <DialogTitle sx={{ px: { xs: 2, sm: 3 }, pt: 2.7, pb: 1.6 }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: "12px",
                bgcolor: "#D8F3E5",
                color: "#066649",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Description />
            </Box>
            <Box>
              <Typography
                sx={{ color: "#173F3A", fontWeight: 950, fontSize: "1.05rem" }}
              >
                Submission Details
              </Typography>
              <Typography sx={{ color: "#80958F", fontSize: ".66rem" }}>
                Review the request before taking action.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <Divider sx={{ borderColor: "#E7F1EE" }} />
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>
          {selectedSubmission && (
            <Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                  gap: 1.2,
                  mb: 2,
                }}
              >
                {[
                  ["Type", selectedSubmission.type],
                  ["Submitted by", selectedSubmission.submitted_by_name],
                  [
                    "Date",
                    new Date(selectedSubmission.created_at).toLocaleString(),
                  ],
                ].map(([label, value]) => (
                  <Box
                    key={label}
                    sx={{
                      p: 1.4,
                      borderRadius: "13px",
                      bgcolor: "#F7FCFA",
                      border: "1px solid #E2EFEB",
                    }}
                  >
                    <Typography
                      sx={{
                        color: "#8A9D98",
                        fontSize: ".58rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </Typography>
                    <Typography
                      sx={{
                        mt: 0.4,
                        color: "#173F3A",
                        fontSize: ".73rem",
                        fontWeight: 800,
                      }}
                    >
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  bgcolor: "#F7FCFA",
                  border: "1px solid #E2EFEB",
                  borderRadius: "16px",
                }}
              >
                <Typography
                  sx={{
                    mb: 1.2,
                    color: "#173F3A",
                    fontSize: ".72rem",
                    fontWeight: 900,
                  }}
                >
                  Submission data
                </Typography>
                {selectedSubmission.type === "password_reset" &&
                selectedSubmission.data ? (
                  <Box>
                    {[
                      {
                        label: "Account",
                        value:
                          selectedSubmission.data.target_user_id_formatted ||
                          selectedSubmission.data.target_user_id,
                      },
                      {
                        label: "Name",
                        value: selectedSubmission.data.target_name,
                      },
                      {
                        label: "Email",
                        value: selectedSubmission.data.target_email,
                      },
                      {
                        label: "Role",
                        value: selectedSubmission.data.target_role,
                      },
                    ].map((item) => (
                      <Box
                        key={item.label}
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 2,
                          py: 0.7,
                          borderBottom: "1px solid #E7F1EE",
                          "&:last-of-type": { borderBottom: 0 },
                        }}
                      >
                        <Typography
                          sx={{ color: "#80958F", fontSize: ".7rem" }}
                        >
                          {item.label}
                        </Typography>
                        <Typography
                          sx={{
                            color: "#173F3A",
                            fontSize: ".7rem",
                            fontWeight: 800,
                            textAlign: "right",
                          }}
                        >
                          {item.value || "—"}
                        </Typography>
                      </Box>
                    ))}
                    <Alert
                      icon={<SecurityRounded />}
                      severity="info"
                      sx={{ mt: 1.5, borderRadius: "12px", fontSize: ".68rem" }}
                    >
                      Approving this will generate a temporary password (
                      {selectedSubmission.data.target_role}123) and force the
                      user to change it on next login.
                    </Alert>
                  </Box>
                ) : (
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      color: "#49665F",
                      fontSize: ".72rem",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}
                  >
                    {JSON.stringify(selectedSubmission.data, null, 2)}
                  </Box>
                )}
              </Box>
              <TextField
                fullWidth
                label="Admin Notes"
                multiline
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                sx={{
                  mt: 2,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "14px",
                    bgcolor: "var(--sh-glass-bg)",
                    "&.Mui-focused fieldset": { borderColor: "#066649" },
                  },
                  "& .MuiInputLabel-root.Mui-focused": { color: "#066649" },
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2.5, pt: 0.5 }}>
          <Button
            onClick={closeDialog}
            sx={{ color: "#6B817C", textTransform: "none", fontWeight: 800 }}
          >
            Close
          </Button>
          <Button
            onClick={() => handleApprove(selectedSubmission?.id)}
            variant="contained"
            startIcon={<CheckCircle />}
            sx={{
              bgcolor: "#066649",
              borderRadius: "11px",
              textTransform: "none",
              fontWeight: 900,
              boxShadow: "none",
              "&:hover": { bgcolor: "#07543E", boxShadow: "none" },
            }}
          >
            Approve Submission
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SubmissionApprovals;
