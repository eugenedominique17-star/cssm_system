import React, { useState } from "react";
import {
  Card,
  CardMedia,
  CardContent,
  Box,
  Stack,
  Typography,
  Chip,
  Rating,
} from "@mui/material";

import {
  ImageNotSupportedRounded,
  Inventory2Outlined,
} from "@mui/icons-material";

import { motion, useReducedMotion } from "framer-motion";

const ProductCard = ({ product }) => {
  const [imageError, setImageError] = useState(false);
  const reduceMotion = useReducedMotion();

  /* =========================================================
     COLORS
  ========================================================= */

  const palette = {
    primary: "#066649",
    primaryDark: "#07543E",

    mint: "#D8F3E5",
    mintSoft: "#EFF9F1",
    mintStrong: "#DDF7EF",

    text: "#173F3A",
    textSoft: "#607A74",
    muted: "#8CA09B",

    border: "#DCEBE7",
    borderSoft: "#E8F2EF",

    white: "#FFFFFF",
  };

  /* =========================================================
     PRODUCT HELPERS
  ========================================================= */

  const getImageUrl = () => {
    if (product?.image_url) return product.image_url;
    if (product?.image) return product.image;

    return null;
  };

  const getStock = () => Number(product?.stock ?? product?.stock_quantity ?? 0);

  const stock = getStock();

  const isLowStock = stock > 0 && stock <= 10;
  const isOutOfStock = stock === 0;

  const imageUrl = getImageUrl();

  /* =========================================================
     STOCK DESIGN
  ========================================================= */

  const getStockStyle = () => {
    if (isOutOfStock) {
      return {
        label: "Out of Stock",
        color: "#B42318",
        bgcolor: "#FFF1F0",
        borderColor: "#FFD6D2",
        dot: "#F04438",
      };
    }

    if (isLowStock) {
      return {
        label: `Low Stock (${stock})`,
        color: "#B54708",
        bgcolor: "#FFF8EB",
        borderColor: "#FDE5B4",
        dot: "#F79009",
      };
    }

    return {
      label: "In Stock",
      color: "#067647",
      bgcolor: "#ECFDF3",
      borderColor: "#C7EFD8",
      dot: "#12B76A",
    };
  };

  const stockStyle = getStockStyle();

  /* =========================================================
     PRICE FORMATTER
  ========================================================= */

  const formatPrice = (value) =>
    Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <Card
      component={motion.div}
      initial={{
        opacity: 0,
        y: reduceMotion ? 0 : 14,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      whileHover={
        reduceMotion
          ? {}
          : {
              y: -7,
            }
      }
      transition={{
        duration: reduceMotion ? 0 : 0.32,
        ease: [0.22, 1, 0.36, 1],
      }}
      sx={{
        position: "relative",

        height: "100%",

        display: "flex",
        flexDirection: "column",

        overflow: "hidden",

        bgcolor: palette.white,

        border: `1px solid ${palette.border}`,

        borderRadius: {
          xs: "16px",
          sm: "18px",
        },

        boxShadow: "0 4px 18px rgba(17,94,89,.045)",

        transition: "border-color .3s ease, box-shadow .3s ease",

        "&:hover": {
          borderColor: "#BBDDD5",

          boxShadow:
            "0 18px 40px rgba(17,94,89,.11), 0 3px 10px rgba(17,94,89,.04)",

          "& .product-image": {
            transform: "scale(1.045)",
          },

          "& .product-image-shade": {
            opacity: 1,
          },
        },
      }}
    >
      {/* =====================================================
          IMAGE
      ===================================================== */}

      <Box
        sx={{
          position: "relative",

          aspectRatio: "1 / 0.88",

          overflow: "hidden",

          bgcolor: "#F3F9F7",

          borderBottom: `1px solid ${palette.borderSoft}`,
        }}
      >
        {/* IMAGE */}

        {imageUrl && !imageError ? (
          <CardMedia
            component="img"
            image={imageUrl}
            alt={product?.name || "Product"}
            onError={() => setImageError(true)}
            className="product-image"
            sx={{
              position: "absolute",

              inset: 0,

              width: "100%",
              height: "100%",

              objectFit: "cover",
              objectPosition: "center",

              transition: "transform .55s cubic-bezier(.22,1,.36,1)",
            }}
          />
        ) : (
          /* =================================================
             NO IMAGE
          ================================================= */

          <Box
            sx={{
              position: "absolute",
              inset: 0,

              display: "flex",
              flexDirection: "column",

              alignItems: "center",
              justifyContent: "center",

              gap: 1,

              background: `
                radial-gradient(
                  circle at 50% 35%,
                  rgba(204,251,241,.75),
                  transparent 45%
                ),
                linear-gradient(
                  145deg,
                  #F7FCFA 0%,
                  #EDF8F5 100%
                )
              `,
            }}
          >
            <Box
              sx={{
                width: 54,
                height: 54,

                display: "grid",
                placeItems: "center",

                borderRadius: "16px",

                bgcolor: "rgba(255,255,255,.8)",

                border: `1px solid ${palette.border}`,

                color: "#91AAA4",

                boxShadow: "0 8px 22px rgba(6,102,73,.06)",
              }}
            >
              <ImageNotSupportedRounded
                sx={{
                  fontSize: 27,
                }}
              />
            </Box>

            <Typography
              sx={{
                color: palette.muted,

                fontSize: "0.64rem",

                fontWeight: 700,
              }}
            >
              No image available
            </Typography>
          </Box>
        )}

        {/* =================================================
            SUBTLE IMAGE GRADIENT
        ================================================= */}

        {imageUrl && !imageError && (
          <Box
            className="product-image-shade"
            sx={{
              position: "absolute",

              inset: 0,

              pointerEvents: "none",

              opacity: 0.72,

              transition: "opacity .3s ease",

              background: `
                linear-gradient(
                  180deg,
                  rgba(17,63,58,.05) 0%,
                  transparent 35%,
                  rgba(17,63,58,.10) 100%
                )
              `,
            }}
          />
        )}

        {/* =================================================
            STOCK CHIP
        ================================================= */}

        <Box
          sx={{
            position: "absolute",

            top: 12,
            left: 12,

            zIndex: 3,
          }}
        >
          <Chip
            icon={
              <Box
                sx={{
                  width: 6,
                  height: 6,

                  borderRadius: "50%",

                  bgcolor: stockStyle.dot,

                  ml: "8px !important",
                }}
              />
            }
            label={stockStyle.label}
            size="small"
            sx={{
              height: 27,

              bgcolor: stockStyle.bgcolor,

              color: stockStyle.color,

              border: "1px solid",
              borderColor: stockStyle.borderColor,

              borderRadius: "8px",

              boxShadow: "0 3px 10px rgba(24,61,50,.05)",

              "& .MuiChip-label": {
                px: 1,

                fontSize: "0.58rem",

                fontWeight: 900,

                textTransform: "uppercase",

                letterSpacing: ".045em",
              },

              "& .MuiChip-icon": {
                mr: 0,
              },
            }}
          />
        </Box>

      </Box>

      {/* =====================================================
          PRODUCT CONTENT
      ===================================================== */}

      <CardContent
        sx={{
          flexGrow: 1,

          display: "flex",
          flexDirection: "column",

          p: {
            xs: 1.65,
            sm: 1.85,
          },

          "&:last-child": {
            pb: {
              xs: 1.65,
              sm: 1.85,
            },
          },
        }}
      >
        {/* =================================================
            SMALL META ROW
        ================================================= */}

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{
            mb: 1,
            minHeight: 20,
          }}
        >
          {/* CATEGORY */}

          {product?.category ? (
            <Typography
              sx={{
                color: palette.primary,

                fontSize: "0.57rem",

                fontWeight: 900,

                textTransform: "uppercase",

                letterSpacing: ".08em",

                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {product.category}
            </Typography>
          ) : (
            <Box />
          )}

          {/* STOCK NUMBER */}

          {!isOutOfStock && (
            <Stack
              direction="row"
              spacing={0.45}
              alignItems="center"
              sx={{
                flexShrink: 0,
              }}
            >
              <Inventory2Outlined
                sx={{
                  fontSize: 13,

                  color: "#91A49F",
                }}
              />

              <Typography
                sx={{
                  color: "#91A49F",

                  fontSize: "0.57rem",

                  fontWeight: 700,
                }}
              >
                {stock} left
              </Typography>
            </Stack>
          )}
        </Stack>

        {/* =================================================
            PRODUCT NAME
        ================================================= */}

        <Typography
          variant="subtitle2"
          sx={{
            color: palette.text,

            fontSize: {
              xs: "0.86rem",
              sm: "0.91rem",
            },

            fontWeight: 900,

            lineHeight: 1.38,

            letterSpacing: "-.015em",

            mb: 0.55,

            overflow: "hidden",

            textOverflow: "ellipsis",

            display: "-webkit-box",

            WebkitLineClamp: 2,

            WebkitBoxOrient: "vertical",

            minHeight: {
              sm: "2.5em",
            },
          }}
        >
          {product?.name}
        </Typography>

        {/* =================================================
            DESCRIPTION
        ================================================= */}

        {product?.description && (
          <Typography
            variant="body2"
            sx={{
              color: palette.textSoft,

              fontSize: "0.68rem",

              lineHeight: 1.55,

              mb: 1.15,

              overflow: "hidden",

              textOverflow: "ellipsis",

              display: "-webkit-box",

              WebkitLineClamp: 2,

              WebkitBoxOrient: "vertical",
            }}
          >
            {product.description}
          </Typography>
        )}

        {/* =================================================
            RATING
        ================================================= */}

        {product?.rating && (
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.55}
            sx={{
              mb: 1.25,
            }}
          >
            <Rating
              value={Number(product.rating)}
              readOnly
              size="small"
              precision={0.5}
              sx={{
                fontSize: "0.82rem",

                "& .MuiRating-iconFilled": {
                  color: "#F5A524",
                },

                "& .MuiRating-iconEmpty": {
                  color: "#E3EBE8",
                },
              }}
            />

            <Typography
              sx={{
                color: "#91A49F",

                fontSize: "0.6rem",

                fontWeight: 700,
              }}
            >
              {Number(product.rating).toFixed(1)}
              {product.reviews != null ? ` · ${product.reviews} reviews` : ""}
            </Typography>
          </Stack>
        )}

        {/* =================================================
            DIVIDER
        ================================================= */}

        <Box
          sx={{
            mt: "auto",

            mb: 1.25,

            borderTop: `1px solid ${palette.borderSoft}`,
          }}
        />

        {/* =================================================
            PRICE
        ================================================= */}

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-end"
          spacing={1}
        >
          <Box>
            <Typography
              sx={{
                mb: 0.25,

                color: "#9AABA7",

                fontSize: "0.52rem",

                fontWeight: 800,

                textTransform: "uppercase",

                letterSpacing: ".07em",
              }}
            >
              Price
            </Typography>

            <Stack
              direction="row"
              alignItems="baseline"
              spacing={0.7}
              flexWrap="wrap"
            >
              <Typography
                sx={{
                  color: palette.primary,

                  fontSize: {
                    xs: "1.05rem",
                    sm: "1.17rem",
                  },

                  lineHeight: 1,

                  fontWeight: 950,

                  letterSpacing: "-.035em",
                }}
              >
                ₱{formatPrice(product?.price)}
              </Typography>

              {product?.original_price &&
                Number(product.original_price) > Number(product.price) && (
                  <Typography
                    sx={{
                      color: "#A3B2AE",

                      fontSize: "0.66rem",

                      fontWeight: 650,

                      textDecoration: "line-through",
                    }}
                  >
                    ₱{formatPrice(product.original_price)}
                  </Typography>
                )}
            </Stack>
          </Box>

          {/* SMALL VISUAL ACCENT */}

          <Box
            sx={{
              width: 31,
              height: 31,

              display: "grid",
              placeItems: "center",

              flexShrink: 0,

              borderRadius: "9px",

              bgcolor: palette.mint,

              color: palette.primary,

              border: "1px solid #D7EFE8",
            }}
          >
            <Inventory2Outlined
              sx={{
                fontSize: 16,
              }}
            />
          </Box>
        </Stack>
      </CardContent>

      {/* =====================================================
          BOTTOM ACCENT
      ===================================================== */}

      <Box
        sx={{
          position: "absolute",

          left: "20%",
          right: "20%",
          bottom: 0,

          height: 2,

          opacity: 0,

          borderRadius: "999px 999px 0 0",

          bgcolor: palette.primary,

          transition: "opacity .25s ease, left .25s ease, right .25s ease",

          ".MuiCard-root:hover &": {
            opacity: 1,
            left: "8%",
            right: "8%",
          },
        }}
      />
    </Card>
  );
};

export default ProductCard;
