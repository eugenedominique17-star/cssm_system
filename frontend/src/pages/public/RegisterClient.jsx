import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  ArrowBackRounded,
  ArrowForwardRounded,
  CalendarMonthOutlined,
  CheckCircleRounded,
  EmailOutlined,
  HomeOutlined,
  LockOutlined,
  PersonOutlineRounded,
  PhoneOutlined,
  SecurityRounded,
  StorefrontRounded,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import API from "../../api/axios";
import { supabase, supabaseAuthEnabled } from "../../api/supabase";
import { colors } from "../../theme";

const RegisterClient = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const palette = {
    primary: "#066649",
    primaryHover: "#0D665F",
    primaryDark: "#07543E",

    mint: "#D8F3E5",
    mintLight: "#F4FCF9",
    mintMedium: "#DDF7EF",

    text: "#173F3A",
    textSoft: "#58736C",
    muted: "#80958F",

    border: "#DCEBE7",
    borderSoft: "#E7F1EE",

    white: "#FFFFFF",
  };

  const clearMessages = () => {
    if (error) setError("");
    if (success) setSuccess("");
  };

  /* =========================================================
     REGISTRATION LOGIC
  ========================================================= */

  const handleRegister = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const fullName = `${firstName.trim()} ${
        middleName.trim() ? `${middleName.trim()} ` : ""
      }${lastName.trim()}`.trim();

      const payload = {
        name: fullName,
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        birthdate,
        gender,
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
      };
      let response;
      if (supabaseAuthEnabled) {
        const { data, error } = await supabase.functions.invoke("legacy-auth-migrate", {
          body: { ...payload, action: "register-client" },
        });
        if (error) {
          let message = error.message || "Registration failed. Please try again.";
          if (error.context && typeof error.context.json === "function") {
            try {
              const body = await error.context.json();
              if (typeof body?.message === "string") message = body.message;
            } catch {
              // Use the SDK message when the function response is not JSON.
            }
          }
          throw Object.assign(new Error(message), { response: { data: { message } } });
        }
        response = { data };
      } else {
        response = await API.post("/auth/register/client", payload);
      }

      setSuccess(
        response?.data?.message ||
          "Account created successfully. Please wait for Admin approval.",
      );

      setFirstName("");
      setMiddleName("");
      setLastName("");
      setBirthdate("");
      setGender("");
      setAddress("");
      setPhone("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/login");
      }, 2200);
    } catch (err) {
      console.error("Registration failed:", err);

      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Registration failed. Please try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     FIELD STYLE
  ========================================================= */

  const fieldStyle = {
    "& .MuiOutlinedInput-root": {
      minHeight: 52,
      borderRadius: "13px",
      bgcolor: "var(--sh-glass-bg)",
      fontSize: "0.79rem",

      transition:
        "border-color .2s ease, box-shadow .2s ease, background-color .2s ease",

      "& fieldset": {
        borderColor: palette.border,
      },

      "&:hover fieldset": {
        borderColor: "#A8CEC5",
      },

      "&.Mui-focused": {
        boxShadow: "0 0 0 4px rgba(6,102,73,.07)",
      },

      "&.Mui-focused fieldset": {
        borderColor: palette.primary,
        borderWidth: "1.5px",
      },

      "&.Mui-disabled": {
        bgcolor: "var(--sh-page-tint)",
      },
    },

    "& .MuiInputLabel-root": {
      fontSize: "0.75rem",
      color: "#7A908A",

      "&.Mui-focused": {
        color: palette.primary,
      },
    },

    "& .MuiInputBase-input": {
      color: palette.text,
      fontWeight: 500,
    },

    "& .MuiFormHelperText-root": {
      mx: 0,
      mt: 0.5,
      fontSize: "0.6rem",
      color: "#8B9D98",
    },

    "& .MuiInputAdornment-root svg": {
      color: "#8BA19B",
      fontSize: 18,
    },
  };

  /* =========================================================
     ANIMATIONS
  ========================================================= */

  const formContainer = {
    hidden: {},

    visible: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.05,
        delayChildren: reduceMotion ? 0 : 0.08,
      },
    },
  };

  const formItem = {
    hidden: {
      opacity: 0,
      y: reduceMotion ? 0 : 12,
    },

    visible: {
      opacity: 1,
      y: 0,

      transition: {
        duration: reduceMotion ? 0 : 0.4,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100vh",

        display: "flex",
        alignItems: "center",

        overflow: "hidden",

        py: {
          xs: 1.5,
          sm: 2.5,
          md: 3,
        },

        background: `
          radial-gradient(
            circle at 7% 8%,
            rgba(200,238,217,.30),
            transparent 27%
          ),
          radial-gradient(
            circle at 92% 90%,
            rgba(204,251,241,.58),
            transparent 29%
          ),
          linear-gradient(
            135deg,
            #F7F5EC 0%,
            #EFF5E7 48%,
            #D8F3E5 100%
          )
        `,
      }}
    >
      {/* =====================================================
          BACKGROUND DECORATIONS
      ===================================================== */}

      <Box
        sx={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <Box
          component={motion.div}
          animate={
            reduceMotion
              ? {}
              : {
                  x: [0, 18, 0],
                  y: [0, -14, 0],
                }
          }
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          sx={{
            position: "absolute",

            width: {
              xs: 220,
              md: 360,
            },

            height: {
              xs: 220,
              md: 360,
            },

            top: -170,
            right: -80,

            borderRadius: "50%",

            bgcolor: "rgba(185,235,208,.10)",

            border: "1px solid rgba(6,102,73,.04)",
          }}
        />

        <Box
          component={motion.div}
          animate={
            reduceMotion
              ? {}
              : {
                  x: [0, -14, 0],
                  y: [0, 18, 0],
                }
          }
          transition={{
            duration: 13,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          sx={{
            position: "absolute",

            width: 280,
            height: 280,

            bottom: -140,
            left: -100,

            borderRadius: "50%",

            bgcolor: "rgba(6,102,73,.04)",
          }}
        />

        <Box
          sx={{
            position: "absolute",
            width: 10,
            height: 10,
            top: "18%",
            left: "6%",
            borderRadius: "3px",
            bgcolor: "rgba(6,102,73,.09)",
            transform: "rotate(25deg)",
          }}
        />

        <Box
          sx={{
            position: "absolute",
            width: 8,
            height: 8,
            right: "7%",
            bottom: "18%",
            borderRadius: "50%",
            bgcolor: "rgba(39,174,128,.17)",
          }}
        />
      </Box>

      {/* =====================================================
          PAGE
      ===================================================== */}

      <Container
        maxWidth="lg"
        sx={{
          position: "relative",
          zIndex: 2,

          px: {
            xs: 1.3,
            sm: 2.5,
          },
        }}
      >
        <Box
          component={motion.div}
          initial={{
            opacity: 0,
            y: reduceMotion ? 0 : 24,
            scale: reduceMotion ? 1 : 0.985,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          transition={{
            duration: reduceMotion ? 0 : 0.58,
            ease: [0.22, 1, 0.36, 1],
          }}
          sx={{
            width: "100%",
            maxWidth: 1120,
            mx: "auto",

            overflow: "hidden",

            borderRadius: {
              xs: "22px",
              sm: "26px",
              md: "30px",
            },

            bgcolor: "var(--sh-glass-bg)",

            border: "1px solid rgba(207,230,224,.95)",

            boxShadow:
              "0 35px 90px rgba(17,94,89,.10), 0 8px 24px rgba(17,94,89,.04)",

            backdropFilter: "blur(20px)",
          }}
        >
          {/* =================================================
              TOP BAR
          ================================================= */}

          <Box
            sx={{
              minHeight: {
                xs: 64,
                sm: 70,
              },

              px: {
                xs: 1.5,
                sm: 2.5,
                md: 3,
              },

              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",

              gap: 1,

              borderBottom: `1px solid ${palette.borderSoft}`,

              bgcolor: "rgba(255,255,255,.80)",
            }}
          >
            <Stack direction="row" spacing={1.05} alignItems="center">
              <Box
                component={motion.div}
                whileHover={
                  reduceMotion
                    ? {}
                    : {
                        y: -2,
                        rotate: -3,
                      }
                }
                sx={{
                  width: 40,
                  height: 40,

                  display: "grid",
                  placeItems: "center",

                  borderRadius: "12px",

                  bgcolor: palette.primary,

                  color: "#FFFFFF",

                  boxShadow: "0 9px 22px rgba(6,102,73,.16)",
                }}
              >
                <StorefrontRounded sx={{ fontSize: 21 }} />
              </Box>

              <Box>
                <Typography
                  sx={{
                    color: palette.text,
                    fontSize: "0.95rem",
                    fontWeight: 950,
                    lineHeight: 1,
                    letterSpacing: "-.03em",
                  }}
                >
                  StoreHub
                </Typography>

                <Typography
                  sx={{
                    mt: 0.35,

                    display: {
                      xs: "none",
                      sm: "block",
                    },

                    color: palette.muted,

                    fontSize: "0.53rem",
                    fontWeight: 750,

                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                  }}
                >
                  Client Registration
                </Typography>
              </Box>
            </Stack>

            <Button
              component={motion.button}
              whileHover={
                reduceMotion
                  ? {}
                  : {
                      x: -3,
                    }
              }
              whileTap={{
                scale: 0.97,
              }}
              startIcon={
                <ArrowBackRounded
                  sx={{
                    fontSize: "17px !important",
                  }}
                />
              }
              onClick={() => navigate("/login")}
              sx={{
                minHeight: 36,

                px: {
                  xs: 0.8,
                  sm: 1.3,
                },

                borderRadius: "10px",

                color: "#667E78",

                textTransform: "none",

                fontSize: "0.66rem",
                fontWeight: 850,

                "&:hover": {
                  bgcolor: palette.mint,
                  color: palette.primary,
                },
              }}
            >
              Back to Login
            </Button>
          </Box>

          {/* =================================================
              MAIN CONTENT
          ================================================= */}

          <Box
            sx={{
              display: "grid",

              gridTemplateColumns: {
                xs: "1fr",
                md: "320px minmax(0, 1fr)",
              },
            }}
          >
            {/* =================================================
                LEFT PANEL
            ================================================= */}

            <Box
              sx={{
                position: "relative",

                display: {
                  xs: "none",
                  md: "flex",
                },

                flexDirection: "column",
                justifyContent: "space-between",

                minHeight: 615,

                overflow: "hidden",

                p: {
                  md: 3.4,
                  lg: 3.8,
                },

                bgcolor: "#EAF8F4",

                borderRight: `1px solid ${palette.border}`,
              }}
            >
              {/* DECORATION */}

              <Box
                sx={{
                  position: "absolute",

                  width: 340,
                  height: 340,

                  top: 20,
                  right: -220,

                  borderRadius: "50%",

                  background:
                    "radial-gradient(circle, rgba(142,221,184,.18), rgba(142,221,184,0) 70%)",

                  pointerEvents: "none",
                }}
              />

              <Box
                component={motion.div}
                animate={
                  reduceMotion
                    ? {}
                    : {
                        rotate: 360,
                      }
                }
                transition={{
                  duration: 42,
                  repeat: Infinity,
                  ease: "linear",
                }}
                sx={{
                  position: "absolute",

                  width: 240,
                  height: 240,

                  top: 105,
                  right: -145,

                  borderRadius: "50%",

                  border: "1px solid rgba(6,102,73,.08)",

                  "&::after": {
                    content: '""',

                    position: "absolute",

                    width: 10,
                    height: 10,

                    top: 30,
                    left: 28,

                    borderRadius: "50%",

                    bgcolor: "#27AE80",

                    boxShadow: "0 0 18px rgba(39,174,128,.30)",
                  },
                }}
              />

              {/* LEFT CONTENT */}

              <Box
                component={motion.div}
                variants={formContainer}
                initial="hidden"
                animate="visible"
                sx={{
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <Box component={motion.div} variants={formItem}>
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",

                      gap: 0.7,

                      px: 1.1,
                      py: 0.6,

                      borderRadius: "999px",

                      bgcolor: "rgba(255,255,255,.72)",

                      border: "1px solid #D4EBE5",
                    }}
                  >
                    <Box
                      sx={{
                        width: 7,
                        height: 7,

                        borderRadius: "50%",

                        bgcolor: "#27AE80",
                      }}
                    />

                    <Typography
                      sx={{
                        color: palette.primary,

                        fontSize: "0.56rem",
                        fontWeight: 900,

                        textTransform: "uppercase",
                        letterSpacing: ".11em",
                      }}
                    >
                      New Client
                    </Typography>
                  </Box>
                </Box>

                <Box component={motion.div} variants={formItem}>
                  <Typography
                    sx={{
                      mt: 2,

                      maxWidth: 260,

                      color: palette.text,

                      fontSize: {
                        md: "1.95rem",
                        lg: "2.1rem",
                      },

                      lineHeight: 1.07,

                      fontWeight: 950,

                      letterSpacing: "-.055em",
                    }}
                  >
                    Join your local
                    <Box
                      component="span"
                      sx={{
                        display: "block",
                        color: palette.primary,
                      }}
                    >
                      StoreHub.
                    </Box>
                  </Typography>
                </Box>

                <Box component={motion.div} variants={formItem}>
                  <Typography
                    sx={{
                      mt: 1.4,

                      maxWidth: 250,

                      color: palette.textSoft,

                      fontSize: "0.68rem",

                      lineHeight: 1.7,
                    }}
                  >
                    Create your client account and keep your StoreHub
                    activity in one convenient place.
                  </Typography>
                </Box>

                <Stack spacing={1} sx={{ mt: 3 }}>
                  {[
                    "View purchase and order history",
                    "Access your StoreHub profile",
                    "Receive account access after approval",
                  ].map((item) => (
                    <Box
                      component={motion.div}
                      variants={formItem}
                      key={item}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{
                          p: 1,

                          borderRadius: "12px",

                          bgcolor: "rgba(255,255,255,.58)",

                          border: "1px solid #D7EBE6",
                        }}
                      >
                        <Box
                          sx={{
                            width: 27,
                            height: 27,

                            display: "grid",
                            placeItems: "center",

                            flexShrink: 0,

                            borderRadius: "8px",

                            bgcolor: "#DDF5EF",

                            color: palette.primary,
                          }}
                        >
                          <CheckCircleRounded sx={{ fontSize: 15 }} />
                        </Box>

                        <Typography
                          sx={{
                            color: "#57726B",

                            fontSize: "0.62rem",
                            fontWeight: 650,

                            lineHeight: 1.4,
                          }}
                        >
                          {item}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>

              {/* ADMIN APPROVAL */}

              <Box
                component={motion.div}
                initial={{
                  opacity: 0,
                  y: reduceMotion ? 0 : 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: reduceMotion ? 0 : 0.4,
                  duration: reduceMotion ? 0 : 0.4,
                }}
                sx={{
                  position: "relative",
                  zIndex: 2,

                  mt: 4,
                  p: 1.4,

                  borderRadius: "14px",

                  bgcolor: "rgba(255,255,255,.60)",

                  border: "1px solid #D5EAE5",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 32,
                      height: 32,

                      display: "grid",
                      placeItems: "center",

                      flexShrink: 0,

                      borderRadius: "9px",

                      bgcolor: palette.mintMedium,

                      color: palette.primary,
                    }}
                  >
                    <SecurityRounded sx={{ fontSize: 17 }} />
                  </Box>

                  <Box>
                    <Typography
                      sx={{
                        color: palette.text,
                        fontSize: "0.65rem",
                        fontWeight: 900,
                      }}
                    >
                      Admin approval required
                    </Typography>

                    <Typography
                      sx={{
                        mt: 0.35,

                        color: palette.textSoft,

                        fontSize: "0.58rem",

                        lineHeight: 1.5,
                      }}
                    >
                      Your account may remain pending until reviewed by
                      the StoreHub Administrator.
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>

            {/* =================================================
                RIGHT FORM
            ================================================= */}

            <Box
              component={motion.div}
              variants={formContainer}
              initial="hidden"
              animate="visible"
              sx={{
                p: {
                  xs: 1.7,
                  sm: 2.8,
                  md: 3.3,
                  lg: 3.7,
                },

                bgcolor: "var(--sh-glass-bg)",
              }}
            >
              {/* MOBILE INFO */}

              <Box
                component={motion.div}
                variants={formItem}
                sx={{
                  display: {
                    xs: "block",
                    md: "none",
                  },

                  mb: 2,

                  p: 1.25,

                  borderRadius: "13px",

                  bgcolor: "#EFFAF7",

                  border: "1px solid #D8EEE8",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      width: 31,
                      height: 31,

                      display: "grid",
                      placeItems: "center",

                      flexShrink: 0,

                      borderRadius: "9px",

                      bgcolor: palette.mintMedium,

                      color: palette.primary,
                    }}
                  >
                    <SecurityRounded sx={{ fontSize: 16 }} />
                  </Box>

                  <Box>
                    <Typography
                      sx={{
                        color: palette.text,
                        fontSize: "0.64rem",
                        fontWeight: 900,
                      }}
                    >
                      Client account request
                    </Typography>

                    <Typography
                      sx={{
                        mt: 0.15,
                        color: palette.textSoft,
                        fontSize: "0.57rem",
                      }}
                    >
                      New accounts require Admin approval.
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              {/* HEADER */}

              <Box
                component={motion.div}
                variants={formItem}
                sx={{
                  mb: 2.2,
                }}
              >
                <Typography
                  sx={{
                    color: palette.primary,

                    fontSize: "0.56rem",

                    fontWeight: 900,

                    letterSpacing: ".12em",

                    textTransform: "uppercase",
                  }}
                >
                  Create your account
                </Typography>

                <Typography
                  component="h1"
                  sx={{
                    mt: 0.55,

                    color: palette.text,

                    fontSize: {
                      xs: "1.5rem",
                      sm: "1.8rem",
                    },

                    lineHeight: 1.08,

                    fontWeight: 950,

                    letterSpacing: "-.045em",
                  }}
                >
                  A few details to get started.
                </Typography>

                <Typography
                  sx={{
                    mt: 0.6,

                    color: palette.textSoft,

                    fontSize: "0.66rem",

                    lineHeight: 1.6,
                  }}
                >
                  Enter your personal information and create your
                  StoreHub credentials.
                </Typography>
              </Box>

              {/* =================================================
                  ALERTS
              ================================================= */}

              <AnimatePresence initial={false} mode="popLayout">
                {error && (
                  <Box
                    component={motion.div}
                    key="error"
                    initial={{
                      opacity: 0,
                      height: 0,
                    }}
                    animate={{
                      opacity: 1,
                      height: "auto",
                    }}
                    exit={{
                      opacity: 0,
                      height: 0,
                    }}
                    sx={{
                      overflow: "hidden",
                    }}
                  >
                    <Alert
                      severity="error"
                      onClose={() => setError("")}
                      sx={{
                        mb: 1.5,

                        borderRadius: "12px",

                        bgcolor: "#FFF8F7",

                        border: "1px solid #FECACA",

                        fontSize: "0.68rem",
                      }}
                    >
                      {error}
                    </Alert>
                  </Box>
                )}

                {success && (
                  <Box
                    component={motion.div}
                    key="success"
                    initial={{
                      opacity: 0,
                      height: 0,
                    }}
                    animate={{
                      opacity: 1,
                      height: "auto",
                    }}
                    exit={{
                      opacity: 0,
                      height: 0,
                    }}
                    sx={{
                      overflow: "hidden",
                    }}
                  >
                    <Alert
                      severity="success"
                      icon={<CheckCircleRounded />}
                      sx={{
                        mb: 1.5,

                        borderRadius: "12px",

                        bgcolor: "#F1FBF7",

                        border: "1px solid #BFE8DB",

                        fontSize: "0.68rem",
                      }}
                    >
                      {success}
                    </Alert>
                  </Box>
                )}
              </AnimatePresence>

              {/* =================================================
                  FORM
              ================================================= */}

              <Box component="form" onSubmit={handleRegister} noValidate>
                <Stack spacing={1.25}>
                  {/* =============================================
                      PERSONAL INFORMATION
                  ============================================= */}

                  <Box component={motion.div} variants={formItem}>
                    <Typography
                      sx={{
                        mb: 0.8,

                        color: "#58736C",

                        fontSize: "0.56rem",

                        fontWeight: 900,

                        textTransform: "uppercase",

                        letterSpacing: ".1em",
                      }}
                    >
                      Personal information
                    </Typography>

                    {/* FIRST / MIDDLE / LAST */}

                    <Box
                      sx={{
                        display: "grid",

                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(3, minmax(0, 1fr))",
                        },

                        gap: 1.1,
                      }}
                    >
                      <TextField
                        fullWidth
                        required
                        size="small"
                        label="First Name"
                        value={firstName}
                        disabled={loading}
                        onChange={(e) => {
                          setFirstName(e.target.value);
                          clearMessages();
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonOutlineRounded />
                            </InputAdornment>
                          ),
                        }}
                        sx={fieldStyle}
                      />

                      <TextField
                        fullWidth
                        size="small"
                        label="Middle Name"
                        value={middleName}
                        disabled={loading}
                        onChange={(e) => {
                          setMiddleName(e.target.value);
                          clearMessages();
                        }}
                        sx={fieldStyle}
                      />

                      <TextField
                        fullWidth
                        required
                        size="small"
                        label="Last Name"
                        value={lastName}
                        disabled={loading}
                        onChange={(e) => {
                          setLastName(e.target.value);
                          clearMessages();
                        }}
                        sx={fieldStyle}
                      />
                    </Box>
                  </Box>

                  {/* BIRTHDATE + GENDER */}

                  <Box
                    component={motion.div}
                    variants={formItem}
                    sx={{
                      display: "grid",

                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "1fr 1fr",
                      },

                      gap: 1.1,
                    }}
                  >
                    <TextField
                      fullWidth
                      size="small"
                      label="Birthdate"
                      type="date"
                      value={birthdate}
                      disabled={loading}
                      onChange={(e) => {
                        setBirthdate(e.target.value);
                        clearMessages();
                      }}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <CalendarMonthOutlined />
                          </InputAdornment>
                        ),
                      }}
                      sx={fieldStyle}
                    />

                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Gender"
                      value={gender}
                      disabled={loading}
                      onChange={(e) => {
                        setGender(e.target.value);
                        clearMessages();
                      }}
                      sx={fieldStyle}
                    >
                      <MenuItem value="">
                        Prefer not to say
                      </MenuItem>

                      <MenuItem value="male">
                        Male
                      </MenuItem>

                      <MenuItem value="female">
                        Female
                      </MenuItem>

                      <MenuItem value="other">
                        Other
                      </MenuItem>
                    </TextField>
                  </Box>

                  {/* ADDRESS */}

                  <Box component={motion.div} variants={formItem}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Address"
                      value={address}
                      disabled={loading}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        clearMessages();
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <HomeOutlined />
                          </InputAdornment>
                        ),
                      }}
                      sx={fieldStyle}
                    />
                  </Box>

                  {/* =============================================
                      CONTACT INFORMATION
                  ============================================= */}

                  <Box
                    component={motion.div}
                    variants={formItem}
                    sx={{
                      pt: 0.35,
                    }}
                  >
                    <Typography
                      sx={{
                        mb: 0.8,

                        color: "#58736C",

                        fontSize: "0.56rem",

                        fontWeight: 900,

                        textTransform: "uppercase",

                        letterSpacing: ".1em",
                      }}
                    >
                      Contact information
                    </Typography>

                    <Box
                      sx={{
                        display: "grid",

                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "1fr 1fr",
                        },

                        gap: 1.1,
                      }}
                    >
                      {/* EMAIL */}

                      <TextField
                        fullWidth
                        required
                        size="small"
                        type="email"
                        label="Email Address"
                        placeholder="client@email.com"
                        value={email}
                        disabled={loading}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          clearMessages();
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <EmailOutlined />
                            </InputAdornment>
                          ),
                        }}
                        sx={fieldStyle}
                      />

                      {/* PHONE */}

                      <TextField
                        fullWidth
                        size="small"
                        label="Phone Number"
                        placeholder="09XXXXXXXXX"
                        value={phone}
                        disabled={loading}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          clearMessages();
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PhoneOutlined />
                            </InputAdornment>
                          ),
                        }}
                        sx={fieldStyle}
                      />
                    </Box>
                  </Box>

                  {/* =============================================
                      ACCOUNT CREDENTIALS
                  ============================================= */}

                  <Box
                    component={motion.div}
                    variants={formItem}
                    sx={{
                      pt: 0.35,
                    }}
                  >
                    <Typography
                      sx={{
                        mb: 0.8,

                        color: "#58736C",

                        fontSize: "0.56rem",

                        fontWeight: 900,

                        textTransform: "uppercase",

                        letterSpacing: ".1em",
                      }}
                    >
                      Account credentials
                    </Typography>

                    <Box
                      sx={{
                        display: "grid",

                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "1fr 1fr",
                        },

                        gap: 1.1,
                      }}
                    >
                      {/* PASSWORD */}

                      <TextField
                        fullWidth
                        required
                        size="small"
                        label="Password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        disabled={loading}
                        helperText="Minimum 6 characters"
                        onChange={(e) => {
                          setPassword(e.target.value);
                          clearMessages();
                        }}
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
                                disabled={loading}
                                edge="end"
                                size="small"
                                aria-label={
                                  showPassword
                                    ? "Hide password"
                                    : "Show password"
                                }
                                onClick={() =>
                                  setShowPassword((prev) => !prev)
                                }
                                sx={{
                                  color: "#728A84",

                                  "&:hover": {
                                    bgcolor: palette.mint,
                                    color: palette.primary,
                                  },
                                }}
                              >
                                {showPassword ? (
                                  <VisibilityOff fontSize="small" />
                                ) : (
                                  <Visibility fontSize="small" />
                                )}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        sx={fieldStyle}
                      />

                      {/* CONFIRM PASSWORD */}

                      <TextField
                        fullWidth
                        required
                        size="small"
                        label="Confirm Password"
                        type={
                          showConfirmPassword ? "text" : "password"
                        }
                        value={confirmPassword}
                        disabled={loading}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          clearMessages();
                        }}
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
                                disabled={loading}
                                edge="end"
                                size="small"
                                aria-label={
                                  showConfirmPassword
                                    ? "Hide confirm password"
                                    : "Show confirm password"
                                }
                                onClick={() =>
                                  setShowConfirmPassword(
                                    (prev) => !prev,
                                  )
                                }
                                sx={{
                                  color: "#728A84",

                                  "&:hover": {
                                    bgcolor: palette.mint,
                                    color: palette.primary,
                                  },
                                }}
                              >
                                {showConfirmPassword ? (
                                  <VisibilityOff fontSize="small" />
                                ) : (
                                  <Visibility fontSize="small" />
                                )}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        sx={fieldStyle}
                      />
                    </Box>
                  </Box>

                  {/* =============================================
                      SUBMIT
                  ============================================= */}

                  <Box component={motion.div} variants={formItem}>
                    <Button
                      component={motion.button}
                      whileHover={
                        loading || reduceMotion
                          ? {}
                          : {
                              y: -2,
                            }
                      }
                      whileTap={
                        loading
                          ? {}
                          : {
                              scale: 0.988,
                            }
                      }
                      fullWidth
                      type="submit"
                      variant="contained"
                      disabled={loading}
                      endIcon={
                        loading ? null : <ArrowForwardRounded />
                      }
                      sx={{
                        minHeight: 49,

                        mt: 0.45,

                        borderRadius: "13px",

                        bgcolor: palette.primary,

                        color: "#FFFFFF",

                        textTransform: "none",

                        fontSize: "0.75rem",

                        fontWeight: 900,

                        boxShadow:
                          "0 11px 25px rgba(6,102,73,.17)",

                        "&:hover": {
                          bgcolor: palette.primaryHover,

                          boxShadow:
                            "0 14px 30px rgba(6,102,73,.22)",
                        },

                        "&.Mui-disabled": {
                          bgcolor: "#A7C7C0",
                          color: "#FFFFFF",
                          boxShadow: "none",
                        },
                      }}
                    >
                      {loading ? (
                        <>
                          <CircularProgress
                            size={16}
                            thickness={5}
                            sx={{
                              mr: 1,
                              color: "#FFFFFF",
                            }}
                          />

                          Creating account...
                        </>
                      ) : (
                        "Create Client Account"
                      )}
                    </Button>
                  </Box>
                </Stack>
              </Box>

              {/* =================================================
                  LOGIN
              ================================================= */}

              <Box
                component={motion.div}
                variants={formItem}
                sx={{
                  mt: 1.9,
                  pt: 1.6,

                  borderTop: `1px solid ${palette.borderSoft}`,
                }}
              >
                <Typography
                  sx={{
                    textAlign: "center",

                    color: "#7B908A",

                    fontSize: "0.64rem",
                  }}
                >
                  Already have an account?{" "}
                  <Box
                    component={Link}
                    to="/login"
                    sx={{
                      display: "inline-block",

                      color: colors?.primary || palette.primary,

                      textDecoration: "none",

                      fontWeight: 900,

                      transition:
                        "color .2s ease, transform .2s ease",

                      "&:hover": {
                        color: palette.primaryHover,
                        transform: "translateX(2px)",
                      },
                    }}
                  >
                    Sign in
                  </Box>
                </Typography>

                <Typography
                  sx={{
                    mt: 1.35,

                    textAlign: "center",

                    color: "#B0BDB9",

                    fontSize: "0.52rem",
                  }}
                >
                  © {new Date().getFullYear()} StoreHub · Secure client
                  registration
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default RegisterClient;