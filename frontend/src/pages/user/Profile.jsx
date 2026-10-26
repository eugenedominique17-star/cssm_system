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
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  AccountCircleOutlined,
  BadgeOutlined,
  CalendarMonthRounded,
  CheckCircleRounded,
  CloseRounded,
  EmailOutlined,
  EditRounded,
  HomeRounded,
  InfoOutlined,
  KeyRounded,
  LockOutlined,
  PhoneOutlined,
  PersonOutlineRounded,
  SecurityRounded,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import { useAuth } from "../../contexts/AuthContext";
import API from "../../api/accountAdmin";

const manilaToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const profileFieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 2.5,
    bgcolor: "#F9FCFA",
    transition: "background-color .2s ease, box-shadow .2s ease",
    "& fieldset": { borderColor: "#DCE9E1" },
    "&:hover fieldset": { borderColor: "#A8CEC5" },
    "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(6,102,73,.07)" },
    "&.Mui-focused fieldset": { borderColor: "#047857" },
  },
  "& .MuiInputLabel-root": { color: "#70877C" },
  "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "#203B34" },
  "& .MuiOutlinedInput-root.Mui-disabled": { bgcolor: "#F8FAF9" },
};

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileFields, setProfileFields] = useState({
    first_name: user?.first_name || "",
    middle_name: user?.middle_name || "",
    last_name: user?.last_name || "",
    birthdate: user?.birthdate ? String(user.birthdate).split("T")[0] : "",
    gender: String(user?.gender || "").toLowerCase(),
    address: user?.address || "",
    phone: user?.phone || "",
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
        setProfileFields({
          first_name: data.first_name || "",
          middle_name: data.middle_name || "",
          last_name: data.last_name || "",
          birthdate: data.birthdate ? String(data.birthdate).split("T")[0] : "",
          gender: String(data.gender || "").toLowerCase(),
          address: data.address || "",
          phone: data.phone || "",
        });
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
    const profile = Object.fromEntries(Object.entries(profileFields).map(([key, value]) => [key, value.trim()]));
    if (!profile.first_name || !profile.last_name) {
      setProfileError("Please enter your first and last name.");
      return;
    }
    if ([profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ").length > 100) {
      setProfileError("Your full name must not exceed 100 characters.");
      return;
    }
    if (profile.phone.length > 30 || profile.address.length > 500) {
      setProfileError("Phone number must be 30 characters or less and address 500 characters or less.");
      return;
    }
    setProfileSaving(true);
    try {
      const { data } = await API.put("/auth/profile", {
        first_name: profile.first_name,
        middle_name: profile.middle_name,
        last_name: profile.last_name,
        address: profile.address,
        phone: profile.phone,
      });
      updateUser(data.user);
      setProfileFields(profile);
      setProfileSuccess(data.message || "Profile updated successfully.");
      setEditingProfile(false);
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
  const memberSince = user?.created_at
    ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(user.created_at))
    : "—";

  const cancelProfileEdit = () => {
    setProfileFields({
      first_name: user?.first_name || "",
      middle_name: user?.middle_name || "",
      last_name: user?.last_name || "",
      birthdate: user?.birthdate ? String(user.birthdate).split("T")[0] : "",
      gender: String(user?.gender || "").toLowerCase(),
      address: user?.address || "",
      phone: user?.phone || "",
    });
    setProfileError("");
    setProfileSuccess("");
    setEditingProfile(false);
  };

  const infoItems = [
    {
      icon: <BadgeOutlined />,
      label: "Account Role",
      value: currentRole.label,
    },
    {
      icon: <CalendarMonthRounded />,
      label: "Member Since",
      value: memberSince,
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
        background:
          "radial-gradient(ellipse at 8% 0%, rgba(16,185,129,.09), transparent 34%), var(--sh-page-tint)",
        p: {
          xs: 2,
          sm: 3,
        },
      }}
    >
      {/* HEADER */}

      <Box
        sx={{
          mb: 1.5,
          maxWidth: 1180,
          mx: "auto",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "#46675D" }}>
          <HomeRounded sx={{ fontSize: 19 }} />
          <Typography sx={{ color: "#9AAFA5" }}>/</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Profile</Typography>
        </Stack>
      </Box>

      <Grid
        container
        spacing={2.5}
        sx={{
          maxWidth: 1180,
          mx: "auto",
          alignItems: "start",
        }}
      >
        {/* LEFT PROFILE CARD */}

        <Grid item xs={12} md={12}>
          <Paper
            elevation={0}
            sx={{
              position: "relative",
              overflow: "hidden",
              p: { xs: 2.25, sm: 3.5 },
              borderRadius: { xs: 4, sm: 5 },
              color: "#FFFFFF",
              background: "linear-gradient(112deg, #092E27 0%, #0C4939 54%, #087F5B 100%)",
              boxShadow: "0 24px 56px rgba(6,78,59,.16)",
              "&::after": {
                content: '""',
                position: "absolute",
                inset: 0,
                opacity: 0.18,
                pointerEvents: "none",
                backgroundImage: "radial-gradient(rgba(255,255,255,.5) .7px, transparent .7px)",
                backgroundSize: "12px 12px",
                maskImage: "linear-gradient(90deg, transparent 20%, black 100%)",
              },
            }}
          >
            <Box
              sx={{
                position: "absolute",
                width: { xs: 210, sm: 310 },
                height: { xs: 210, sm: 310 },
                borderRadius: "50%",
                right: { xs: -115, sm: -45 },
                top: { xs: -145, sm: -190 },
                background:
                  "radial-gradient(circle, rgba(190,242,100,.34), rgba(190,242,100,.06) 44%, transparent 72%)",
              }}
            />

            <Box
              sx={{
                position: "absolute",
                width: 210,
                height: 210,
                borderRadius: "50%",
                right: { xs: -110, sm: 90 },
                bottom: -180,
                border: "1px solid rgba(255,255,255,.12)",
                boxShadow: "0 0 0 24px rgba(255,255,255,.025), 0 0 0 52px rgba(255,255,255,.02)",
              }}
            />

            <Box
              sx={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                gap: { xs: 2, sm: 3 },
                flexWrap: "wrap",
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  display: "inline-flex",
                  flexShrink: 0,
                }}
              >
                <Avatar
                  sx={{
                    width: { xs: 64, sm: 88 },
                    height: { xs: 64, sm: 88 },
                    bgcolor: "rgba(209,250,229,.16)",
                    color: "#FFFFFF",
                    fontSize: { xs: 22, sm: 30 },
                    fontWeight: 900,
                    border: "3px solid rgba(209,250,229,.3)",
                    boxShadow: "0 12px 28px rgba(0,0,0,.22)",
                  }}
                >
                  {initials}
                </Avatar>
              </Box>
              <Box
                sx={{
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <Chip
                  label={currentRole.label}
                  size="small"
                  sx={{
                    mb: 0.9,
                    bgcolor: "rgba(190,242,100,.16)",
                    color: "#D9F99D",
                    border: "1px solid rgba(190,242,100,.2)",
                    fontWeight: 750,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: { xs: 21, sm: 27 },
                    fontWeight: 850,
                    letterSpacing: "-.035em",
                    lineHeight: 1.2,
                    overflowWrap: "anywhere",
                  }}
                >
                  {user?.name || "StoreHub User"}
                </Typography>
                <Typography sx={{ mt: 0.5, color: "rgba(255,255,255,.68)", fontSize: 12 }}>
                  Welcome to StoreHub! Manage your account information here.
                </Typography>
                <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                  {[
                    { icon: <EmailOutlined />, value: user?.email },
                    { icon: <PhoneOutlined />, value: user?.phone },
                    {
                      icon: <CalendarMonthRounded />,
                      value: user?.birthdate ? new Date(user.birthdate).toLocaleDateString() : null,
                    },
                    { icon: <BadgeOutlined />, value: accountId },
                  ].filter((item) => item.value).map((item, index) => (
                    <Stack
                      key={`${item.value}-${index}`}
                      direction="row"
                      spacing={0.65}
                      alignItems="center"
                      sx={{
                        minWidth: 0,
                        px: 1,
                        py: 0.65,
                        borderRadius: 2,
                        bgcolor: "rgba(255,255,255,.09)",
                        color: "rgba(255,255,255,.9)",
                      }}
                    >
                      {React.cloneElement(item.icon, { sx: { fontSize: 15, flexShrink: 0 } })}
                      <Typography sx={{ fontSize: 10.5, overflowWrap: "anywhere" }}>{item.value}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Stack
            direction="row"
            spacing={0.8}
            useFlexGap
            flexWrap="wrap"
            sx={{ mb: 0.2 }}
          >
            <Button
              startIcon={<PersonOutlineRounded />}
              aria-current="page"
              sx={{
                minHeight: 44,
                px: 2,
                borderRadius: "14px 14px 6px 6px",
                color: "#087F5B",
                bgcolor: "#D8F3E5",
                borderBottom: "3px solid #087F5B",
                textTransform: "none",
                fontSize: 13,
                fontWeight: 750,
                "&:hover": { bgcolor: "#D8F3E5" },
              }}
            >
              Personal Information
            </Button>
          </Stack>
        </Grid>

        {/* RIGHT CONTENT */}

        <Grid item xs={12} md={12}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                md: normalizedRole === "client"
                  ? "minmax(0, 1.65fr) minmax(280px, .9fr)"
                  : "minmax(0, 1fr)",
              },
              gap: 2.5,
              alignItems: "start",
            }}
          >
            {normalizedRole === "client" && (
              <Paper
                id="profile-personal"
                component="form"
                onSubmit={handleSaveProfile}
                elevation={0}
                sx={{
                  gridColumn: { md: "1" },
                  minWidth: 0,
                  p: { xs: 2.25, sm: 3.1 },
                  borderRadius: 4,
                  bgcolor: "var(--sh-glass-bg)",
                  border: "1px solid #D5E5D9",
                  boxShadow: "0 12px 32px rgba(24,61,50,.045)",
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  sx={{ mb: 2.75 }}
                >
                  <Stack direction="row" spacing={1.35} alignItems="center">
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 2.5,
                        bgcolor: "#D8F3E5",
                        color: "#047857",
                      }}
                    >
                      <PersonOutlineRounded />
                    </Box>
                    <Box>
                      <Typography sx={{ color: "#183D32", fontSize: 17, fontWeight: 850 }}>
                        Personal Information
                      </Typography>
                      <Typography sx={{ color: "#839B8C", fontSize: 12, mt: 0.35 }}>
                        Keep your contact details up to date.
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    type="button"
                    size="small"
                    startIcon={editingProfile ? <CloseRounded /> : <EditRounded />}
                    onClick={() => editingProfile ? cancelProfileEdit() : setEditingProfile(true)}
                    sx={{
                      minHeight: 39,
                      px: 1.5,
                      border: "1px solid #A7E4D3",
                      borderRadius: 2.5,
                      color: "#087F5B",
                      bgcolor: "#FBFFFD",
                      textTransform: "none",
                      fontWeight: 750,
                      "&:hover": { bgcolor: "#EFFAF5" },
                    }}
                  >
                    {editingProfile ? "Cancel" : "Edit Profile"}
                  </Button>
                </Stack>

                {profileError && <Alert severity="error" sx={{ mb: 2.25, borderRadius: 2.5 }}>{profileError}</Alert>}
                {profileSuccess && <Alert severity="success" sx={{ mb: 2.25, borderRadius: 2.5 }}>{profileSuccess}</Alert>}
                <Grid container spacing={2}>
                  {[
                    { key: "first_name", label: "First Name", autocomplete: "given-name" },
                    { key: "middle_name", label: "Middle Name", autocomplete: "additional-name" },
                    { key: "last_name", label: "Last Name", autocomplete: "family-name" },
                  ].map((field) => (
                    <Grid item xs={12} sm={6} key={field.key}>
                      <TextField
                        fullWidth
                        sx={profileFieldSx}
                        label={field.label}
                        value={profileFields[field.key]}
                        required={field.key !== "middle_name"}
                        autoComplete={field.autocomplete}
                        inputProps={{ maxLength: 100 }}
                        disabled={profileLoading || profileSaving || !editingProfile}
                        onChange={(event) => {
                          setProfileFields((current) => ({ ...current, [field.key]: event.target.value }));
                          setProfileSuccess("");
                        }}
                      />
                    </Grid>
                  ))}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      sx={profileFieldSx}
                      type="date"
                      label="Birthdate"
                      value={profileFields.birthdate}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ max: manilaToday() }}
                      disabled
                      onChange={(event) => {
                        setProfileFields((current) => ({ ...current, birthdate: event.target.value }));
                        setProfileSuccess("");
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      sx={profileFieldSx}
                      select
                      label="Gender"
                      value={profileFields.gender}
                      disabled
                      onChange={(event) => {
                        setProfileFields((current) => ({ ...current, gender: event.target.value }));
                        setProfileSuccess("");
                      }}
                    >
                      <MenuItem value="">Prefer not to say</MenuItem>
                      <MenuItem value="male">Male</MenuItem>
                      <MenuItem value="female">Female</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      sx={profileFieldSx}
                      label="Phone Number"
                      type="tel"
                      autoComplete="tel"
                      value={profileFields.phone}
                      inputProps={{ maxLength: 30 }}
                      disabled={profileLoading || profileSaving || !editingProfile}
                      onChange={(event) => {
                        setProfileFields((current) => ({ ...current, phone: event.target.value }));
                        setProfileSuccess("");
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      sx={profileFieldSx}
                      label="Email Address"
                      type="email"
                      value={user?.email || ""}
                      helperText="Your email address cannot be changed."
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <LockOutlined sx={{ color: "#839B8C", fontSize: 18 }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      sx={profileFieldSx}
                      label="Address"
                      autoComplete="street-address"
                      value={profileFields.address}
                      inputProps={{ maxLength: 500 }}
                      multiline
                      minRows={2}
                      maxRows={4}
                      disabled={profileLoading || profileSaving || !editingProfile}
                      onChange={(event) => {
                        setProfileFields((current) => ({ ...current, address: event.target.value }));
                        setProfileSuccess("");
                      }}
                    />
                  </Grid>
                </Grid>
                {editingProfile && <Stack
                  direction={{ xs: "column-reverse", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  justifyContent="space-between"
                  sx={{ mt: 2.5, pt: 2.25, borderTop: "1px solid #E8F0EA" }}
                >
                  <Typography sx={{ color: "#839B8C", fontSize: 11.5, lineHeight: 1.5 }}>
                    Your email address cannot be changed.
                  </Typography>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={profileSaving ? <CircularProgress size={17} color="inherit" /> : <CheckCircleRounded />}
                    disabled={profileLoading || profileSaving || !editingProfile}
                    sx={{
                      minHeight: 44,
                      px: 2.5,
                      borderRadius: 2.5,
                      bgcolor: "#047857",
                      textTransform: "none",
                      fontWeight: 800,
                      boxShadow: "0 8px 18px rgba(4,120,87,.16)",
                      "&:hover": { bgcolor: "#065F46" },
                    }}
                  >
                    {profileLoading ? "Loading profile..." : profileSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </Stack>}
              </Paper>
            )}
            <Stack
              spacing={2.5}
              sx={{
                gridColumn: { md: normalizedRole === "client" ? "2" : "1" },
                minWidth: 0,
              }}
            >
            {/* ACCOUNT INFO */}

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.25, sm: 2.6 },
                borderRadius: 4,
                color: "#FFFFFF",
                background: "linear-gradient(140deg, #07543E 0%, #087F5B 100%)",
                border: "1px solid rgba(255,255,255,.16)",
                boxShadow: "0 14px 32px rgba(6,78,59,.13)",
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
                    bgcolor: "rgba(255,255,255,.14)",
                    color: "#D1FAE5",
                    borderRadius: 2.5,
                  }}
                >
                  <AccountCircleOutlined />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      color: "#FFFFFF",
                      fontSize: 17,
                      fontWeight: 850,
                    }}
                  >
                    Account Overview
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.2,
                      color: "rgba(255,255,255,.72)",
                      fontSize: 11,
                    }}
                  >
                    Your account details at a glance.
                  </Typography>
                </Box>
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 158px), 1fr))",
                  gap: 1.5,
                  minWidth: 0,
                }}
              >
                {infoItems.map((item) => (
                  <Box
                    key={item.label}
                    sx={{
                      minWidth: 0,
                      height: "100%",
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: "rgba(255,255,255,.96)",
                      border: "1px solid rgba(255,255,255,.55)",
                      transition: "background-color .2s ease, transform .2s ease",
                      "&:hover": {
                        bgcolor: "#F0FDF4",
                        transform: "translateY(-2px)",
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          flex: "0 0 40px",
                          display: "grid",
                          placeItems: "center",
                          bgcolor: "#D8F3E5",
                          color: "#047857",
                          border: "1px solid #D5E5D9",
                          borderRadius: 2.5,
                        }}
                      >
                        {item.icon}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          sx={{
                            color: "#839B8C",
                            fontSize: 9.5,
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: ".04em",
                            whiteSpace: "nowrap",
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
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.value}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Paper>

            <Paper
              id="profile-quick-actions"
              elevation={0}
              sx={{
                p: { xs: 2.25, sm: 2.6 },
                borderRadius: 4,
                bgcolor: "var(--sh-glass-bg)",
                border: "1px solid #D5E5D9",
                boxShadow: "0 12px 32px rgba(24,61,50,.045)",
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.8 }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 2.5,
                    bgcolor: "#D8F3E5",
                    color: "#087F5B",
                  }}
                >
                  <KeyRounded />
                </Box>
                <Box>
                  <Typography sx={{ color: "#183D32", fontSize: 15, fontWeight: 850 }}>
                    Quick Actions
                  </Typography>
                  <Typography sx={{ color: "#839B8C", fontSize: 11.5, mt: 0.2 }}>
                    Manage your account easily.
                  </Typography>
                </Box>
              </Stack>

              <Grid container spacing={1.2}>
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    onClick={openPasswordDialog}
                    startIcon={<LockOutlined />}
                    sx={{
                      minHeight: 82,
                      justifyContent: "flex-start",
                      alignItems: "center",
                      p: 1.4,
                      border: "1px solid #E4ECE8",
                      borderRadius: 3,
                      bgcolor: "#F8FAF9",
                      color: "#183D32",
                      textAlign: "left",
                      textTransform: "none",
                      "& .MuiButton-startIcon": {
                        width: 38,
                        height: 38,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: "50%",
                        bgcolor: "#D8F3E5",
                        color: "#087F5B",
                      },
                      "&:hover": { bgcolor: "#F0F8F4", borderColor: "#BFE3D4" },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 800 }}>Change Password</Typography>
                      <Typography sx={{ color: "#839B8C", fontSize: 10.5, fontWeight: 400 }}>
                        Keep your account secure.
                      </Typography>
                    </Box>
                  </Button>
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1.8 }}>
                <InfoOutlined sx={{ mt: 0.1, color: "#91A59C", fontSize: 17 }} />
                <Typography sx={{ color: "#839B8C", fontSize: 10.5, lineHeight: 1.55 }}>
                  Store transactions are processed in-store. For account or transaction concerns, contact StoreHub staff or an administrator.
                </Typography>
              </Stack>
              </Paper>
            </Stack>
          </Box>
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
