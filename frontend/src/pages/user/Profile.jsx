import React, { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Avatar,
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
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  AccountCircleOutlined,
  BadgeOutlined,
  CheckCircleRounded,
  CloseRounded,
  EmailOutlined,
  InfoOutlined,
  KeyRounded,
  LockOutlined,
  PersonOutlineRounded,
  PinDropOutlined,
  SecurityRounded,
  StorefrontRounded,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import { useAuth } from "../../contexts/AuthContext";
import API from "../../api/axios";

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [nameFields, setNameFields] = useState({
    first_name: user?.first_name || "",
    middle_name: user?.middle_name || "",
    last_name: user?.last_name || "",
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  useEffect(() => {
    let active = true;
    API.get("/auth/me")
      .then(({ data }) => {
        if (!active) return;
        updateUser(data);
        setNameFields({ first_name: data.first_name || "", middle_name: data.middle_name || "", last_name: data.last_name || "" });
      })
      .catch(() => {
        if (active) setProfileError("Unable to load your latest profile. Refresh the page to try again.");
      })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [updateUser]);

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (profileSaving || profileLoading) return;
    setProfileError("");
    setProfileSuccess("");
    const names = Object.fromEntries(Object.entries(nameFields).map(([key, value]) => [key, value.trim()]));
    if (!names.first_name || !names.last_name) {
      setProfileError("Please enter your first and last name.");
      return;
    }
    if (Object.values(names).filter(Boolean).join(" ").length > 100) {
      setProfileError("Your full name must not exceed 100 characters.");
      return;
    }
    setProfileSaving(true);
    try {
      const { data } = await API.put("/auth/profile", names);
      updateUser(data.user);
      setNameFields(names);
      setProfileSuccess(data.message || "Profile updated successfully.");
    } catch (error) {
      setProfileError(error.response?.data?.message || "Unable to save your profile. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  const [changeOpen, setChangeOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [changeError, setChangeError] = useState("");
  const [changeSuccess, setChangeSuccess] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);

  const normalizedRole = String(user?.role || "").toLowerCase();

  const roleConfig = {
    admin: {
      label: "Administrator",
      color: "#B91C1C",
      background: "#FEF2F2",
      border: "#FECACA",
    },
    staff: {
      label: "Staff",
      color: "#2563EB",
      background: "#EFF6FF",
      border: "#DBEAFE",
    },
    client: {
      label: "Client",
      color: "#047857",
      background: "#D8F3E5",
      border: "#A7F3D0",
    },
  };

  const currentRole = roleConfig[normalizedRole] || {
    label: user?.role || "User",
    color: "#4C695A",
    background: "var(--sh-page-tint)",
    border: "#D5E5D9",
  };

  const initials = useMemo(() => {
    const name = String(user?.name || "").trim();

    if (!name) return "U";

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, [user?.name]);

  const accountId =
    user?.user_id || user?.account_id || (user?.id ? `#${user.id}` : "—");

  const infoItems = [
    {
      icon: <PinDropOutlined />,
      label: "Account ID",
      value: accountId,
    },
    {
      icon: <PersonOutlineRounded />,
      label: "Full Name",
      value: user?.name || "—",
    },
    {
      icon: <EmailOutlined />,
      label: "Email Address",
      value: user?.email || "—",
    },
    {
      icon: <BadgeOutlined />,
      label: "Account Role",
      value: currentRole.label,
    },
  ];

  const passwordChecks = {
    minLength: newPassword.length >= 6,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /\d/.test(newPassword),
  };

  const strongPassword =
    passwordChecks.minLength &&
    passwordChecks.upper &&
    passwordChecks.lower &&
    passwordChecks.number;

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setChangeError("");
    setChangeSuccess("");

    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const openPasswordDialog = () => {
    resetPasswordForm();
    setChangeOpen(true);
  };

  const closePasswordDialog = () => {
    if (changeLoading) return;

    setChangeOpen(false);
    resetPasswordForm();
  };

  const handleChangePassword = async () => {
    setChangeError("");
    setChangeSuccess("");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setChangeError("Please complete all password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setChangeError("New password must contain at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setChangeError("New passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setChangeError(
        "Your new password must be different from your current password.",
      );
      return;
    }

    setChangeLoading(true);

    try {
      const response = await API.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      setChangeSuccess(
        response?.data?.message || "Password updated successfully.",
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      setTimeout(() => {
        setChangeOpen(false);
        setChangeSuccess("");
      }, 1400);
    } catch (error) {
      console.error("Password change failed:", error);

      setChangeError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to change password.",
      );
    } finally {
      setChangeLoading(false);
    }
  };

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
          mb: 3,
        }}
      >
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
          My Profile
        </Typography>

        <Typography
          sx={{
            mt: 0.7,
            color: "#617B6C",
            fontSize: 14,
          }}
        >
          Review your account information and manage account security.
        </Typography>
      </Box>

      <Grid
        container
        spacing={2.5}
        sx={{
          maxWidth: 1100,
          mx: "auto",
        }}
      >
        {/* LEFT PROFILE CARD */}

        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              position: "relative",
              overflow: "hidden",
              height: "100%",
              p: 3,
              borderRadius: 5,
              color: "#FFFFFF",
              background:
                "linear-gradient(145deg, #022C22 0%, #064E3B 50%, #047857 100%)",
              boxShadow: "0 18px 45px rgba(6,78,59,.14)",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                width: 240,
                height: 240,
                borderRadius: "50%",
                right: -110,
                top: -120,
                background:
                  "radial-gradient(circle, rgba(253,230,138,.16), transparent 70%)",
              }}
            />

            <Box
              sx={{
                position: "absolute",
                width: 180,
                height: 180,
                borderRadius: "50%",
                left: -100,
                bottom: -100,
                bgcolor: "rgba(255,255,255,.035)",
              }}
            />

            <Box
              sx={{
                position: "relative",
                zIndex: 2,
                textAlign: "center",
              }}
            >
              <Stack
                direction="row"
                spacing={0.8}
                justifyContent="center"
                alignItems="center"
                sx={{
                  mb: 3,
                }}
              >
                <StorefrontRounded
                  sx={{
                    color: "#FDE68A",
                    fontSize: 18,
                  }}
                />

                <Typography
                  sx={{
                    color: "rgba(255,255,255,.62)",
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: ".12em",
                  }}
                >
                  StoreHub Account
                </Typography>
              </Stack>

              <Box
                sx={{
                  position: "relative",
                  display: "inline-flex",
                }}
              >
                <Avatar
                  sx={{
                    width: 112,
                    height: 112,
                    bgcolor: "rgba(255,255,255,.12)",
                    color: "#FFFFFF",
                    fontSize: 36,
                    fontWeight: 900,
                    border: "4px solid rgba(255,255,255,.12)",
                    boxShadow: "0 14px 32px rgba(0,0,0,.18)",
                  }}
                >
                  {initials}
                </Avatar>

                <Box
                  sx={{
                    position: "absolute",
                    right: 4,
                    bottom: 5,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    bgcolor: "#34D399",
                    border: "4px solid #065F46",
                  }}
                />
              </Box>

              <Typography
                sx={{
                  mt: 2.2,
                  fontSize: 21,
                  fontWeight: 900,
                  letterSpacing: "-.02em",
                }}
              >
                {user?.name || "StoreHub User"}
              </Typography>

              <Typography
                sx={{
                  mt: 0.5,
                  color: "rgba(255,255,255,.6)",
                  fontSize: 11.5,
                }}
              >
                {user?.email || "No email available"}
              </Typography>

              <Chip
                label={currentRole.label}
                sx={{
                  mt: 1.8,
                  bgcolor: "rgba(255,255,255,.1)",
                  color: "#FFFFFF",
                  border: "1px solid rgba(255,255,255,.13)",
                  fontWeight: 800,
                }}
              />

              <Divider
                sx={{
                  my: 3,
                  borderColor: "rgba(255,255,255,.10)",
                }}
              />

              <Box
                sx={{
                  p: 2,
                  textAlign: "left",
                  borderRadius: 3,
                  bgcolor: "rgba(255,255,255,.07)",
                  border: "1px solid rgba(255,255,255,.09)",
                }}
              >
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <SecurityRounded
                    sx={{
                      color: "#FDE68A",
                    }}
                  />

                  <Box>
                    <Typography
                      sx={{
                        fontSize: 12.5,
                        fontWeight: 800,
                      }}
                    >
                      Account Security
                    </Typography>

                    <Typography
                      sx={{
                        mt: 0.3,
                        color: "rgba(255,255,255,.58)",
                        fontSize: 10.5,
                        lineHeight: 1.5,
                      }}
                    >
                      Keep your password private and update it if you suspect
                      unauthorized access.
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* RIGHT CONTENT */}

        <Grid item xs={12} md={8}>
          <Stack spacing={2.5}>
            {normalizedRole === "client" && (
              <Paper component="form" onSubmit={handleSaveProfile} elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 5, bgcolor: "var(--sh-glass-bg)", border: "1px solid #D5E5D9" }}>
                <Typography sx={{ color: "#183D32", fontSize: 17, fontWeight: 850 }}>Edit Personal Information</Typography>
                <Typography sx={{ color: "#839B8C", fontSize: 12, mt: 0.5, mb: 2.5 }}>Update your name. Middle name is optional.</Typography>
                {profileError && <Alert severity="error" sx={{ mb: 2 }}>{profileError}</Alert>}
                {profileSuccess && <Alert severity="success" sx={{ mb: 2 }}>{profileSuccess}</Alert>}
                <Grid container spacing={2}>
                  {[
                    { key: "first_name", label: "First Name", autocomplete: "given-name" },
                    { key: "middle_name", label: "Middle Name", autocomplete: "additional-name" },
                    { key: "last_name", label: "Last Name", autocomplete: "family-name" },
                  ].map((field) => (
                    <Grid item xs={12} sm={4} key={field.key}>
                      <TextField fullWidth label={field.label} value={nameFields[field.key]} required={field.key !== "middle_name"} autoComplete={field.autocomplete} inputProps={{ maxLength: 100 }} disabled={profileLoading || profileSaving} onChange={(event) => {
                        setNameFields((current) => ({ ...current, [field.key]: event.target.value }));
                        setProfileSuccess("");
                      }} />
                    </Grid>
                  ))}
                </Grid>
                <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-end" }}>
                  <Button type="submit" variant="contained" disabled={profileLoading || profileSaving} sx={{ bgcolor: "#047857", "&:hover": { bgcolor: "#065F46" } }}>
                    {profileLoading ? "Loading profile..." : profileSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </Box>
              </Paper>
            )}
            {/* ACCOUNT INFO */}

            <Paper
              elevation={0}
              sx={{
                p: {
                  xs: 2.5,
                  sm: 3,
                },
                borderRadius: 5,
                bgcolor: "var(--sh-glass-bg)",
                border: "1px solid #D5E5D9",
              }}
            >
              <Stack
                direction="row"
                spacing={1.2}
                alignItems="center"
                sx={{
                  mb: 2.5,
                }}
              >
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
                  <AccountCircleOutlined />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      color: "#183D32",
                      fontSize: 17,
                      fontWeight: 850,
                    }}
                  >
                    Account Information
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.2,
                      color: "#839B8C",
                      fontSize: 11,
                    }}
                  >
                    Your registered StoreHub account details.
                  </Typography>
                </Box>
              </Stack>

              <Grid container spacing={1.8}>
                {infoItems.map((item) => (
                  <Grid item xs={12} sm={6} key={item.label}>
                    <Box
                      sx={{
                        height: "100%",
                        p: 2,
                        borderRadius: 3,
                        bgcolor: "var(--sh-page-tint)",
                        border: "1px solid #EDF3E8",
                        transition: "all .2s ease",

                        "&:hover": {
                          bgcolor: "#F0FDF4",
                          borderColor: "#D1FAE5",
                          transform: "translateY(-2px)",
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1.3} alignItems="center">
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            flexShrink: 0,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: "var(--sh-glass-bg)",
                            color: "#059669",
                            border: "1px solid #D5E5D9",
                            borderRadius: 2.5,
                          }}
                        >
                          {item.icon}
                        </Box>

                        <Box
                          sx={{
                            minWidth: 0,
                          }}
                        >
                          <Typography
                            sx={{
                              color: "#839B8C",
                              fontSize: 9.5,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: ".06em",
                            }}
                          >
                            {item.label}
                          </Typography>

                          <Typography
                            sx={{
                              mt: 0.3,
                              color: "#183D32",
                              fontSize: 13,
                              fontWeight: 750,
                              wordBreak: "break-word",
                            }}
                          >
                            {item.value}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>

            {/* SECURITY */}

            <Paper
              elevation={0}
              sx={{
                p: {
                  xs: 2.5,
                  sm: 3,
                },
                borderRadius: 5,
                bgcolor: "var(--sh-glass-bg)",
                border: "1px solid #D5E5D9",
              }}
            >
              <Stack
                direction={{
                  xs: "column",
                  sm: "row",
                }}
                spacing={2}
                alignItems={{
                  xs: "stretch",
                  sm: "center",
                }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1.3} alignItems="center">
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "#EFF6FF",
                      color: "#2563EB",
                      borderRadius: 2.5,
                    }}
                  >
                    <KeyRounded />
                  </Box>

                  <Box>
                    <Typography
                      sx={{
                        color: "#183D32",
                        fontSize: 15,
                        fontWeight: 850,
                      }}
                    >
                      Password & Security
                    </Typography>

                    <Typography
                      sx={{
                        mt: 0.3,
                        color: "#617B6C",
                        fontSize: 11.5,
                        lineHeight: 1.6,
                      }}
                    >
                      Change your password regularly to help protect your
                      account.
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  variant="contained"
                  startIcon={<LockOutlined />}
                  onClick={openPasswordDialog}
                  sx={{
                    minHeight: 43,
                    px: 2.2,
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
                  Change Password
                </Button>
              </Stack>
            </Paper>

            {/* STORE INFO */}

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                bgcolor: "#FFFBEB",
                border: "1px solid #FDE68A",
              }}
            >
              <Stack direction="row" spacing={1.3} alignItems="flex-start">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "var(--sh-glass-bg)",
                    color: "#D97706",
                    borderRadius: 2.5,
                  }}
                >
                  <InfoOutlined />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      color: "#92400E",
                      fontSize: 12.5,
                      fontWeight: 850,
                    }}
                  >
                    Walk-in Store Information
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.5,
                      color: "#78716C",
                      fontSize: 11.5,
                      lineHeight: 1.7,
                    }}
                  >
                    Store transactions are processed in-store. For account or
                    transaction concerns, contact the StoreHub staff or
                    Administrator.
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      {/* =====================================================
          CHANGE PASSWORD DIALOG
      ====================================================== */}

      <Dialog
        open={changeOpen}
        onClose={closePasswordDialog}
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
                "linear-gradient(135deg, #022C22 0%, #047857 55%, #059669 100%)",
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
                  border: "1px solid rgba(255,255,255,.15)",
                  borderRadius: 3,
                }}
              >
                <SecurityRounded />
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    fontSize: 20,
                    fontWeight: 850,
                  }}
                >
                  Change Password
                </Typography>

                <Typography
                  sx={{
                    mt: 0.3,
                    color: "rgba(255,255,255,.68)",
                    fontSize: 12,
                  }}
                >
                  Update your StoreHub account password securely.
                </Typography>
              </Box>

              <IconButton
                disabled={changeLoading}
                onClick={closePasswordDialog}
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
          {changeError && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                borderRadius: 3,
              }}
            >
              {changeError}
            </Alert>
          )}

          {changeSuccess && (
            <Alert
              severity="success"
              icon={<CheckCircleRounded />}
              sx={{
                mb: 2.5,
                borderRadius: 3,
              }}
            >
              {changeSuccess}
            </Alert>
          )}

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Current Password"
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              disabled={changeLoading}
              onChange={(event) => setCurrentPassword(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined />
                  </InputAdornment>
                ),

                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      type="button"
                      edge="end"
                      onClick={() =>
                        setShowCurrentPassword((previous) => !previous)
                      }
                    >
                      {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="New Password"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              disabled={changeLoading}
              onChange={(event) => setNewPassword(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <KeyRounded />
                  </InputAdornment>
                ),

                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      type="button"
                      edge="end"
                      onClick={() =>
                        setShowNewPassword((previous) => !previous)
                      }
                    >
                      {showNewPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Confirm New Password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmNewPassword}
              disabled={changeLoading}
              error={
                Boolean(confirmNewPassword) &&
                newPassword !== confirmNewPassword
              }
              helperText={
                confirmNewPassword && newPassword !== confirmNewPassword
                  ? "Passwords do not match."
                  : ""
              }
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <KeyRounded />
                  </InputAdornment>
                ),

                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      type="button"
                      edge="end"
                      onClick={() =>
                        setShowConfirmPassword((previous) => !previous)
                      }
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          {newPassword && (
            <Paper
              elevation={0}
              sx={{
                mt: 2.5,
                p: 2,
                bgcolor: strongPassword ? "#D8F3E5" : "#F7F5EC",
                border: `1px solid ${strongPassword ? "#A7F3D0" : "#D5E5D9"}`,
                borderRadius: 3,
              }}
            >
              <Typography
                sx={{
                  mb: 1.2,
                  color: "#617B6C",
                  fontSize: 10,
                  fontWeight: 850,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                }}
              >
                Password Check
              </Typography>

              <Grid container spacing={1}>
                {[
                  {
                    label: "At least 6 characters",
                    passed: passwordChecks.minLength,
                  },
                  {
                    label: "Uppercase letter",
                    passed: passwordChecks.upper,
                  },
                  {
                    label: "Lowercase letter",
                    passed: passwordChecks.lower,
                  },
                  {
                    label: "Number",
                    passed: passwordChecks.number,
                  },
                ].map((check) => (
                  <Grid item xs={12} sm={6} key={check.label}>
                    <Stack direction="row" spacing={0.7} alignItems="center">
                      <CheckCircleRounded
                        sx={{
                          fontSize: 15,
                          color: check.passed ? "#059669" : "#CBD5E1",
                        }}
                      />

                      <Typography
                        sx={{
                          color: check.passed ? "#047857" : "#839B8C",
                          fontSize: 10.5,
                          fontWeight: 650,
                        }}
                      >
                        {check.label}
                      </Typography>
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}
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
            disabled={changeLoading}
            onClick={closePasswordDialog}
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
            disabled={changeLoading}
            onClick={handleChangePassword}
            startIcon={changeLoading ? null : <SecurityRounded />}
            sx={{
              minWidth: 170,
              minHeight: 44,
              bgcolor: "#047857",
              borderRadius: 3,
              textTransform: "none",
              fontWeight: 850,

              "&:hover": {
                bgcolor: "#065F46",
              },
            }}
          >
            {changeLoading ? (
              <>
                <CircularProgress
                  size={18}
                  sx={{
                    mr: 1,
                    color: "#FFFFFF",
                  }}
                />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Profile;
