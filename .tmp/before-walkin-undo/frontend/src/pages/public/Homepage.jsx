import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Fab,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  AccessTimeRounded,
  ArrowForwardRounded,
  CheckCircleRounded,
  FilterAltOffRounded,
  Inventory2Outlined,
  KeyboardArrowUpRounded,
  LocalOfferRounded,
  LocationOnRounded,
  LoginRounded,
  PhoneRounded,
  RefreshRounded,
  SearchRounded,
  ShoppingBagOutlined,
  StorefrontRounded,
  SupportAgentRounded,
  TrendingUpRounded,
  VerifiedRounded,
} from "@mui/icons-material";

import API from "../../api/axios";
import Navbar from "../../components/Navbar";

const STORE = {
  name: "StoreHub",
  tagline: "Local convenience, made simpler.",
  address: "Garcia, Batuan, Bohol",
  phone: "09515200688",
  openingHour: 8,
  closingHour: 18,
};

const MotionBox = motion.create(Box);
const MotionPaper = motion.create(Paper);
const MotionCard = motion.create(Card);

const Homepage = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [data, setData] = useState({ products: [], promos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortOrder, setSortOrder] = useState("featured");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchHomepageData = async () => {
    setLoading(true);
    setError("");

    try {
      // Existing backend API kept unchanged.
      const response = await API.get("/public/homepage");

      setData({
        products: response.data?.products || [],
        promos: response.data?.promos || [],
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch homepage data:", err);
      setError(
        "We could not load the latest store data. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomepageData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });

  const formatPrice = (price) =>
    `₱${Number(price || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (date) =>
    date
      ? new Date(date).toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

  const getStockStatus = (stockValue) => {
    const stock = Number(stockValue || 0);

    if (stock <= 0)
      return {
        label: "Out of Stock",
        color: "#B42318",
        bg: "#FEF3F2",
        border: "#FECDCA",
      };

    if (stock <= 10)
      return {
        label: `Only ${stock} left`,
        color: "#B54708",
        bg: "#FFFAEB",
        border: "#FEDF89",
      };

    return {
      label: "In Stock",
      color: "#027A48",
      bg: "#ECFDF3",
      border: "#ABEFC6",
    };
  };

  const categories = useMemo(() => {
    const values = data.products.map((p) => p.category).filter(Boolean);
    return ["All", ...new Set(values)];
  }, [data.products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = data.products.filter((product) => {
      const matchesCategory =
        activeCategory === "All" || product.category === activeCategory;

      const matchesSearch =
        !query ||
        product.name?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });

    return [...result].sort((a, b) => {
      if (sortOrder === "price-low")
        return Number(a.price || 0) - Number(b.price || 0);
      if (sortOrder === "price-high")
        return Number(b.price || 0) - Number(a.price || 0);
      if (sortOrder === "name")
        return String(a.name || "").localeCompare(String(b.name || ""));
      if (sortOrder === "stock")
        return Number(b.stock || 0) - Number(a.stock || 0);
      return 0;
    });
  }, [data.products, search, activeCategory, sortOrder]);

  const featuredProducts = useMemo(
    () =>
      [...data.products]
        .filter((p) => Number(p.stock || 0) > 0)
        .sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0))
        .slice(0, 4),
    [data.products]
  );

  const availableProducts = useMemo(
    () => data.products.filter((p) => Number(p.stock || 0) > 0).length,
    [data.products]
  );

  const activePromos = useMemo(() => {
    const today = new Date();

    return data.promos.filter((promo) => {
      if (!promo.end_date) return true;
      const endDate = new Date(promo.end_date);
      endDate.setHours(23, 59, 59, 999);
      return endDate >= today;
    });
  }, [data.promos]);

  const storeHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", hourCycle: "h23" }).format(now));
  const isOpen = storeHour >= STORE.openingHour && storeHour < STORE.closingHour;

  const storeStatusText = isOpen
    ? "Open now · closes at 6:00 PM"
    : storeHour < STORE.openingHour
      ? "Closed · opens at 8:00 AM"
      : "Closed · opens tomorrow at 8:00 AM";

  const reveal = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 22 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0 : 0.55 },
    },
  };

  const promoLabel = (promo) => {
    if (promo.discount_type === "percentage")
      return `${promo.discount_value}% OFF`;
    if (promo.discount_type === "fixed")
      return `₱${promo.discount_value} OFF`;
    return "SPECIAL DEAL";
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "var(--sh-page-tint)", pt: { xs: 9, sm: 10 } }}>
        <Navbar homepage />
        <Container maxWidth="lg" sx={{ py: 7 }}>
          <Skeleton variant="rounded" height={420} sx={{ borderRadius: "32px" }} />
          <Grid container spacing={2.5} sx={{ mt: 2 }}>
            {[1, 2, 3, 4].map((item) => (
              <Grid item xs={12} sm={6} md={3} key={item}>
                <Skeleton variant="rounded" height={330} sx={{ borderRadius: "22px" }} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "var(--sh-page-tint)",
        color: "#102A26",
        overflowX: "hidden",
        pt: { xs: 9, sm: 10 },
      }}
    >
      <Navbar homepage />

      {error && (
        <Container maxWidth="lg" sx={{ pt: 2 }}>
          <Alert
            severity="warning"
            action={
              <Button
                color="inherit"
                size="small"
                startIcon={<RefreshRounded />}
                onClick={fetchHomepageData}
              >
                Retry
              </Button>
            }
            sx={{ borderRadius: "16px" }}
          >
            {error}
          </Alert>
        </Container>
      )}

      {/* NEW LIGHT HERO */}
      <Box
        id="home-section"
        sx={{
          position: "relative",
          overflow: "hidden",
          pt: { xs: 5, md: 8 },
          pb: { xs: 7, md: 10 },
          background:
            "radial-gradient(circle at 78% 20%, rgba(185,235,208,.28), transparent 25%), radial-gradient(circle at 10% 80%, rgba(142,221,184,.13), transparent 22%), linear-gradient(135deg,#F7F5EC 0%,#EFF5E7 48%,#D8F3E5 100%)",
        }}
      >
        <MotionBox
          animate={reduceMotion ? {} : { y: [0, -16, 0], x: [0, 8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          sx={{
            position: "absolute",
            width: 260,
            height: 260,
            borderRadius: "50%",
            right: { xs: -130, md: "8%" },
            top: -90,
            bgcolor: "rgba(142,221,184,.12)",
            filter: "blur(2px)",
          }}
        />

        <MotionBox
          animate={reduceMotion ? {} : { y: [0, 12, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          sx={{
            position: "absolute",
            width: 110,
            height: 110,
            borderRadius: "50%",
            right: "4%",
            bottom: "10%",
            bgcolor: "rgba(39,174,128,.11)",
          }}
        />

        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 5, md: 7 }} alignItems="center">
            <Grid item xs={12} md={7}>
              <MotionBox
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: {
                    transition: { staggerChildren: reduceMotion ? 0 : 0.09 },
                  },
                }}
              >
                <MotionBox variants={reveal}>
                  <Chip
                    icon={<StorefrontRounded />}
                    label="Your neighborhood convenience store"
                    sx={{
                      mb: 2.4,
                      bgcolor: "rgba(255,255,255,.8)",
                      color: "#066649",
                      border: "1px solid #CBEDE6",
                      boxShadow: "0 8px 25px rgba(6,102,73,.06)",
                      "& .MuiChip-icon": { color: "#087F5B" },
                      "& .MuiChip-label": { fontWeight: 800 },
                    }}
                  />
                </MotionBox>

                <MotionBox variants={reveal}>
                  <Typography
                    component="h1"
                    sx={{
                      maxWidth: 720,
                      fontSize: { xs: "2.7rem", sm: "3.8rem", md: "4.6rem" },
                      lineHeight: 0.98,
                      letterSpacing: "-0.06em",
                      fontWeight: 950,
                      color: "#102A26",
                    }}
                  >
                    Everyday essentials,
                    <Box component="span" sx={{ display: "block", mt: 0.7, color: "#0F9F8F" }}>
                      always within reach.
                    </Box>
                  </Typography>
                </MotionBox>

                <MotionBox variants={reveal}>
                  <Typography
                    sx={{
                      mt: 2.5,
                      maxWidth: 620,
                      color: "#667A76",
                      fontSize: { xs: ".95rem", md: "1.05rem" },
                      lineHeight: 1.8,
                    }}
                  >
                    Check product availability, browse current promotions, and
                    discover everyday essentials from your local StoreHub in one
                    simple place. Purchases and payments are handled directly at our in-store cashier.
                  </Typography>
                </MotionBox>

                <MotionBox variants={reveal}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.4} sx={{ mt: 3.3 }}>
                    <Button variant="outlined" onClick={() => navigate("/register/client")} sx={{ borderRadius: "15px", textTransform: "none", fontWeight: 800 }}>Sign Up</Button>
                    <motion.div whileHover={reduceMotion ? {} : { y: -3 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<ShoppingBagOutlined />}
                        onClick={() => scrollTo("products-section")}
                        sx={{
                          minHeight: 52,
                          px: 3,
                          borderRadius: "15px",
                          bgcolor: "#087F5B",
                          color: "#fff",
                          textTransform: "none",
                          fontWeight: 900,
                          boxShadow: "0 12px 28px rgba(15,139,126,.18)",
                          "&:hover": { bgcolor: "#066649" },
                        }}
                      >
                        Browse Products
                      </Button>
                    </motion.div>

                    <motion.div whileHover={reduceMotion ? {} : { y: -3 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="outlined"
                        size="large"
                        endIcon={<ArrowForwardRounded />}
                        onClick={() => scrollTo("promos-section")}
                        sx={{
                          minHeight: 52,
                          px: 3,
                          borderRadius: "15px",
                          borderColor: "#B7DCD5",
                          color: "#174A43",
                          bgcolor: "rgba(255,255,255,.55)",
                          textTransform: "none",
                          fontWeight: 800,
                          "&:hover": { borderColor: "#087F5B", bgcolor: "var(--sh-glass-bg)" },
                        }}
                      >
                        View Promotions
                      </Button>
                    </motion.div>
                  </Stack>
                </MotionBox>

                <MotionBox variants={reveal}>
                  <Stack
                    direction="row"
                    spacing={{ xs: 1.5, sm: 2.8 }}
                    sx={{ mt: 3.3, flexWrap: "wrap", rowGap: 1.2 }}
                  >
                    {[
                      [<VerifiedRounded />, "Reliable products"],
                      [<TrendingUpRounded />, "Updated stock"],
                      [<SupportAgentRounded />, "Local support"],
                    ].map(([icon, label]) => (
                      <Stack key={label} direction="row" spacing={0.7} alignItems="center">
                        <Box sx={{ display: "flex", color: "#087F5B", "& svg": { fontSize: 18 } }}>
                          {icon}
                        </Box>
                        <Typography sx={{ color: "#647773", fontSize: ".75rem", fontWeight: 700 }}>
                          {label}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </MotionBox>
              </MotionBox>
            </Grid>

            <Grid item xs={12} md={5}>
              <MotionPaper
                initial={{ opacity: 0, x: reduceMotion ? 0 : 35, scale: reduceMotion ? 1 : 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.7, delay: 0.2 }}
                whileHover={reduceMotion ? {} : { y: -6 }}
                elevation={0}
                sx={{
                  p: { xs: 1.3, sm: 1.7 },
                  borderRadius: "32px",
                  bgcolor: "rgba(255,255,255,.42)",
                  border: "1px solid rgba(255,255,255,.85)",
                  boxShadow: "0 30px 70px rgba(24,89,79,.13)",
                  backdropFilter: "blur(16px)",
                }}
              >
                <Box sx={{ p: { xs: 2.3, sm: 2.8 }, borderRadius: "25px", bgcolor: "var(--sh-glass-bg)" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Box
                        sx={{
                          width: 50,
                          height: 50,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: "16px",
                          bgcolor: "#ECFDF8",
                          border: "1px solid #C9F2E8",
                        }}
                      >
                        <StorefrontRounded sx={{ color: "#087F5B" }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: "1.05rem", fontWeight: 950 }}>
                          {STORE.name}
                        </Typography>
                        <Typography sx={{ color: "#8A9B97", fontSize: ".7rem" }}>
                          {STORE.address}
                        </Typography>
                      </Box>
                    </Stack>

                    <Chip
                      size="small"
                      icon={<CheckCircleRounded />}
                      label={isOpen ? "OPEN NOW" : "CLOSED"}
                      sx={{
                        bgcolor: isOpen ? "#ECFDF3" : "#FEF3F2",
                        color: isOpen ? "#027A48" : "#B42318",
                        fontWeight: 900,
                        "& .MuiChip-icon": { color: "inherit" },
                      }}
                    />
                  </Stack>

                  <Divider sx={{ my: 2.4, borderColor: "#EEF3F2" }} />

                  <Typography sx={{ color: "#738581", fontSize: ".8rem", lineHeight: 1.65 }}>
                    A quick look at what is currently available in the store.
                  </Typography>

                  <Grid container spacing={1.5} sx={{ mt: 0.7 }}>
                    <Grid item xs={6}>
                      <Box sx={{ p: 2, borderRadius: "18px", bgcolor: "#ECFBF8", border: "1px solid #C6F1E8" }}>
                        <Typography sx={{ color: "#087F5B", fontSize: ".65rem", fontWeight: 900 }}>
                          AVAILABLE
                        </Typography>
                        <Typography sx={{ mt: 0.5, fontSize: "1.65rem", fontWeight: 950 }}>
                          {availableProducts}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ p: 2, borderRadius: "18px", bgcolor: "#FFF8EF", border: "1px solid #FDE6C8" }}>
                        <Typography sx={{ color: "#C65D09", fontSize: ".65rem", fontWeight: 900 }}>
                          ACTIVE PROMOS
                        </Typography>
                        <Typography sx={{ mt: 0.5, fontSize: "1.65rem", fontWeight: 950 }}>
                          {activePromos.length}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 1.6, p: 1.7, borderRadius: "17px", bgcolor: "#F7FAFA" }}>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <LocationOnRounded sx={{ color: "#087F5B" }} />
                      <Box>
                        <Typography sx={{ fontSize: ".74rem", fontWeight: 900 }}>Visit the store</Typography>
                        <Typography sx={{ mt: .2, color: "#71817E", fontSize: ".68rem" }}>
                          Open daily from 8:00 AM to 6:00 PM (Philippine time).
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Box>
              </MotionPaper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* QUICK STATS */}
      <Box sx={{ bgcolor: "var(--sh-glass-bg)", borderTop: "1px solid #EAF1EF", borderBottom: "1px solid #EAF1EF" }}>
        <Container maxWidth="lg">
          <Grid container>
            {[
              [data.products.length, "Products listed"],
              [availableProducts, "Available now"],
              [activePromos.length, "Active promotions"],
              ["7 Days", "Open weekly"],
            ].map(([value, label], index) => (
              <Grid item xs={6} md={3} key={label}>
                <Box
                  sx={{
                    py: 2.5,
                    textAlign: "center",
                    borderRight: { md: index < 3 ? "1px solid #EAF1EF" : "none" },
                  }}
                >
                  <Typography sx={{ fontSize: "1.25rem", fontWeight: 950, color: "#153C36" }}>
                    {value}
                  </Typography>
                  <Typography sx={{ mt: .25, color: "#82918E", fontSize: ".68rem", fontWeight: 700 }}>
                    {label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* FEATURED */}
      {featuredProducts.length > 0 && (
        <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: "var(--sh-glass-bg)" }}>
          <Container maxWidth="lg">
            <MotionBox variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .2 }}>
              <Typography sx={{ color: "#087F5B", fontSize: ".7rem", fontWeight: 900, letterSpacing: ".12em" }}>
                POPULAR IN STORE
              </Typography>
              <Typography sx={{ mt: .6, fontSize: { xs: "1.7rem", md: "2.1rem" }, fontWeight: 950, letterSpacing: "-.04em" }}>
                Featured Products
              </Typography>
              <Typography sx={{ mt: .6, color: "#7A8C88", fontSize: ".8rem" }}>
                A quick look at available everyday essentials.
              </Typography>
            </MotionBox>

            <Grid container spacing={2.3} sx={{ mt: 1.5 }}>
              {featuredProducts.map((product, index) => {
                const stock = getStockStatus(product.stock);
                return (
                  <Grid item xs={12} sm={6} md={3} key={product.id ?? `${product.name}-${index}`}>
                    <MotionCard
                      initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: reduceMotion ? 0 : index * .06 }}
                      whileHover={reduceMotion ? {} : { y: -7 }}
                      elevation={0}
                      sx={{
                        height: "100%",
                        borderRadius: "22px",
                        overflow: "hidden",
                        border: "1px solid #E5EEEB",
                        boxShadow: "0 10px 30px rgba(25,65,59,.05)",
                      }}
                    >
                      <Box sx={{ height: 185, position: "relative", overflow: "hidden", bgcolor: "#F0F6F4" }}>
                        {product.image_url ? (
                          <motion.img
                            src={product.image_url}
                            alt={product.name || "Product"}
                            loading="lazy"
                            whileHover={reduceMotion ? {} : { scale: 1.055 }}
                            transition={{ duration: .35 }}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
                            <Inventory2Outlined sx={{ fontSize: 48, color: "#A8BAB6" }} />
                          </Box>
                        )}
                        <Chip
                          size="small"
                          label={product.category || "General"}
                          sx={{
                            position: "absolute",
                            top: 12,
                            left: 12,
                            bgcolor: "rgba(255,255,255,.92)",
                            fontSize: ".6rem",
                            fontWeight: 800,
                          }}
                        />
                      </Box>

                      <CardContent sx={{ p: 2.1, "&:last-child": { pb: 2.1 } }}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                          <Typography sx={{ fontSize: ".9rem", fontWeight: 900, lineHeight: 1.35 }}>
                            {product.name}
                          </Typography>
                          <Chip
                            size="small"
                            label={stock.label}
                            sx={{
                              height: 23,
                              bgcolor: stock.bg,
                              color: stock.color,
                              border: `1px solid ${stock.border}`,
                              fontSize: ".55rem",
                              fontWeight: 900,
                            }}
                          />
                        </Stack>
                        <Typography
                          sx={{
                            mt: .8,
                            minHeight: 38,
                            color: "#7B8C89",
                            fontSize: ".69rem",
                            lineHeight: 1.55,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {product.description || "Everyday essential available from your local StoreHub."}
                        </Typography>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: 1.5 }}>
                          <Typography sx={{ color: "#066649", fontSize: "1.1rem", fontWeight: 950 }}>
                            {formatPrice(product.price)}
                          </Typography>
                          <Typography sx={{ color: "#92A09D", fontSize: ".6rem", fontWeight: 700 }}>
                            {Number(product.stock || 0)} in stock
                          </Typography>
                        </Stack>
                      </CardContent>
                    </MotionCard>
                  </Grid>
                );
              })}
            </Grid>
          </Container>
        </Box>
      )}

      {/* PRODUCT CATALOG */}
      <Box
        id="products-section"
        sx={{ scrollMarginTop: 90, py: { xs: 6, md: 8 }, bgcolor: "var(--sh-page-tint)" }}
      >
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "flex-end" }}
            spacing={2}
          >
            <Box>
              <Typography sx={{ color: "#087F5B", fontSize: ".7rem", fontWeight: 900, letterSpacing: ".12em" }}>
                STORE CATALOG
              </Typography>
              <Typography sx={{ mt: .6, fontSize: { xs: "1.7rem", md: "2.1rem" }, fontWeight: 950, letterSpacing: "-.04em" }}>
                Find what you need
              </Typography>
              <Typography sx={{ mt: .5, color: "#7B8C89", fontSize: ".8rem" }}>
                Search, filter, and sort products using live StoreHub data.
              </Typography>
            </Box>

            {lastUpdated && (
              <Typography sx={{ color: "#899895", fontSize: ".66rem" }}>
                Updated {lastUpdated.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
              </Typography>
            )}
          </Stack>

          <Paper
            elevation={0}
            sx={{
              mt: 2.4,
              p: { xs: 1.5, md: 1.8 },
              borderRadius: "20px",
              border: "1px solid #E2ECE9",
              bgcolor: "var(--sh-glass-bg)",
              boxShadow: "0 12px 35px rgba(25,65,59,.04)",
            }}
          >
            <Grid container spacing={1.3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRounded sx={{ color: "#80918D" }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "14px",
                      bgcolor: "#F9FBFB",
                    },
                  }}
                />
              </Grid>

              <Grid item xs={6} md={3}>
                <Select
                  fullWidth
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  sx={{ borderRadius: "14px", bgcolor: "#F9FBFB" }}
                >
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category === "All" ? "All Categories" : category}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>

              <Grid item xs={6} md={3}>
                <Select
                  fullWidth
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  sx={{ borderRadius: "14px", bgcolor: "#F9FBFB" }}
                >
                  <MenuItem value="featured">Featured</MenuItem>
                  <MenuItem value="price-low">Price: Low to High</MenuItem>
                  <MenuItem value="price-high">Price: High to Low</MenuItem>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="stock">Stock</MenuItem>
                </Select>
              </Grid>
            </Grid>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1}
              sx={{ mt: 1.5 }}
            >
              <Stack direction="row" spacing={.8} sx={{ flexWrap: "wrap", rowGap: .8 }}>
                {categories.map((category) => (
                  <motion.div key={category} whileTap={{ scale: .95 }}>
                    <Chip
                      clickable
                      label={category}
                      onClick={() => setActiveCategory(category)}
                      sx={{
                        bgcolor: activeCategory === category ? "#087F5B" : "#F3F7F6",
                        color: activeCategory === category ? "#fff" : "#5D706C",
                        border: "1px solid",
                        borderColor: activeCategory === category ? "#087F5B" : "#E1EAE8",
                        fontWeight: 800,
                      }}
                    />
                  </motion.div>
                ))}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                {(search || activeCategory !== "All" || sortOrder !== "featured") && (
                  <Button
                    size="small"
                    startIcon={<FilterAltOffRounded />}
                    onClick={() => {
                      setSearch("");
                      setActiveCategory("All");
                      setSortOrder("featured");
                    }}
                    sx={{ color: "#657773", textTransform: "none", fontWeight: 800 }}
                  >
                    Clear
                  </Button>
                )}
                <Chip
                  label={`${filteredProducts.length} result${filteredProducts.length === 1 ? "" : "s"}`}
                  sx={{ bgcolor: "#ECFBF8", color: "#066649", fontWeight: 900 }}
                />
              </Stack>
            </Stack>
          </Paper>

          {filteredProducts.length === 0 ? (
            <Paper
              elevation={0}
              sx={{ mt: 2.5, p: 5, textAlign: "center", borderRadius: "22px", border: "1px solid #E3ECEA" }}
            >
              <SearchRounded sx={{ fontSize: 44, color: "#A8B7B4" }} />
              <Typography sx={{ mt: 1, fontWeight: 900 }}>No products found</Typography>
              <Typography sx={{ mt: .5, color: "#82918E", fontSize: ".78rem" }}>
                Try another search or category.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2.3} sx={{ mt: 1 }}>
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, index) => {
                  const stock = getStockStatus(product.stock);
                  return (
                    <Grid item xs={12} sm={6} md={3} key={product.id ?? `${product.name}-${index}`} component={motion.div} layout>
                      <MotionCard
                        layout
                        initial={{ opacity: 0, scale: reduceMotion ? 1 : .96, y: reduceMotion ? 0 : 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: reduceMotion ? 1 : .96 }}
                        whileHover={reduceMotion ? {} : { y: -7 }}
                        elevation={0}
                        sx={{
                          height: "100%",
                          borderRadius: "22px",
                          overflow: "hidden",
                          border: "1px solid #E3ECEA",
                          bgcolor: "var(--sh-glass-bg)",
                          boxShadow: "0 10px 28px rgba(25,65,59,.045)",
                        }}
                      >
                        <Box sx={{ height: 190, position: "relative", overflow: "hidden", bgcolor: "#EFF5F3" }}>
                          {product.image_url ? (
                            <motion.img
                              src={product.image_url}
                              alt={product.name || "Product"}
                              loading="lazy"
                              whileHover={reduceMotion ? {} : { scale: 1.055 }}
                              transition={{ duration: .35 }}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
                              <ShoppingBagOutlined sx={{ fontSize: 48, color: "#A7B8B4" }} />
                            </Box>
                          )}

                          <Chip
                            size="small"
                            label={product.category || "General"}
                            sx={{
                              position: "absolute",
                              top: 12,
                              left: 12,
                              bgcolor: "rgba(255,255,255,.94)",
                              fontSize: ".6rem",
                              fontWeight: 800,
                            }}
                          />

                          <Chip
                            size="small"
                            label={stock.label}
                            sx={{
                              position: "absolute",
                              right: 12,
                              bottom: 12,
                              bgcolor: stock.bg,
                              color: stock.color,
                              border: `1px solid ${stock.border}`,
                              fontSize: ".55rem",
                              fontWeight: 900,
                            }}
                          />
                        </Box>

                        <CardContent sx={{ p: 2.1, "&:last-child": { pb: 2.1 } }}>
                          <Typography sx={{ fontSize: ".9rem", fontWeight: 900 }}>
                            {product.name}
                          </Typography>
                          <Typography
                            sx={{
                              mt: .65,
                              minHeight: 38,
                              color: "#7B8C89",
                              fontSize: ".69rem",
                              lineHeight: 1.55,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {product.description || "Everyday essential currently listed at StoreHub."}
                          </Typography>
                          <Divider sx={{ my: 1.5, borderColor: "#EEF3F2" }} />
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
                            <Typography sx={{ color: "#066649", fontSize: "1.12rem", fontWeight: 950 }}>
                              {formatPrice(product.price)}
                            </Typography>
                            <Typography sx={{ color: "#91A09D", fontSize: ".6rem", fontWeight: 700 }}>
                              {Number(product.stock || 0)} in stock
                            </Typography>
                          </Stack>
                        </CardContent>
                      </MotionCard>
                    </Grid>
                  );
                })}
              </AnimatePresence>
            </Grid>
          )}
        </Container>
      </Box>

      {/* PROMOTIONS */}
      <Box
        id="promos-section"
        sx={{ scrollMarginTop: 90, py: { xs: 6, md: 8 }, bgcolor: "var(--sh-glass-bg)" }}
      >
        <Container maxWidth="lg">
          <Typography sx={{ color: "#E24A64", fontSize: ".7rem", fontWeight: 900, letterSpacing: ".12em" }}>
            CURRENT DEALS
          </Typography>
          <Typography sx={{ mt: .6, fontSize: { xs: "1.7rem", md: "2.1rem" }, fontWeight: 950, letterSpacing: "-.04em" }}>
            Current Promotions
          </Typography>
          <Typography sx={{ mt: .5, color: "#7B8C89", fontSize: ".8rem" }}>
            Take advantage of the latest offers available at StoreHub.
          </Typography>

          {activePromos.length === 0 ? (
            <Paper
              elevation={0}
              sx={{ mt: 2.5, p: 4, borderRadius: "22px", bgcolor: "#FFF9F7", border: "1px solid #F8E6DF" }}
            >
              <LocalOfferRounded sx={{ color: "#D97757" }} />
              <Typography sx={{ mt: 1, fontWeight: 900 }}>No active promotions right now</Typography>
              <Typography sx={{ mt: .4, color: "#897B76", fontSize: ".76rem" }}>
                Check back again for new StoreHub offers.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2.3} sx={{ mt: 1.3 }}>
              {activePromos.map((promo, index) => (
                <Grid item xs={12} md={4} key={promo.id ?? `${promo.title}-${index}`}>
                  <MotionCard
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: reduceMotion ? 0 : index * .08 }}
                    whileHover={reduceMotion ? {} : { y: -6 }}
                    elevation={0}
                    sx={{
                      height: "100%",
                      borderRadius: "22px",
                      overflow: "hidden",
                      border: "1px solid #F1E5E0",
                      boxShadow: "0 12px 30px rgba(66,44,35,.05)",
                    }}
                  >
                    <Box
                      sx={{
                        minHeight: 120,
                        p: 2.2,
                        display: "flex",
                        alignItems: "flex-end",
                        background:
                          index % 3 === 0
                            ? "linear-gradient(135deg,#FFE4E6,#FFF1F2)"
                            : index % 3 === 1
                              ? "linear-gradient(135deg,#FFF0D8,#FFF7E8)"
                              : "linear-gradient(135deg,#FFE1CF,#FFF0E7)",
                      }}
                    >
                      <Chip
                        label={promoLabel(promo)}
                        sx={{ bgcolor: "#E93452", color: "#fff", fontWeight: 950 }}
                      />
                    </Box>

                    <CardContent sx={{ p: 2.2, "&:last-child": { pb: 2.2 } }}>
                      <Typography sx={{ fontSize: ".95rem", fontWeight: 950 }}>
                        {promo.title || promo.name || "StoreHub Promotion"}
                      </Typography>
                      <Typography sx={{ mt: .6, color: "#7D8B88", fontSize: ".72rem", lineHeight: 1.6 }}>
                        {promo.description || "Enjoy this limited StoreHub offer while it is available."}
                      </Typography>

                      {(promo.start_date || promo.end_date) && (
                        <Stack direction="row" spacing={.7} alignItems="center" sx={{ mt: 1.5 }}>
                          <AccessTimeRounded sx={{ fontSize: 15, color: "#E24A64" }} />
                          <Typography sx={{ color: "#7D8B88", fontSize: ".65rem", fontWeight: 700 }}>
                            {promo.start_date && promo.end_date
                              ? `${formatDate(promo.start_date)} – ${formatDate(promo.end_date)}`
                              : promo.end_date
                                ? `Until ${formatDate(promo.end_date)}`
                                : `From ${formatDate(promo.start_date)}`}
                          </Typography>
                        </Stack>
                      )}
                    </CardContent>
                  </MotionCard>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Box>

      {/* SERVICES */}
      <Box id="services-section" sx={{ scrollMarginTop: 90, py: { xs: 6, md: 8 }, bgcolor: "var(--sh-page-tint)" }}>
        <Container maxWidth="lg">
          <Typography sx={{ textAlign: "center", color: "#087F5B", fontSize: ".7rem", fontWeight: 900, letterSpacing: ".12em" }}>
            WHY STOREHUB
          </Typography>
          <Typography sx={{ mt: .7, textAlign: "center", fontSize: { xs: "1.7rem", md: "2.05rem" }, fontWeight: 950 }}>
            Local shopping, made clearer
          </Typography>

          <Grid container spacing={2.2} sx={{ mt: 2 }}>
            {[
              [<Inventory2Outlined />, "1. Choose products in store", "Browse our product availability and promotions, then visit the store to shop."],
              [<LocalOfferRounded />, "2. Pay at the cashier", "The cashier records your items, computes your total, and accepts your payment."],
              [<SupportAgentRounded />, "3. Receive your receipt", "Get your receipt immediately. Purchases linked to your account appear in your purchase history."],
            ].map(([icon, title, text], index) => (
              <Grid item xs={12} md={4} key={title}>
                <MotionPaper
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: reduceMotion ? 0 : index * .07 }}
                  elevation={0}
                  sx={{ height: "100%", p: 2.7, borderRadius: "20px", border: "1px solid #E3ECEA", bgcolor: "var(--sh-glass-bg)" }}
                >
                  <Box sx={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: "14px", bgcolor: "#ECFBF8", color: "#087F5B" }}>
                    {icon}
                  </Box>
                  <Typography sx={{ mt: 1.6, fontWeight: 950 }}>{title}</Typography>
                  <Typography sx={{ mt: .6, color: "#7A8B87", fontSize: ".74rem", lineHeight: 1.65 }}>
                    {text}
                  </Typography>
                </MotionPaper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CONTACT */}
      <Box id="contact-section" sx={{ scrollMarginTop: 90, py: { xs: 6, md: 8 }, bgcolor: "var(--sh-glass-bg)" }}>
        <Container maxWidth="lg">
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={7}>
              <Paper elevation={0} sx={{ height: "100%", p: { xs: 2.6, md: 3.2 }, borderRadius: "22px", border: "1px solid #E3ECEA" }}>
                <Typography sx={{ color: "#087F5B", fontSize: ".68rem", fontWeight: 900, letterSpacing: ".12em" }}>
                  VISIT US
                </Typography>
                <Typography sx={{ mt: .8, fontSize: "1.6rem", fontWeight: 950 }}>Your local StoreHub</Typography>
                <Typography sx={{ mt: .7, color: "#7B8C89", fontSize: ".78rem", lineHeight: 1.7 }}>
                  Drop by for everyday essentials, current promotions, and updated product availability.
                </Typography>

                <Grid container spacing={1.4} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.7, borderRadius: "16px", bgcolor: "var(--sh-page-tint)" }}>
                      <Stack direction="row" spacing={1.1}>
                        <LocationOnRounded sx={{ color: "#087F5B" }} />
                        <Box>
                          <Typography sx={{ fontSize: ".7rem", fontWeight: 900 }}>Address</Typography>
                          <Typography sx={{ mt: .2, color: "#7B8C89", fontSize: ".7rem" }}>{STORE.address}</Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 1.7, borderRadius: "16px", bgcolor: "var(--sh-page-tint)" }}>
                      <Stack direction="row" spacing={1.1}>
                        <AccessTimeRounded sx={{ color: "#087F5B" }} />
                        <Box>
                          <Typography sx={{ fontSize: ".7rem", fontWeight: 900 }}>Store hours</Typography>
                          <Typography sx={{ mt: .2, color: "#7B8C89", fontSize: ".7rem" }}>Daily · 8:00 AM–6:00 PM (Philippine time)</Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12} md={5}>
              <Paper elevation={0} sx={{ height: "100%", p: { xs: 2.6, md: 3.2 }, borderRadius: "22px", bgcolor: "#103E37", color: "#fff" }}>
                <Typography sx={{ color: "#82E9D9", fontSize: ".68rem", fontWeight: 900, letterSpacing: ".12em" }}>
                  CONTACT
                </Typography>
                <Typography sx={{ mt: .8, fontSize: "1.4rem", fontWeight: 950 }}>Need to ask about an item?</Typography>
                <Typography sx={{ mt: .7, color: "rgba(255,255,255,.62)", fontSize: ".76rem", lineHeight: 1.7 }}>
                  Contact the store for availability, new arrivals, or current promotions.
                </Typography>

                <Stack spacing={1} sx={{ mt: 2 }}>
                  <Button
                    component="a"
                    href={`tel:${STORE.phone.replace(/\s+/g, "")}`}
                    startIcon={<PhoneRounded />}
                    sx={{
                      justifyContent: "flex-start",
                      color: "#fff",
                      bgcolor: "rgba(255,255,255,.07)",
                      borderRadius: "13px",
                      textTransform: "none",
                      fontWeight: 800,
                    }}
                  >
                    {STORE.phone}
                  </Button>
                  <Button
                    onClick={() => scrollTo("services-section")}
                    startIcon={<StorefrontRounded />}
                    sx={{
                      justifyContent: "flex-start",
                      color: "#fff",
                      bgcolor: "rgba(255,255,255,.07)",
                      borderRadius: "13px",
                      textTransform: "none",
                      fontWeight: 800,
                    }}
                  >
                    How to shop in store
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 5, md: 6 }, bgcolor: "var(--sh-page-tint)" }}>
        <Container maxWidth="lg">
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: "25px",
              background: "linear-gradient(135deg,#0E5D53,#087F5B)",
              color: "#fff",
              overflow: "hidden",
            }}
          >
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2}>
              <Box>
                <Typography sx={{ fontSize: { xs: "1.4rem", md: "1.7rem" }, fontWeight: 950 }}>
                  Ready to explore the store?
                </Typography>
                <Typography sx={{ mt: .5, color: "rgba(255,255,255,.68)", fontSize: ".78rem" }}>
                  Browse available products or sign in to StoreHub.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
                <Button
                  variant="contained"
                  startIcon={<ShoppingBagOutlined />}
                  onClick={() => scrollTo("products-section")}
                  sx={{ bgcolor: "var(--sh-glass-bg)", color: "#0A6F64", borderRadius: "13px", textTransform: "none", fontWeight: 900, "&:hover": { bgcolor: "#EFFFFB" } }}
                >
                  Browse products
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<LoginRounded />}
                  onClick={() => navigate("/login")}
                  sx={{ borderColor: "rgba(255,255,255,.45)", color: "#fff", borderRadius: "13px", textTransform: "none", fontWeight: 900 }}
                >
                  Sign in
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Container>
      </Box>

      {/* FOOTER */}
      <Box component="footer" sx={{ bgcolor: "#0B2823", color: "#fff", pt: 5, pb: 3 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={5}>
              <Stack direction="row" spacing={1.1} alignItems="center">
                <Box sx={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: "13px", bgcolor: "rgba(185,235,208,.1)" }}>
                  <StorefrontRounded sx={{ color: "#72E4D3" }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 950 }}>{STORE.name}</Typography>
                  <Typography sx={{ color: "rgba(255,255,255,.45)", fontSize: ".65rem" }}>{STORE.tagline}</Typography>
                </Box>
              </Stack>
              <Typography sx={{ mt: 1.6, maxWidth: 390, color: "rgba(255,255,255,.48)", fontSize: ".72rem", lineHeight: 1.7 }}>
                Your neighborhood store for everyday essentials, updated availability, and current promotions.
              </Typography>
            </Grid>

            <Grid item xs={6} md={2}>
              <Typography sx={{ color: "#72E4D3", fontSize: ".65rem", fontWeight: 900 }}>EXPLORE</Typography>
              <Stack spacing={.6} sx={{ mt: 1.2 }}>
                {[
                  ["Home", "home-section"],
                  ["Products", "products-section"],
                  ["Promotions", "promos-section"],
                  ["Services", "services-section"],
                ].map(([label, id]) => (
                  <Button
                    key={label}
                    onClick={() => scrollTo(id)}
                    sx={{ p: 0, minWidth: 0, justifyContent: "flex-start", color: "rgba(255,255,255,.5)", textTransform: "none", fontSize: ".7rem" }}
                  >
                    {label}
                  </Button>
                ))}
              </Stack>
            </Grid>

            <Grid item xs={6} md={2}>
              <Typography sx={{ color: "#72E4D3", fontSize: ".65rem", fontWeight: 900 }}>CONTACT</Typography>
              <Typography sx={{ mt: 1.2, color: "rgba(255,255,255,.5)", fontSize: ".7rem", lineHeight: 1.6 }}>
                {STORE.address}
              </Typography>
              <Typography component="a" href={`tel:${STORE.phone.replace(/\s+/g, "")}`} sx={{ mt: .8, display: "block", color: "rgba(255,255,255,.5)", fontSize: ".7rem", textDecoration: "none" }}>
                {STORE.phone}
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography sx={{ color: "#72E4D3", fontSize: ".65rem", fontWeight: 900 }}>STORE STATUS</Typography>
              <Box sx={{ mt: 1.2, p: 1.4, borderRadius: "14px", bgcolor: "rgba(255,255,255,.05)" }}>
                <Stack direction="row" spacing={.8} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: isOpen ? "#34D399" : "#F87171" }} />
                  <Typography sx={{ fontSize: ".7rem", fontWeight: 900 }}>
                    {isOpen ? "Open now" : "Currently closed"}
                  </Typography>
                </Stack>
                <Typography sx={{ mt: .6, color: "rgba(255,255,255,.42)", fontSize: ".65rem" }}>
                  {storeStatusText}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,.08)" }} />
          <Typography sx={{ color: "rgba(255,255,255,.34)", fontSize: ".65rem" }}>
            © {new Date().getFullYear()} StoreHub. All rights reserved.
          </Typography>
        </Container>
      </Box>

      <AnimatePresence>
        {showBackToTop && (
          <motion.div
            initial={{ opacity: 0, scale: .75, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: .75, y: 15 }}
            style={{ position: "fixed", right: 24, bottom: 24, zIndex: 1300 }}
          >
            <Fab
              size="small"
              aria-label="Back to top"
              onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })}
              sx={{
                bgcolor: "#087F5B",
                color: "#fff",
                boxShadow: "0 12px 30px rgba(15,139,126,.25)",
                "&:hover": { bgcolor: "#066649" },
              }}
            >
              <KeyboardArrowUpRounded />
            </Fab>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default Homepage;
