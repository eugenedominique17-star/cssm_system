import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { FavoriteBorderRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import API from "../../api/axios";
import ProductCard from "../../components/ProductCard";
import { useFavorites } from "../../hooks/useFavorites";

const Favorites = () => {
  const navigate = useNavigate();
  const { favorites, toggleFavorite, isFavorited } = useFavorites();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await API.get("/products?active=true");
        const allProducts = Array.isArray(response.data) ? response.data : [];
        setProducts(
          allProducts.filter((product) => favorites.includes(product.id)),
        );
      } catch (loadError) {
        console.error("Failed to load favorites:", loadError);
        setError(
          loadError?.response?.data?.message ||
            "Unable to load your favorites.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [favorites]);

  const favoriteProducts = useMemo(
    () => products.filter((product) => favorites.includes(product.id)),
    [favorites, products],
  );

  if (loading) {
    return (
      <Box sx={{ p: 4, maxWidth: 900, mx: "auto", textAlign: "center" }}>
        <CircularProgress sx={{ color: "#087F5B" }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, maxWidth: 900, mx: "auto" }}>
        <Paper sx={{ p: 4, borderRadius: 4, textAlign: "center" }}>
          <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>
            Favorites
          </Typography>
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/client/dashboard")}
          >
            Back to Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  if (!favoriteProducts.length) {
    return (
      <Box sx={{ p: 4, maxWidth: 900, mx: "auto" }}>
        <Paper sx={{ p: 4, borderRadius: 4, textAlign: "center" }}>
          <Box sx={{ width: 104, height: 104, mx: 'auto', mb: 3, display: 'grid', placeItems: 'center', borderRadius: '32px', background: 'linear-gradient(145deg, #F7F5EC, #D8F3E5)', border: '1px solid white', boxShadow: '0 12px 30px rgba(8,127,91,.09)', transform: 'rotate(-6deg)' }}>
            <FavoriteBorderRounded sx={{ fontSize: 48, color: '#087F5B' }} />
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
            Favorites
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Your saved products will appear here.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/client/dashboard")}
          >
            Back to Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={900}
            sx={{ color: "#183D32", mb: 0.5 }}
          >
            Favorites
          </Typography>
          <Typography color="text.secondary">
            {favoriteProducts.length} saved{" "}
            {favoriteProducts.length === 1 ? "item" : "items"}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate("/client/dashboard")}
        >
          Continue Shopping
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {favoriteProducts.map((product) => (
          <Grid item xs={12} sm={6} md={4} key={product.id}>
            <ProductCard
              product={product}
              isFavorited={isFavorited(product.id)}
              onFavoriteToggle={toggleFavorite}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Favorites;
