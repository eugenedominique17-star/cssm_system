import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Link as MuiLink,
  Container,
  Grid,
} from "@mui/material";
import {
  Storefront,
  Home,
  Login,
  Inventory as InventoryIcon,
  Info as InfoIcon,
  Description as DescriptionIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Place as PlaceIcon,
  Favorite as FavoriteIcon,
} from "@mui/icons-material";
import { colors } from "../theme";

const footerLinks = [
  { label: "Shop", icon: <Storefront fontSize="small" />, href: "#" },
  { label: "Services", icon: <InventoryIcon fontSize="small" />, href: "#" },
  { label: "About Us", icon: <InfoIcon fontSize="small" />, href: "#" },
  { label: "Contract", icon: <DescriptionIcon fontSize="small" />, href: "#" },
];

const Footer = () => {
  const navigate = useNavigate();

  return (
    <Box
      component="footer"
      sx={{
        background: `linear-gradient(180deg, ${colors?.dark || "#183D32"} 0%, #090D16 100%)`,
        color: "white",
        pt: { xs: 6, md: 8 },
        pb: 4,
        mt: "auto",
        position: "relative",
        overflow: "hidden",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Background Glow Overlay Effects */}
      <Box
        sx={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 300,
          height: 300,
          background:
            "radial-gradient(circle, rgba(8,127,91, 0.15) 0%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
          filter: "blur(30px)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: -100,
          left: -100,
          width: 350,
          height: 350,
          background:
            "radial-gradient(circle, rgba(185,235,208, 0.08) 0%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
          filter: "blur(40px)",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Grid container spacing={{ xs: 4, md: 6 }}>
          {/* BRAND Column */}
          <Grid item xs={12} md={5}>
            <Box sx={{ maxWidth: 360 }}>
              <Box
                onClick={() => navigate("/")}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1.5,
                  mb: 2,
                  cursor: "pointer",
                  "&:hover .brand-logo": {
                    transform: "rotate(-6deg) scale(1.05)",
                  },
                }}
              >
                <Box
                  className="brand-logo"
                  sx={{
                    background:
                      "linear-gradient(135deg, rgba(185,235,208,0.2) 0%, rgba(8,127,91,0.1) 100%)",
                    borderRadius: "12px",
                    p: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(185,235,208, 0.25)",
                    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <Storefront sx={{ color: "#B9EBD0", fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight={800}
                    sx={{
                      lineHeight: 1.1,
                      letterSpacing: "0.5px",
                      background:
                        "linear-gradient(90deg, #FFFFFF 0%, #CBD5E1 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    StoreHub
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "#839B8C", fontWeight: 500 }}
                  >
                    Sari-Sari Store Stock Management
                  </Typography>
                </Box>
              </Box>

              <Typography
                variant="body2"
                sx={{
                  color: "#839B8C",
                  lineHeight: 1.6,
                  mb: 2,
                }}
              >
                Modernizing local retail inventory management with seamless
                tracking, automated receipts, and real-time sales reporting.
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: "#CBD5E1",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  fontSize: "0.85rem",
                  px: 1.5,
                  py: 0.5,
                  borderRadius: "20px",
                  bgcolor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                Made with
                <FavoriteIcon
                  sx={{
                    color: colors?.red || "#EF4444",
                    fontSize: 16,
                    animation: "pulse 1.8s infinite ease-in-out",
                    "@keyframes pulse": {
                      "0%": { transform: "scale(1)" },
                      "50%": { transform: "scale(1.2)" },
                      "100%": { transform: "scale(1)" },
                    },
                  }}
                />
                for your everyday needs
              </Typography>
            </Box>
          </Grid>

          {/* QUICK LINKS Column */}
          <Grid item xs={6} md={3}>
            <Typography
              variant="overline"
              sx={{
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "1px",
                color: "#B9EBD0",
                mb: 2,
                display: "block",
              }}
            >
              Quick Links
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {footerLinks.map((link) => (
                <MuiLink
                  key={link.label}
                  href={link.href}
                  onClick={(e) => e.preventDefault()}
                  sx={{
                    color: "#839B8C",
                    textDecoration: "none",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1.25,
                    width: "fit-content",
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                      color: "#B9EBD0",
                      transform: "translateX(4px)",
                      "& .link-icon": { color: "#B9EBD0" },
                    },
                  }}
                >
                  <Box
                    className="link-icon"
                    sx={{
                      color: "#617B6C",
                      display: "flex",
                      transition: "color 0.2s ease",
                    }}
                  >
                    {link.icon}
                  </Box>
                  {link.label}
                </MuiLink>
              ))}
            </Box>
          </Grid>

          {/* CONTACT Column */}
          <Grid item xs={12} sm={6} md={4}>
            <Typography
              variant="overline"
              sx={{
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "1px",
                color: "#B9EBD0",
                mb: 2,
                display: "block",
              }}
            >
              Contact
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                p: 2.5,
                borderRadius: "16px",
                bgcolor: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                <PlaceIcon sx={{ color: "#B9EBD0", fontSize: 20, mt: 0.2 }} />
                <Typography
                  variant="body2"
                  sx={{ color: "#CBD5E1", lineHeight: 1.5 }}
                >
                  Garcia, Batuan, Bohol
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <PhoneIcon sx={{ color: "#B9EBD0", fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: "#839B8C" }}>
                  +63 912 345 6789
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <EmailIcon sx={{ color: "#B9EBD0", fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: "#839B8C" }}>
                  contact@storehub.ph
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* BOTTOM BAR: Copyright & Quick Action Buttons */}
        <Box
          sx={{
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            mt: { xs: 5, md: 7 },
            pt: 3,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justify: "space-between",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: "#617B6C",
              textAlign: { xs: "center", sm: "left" },
              fontSize: "0.85rem",
            }}
          >
            &copy; {new Date().getFullYear()} StoreHub. All rights reserved.
          </Typography>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              ml: { sm: "auto" },
            }}
          >
            <Tooltip title="Homepage">
              <IconButton
                size="small"
                onClick={() => navigate("/")}
                sx={{
                  color: "#839B8C",
                  bgcolor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  p: 1,
                  borderRadius: "10px",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    color: "#B9EBD0",
                    bgcolor: "rgba(185,235,208, 0.1)",
                    borderColor: "rgba(185,235,208, 0.3)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Home fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Login">
              <IconButton
                size="small"
                onClick={() => navigate("/login")}
                sx={{
                  color: "#839B8C",
                  bgcolor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  p: 1,
                  borderRadius: "10px",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    color: "#B9EBD0",
                    bgcolor: "rgba(185,235,208, 0.1)",
                    borderColor: "rgba(185,235,208, 0.3)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Login fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
