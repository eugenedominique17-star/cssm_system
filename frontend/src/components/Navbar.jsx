import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Avatar,
  Divider,
  ListItemIcon,
  Fade,
  Stack,
} from "@mui/material";

import {
  Menu as MenuIcon,
  HomeRounded,
  DashboardRounded,
  Inventory2Rounded,
  ReceiptLongRounded,
  LocalOfferRounded,
  PeopleAltRounded,
  LogoutRounded,
  AccountCircleRounded,
  AssessmentRounded,
  StorefrontRounded,
  ExpandMoreRounded,
  ArrowForwardRounded,
} from "@mui/icons-material";

const Navbar = ({ homepage = false }) => {
  const { user, logout, isAuthenticated, isAdmin, isStaff, isClient } =
    useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const isDashboardRoute = /^(\/admin|\/staff|\/client)\//.test(
    location.pathname,
  );

  const [profileAnchor, setProfileAnchor] = useState(null);
  const [mobileAnchor, setMobileAnchor] = useState(null);

  const handleLogout = () => {
    setProfileAnchor(null);
    setMobileAnchor(null);
    logout();
    navigate("/");
  };

  const handleNavigate = (link) => {
    setMobileAnchor(null);
    setProfileAnchor(null);
    navigate(link);
  };

  const handleHomepageSection = (sectionId) => {
    setMobileAnchor(null);
    setProfileAnchor(null);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const getDashboardLink = () => {
    if (isAdmin) return "/admin/dashboard";
    if (isStaff) return "/staff/dashboard";
    if (isClient) return "/client/dashboard";

    return "/";
  };

  const getNavItems = () => {
    if (isAdmin) {
      return [
        {
          label: "Dashboard",
          icon: <DashboardRounded fontSize="small" />,
          link: "/admin/dashboard",
        },
        {
          label: "Accounts",
          icon: <PeopleAltRounded fontSize="small" />,
          link: "/admin/accounts",
        },
        {
          label: "Staff Approvals",
          icon: <PeopleAltRounded fontSize="small" />,
          link: "/admin/approvals/staff",
        },
        {
          label: "Client Approvals",
          icon: <PeopleAltRounded fontSize="small" />,
          link: "/admin/approvals/clients",
        },
        {
          label: "Submissions",
          icon: <Inventory2Rounded fontSize="small" />,
          link: "/admin/approvals/submissions",
        },
        {
          label: "Reports",
          icon: <AssessmentRounded fontSize="small" />,
          link: "/admin/reports",
        },
      ];
    }

    if (isStaff) {
      return [
        {
          label: "Dashboard",
          icon: <DashboardRounded fontSize="small" />,
          link: "/staff/dashboard",
        },
        {
          label: "Products",
          icon: <Inventory2Rounded fontSize="small" />,
          link: "/staff/products",
        },
        {
          label: "Receipts",
          icon: <ReceiptLongRounded fontSize="small" />,
          link: "/staff/receipts",
        },
        {
          label: "Promos",
          icon: <LocalOfferRounded fontSize="small" />,
          link: "/staff/promos",
        },
        {
          label: "Users",
          icon: <PeopleAltRounded fontSize="small" />,
          link: "/staff/users",
        },
        {
          label: "Submissions",
          icon: <Inventory2Rounded fontSize="small" />,
          link: "/staff/submissions",
        },
      ];
    }

    if (isClient) {
      return [
        {
          label: "Dashboard",
          icon: <DashboardRounded fontSize="small" />,
          link: "/client/dashboard",
        },
        {
          label: "Purchase History",
          icon: <ReceiptLongRounded fontSize="small" />,
          link: "/client/history",
        },
        {
          label: "Profile",
          icon: <AccountCircleRounded fontSize="small" />,
          link: "/client/profile",
        },
      ];
    }

    return [];
  };

  const navItems = getNavItems();

  const isActive = (link) => {
    if (link === "/") {
      return location.pathname === "/";
    }

    return location.pathname.startsWith(link);
  };

  const getUserInitial = () => {
    const name = user?.name?.trim();

    if (!name) {
      return "U";
    }

    return name.charAt(0).toUpperCase();
  };

  const getRoleStyle = () => {
    const role = String(user?.role || "").toLowerCase();

    switch (role) {
      case "admin":
        return {
          label: "Administrator",
          color: "#DC2626",
          bg: "#FEF2F2",
        };

      case "staff":
        return {
          label: "Staff",
          color: "#2563EB",
          bg: "#EFF6FF",
        };

      case "client":
        return {
          label: "Client",
          color: "#047857",
          bg: "#D8F3E5",
        };

      default:
        return {
          label: role || "User",
          color: "#4C695A",
          bg: "#EDF3E8",
        };
    }
  };

  const roleStyle = getRoleStyle();

  return (
    <>
      <AppBar
        position={homepage ? "fixed" : "sticky"}
        elevation={0}
        sx={{
          zIndex: 1200,

          ...(homepage && {
            top: { xs: 10, sm: 14 },
            left: { xs: 12, sm: 20, md: 32 },
            right: { xs: 12, sm: 20, md: 32 },
            width: "auto",
            border: "1px solid rgba(255,255,255,.18)",
            borderRadius: "18px",
            background: "rgba(255,255,255,.9)",
            boxShadow: "0 16px 40px rgba(4, 46, 40, .16)",
            borderBottom: "1px solid rgba(204,218,213,.8)",
          }),

          background:
            homepage
              ? "var(--sh-glass-bg)"
              : "var(--sh-glass-raised)",

          color: "#173D36",

          borderBottom: "1px solid rgba(204,218,213,.8)",

          backdropFilter: "blur(18px)",

          boxShadow: "0 6px 24px rgba(33,64,56,.045)",
        }}
      >
        <Toolbar
          sx={{
            width: "100%",

            maxWidth: 1440,
            boxSizing: "border-box",
            py: 1,

            mx: "auto",

            px: {
              xs: 2,
              sm: 3,
              md: 4,
            },

            minHeight: {
              xs: 64,
              md: 72,
            },

            ...(homepage && {
              minHeight: { xs: 58, md: 66 },
              px: { xs: 1.4, sm: 2.2, md: 3 },
            }),

            gap: 1.5,
          }}
        >
          {/* ================= BRAND ================= */}

          <Box
            onClick={() => navigate("/")}
            sx={{
              display: "flex",

              alignItems: "center",

              gap: 1.15,

              cursor: "pointer",

              userSelect: "none",

              flexShrink: 0,

              mr: {
                xs: 0,
                md: 0.5,
              },

              transition: "transform .2s ease",

              "&:hover": {
                transform: "translateY(-1px)",
              },
            }}
          >
            <Box
              sx={{
                width: 42,
                height: 42,

                display: "grid",
                placeItems: "center",

                borderRadius: "13px",

                background: "linear-gradient(145deg, #174E44 0%, #066649 100%)",

                color: "#FDE68A",

                boxShadow: "0 8px 20px rgba(6,102,73,.16)",

                position: "relative",

                overflow: "hidden",

                "&::after": {
                  content: '""',

                  position: "absolute",

                  width: 20,
                  height: 20,

                  top: -9,
                  right: -7,

                  borderRadius: "50%",

                  bgcolor: "rgba(255,255,255,.15)",
                },
              }}
            >
              <StorefrontRounded
                sx={{
                  fontSize: 23,
                  position: "relative",
                  zIndex: 1,
                }}
              />
            </Box>

            <Box
              sx={{
                display: {
                  xs: "block",
                  sm: "block",
                },
              }}
            >
              <Typography
                sx={{
                  color: "#173D36",

                  fontSize: {
                    xs: "1rem",
                    sm: "1.08rem",
                  },

                  fontWeight: 900,

                  lineHeight: 1,

                  letterSpacing: "-.035em",
                }}
              >
                StoreHub
              </Typography>

              <Typography
                sx={{
                  display: {
                    xs: "none",
                    sm: "block",
                  },

                  mt: 0.3,

                  color: "#8A9A95",

                  fontSize: "0.6rem",

                  fontWeight: 600,

                  letterSpacing: ".025em",
                }}
              >
                Local store management
              </Typography>
            </Box>
          </Box>

          {/* Role and homepage links share one wrapping navigation area. */}
          {!isDashboardRoute && (isAuthenticated || homepage) ? (
            <Box
              component="nav"
              aria-label="Main navigation"
              sx={{
                display: { xs: "none", lg: "flex" },
                flex: "1 1 auto",
                minWidth: 0,
                alignItems: "center",
                flexWrap: "wrap",
                columnGap: 0.75,
                rowGap: 0.5,
                "& .MuiButton-root": {
                  flexShrink: 0,
                  minWidth: "max-content",
                  minHeight: 40,
                  px: 1.35,
                  borderRadius: "10px",
                  textTransform: "none",
                  fontSize: "0.77rem",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  color: "#63756F",
                  "&:hover": { bgcolor: "#F4F7F6", color: "#066649" },
                },
                "& .MuiButton-startIcon": {
                  flexShrink: 0,
                  ml: 0,
                  mr: 0.75,
                  "& svg": { fontSize: 18 },
                },
              }}
            >
              {isAuthenticated && navItems.map(item => (
                <Button
                  key={item.link}
                  onClick={() => handleNavigate(item.link)}
                  startIcon={item.icon}
                  aria-current={isActive(item.link) ? "page" : undefined}
                  disableRipple
                  sx={isActive(item.link) ? { "&&": { color: "#066649", bgcolor: "#EDF8F4", fontWeight: 800 } } : undefined}
                >
                  {item.label}
                </Button>
              ))}
              {homepage && [
                ["Home", "home-section", <HomeRounded fontSize="small" />],
                ["Services", "services-section", <StorefrontRounded fontSize="small" />],
              ].map(([label, sectionId, icon]) => (
                <Button key={sectionId} onClick={() => handleHomepageSection(sectionId)} startIcon={icon} disableRipple>
                  {label}
                </Button>
              ))}
            </Box>
          ) : <Box sx={{ flex: 1 }} />}

          {/* ================= RIGHT SIDE ================= */}

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              ml: "auto",
              flexShrink: 0,
            }}
          >
            {/* ================= AUTHENTICATED USER ================= */}

            {isAuthenticated ? (
              <Box
                onClick={(event) => setProfileAnchor(event.currentTarget)}
                sx={{
                  display: "flex",

                  alignItems: "center",

                  gap: 1,

                  pl: 0.55,

                  pr: {
                    xs: 0.8,
                    sm: 1.2,
                  },

                  py: 0.5,

                  cursor: "pointer",

                  borderRadius: "999px",

                  border: "1px solid #DFE8E5",

                  bgcolor: "var(--sh-glass-bg)",

                  boxShadow: "0 4px 12px rgba(24,61,50,.035)",

                  transition: "all .2s ease",

                  "&:hover": {
                    borderColor: "#BFD7CF",

                    bgcolor: "#F8FBFA",

                    boxShadow: "0 7px 18px rgba(24,61,50,.055)",
                  },
                }}
              >
                <Box
                  sx={{
                    position: "relative",
                  }}
                >
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,

                      bgcolor: "#174E44",

                      color: "#FDE68A",

                      fontSize: "0.76rem",

                      fontWeight: 900,
                    }}
                  >
                    {getUserInitial()}
                  </Avatar>

                  <Box
                    sx={{
                      position: "absolute",

                      right: -1,
                      bottom: 0,

                      width: 9,
                      height: 9,

                      bgcolor: "#22C55E",

                      borderRadius: "50%",

                      border: "2px solid #FFFFFF",
                    }}
                  />
                </Box>

                <Box
                  sx={{
                    display: {
                      xs: "none",
                      sm: "block",
                    },

                    minWidth: 0,

                    maxWidth: 145,
                  }}
                >
                  <Typography
                    noWrap
                    sx={{
                      color: "#253F38",

                      fontSize: "0.72rem",

                      fontWeight: 800,

                      lineHeight: 1.2,
                    }}
                  >
                    {user?.name || "StoreHub User"}
                  </Typography>

                  <Typography
                    noWrap
                    sx={{
                      mt: 0.15,

                      color: roleStyle.color,

                      fontSize: "0.57rem",

                      fontWeight: 800,

                      textTransform: "uppercase",

                      letterSpacing: ".04em",
                    }}
                  >
                    {roleStyle.label}
                  </Typography>
                </Box>

                <ExpandMoreRounded
                  sx={{
                    display: {
                      xs: "none",
                      sm: "block",
                    },

                    fontSize: 18,

                    color: "#83938E",

                    transition: "transform .2s ease",

                    transform: Boolean(profileAnchor)
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                  }}
                />
              </Box>
            ) : (
              <Button
                onClick={() => navigate("/login")}
                endIcon={
                  <ArrowForwardRounded
                    sx={{
                      fontSize: "17px !important",
                    }}
                  />
                }
                sx={{
                  minHeight: 40,

                  px: {
                    xs: 1.7,
                    sm: 2.1,
                  },

                  borderRadius: "11px",

                  bgcolor: "#174E44",

                  color: "#FFFFFF",

                  textTransform: "none",

                  fontSize: "0.76rem",

                  fontWeight: 800,

                  boxShadow: "0 7px 18px rgba(23,78,68,.16)",

                  "&:hover": {
                    bgcolor: "#066649",

                    boxShadow: "0 9px 22px rgba(6,102,73,.2)",
                  },
                }}
              >
                Sign In
              </Button>
            )}

            {/* ================= MOBILE MENU BUTTON ================= */}

            {!isDashboardRoute && (isAuthenticated || homepage) && (
              <IconButton
                aria-label="Open navigation menu"
                aria-expanded={Boolean(mobileAnchor)}
                onClick={(event) => setMobileAnchor(event.currentTarget)}
                sx={{
                  display: {
                    xs: "flex",
                    lg: "none",
                  },

                  width: 40,
                  height: 40,

                  borderRadius: "11px",

                  bgcolor: "#F5F8F7",

                  border: "1px solid #E0E8E5",

                  color: "#31534B",

                  "&:hover": {
                    bgcolor: "#EDF5F2",

                    color: "#066649",
                  },
                }}
              >
                <MenuIcon
                  sx={{
                    fontSize: 21,
                  }}
                />
              </IconButton>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* ========================================================= */}
      {/* PROFILE MENU */}
      {/* ========================================================= */}

      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
        TransitionComponent={Fade}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          elevation: 0,

          sx: {
            width: 260,

            mt: 1.2,

            p: 0.8,

            borderRadius: "16px",

            border: "1px solid #DEE7E4",

            bgcolor: "var(--sh-glass-bg)",

            boxShadow: "0 18px 45px rgba(27,51,44,.13)",
          },
        }}
      >
        {/* user summary */}

        <Box
          sx={{
            p: 1.5,

            borderRadius: "12px",

            bgcolor: "#F7FAF9",

            border: "1px solid #ECF1EF",

            mb: 0.7,
          }}
        >
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Avatar
              sx={{
                width: 40,
                height: 40,

                bgcolor: "#174E44",

                color: "#FDE68A",

                fontSize: "0.82rem",

                fontWeight: 900,
              }}
            >
              {getUserInitial()}
            </Avatar>

            <Box
              sx={{
                minWidth: 0,
              }}
            >
              <Typography
                noWrap
                sx={{
                  color: "#233F38",

                  fontSize: "0.78rem",

                  fontWeight: 900,
                }}
              >
                {user?.name || "StoreHub User"}
              </Typography>

              <Typography
                noWrap
                sx={{
                  mt: 0.15,

                  color: "#83918D",

                  fontSize: "0.64rem",
                }}
              >
                {user?.email || ""}
              </Typography>
            </Box>
          </Stack>

          <Box
            sx={{
              display: "inline-flex",

              alignItems: "center",

              mt: 1.2,

              px: 0.9,

              py: 0.4,

              borderRadius: "999px",

              bgcolor: roleStyle.bg,

              color: roleStyle.color,

              fontSize: "0.57rem",

              fontWeight: 900,

              textTransform: "uppercase",

              letterSpacing: ".05em",
            }}
          >
            {roleStyle.label}
          </Box>
        </Box>

        <MenuItem
          onClick={() => handleNavigate(getDashboardLink())}
          sx={{
            py: 1.05,

            px: 1.2,

            borderRadius: "10px",

            color: "#405650",

            fontSize: "0.76rem",

            fontWeight: 700,

            "&:hover": {
              bgcolor: "#F2F7F5",

              color: "#066649",
            },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: "34px !important",
            }}
          >
            <DashboardRounded
              sx={{
                fontSize: 19,

                color: "#066649",
              }}
            />
          </ListItemIcon>
          Open Dashboard
        </MenuItem>

        {isClient && (
          <MenuItem
            onClick={() => handleNavigate("/client/profile")}
            sx={{
              py: 1.05,

              px: 1.2,

              borderRadius: "10px",

              color: "#405650",

              fontSize: "0.76rem",

              fontWeight: 700,

              "&:hover": {
                bgcolor: "#F2F7F5",

                color: "#066649",
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: "34px !important",
              }}
            >
              <AccountCircleRounded
                sx={{
                  fontSize: 19,

                  color: "#617B6C",
                }}
              />
            </ListItemIcon>
            My Profile
          </MenuItem>
        )}

        <Divider
          sx={{
            my: 0.6,
          }}
        />

        <MenuItem
          onClick={handleLogout}
          sx={{
            py: 1.05,

            px: 1.2,

            borderRadius: "10px",

            color: "#DC2626",

            fontSize: "0.76rem",

            fontWeight: 800,

            "&:hover": {
              bgcolor: "#FEF2F2",
            },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: "34px !important",
            }}
          >
            <LogoutRounded
              sx={{
                fontSize: 19,

                color: "#DC2626",
              }}
            />
          </ListItemIcon>
          Sign Out
        </MenuItem>
      </Menu>

      {/* ========================================================= */}
      {/* MOBILE NAVIGATION */}
      {/* ========================================================= */}

      <Menu
        anchorEl={mobileAnchor}
        open={Boolean(mobileAnchor)}
        onClose={() => setMobileAnchor(null)}
        TransitionComponent={Fade}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          elevation: 0,

          sx: {
            width: {
              xs: "calc(100vw - 28px)",
              sm: 320,
            },

            maxWidth: 340,

            mt: 1,

            p: 1,

            borderRadius: "16px",

            border: "1px solid #DEE7E4",

            boxShadow: "0 20px 50px rgba(27,51,44,.16)",
          },
        }}
      >
        <Box
          sx={{
            p: 1.2,

            mb: 0.7,

            borderRadius: "12px",

            background: "linear-gradient(135deg, #F2F8F6 0%, #FBFCFC 100%)",
          }}
        >
          <Typography
            sx={{
              color: "#173D36",

              fontSize: "0.72rem",

              fontWeight: 900,
            }}
          >
            Navigation
          </Typography>

          <Typography
            sx={{
              mt: 0.25,

              color: "#899894",

              fontSize: "0.61rem",
            }}
          >
            StoreHub workspace menu
          </Typography>
        </Box>

        <MenuItem
          onClick={() => handleNavigate("/")}
          sx={{
            py: 1,

            borderRadius: "10px",

            color: location.pathname === "/" ? "#066649" : "#465B55",

            bgcolor: location.pathname === "/" ? "#EFF8F5" : "transparent",

            fontSize: "0.76rem",

            fontWeight: location.pathname === "/" ? 800 : 700,
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: "35px !important",
            }}
          >
            <HomeRounded
              sx={{
                fontSize: 19,

                color: location.pathname === "/" ? "#066649" : "#71837D",
              }}
            />
          </ListItemIcon>
          Home
        </MenuItem>

        {homepage && (
          <MenuItem
            onClick={() => handleHomepageSection("services-section")}
            sx={{
              py: 1,
              borderRadius: "10px",
              color: "#465B55",
              fontSize: "0.76rem",
              fontWeight: 700,
              "&:hover": {
                bgcolor: "#F5F8F7",
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: "35px !important",
              }}
            >
              <StorefrontRounded
                sx={{
                  fontSize: 19,
                  color: "#71837D",
                }}
              />
            </ListItemIcon>
            Services
          </MenuItem>
        )}

        {navItems.length > 0 && (
          <Divider
            sx={{
              my: 0.7,
            }}
          />
        )}

        {navItems.map((item) => {
          const active = isActive(item.link);

          return (
            <MenuItem
              key={item.link}
              onClick={() => handleNavigate(item.link)}
              sx={{
                py: 1,

                my: 0.2,

                borderRadius: "10px",

                bgcolor: active ? "#EFF8F5" : "transparent",

                color: active ? "#066649" : "#465B55",

                fontSize: "0.76rem",

                fontWeight: active ? 800 : 700,

                "&:hover": {
                  bgcolor: active ? "#E8F5F1" : "#F5F8F7",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: "35px !important",
                }}
              >
                {React.cloneElement(item.icon, {
                  sx: {
                    fontSize: 19,

                    color: active ? "#066649" : "#71837D",
                  },
                })}
              </ListItemIcon>

              {item.label}
            </MenuItem>
          );
        })}

        {isAuthenticated && (
          <>
            <Divider
              sx={{
                my: 0.7,
              }}
            />

            <MenuItem
              onClick={handleLogout}
              sx={{
                py: 1,

                borderRadius: "10px",

                color: "#DC2626",

                fontSize: "0.76rem",

                fontWeight: 800,

                "&:hover": {
                  bgcolor: "#FEF2F2",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: "35px !important",
                }}
              >
                <LogoutRounded
                  sx={{
                    fontSize: 19,

                    color: "#DC2626",
                  }}
                />
              </ListItemIcon>
              Sign Out
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
};

export default Navbar;
