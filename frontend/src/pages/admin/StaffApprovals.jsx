import React, { useState, useEffect } from "react";
import { Box, Typography, Paper, CircularProgress, Alert, Card, Grid } from '@mui/material';
import { PersonAdd } from '@mui/icons-material';
import AccountApprovalCards from '../../components/AccountApprovalCards';
import API from "../../api/accountAdmin";
import { colors } from "../../theme";

const StaffApprovals = () => {
  const [pendingStaff, setPendingStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({
    show: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      const response = await API.get("/admin/pending-staff");
      setPendingStaff(response.data);
    } catch (error) {
      console.error("Failed to fetch pending staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await API.put(`/admin/approve-staff/${id}`, { status: "active" });
      showAlert("Staff account approved!");
      await fetchPending();
    } catch (error) {
      showAlert("Failed to approve staff.", "error");
    }
  };

  const handleReject = async (id) => {
    try {
      await API.put(`/admin/approve-staff/${id}`, { status: "rejected" });
      showAlert("Staff account rejected successfully.", "success");
      await fetchPending();
    } catch (error) {
      showAlert("Failed to reject staff.", "error");
    }
  };

  const showAlert = (message, severity = "success") => {
    setAlert({ show: true, message, severity });
    setTimeout(
      () => setAlert({ show: false, message: "", severity: "success" }),
      3000,
    );
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
    <Box
      className="page-container"
      sx={{
        minHeight: "100%",
        p: { xs: 1.5, sm: 2, md: 2.5 },
        bgcolor: "#EFF5E7",
        color: "#173F3A",
      }}
    >
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          className="page-title"
          sx={{ mb: 1, fontWeight: 900 }}
        >
          Staff Account Approvals
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review and approve pending staff registration requests.
        </Typography>
      </Box>

      {/* Summary Card */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card
            sx={{
              p: 3,
              background: "linear-gradient(135deg, #066649 0%, #07543E 100%)",
              color: "white",
              borderRadius: "18px",
              boxShadow: "0 8px 24px rgba(6,102,73,.14)",
              border: "none",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: "12px",
                  bgcolor: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PersonAdd sx={{ fontSize: 32 }} />
              </Box>
              <Box>
                <Typography
                  variant="body2"
                  sx={{ opacity: 0.9, fontWeight: 500 }}
                >
                  Pending Staff
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>
                  {pendingStaff.length}
                </Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {alert.show && (
        <Alert
          severity={alert.severity}
          sx={{ mb: 3, borderRadius: "14px", animation: "fadeInUp 0.3s ease" }}
        >
          {alert.message}
        </Alert>
      )}

      {pendingStaff.length === 0 ? (
        <Paper
          sx={{
            p: 6,
            textAlign: "center",
            borderRadius: "18px",
            background:
              "linear-gradient(135deg, rgba(6,102,73,.035) 0%, rgba(39,174,128,.035) 100%)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <Box
            sx={{
              bgcolor: "rgba(6,102,73,.10)",
              borderRadius: "18px",
              p: 2,
              display: "inline-flex",
              mb: 2,
              color: colors.primary,
            }}
          >
            <PersonAdd sx={{ fontSize: 48 }} />
          </Box>
          <Typography variant="h6" fontWeight={600} color="text.secondary">
            No pending staff account requests.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            New staff registrations will appear here for your approval.
          </Typography>
        </Paper>
      ) : (
        <AccountApprovalCards accounts={pendingStaff} role="staff" onApprove={handleApprove} onReject={handleReject} />
      )}
    </Box>
  );
};

export default StaffApprovals;
