import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  AlternateEmailRounded,
  ArrowBackRounded,
  ArrowForwardRounded,
  CheckRounded,
  LockOutlined,
  SecurityRounded,
  StorefrontRounded,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import { useAuth } from "../../contexts/AuthContext";

/* =========================================================
   LOGIN PAGE
========================================================= */

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const reduceMotion = useReducedMotion();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* =========================================================
     AUTHENTICATION
     EXISTING LOGIC PRESERVED
  ========================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const cleanIdentifier = identifier.trim();

    if (!cleanIdentifier || !password) {
      setError("Please enter your Account ID or Email and password.");
      return;
    }

    try {
      setLoading(true);

      // EXISTING AUTHENTICATION FLOW
      const user = await login(cleanIdentifier, password);

      if (!user) {
        throw new Error("Unable to retrieve account information.");
      }

      const role = String(user.role || "").toLowerCase();

      // EXISTING FIRST-LOGIN FLOW
      if (user.must_change_password) {
        navigate("/change-password", {
          replace: true,
        });
        return;
      }

      // EXISTING ROLE REDIRECTS
      switch (role) {
        case "admin":
          navigate("/admin/dashboard", {
            replace: true,
          });
          break;

        case "staff":
          navigate("/staff/dashboard", {
            replace: true,
          });
          break;

        case "client":
          navigate("/client/dashboard", {
            replace: true,
          });
          break;

        default:
          throw new Error("Invalid account role.");
      }
    } catch (err) {
      console.error("Login error:", err);

      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Login failed. Please check your credentials.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     COLORS
  ========================================================= */

  const colors = {
    primary: "#066649",
    primaryDark: "#07543E",
    primaryDeep: "#134E4A",

    mint: "#D8F3E5",
    mintSoft: "#EFF9F1",
    mintBorder: "#D8F3E5",

    text: "#173F3A",
    textSecondary: "#6B817C",
    textMuted: "#94A7A2",

    border: "#DCEBE7",
    background: "var(--sh-page-tint)",
    white: "#FFFFFF",
  };

  /* =========================================================
     INPUT DESIGN
  ========================================================= */

  const inputSx = {
    "& .MuiOutlinedInput-root": {
      minHeight: 56,
      borderRadius: "14px",
      bgcolor: "var(--sh-glass-bg)",
      color: colors.text,
      fontSize: "0.88rem",

      transition:
        "border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease",

      "& fieldset": {
        borderColor: colors.border,
      },

      "&:hover fieldset": {
        borderColor: "#A8CFC7",
      },

      "&.Mui-focused": {
        boxShadow: "0 0 0 4px rgba(6,102,73, 0.08)",
      },

      "&.Mui-focused fieldset": {
        borderColor: colors.primary,
        borderWidth: "1.5px",
      },

      "&.Mui-disabled": {
        bgcolor: "var(--sh-page-tint)",
      },
    },

    "& input": {
      fontWeight: 600,
    },

    "& input::placeholder": {
      color: "#A0B0AC",
      opacity: 1,
      fontWeight: 400,
    },
  };

  /* =========================================================
     ANIMATION VARIANTS
  ========================================================= */

  const containerVariants = {
    hidden: {},

    visible: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.07,
        delayChildren: reduceMotion ? 0 : 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: reduceMotion ? 0 : 14,
    },

    visible: {
      opacity: 1,
      y: 0,

      transition: {
        duration: reduceMotion ? 0 : 0.45,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <Box
      sx={{
        position: "relative",

        minHeight: "100vh",

        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        overflow: "hidden",

        px: {
          xs: 1.5,
          sm: 2.5,
          md: 4,
        },

        py: {
          xs: 1.5,
          sm: 2.5,
          md: 4,
        },

        background: `
          radial-gradient(
            circle at 15% 15%,
            rgba(200,238,217, 0.30),
            transparent 28%
          ),
          radial-gradient(
            circle at 85% 80%,
            rgba(204, 251, 241, 0.55),
            transparent 28%
          ),
          linear-gradient(
            135deg,
            #F7F5EC 0%,
            #EFF5E7 45%,
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
        <motion.div
          animate={
            reduceMotion
              ? {}
              : {
                  y: [0, -18, 0],
                  x: [0, 12, 0],
                }
          }
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            position: "absolute",
            width: 310,
            height: 310,
            borderRadius: "50%",
            background: "rgba(200,238,217, 0.16)",
            top: "-140px",
            right: "-80px",
            filter: "blur(2px)",
          }}
        />

        <motion.div
          animate={
            reduceMotion
              ? {}
              : {
                  y: [0, 16, 0],
                  x: [0, -10, 0],
                }
          }
          transition={{
            duration: 11,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            position: "absolute",
            width: 240,
            height: 240,
            borderRadius: "50%",
            background: "rgba(6,102,73, 0.05)",
            bottom: "-100px",
            left: "-80px",
          }}
        />

        <Box
          sx={{
            position: "absolute",

            width: 16,
            height: 16,

            borderRadius: "5px",

            bgcolor: "rgba(6,102,73,.08)",

            top: "18%",
            left: "8%",

            transform: "rotate(18deg)",
          }}
        />

        <Box
          sx={{
            position: "absolute",

            width: 10,
            height: 10,

            borderRadius: "50%",

            bgcolor: "rgba(6,102,73,.12)",

            bottom: "17%",
            right: "10%",
          }}
        />
      </Box>

      {/* =====================================================
          MAIN LOGIN CONTAINER
      ===================================================== */}

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
          duration: reduceMotion ? 0 : 0.6,
          ease: [0.22, 1, 0.36, 1],
        }}
        sx={{
          position: "relative",
          zIndex: 2,

          width: "100%",
          maxWidth: 1060,

          display: "grid",

          gridTemplateColumns: {
            xs: "1fr",
            md: "0.88fr 1.12fr",
          },

          overflow: "hidden",

          borderRadius: {
            xs: "24px",
            md: "30px",
          },

          bgcolor: "var(--sh-glass-bg)",

          border: "1px solid rgba(204, 231, 224, .95)",

          boxShadow: `
            0 35px 90px rgba(17, 94, 89, 0.10),
            0 8px 25px rgba(17, 94, 89, 0.045)
          `,

          backdropFilter: "blur(20px)",
        }}
      >
        {/* ===================================================
            LEFT SIDE
        =================================================== */}

        <Box
          sx={{
            position: "relative",

            display: {
              xs: "none",
              md: "flex",
            },

            flexDirection: "column",
            justifyContent: "space-between",

            minHeight: 650,

            p: {
              md: 4.5,
              lg: 5.5,
            },

            overflow: "hidden",

            bgcolor: "#E9F8F3",

            borderRight: "1px solid #D8EEE8",
          }}
        >
          {/* LEFT DECORATIVE GRADIENT */}

          <Box
            sx={{
              position: "absolute",

              width: 420,
              height: 420,

              borderRadius: "50%",

              right: -230,
              top: 60,

              background:
                "radial-gradient(circle, rgba(142,221,184,.18), rgba(142,221,184,0) 70%)",
            }}
          />

          <Box
            component={motion.div}
            animate={
              reduceMotion
                ? {}
                : {
                    rotate: [0, 360],
                  }
            }
            transition={{
              duration: 40,
              repeat: Infinity,
              ease: "linear",
            }}
            sx={{
              position: "absolute",

              width: 280,
              height: 280,

              borderRadius: "50%",

              border: "1px solid rgba(6,102,73,.09)",

              right: -135,
              top: 125,

              "&::after": {
                content: '""',

                position: "absolute",

                width: 12,
                height: 12,

                borderRadius: "50%",

                bgcolor: "#27AE80",

                top: 36,
                left: 36,

                boxShadow: "0 0 20px rgba(39,174,128,.25)",
              },
            }}
          />

          {/* BRAND */}

          <Box
            component={motion.div}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            sx={{
              position: "relative",
              zIndex: 2,
            }}
          >
            <Box component={motion.div} variants={itemVariants}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1.25}
              >
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
                    width: 44,
                    height: 44,

                    display: "grid",
                    placeItems: "center",

                    borderRadius: "13px",

                    bgcolor: colors.primary,

                    color: "#FFFFFF",

                    boxShadow: "0 10px 24px rgba(6,102,73,.16)",
                  }}
                >
                  <StorefrontRounded sx={{ fontSize: 23 }} />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      color: colors.text,

                      fontSize: "1.05rem",
                      fontWeight: 950,

                      lineHeight: 1,

                      letterSpacing: "-0.03em",
                    }}
                  >
                    StoreHub
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.4,

                      color: "#7C948E",

                      fontSize: "0.57rem",

                      textTransform: "uppercase",

                      letterSpacing: ".1em",

                      fontWeight: 700,
                    }}
                  >
                    Local convenience, made simpler.
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* HERO CONTENT */}

            <Box
              sx={{
                mt: 9,
                maxWidth: 360,
              }}
            >
              <Box component={motion.div} variants={itemVariants}>
                <Box
                  sx={{
                    display: "inline-flex",

                    alignItems: "center",

                    gap: 0.8,

                    px: 1.25,
                    py: 0.7,

                    borderRadius: "999px",

                    bgcolor: "rgba(255,255,255,.75)",

                    border: "1px solid #D5ECE6",

                    boxShadow: "0 5px 16px rgba(6,102,73,.04)",
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
                      color: colors.primary,

                      fontSize: "0.61rem",

                      fontWeight: 900,

                      textTransform: "uppercase",

                      letterSpacing: ".1em",
                    }}
                  >
                    StoreHub Access
                  </Typography>
                </Box>
              </Box>

              <Box component={motion.div} variants={itemVariants}>
                <Typography
                  component="h1"
                  sx={{
                    mt: 2.1,

                    color: colors.text,

                    fontSize: {
                      md: "2.55rem",
                      lg: "2.85rem",
                    },

                    lineHeight: 1.06,

                    fontWeight: 950,

                    letterSpacing: "-0.055em",
                  }}
                >
                  Welcome to your
                  <Box
                    component="span"
                    sx={{
                      display: "block",

                      color: colors.primary,
                    }}
                  >
                    StoreHub workspace.
                  </Box>
                </Typography>
              </Box>

              <Box component={motion.div} variants={itemVariants}>
                <Typography
                  sx={{
                    mt: 2,

                    maxWidth: 330,

                    color: colors.textSecondary,

                    fontSize: "0.78rem",

                    lineHeight: 1.75,
                  }}
                >
                  Sign in once and StoreHub will automatically take you
                  to the workspace assigned to your account.
                </Typography>
              </Box>

              {/* ROLE PILLS */}

              <Box component={motion.div} variants={itemVariants}>
                <Stack
                  direction="row"
                  spacing={0.9}
                  sx={{
                    mt: 3.5,
                    flexWrap: "wrap",
                    rowGap: 0.9,
                  }}
                >
                  {["ADMIN", "STAFF", "CLIENT"].map((role) => (
                    <Box
                      component={motion.div}
                      key={role}
                      whileHover={
                        reduceMotion
                          ? {}
                          : {
                              y: -2,
                            }
                      }
                      sx={{
                        px: 1.3,
                        py: 0.7,

                        borderRadius: "999px",

                        bgcolor: "rgba(255,255,255,.70)",

                        border: "1px solid #D1E9E3",

                        color: "#56736C",

                        fontSize: "0.57rem",

                        fontWeight: 900,

                        letterSpacing: ".08em",
                      }}
                    >
                      {role}
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Box>

          {/* SECURITY MESSAGE */}

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
              delay: reduceMotion ? 0 : 0.45,
              duration: reduceMotion ? 0 : 0.4,
            }}
            sx={{
              position: "relative",
              zIndex: 2,
            }}
          >
            <Box
              sx={{
                p: 1.6,

                borderRadius: "15px",

                bgcolor: "rgba(255,255,255,.60)",

                border: "1px solid #D5EAE5",
              }}
            >
              <Stack
                direction="row"
                spacing={1.1}
                alignItems="center"
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,

                    display: "grid",
                    placeItems: "center",

                    flexShrink: 0,

                    borderRadius: "10px",

                    bgcolor: "#DDF5EF",

                    color: colors.primary,
                  }}
                >
                  <SecurityRounded sx={{ fontSize: 18 }} />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      color: colors.text,

                      fontSize: "0.68rem",

                      fontWeight: 900,
                    }}
                  >
                    Secure account access
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.2,

                      color: colors.textSecondary,

                      fontSize: "0.61rem",

                      lineHeight: 1.5,
                    }}
                  >
                    Your role is identified automatically after login.
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Box>
        </Box>

        {/* ===================================================
            RIGHT SIDE
        =================================================== */}

        <Box
          sx={{
            position: "relative",

            minHeight: {
              xs: "auto",
              md: 650,
            },

            display: "flex",

            flexDirection: {
              xs: "column",
              md: "row",
            },

            alignItems: "center",

            px: {
              xs: 2.2,
              sm: 5,
              md: 6,
              lg: 7,
            },

            py: {
              xs: 2.2,
              sm: 5,
              md: 6,
            },

            bgcolor: "var(--sh-glass-bg)",
          }}
        >
          {/* BACK BUTTON */}

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
            startIcon={<ArrowBackRounded sx={{ fontSize: 17 }} />}
            onClick={() => navigate("/")}
            sx={{
              position: {
                xs: "static",
                sm: "absolute",
              },

              top: 24,
              right: 26,

              mb: {
                xs: 3,
                sm: 0,
              },

              alignSelf: {
                xs: "flex-end",
                sm: "auto",
              },

              minWidth: 0,

              px: 1.2,
              py: 0.7,

              borderRadius: "10px",

              color: "#68817B",

              fontSize: "0.67rem",

              fontWeight: 800,

              textTransform: "none",

              "&:hover": {
                bgcolor: colors.mintSoft,
                color: colors.primary,
              },
            }}
          >
            Back to Store
          </Button>

          {/* =================================================
              LOGIN FORM
          ================================================= */}

          <Box
            component={motion.div}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            sx={{
              width: "100%",
              maxWidth: 410,

              mx: "auto",
            }}
          >
            {/* MOBILE LOGO */}

            <Box
              component={motion.div}
              variants={itemVariants}
              sx={{
                display: {
                  xs: "block",
                  md: "none",
                },
              }}
            >
              <Stack
                direction="row"
                spacing={1.1}
                alignItems="center"
                sx={{
                  mb: 4,
                }}
              >
                <Box
                  sx={{
                    width: 42,
                    height: 42,

                    display: "grid",
                    placeItems: "center",

                    borderRadius: "13px",

                    bgcolor: colors.primary,

                    color: "#FFFFFF",

                    boxShadow: "0 9px 22px rgba(6,102,73,.15)",
                  }}
                >
                  <StorefrontRounded sx={{ fontSize: 21 }} />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      color: colors.text,

                      fontSize: "1.02rem",

                      fontWeight: 950,

                      lineHeight: 1,
                    }}
                  >
                    StoreHub
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.4,

                      color: colors.textMuted,

                      fontSize: "0.56rem",

                      textTransform: "uppercase",

                      letterSpacing: ".09em",
                    }}
                  >
                    Secure access
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* WELCOME ICON */}

            <Box component={motion.div} variants={itemVariants}>
              <Box
                sx={{
                  width: 42,
                  height: 42,

                  display: "grid",
                  placeItems: "center",

                  borderRadius: "13px",

                  bgcolor: colors.mint,

                  border: "1px solid #D3F3E9",

                  color: colors.primary,
                }}
              >
                <LockOutlined sx={{ fontSize: 20 }} />
              </Box>
            </Box>

            {/* TITLE */}

            <Box component={motion.div} variants={itemVariants}>
              <Typography
                component="h2"
                sx={{
                  mt: 2,

                  color: colors.text,

                  fontSize: {
                    xs: "2rem",
                    sm: "2.35rem",
                  },

                  fontWeight: 950,

                  lineHeight: 1.05,

                  letterSpacing: "-0.055em",
                }}
              >
                Welcome back
              </Typography>

              <Typography
                sx={{
                  mt: 1,

                  mb: 3.2,

                  color: colors.textSecondary,

                  fontSize: "0.78rem",

                  lineHeight: 1.7,
                }}
              >
                Enter your StoreHub credentials to continue to your
                account.
              </Typography>
            </Box>

            {/* ERROR */}

            <AnimatePresence initial={false}>
              {error && (
                <Box
                  component={motion.div}
                  initial={{
                    opacity: 0,
                    y: reduceMotion ? 0 : -8,
                    height: 0,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    height: "auto",
                  }}
                  exit={{
                    opacity: 0,
                    y: reduceMotion ? 0 : -6,
                    height: 0,
                  }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.25,
                  }}
                  sx={{
                    overflow: "hidden",
                  }}
                >
                  <Alert
                    severity="error"
                    onClose={() => setError("")}
                    sx={{
                      mb: 2.3,

                      borderRadius: "13px",

                      border: "1px solid #FECACA",

                      bgcolor: "#FFF8F7",

                      fontSize: "0.72rem",

                      alignItems: "center",

                      "& .MuiAlert-message": {
                        py: 0.2,
                      },
                    }}
                  >
                    {error}
                  </Alert>
                </Box>
              )}
            </AnimatePresence>

            {/* =================================================
                FORM
            ================================================= */}

            <Box component="form" onSubmit={handleSubmit} autoComplete="off" noValidate>
              <Stack spacing={1.9}>
                {/* ACCOUNT */}

                <Box component={motion.div} variants={itemVariants}>
                  <Typography
                    component="label"
                    htmlFor="login-identifier"
                    sx={{
                      display: "block",

                      mb: 0.7,

                      color: "#355D55",

                      fontSize: "0.69rem",

                      fontWeight: 900,
                    }}
                  >
                    Account ID or Email
                  </Typography>

                  <TextField
                    id="login-identifier"
                    fullWidth
                    autoFocus
                    disabled={loading}
                    autoComplete="off"
                    value={identifier}
                    placeholder="Enter your Account ID or Email"
                    onChange={(event) => {
                      setIdentifier(event.target.value);

                      if (error) {
                        setError("");
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <AlternateEmailRounded
                            sx={{
                              color: "#8CA39D",
                              fontSize: 19,
                            }}
                          />
                        </InputAdornment>
                      ),
                    }}
                    sx={inputSx}
                  />
                </Box>

                {/* PASSWORD */}

                <Box component={motion.div} variants={itemVariants}>
                  <Typography
                    component="label"
                    htmlFor="login-password"
                    sx={{
                      display: "block",

                      mb: 0.7,

                      color: "#355D55",

                      fontSize: "0.69rem",

                      fontWeight: 900,
                    }}
                  >
                    Password
                  </Typography>

                  <TextField
                    id="login-password"
                    fullWidth
                    disabled={loading}
                    autoComplete="off"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    placeholder="Enter your password"
                    onChange={(event) => {
                      setPassword(event.target.value);

                      if (error) {
                        setError("");
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlined
                            sx={{
                              color: "#8CA39D",
                              fontSize: 19,
                            }}
                          />
                        </InputAdornment>
                      ),

                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            component={motion.button}
                            whileTap={{
                              scale: 0.88,
                            }}
                            type="button"
                            edge="end"
                            disabled={loading}
                            onClick={() =>
                              setShowPassword((previous) => !previous)
                            }
                            aria-label={
                              showPassword
                                ? "Hide password"
                                : "Show password"
                            }
                            size="small"
                            sx={{
                              color: "#748B85",

                              "&:hover": {
                                bgcolor: colors.mintSoft,
                                color: colors.primary,
                              },
                            }}
                          >
                            <AnimatePresence
                              mode="wait"
                              initial={false}
                            >
                              <motion.span
                                key={showPassword ? "hide" : "show"}
                                initial={{
                                  opacity: 0,
                                  scale: reduceMotion ? 1 : 0.8,
                                }}
                                animate={{
                                  opacity: 1,
                                  scale: 1,
                                }}
                                exit={{
                                  opacity: 0,
                                  scale: reduceMotion ? 1 : 0.8,
                                }}
                                transition={{
                                  duration: reduceMotion ? 0 : 0.14,
                                }}
                                style={{
                                  display: "flex",
                                }}
                              >
                                {showPassword ? (
                                  <VisibilityOff />
                                ) : (
                                  <Visibility />
                                )}
                              </motion.span>
                            </AnimatePresence>
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={inputSx}
                  />
                </Box>

                {/* SUBMIT */}

                <Box component={motion.div} variants={itemVariants}>
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
                            scale: 0.985,
                          }
                    }
                    type="submit"
                    fullWidth
                    variant="contained"
                    disabled={loading}
                    endIcon={loading ? null : <ArrowForwardRounded />}
                    sx={{
                      minHeight: 54,

                      mt: 0.6,

                      borderRadius: "14px",

                      bgcolor: colors.primary,

                      color: "#FFFFFF",

                      fontSize: "0.8rem",

                      fontWeight: 900,

                      textTransform: "none",

                      boxShadow: "0 12px 26px rgba(6,102,73,.17)",

                      "&:hover": {
                        bgcolor: colors.primaryDark,

                        boxShadow: "0 15px 32px rgba(6,102,73,.22)",
                      },

                      "&.Mui-disabled": {
                        bgcolor: "#A7C8C1",

                        color: "#FFFFFF",

                        boxShadow: "none",
                      },
                    }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {loading ? (
                        <motion.span
                          key="loading"
                          initial={{
                            opacity: 0,
                          }}
                          animate={{
                            opacity: 1,
                          }}
                          exit={{
                            opacity: 0,
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <CircularProgress
                            size={17}
                            thickness={5}
                            sx={{
                              mr: 1,
                              color: "#FFFFFF",
                            }}
                          />

                          Signing in...
                        </motion.span>
                      ) : (
                        <motion.span
                          key="normal"
                          initial={{
                            opacity: 0,
                          }}
                          animate={{
                            opacity: 1,
                          }}
                          exit={{
                            opacity: 0,
                          }}
                        >
                          Continue to StoreHub
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </Box>
              </Stack>
            </Box>

            {/* SECURITY NOTE */}

            <Box component={motion.div} variants={itemVariants}>
              <Stack
                direction="row"
                spacing={0.9}
                alignItems="center"
                sx={{
                  mt: 2.4,

                  px: 1.2,
                  py: 1.1,

                  borderRadius: "12px",

                  bgcolor: "var(--sh-page-tint)",

                  border: "1px solid #E4EFEC",
                }}
              >
                <Box
                  sx={{
                    width: 23,
                    height: 23,

                    display: "grid",
                    placeItems: "center",

                    flexShrink: 0,

                    borderRadius: "50%",

                    bgcolor: "#E0F5EF",
                  }}
                >
                  <CheckRounded
                    sx={{
                      color: colors.primary,
                      fontSize: 14,
                    }}
                  />
                </Box>

                <Typography
                  sx={{
                    color: "#718680",

                    fontSize: "0.63rem",

                    lineHeight: 1.5,
                  }}
                >
                  Your account role is identified automatically after
                  sign in.
                </Typography>
              </Stack>
            </Box>

            {/* FOOTER */}

            <Box component={motion.div} variants={itemVariants}>
              <Typography
                sx={{
                  mt: 2.6,

                  color: "#AFBBB8",

                  fontSize: "0.56rem",

                  textAlign: {
                    xs: "center",
                    sm: "left",
                  },
                }}
              >
                © {new Date().getFullYear()} StoreHub · Secure account
                access
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;