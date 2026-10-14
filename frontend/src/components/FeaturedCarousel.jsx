import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardMedia,
  Stack,
  Typography,
  IconButton,
  Button,
} from "@mui/material";
import {
  ChevronLeftRounded,
  ChevronRightRounded,
  LocalAtmRounded,
  ArrowForwardRounded,
} from "@mui/icons-material";

/**
 * Featured Products Carousel
 * Auto-rotates featured products with enhanced colors and interactions
 */
const FeaturedCarousel = ({
  products = [],
  onProductClick,
  autoRotateInterval = 5000,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const maxSteps = Math.max(products.length, 1);

  // Auto-rotate with pause on hover
  useEffect(() => {
    if (products.length === 0 || isHovered) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % maxSteps);
    }, autoRotateInterval);

    return () => clearInterval(interval);
  }, [maxSteps, autoRotateInterval, products.length, isHovered]);

  const handleNext = useCallback(() => {
    setActiveStep((prev) => (prev + 1) % maxSteps);
  }, [maxSteps]);

  const handlePrev = useCallback(() => {
    setActiveStep((prev) => (prev - 1 + maxSteps) % maxSteps);
  }, [maxSteps]);

  if (products.length === 0) {
    return (
      <Box
        sx={{
          mb: 4,
          p: 4,
          textAlign: "center",
          bgcolor: "rgba(37,77,63, 0.4)",
          borderRadius: 4,
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <Typography variant="body2" sx={{ color: "#839B8C" }}>
          No featured products available at the moment.
        </Typography>
      </Box>
    );
  }

  const currentProduct = products[activeStep];
  const imageUrl = currentProduct?.image_url || currentProduct?.image || null;

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header Title Section */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(8,127,91, 0.15)",
            color: "#B9EBD0",
            border: "1px solid rgba(185,235,208, 0.2)",
            borderRadius: "12px",
            flexShrink: 0,
          }}
        >
          <LocalAtmRounded />
        </Box>

        <Box>
          <Typography
            sx={{
              color: "#B9EBD0",
              fontSize: "0.72rem",
              fontWeight: 800,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Featured Products
          </Typography>
          <Typography
            sx={{
              color: "#F7F5EC",
              fontSize: "1.25rem",
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            This Week's Picks
          </Typography>
        </Box>
      </Stack>

      {/* Main Carousel Card Container */}
      <Card
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "20px",
          bgcolor: "#183D32",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Image Aspect Ratio Box */}
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: { xs: 260, sm: 340, md: 400 },
            bgcolor: "#254D3F",
            overflow: "hidden",
          }}
        >
          {imageUrl ? (
            <CardMedia
              component="img"
              image={imageUrl}
              alt={currentProduct.name}
              key={currentProduct.id || activeStep}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center 38%",
                animation: "zoomIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                "@keyframes zoomIn": {
                  "0%": { opacity: 0, transform: "scale(1.08)" },
                  "100%": { opacity: 1, transform: "scale(1)" },
                },
              }}
            />
          ) : (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                bgcolor: "#183D32",
              }}
            >
              <LocalAtmRounded sx={{ fontSize: 64, color: "#365C4B", mb: 1 }} />
              <Typography variant="body2" sx={{ color: "#617B6C" }}>
                No Image Available
              </Typography>
            </Box>
          )}

          {/* Controls: Left Arrow */}
          <IconButton
            onClick={handlePrev}
            aria-label="Previous slide"
            sx={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 3,
              bgcolor: "rgba(24,61,50, 0.65)",
              color: "#FFFFFF",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              transition: "all 0.2s ease",
              "&:hover": {
                bgcolor: "#087F5B",
                borderColor: "#B9EBD0",
                transform: "translateY(-50%) scale(1.1)",
              },
            }}
          >
            <ChevronLeftRounded />
          </IconButton>

          {/* Controls: Right Arrow */}
          <IconButton
            onClick={handleNext}
            aria-label="Next slide"
            sx={{
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 3,
              bgcolor: "rgba(24,61,50, 0.65)",
              color: "#FFFFFF",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              transition: "all 0.2s ease",
              "&:hover": {
                bgcolor: "#087F5B",
                borderColor: "#B9EBD0",
                transform: "translateY(-50%) scale(1.1)",
              },
            }}
          >
            <ChevronRightRounded />
          </IconButton>

          {/* Gradient Shadow Overlay */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(24,61,50, 0.95) 0%, rgba(24,61,50, 0.4) 50%, transparent 100%)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />

          {/* Bottom Card Content Info */}
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              p: { xs: 2.5, sm: 3.5 },
              zIndex: 2,
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "flex-end" }}
              spacing={2}
            >
              <Box sx={{ maxWidth: { sm: "65%" } }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    color: "#F7F5EC",
                    fontSize: { xs: "1.25rem", sm: "1.5rem", md: "1.75rem" },
                    lineHeight: 1.2,
                  }}
                >
                  {currentProduct.name}
                </Typography>

                {currentProduct.description && (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.75,
                      color: "#839B8C",
                      fontSize: "0.875rem",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {currentProduct.description}
                  </Typography>
                )}
              </Box>

              {/* Price Tag & CTA Button */}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ width: { xs: "100%", sm: "auto" }, gap: 2 }}
              >
                <Typography
                  sx={{
                    fontWeight: 900,
                    fontSize: { xs: "1.5rem", sm: "1.8rem" },
                    color: "#B9EBD0",
                    letterSpacing: "-0.5px",
                  }}
                >
                  ₱{Number(currentProduct.price || 0).toFixed(2)}
                </Typography>

                <Button
                  variant="contained"
                  endIcon={<ArrowForwardRounded />}
                  onClick={() => onProductClick?.(currentProduct)}
                  sx={{
                    bgcolor: "#087F5B",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    px: 2.5,
                    py: 1,
                    borderRadius: "12px",
                    textTransform: "none",
                    boxShadow: "0 4px 14px rgba(8,127,91, 0.4)",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: "#066649",
                      boxShadow: "0 6px 20px rgba(8,127,91, 0.6)",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  View Details
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Box>
      </Card>

      {/* Pill Indicators (Pagination Dots) */}
      {maxSteps > 1 && (
        <Stack
          direction="row"
          justifyContent="center"
          alignItems="center"
          spacing={1}
          sx={{ mt: 2 }}
        >
          {products.map((_, index) => (
            <Box
              key={index}
              onClick={() => setActiveStep(index)}
              sx={{
                height: 8,
                width: index === activeStep ? 28 : 8,
                borderRadius: "4px",
                bgcolor:
                  index === activeStep ? "#B9EBD0" : "rgba(255, 255, 255, 0.2)",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  bgcolor:
                    index === activeStep
                      ? "#B9EBD0"
                      : "rgba(255, 255, 255, 0.4)",
                },
              }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default FeaturedCarousel;
