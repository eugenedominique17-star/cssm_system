import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import {
  People,
  CheckCircle,
  Pending,
  Description,
  Assessment,
  ArrowForward,
  Inventory,
  Receipt,
  LockReset,
  PersonAdd,
} from "@mui/icons-material";
import API from "../../api/accountAdmin";
import { getPendingSubmissions } from "../../api/submissions";
import AnimatedNumber from '../../components/AnimatedNumber';
import DashboardSkeleton from '../../components/DashboardSkeleton';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [pendingResetCount, setPendingResetCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await API.get("/admin/dashboard");
        setStats(response.data);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const fetchResetRequests = async () => {
      try {
        const response = await getPendingSubmissions();
        const resets = (
          Array.isArray(response.data) ? response.data : []
        ).filter((s) => s.type === "password_reset");
        setPendingResetCount(resets.length);
      } catch (error) {
        console.error("Failed to fetch reset requests:", error);
      }
    };
    fetchResetRequests();
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: 420, display: "grid", placeItems: "center" }}>
        <DashboardSkeleton />
      </Box>
    );
  }

  const palette = {
    primary: "#066649",
    primaryDark: "#07543E",
    mint: "#D8F3E5",
    mintSoft: "#EFF9F1",
    mintBorder: "#D8EEE8",
    text: "#173F3A",
    muted: "#6B817C",
    white: "#FFFFFF",
  };

  const getStatStyles = (name) => {
    switch (String(name || "").toLowerCase()) {
      case "blue":
        return {
          colorHex: "#066649",
          background: "linear-gradient(135deg,#DDF7EF,#B8EBDD)",
        };
      case "green":
        return {
          colorHex: "#15806F",
          background: "linear-gradient(135deg,#E7FAF3,#C9F1E5)",
        };
      case "orange":
        return {
          colorHex: "#A56A18",
          background: "linear-gradient(135deg,#FFF7E7,#F9E3B7)",
        };
      case "red":
        return {
          colorHex: "#B45353",
          background: "linear-gradient(135deg,#FFF1F0,#F8D5D1)",
        };
      case "teal":
        return {
          colorHex: "#066649",
          background: "linear-gradient(135deg,#D8F3E5,#C8EED9)",
        };
      case "purple":
        return {
          colorHex: "#5F6F9E",
          background: "linear-gradient(135deg,#F0F3FB,#DCE4F5)",
        };
      default:
        return {
          colorHex: "#066649",
          background: "linear-gradient(135deg,#D8F3E5,#D1FAE5)",
        };
    }
  };

  const statCards = [
    {
      label: "Total Users",
      value: stats?.totalUsers || 0,
      icon: <People />,
      color: "blue",
      link: "/admin/accounts/clients",
    },
    {
      label: "Total Products",
      value: stats?.totalProducts || 0,
      icon: <Inventory />,
      color: "green",
      link: "/admin/reports",
    },
    {
      label: "Transactions",
      value: stats?.totalTransactions || 0,
      icon: <Receipt />,
      color: "orange",
      link: "/admin/reports",
    },
    {
      label: "Pending Staff",
      value: stats?.pendingStaff || 0,
      icon: <Pending />,
      color: "red",
      link: "/admin/approvals/staff",
    },
    {
      label: "Pending Clients",
      value: stats?.pendingClients || 0,
      icon: <PersonAdd />,
      color: "teal",
      link: "/admin/approvals/clients",
    },
    {
      label: "Pending Submissions",
      value: stats?.pendingSubmissions || 0,
      icon: <Description />,
      color: "purple",
      link: "/admin/approvals/submissions",
    },
  ];

  const quickActions = [
    {
      label: "Manage Accounts",
      icon: <People />,
      color: "blue",
      link: "/admin/accounts/clients",
      desc: "View & manage all user accounts",
    },
    {
      label: "Staff Approvals",
      icon: <CheckCircle />,
      color: "orange",
      link: "/admin/approvals/staff",
      desc: "Approve pending staff registrations",
    },
    {
      label: "Submissions",
      icon: <Description />,
      color: "purple",
      link: "/admin/approvals/submissions",
      desc: "Review submitted reports",
    },
    {
      label: "Generate Reports",
      icon: <Assessment />,
      color: "green",
      link: "/admin/reports",
      desc: "View system analytics & reports",
    },
    {
      label: "Product Monitor",
      icon: <Inventory />,
      color: "teal",
      link: "/admin/product-monitor",
      desc: "Monitor stock levels & export list",
    },
  ];

  return (
    <Box
      className="page-container"
      sx={{
        minHeight: "100vh",
        px: { xs: 1.5, sm: 2, md: 2.5 },
        py: { xs: 1.5, md: 2.5 },
        background: `radial-gradient(circle at 8% 0%, rgba(200,238,217,.18), transparent 24%), linear-gradient(180deg,#FBFFFD 0%,#EFF5E7 100%)`,
      }}
    >
      {pendingResetCount > 0 && (
        <Alert
          severity="warning"
          icon={<LockReset fontSize="small" />}
          action={
            <Button
              size="small"
              onClick={() => navigate("/admin/approvals/submissions")}
              sx={{ color: "#9A681A", fontWeight: 900, textTransform: "none" }}
            >
              Review
            </Button>
          }
          sx={{
            mb: 2.5,
            borderRadius: "14px",
            border: "1px solid #F3D7A0",
            bgcolor: "#FFF9ED",
            alignItems: "center",
            "& .MuiAlert-message": { fontSize: ".75rem", fontWeight: 800 },
          }}
        >
          {pendingResetCount} password reset request
          {pendingResetCount > 1 ? "s" : ""} awaiting your approval
        </Alert>
      )}

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="end"
        sx={{ mb: 1.4 }}
      >
        <Box>
          <Typography
            sx={{ color: palette.text, fontSize: "1rem", fontWeight: 950 }}
          >
            Store overview
          </Typography>
          <Typography
            sx={{ mt: 0.25, color: palette.muted, fontSize: ".68rem" }}
          >
            A quick snapshot of your StoreHub activity.
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        {statCards.map((stat) => {
          const styles = getStatStyles(stat.color);
          return (
            <Grid item xs={12} sm={6} md={4} key={stat.label}>
              <Card
                elevation={0}
                onClick={() => navigate(stat.link)}
                sx={{
                  height: "100%",
                  cursor: "pointer",
                  bgcolor: "rgba(255,255,255,.94)",
                  border: `1px solid ${palette.mintBorder}`,
                  borderRadius: "18px",
                  boxShadow: "0 8px 24px rgba(17,94,89,.045)",
                  transition:
                    "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 16px 34px rgba(17,94,89,.09)",
                    borderColor: "#B9DED5",
                  },
                }}
              >
                <CardContent sx={{ p: "18px !important" }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Box
                      sx={{
                        width: 45,
                        height: 45,
                        display: "grid",
                        placeItems: "center",
                        background: styles.background,
                        color: styles.colorHex,
                        borderRadius: "13px",
                        "& svg": { fontSize: 21 },
                      }}
                    >
                      {stat.icon}
                    </Box>
                    <ArrowForward sx={{ color: "#A8BCB7", fontSize: 18 }} />
                  </Stack>
                  <Typography
                    sx={{
                      mt: 1.7,
                      color: palette.text,
                      fontSize: "1.55rem",
                      lineHeight: 1,
                      fontWeight: 950,
                    }}
                  >
                    <AnimatedNumber value={stat.value} />
                  </Typography>
                  <Typography
                    sx={{
                      mt: 0.65,
                      color: palette.muted,
                      fontSize: ".7rem",
                      fontWeight: 800,
                    }}
                  >
                    {stat.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Box sx={{ mb: 1.4 }}>
        <Typography
          sx={{ color: palette.text, fontSize: "1rem", fontWeight: 950 }}
        >
          Quick actions
        </Typography>
        <Typography sx={{ mt: 0.25, color: palette.muted, fontSize: ".68rem" }}>
          Jump directly to common admin tasks.
        </Typography>
      </Box>

      <Grid container spacing={1.5}>
        {quickActions.map((action) => {
          const styles = getStatStyles(action.color);
          return (
            <Grid item xs={12} sm={6} md={4} lg={2.4} key={action.label}>
              <Card
                onClick={() => navigate(action.link)}
                elevation={0}
                sx={{
                  height: "100%",
                  cursor: "pointer",
                  p: 1.8,
                  bgcolor: "rgba(255,255,255,.94)",
                  border: `1px solid ${palette.mintBorder}`,
                  borderRadius: "18px",
                  transition:
                    "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    borderColor: "#B9DED5",
                    boxShadow: "0 14px 30px rgba(17,94,89,.08)",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    display: "grid",
                    placeItems: "center",
                    background: styles.background,
                    color: styles.colorHex,
                    borderRadius: "12px",
                    mb: 1.4,
                    "& svg": { fontSize: 20 },
                  }}
                >
                  {action.icon}
                </Box>
                <Typography
                  sx={{
                    color: palette.text,
                    fontSize: ".78rem",
                    fontWeight: 900,
                  }}
                >
                  {action.label}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.45,
                    minHeight: 34,
                    color: palette.muted,
                    fontSize: ".64rem",
                    lineHeight: 1.5,
                  }}
                >
                  {action.desc}
                </Typography>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{ mt: 1.2, color: palette.primary }}
                >
                  <Typography sx={{ fontSize: ".62rem", fontWeight: 900 }}>
                    Open
                  </Typography>
                  <ArrowForward sx={{ fontSize: 14 }} />
                </Stack>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default AdminDashboard;
