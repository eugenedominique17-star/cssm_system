import React, { useState } from 'react';
import {
  Box,
  TextField,
  Paper,
  Stack,
  Collapse,
  FormControlLabel,
  Checkbox,
  Slider,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Typography,
  InputAdornment,
} from '@mui/material';
import {
  TuneRounded,
  RefreshRounded,
  SearchRounded,
  FilterListRounded,
} from '@mui/icons-material';

/**
 * Modern Dark Slate Search & Filter Bar Component
 * Theme: Dark Slate (#183D32, #254D3F) with Teal Accent (#B9EBD0, #087F5B)
 */
const SearchFilterBar = ({
  onSearch,
  onFilterChange,
  products = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [sortBy, setSortBy] = useState('relevant');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // Calculate max price dynamically from products list
  const maxPrice = Math.max(
    ...products.map((p) => Number(p.price || 0)),
    10000
  );

  const handleSearch = (value) => {
    setSearchTerm(value);
    onSearch?.(value);
  };

  const handlePriceChange = (event, newValue) => {
    setPriceRange(newValue);
    applyFilters({
      priceRange: newValue,
      sortBy,
      inStockOnly,
    });
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    applyFilters({
      priceRange,
      sortBy: newSort,
      inStockOnly,
    });
  };

  const handleInStockToggle = () => {
    const nextState = !inStockOnly;
    setInStockOnly(nextState);
    applyFilters({
      priceRange,
      sortBy,
      inStockOnly: nextState,
    });
  };

  const applyFilters = (filters) => {
    let count = 0;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice) count++;
    if (filters.sortBy !== 'relevant') count++;
    if (filters.inStockOnly) count++;

    setActiveFilterCount(count);

    onFilterChange?.({
      priceRange: filters.priceRange,
      sortBy: filters.sortBy,
      inStockOnly: filters.inStockOnly,
      searchTerm,
    });
  };

  const handleReset = () => {
    setSearchTerm('');
    setPriceRange([0, maxPrice]);
    setSortBy('relevant');
    setInStockOnly(false);
    setActiveFilterCount(0);
    setShowFilters(false);

    onSearch?.('');
    onFilterChange?.({
      priceRange: [0, maxPrice],
      sortBy: 'relevant',
      inStockOnly: false,
      searchTerm: '',
    });
  };

  return (
    <Box sx={{ mb: 3 }}>
      {/* Search Input Bar */}
      <Paper
        elevation={0}
        sx={{
          p: '6px 12px',
          bgcolor: '#183D32',
          border: '1px solid',
          borderColor: showFilters ? '#087F5B' : 'rgba(255, 255, 255, 0.1)',
          borderRadius: '14px',
          display: 'flex',
          gap: 1.5,
          alignItems: 'center',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: showFilters ? '0 0 15px rgba(8,127,91, 0.25)' : 'none',

          '&:focus-within': {
            borderColor: '#B9EBD0',
            boxShadow: '0 0 20px rgba(185,235,208, 0.2)',
          },
        }}
      >
        <TextField
          fullWidth
          placeholder="Search products..."
          variant="standard"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          InputProps={{
            disableUnderline: true,
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded sx={{ color: '#617B6C' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiInput-input': {
              py: 1,
              color: '#F7F5EC',
              fontSize: '0.95rem',
              fontWeight: 500,
              '&::placeholder': {
                color: '#617B6C',
                opacity: 1,
              },
            },
          }}
        />

        <Tooltip title="Toggle filters">
          <IconButton
            onClick={() => setShowFilters(!showFilters)}
            sx={{
              position: 'relative',
              bgcolor: showFilters ? '#087F5B' : '#254D3F',
              color: showFilters ? '#F7F5EC' : '#839B8C',
              borderRadius: '10px',
              p: 1,
              transition: 'all 0.2s ease',

              '&:hover': {
                bgcolor: showFilters ? '#087F5B' : 'rgba(255, 255, 255, 0.1)',
                color: '#F7F5EC',
              },
            }}
          >
            <TuneRounded sx={{ fontSize: 20 }} />
            {activeFilterCount > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  bgcolor: '#B9EBD0',
                  color: '#183D32',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  boxShadow: '0 0 8px rgba(185,235,208, 0.8)',
                }}
              >
                {activeFilterCount}
              </Box>
            )}
          </IconButton>
        </Tooltip>
      </Paper>

      {/* Filter Panel Collapse */}
      <Collapse in={showFilters} timeout="auto">
        <Paper
          elevation={0}
          sx={{
            mt: 1.5,
            p: 2.5,
            bgcolor: '#183D32',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          }}
        >
          <Stack spacing={2.5}>
            {/* Price Range */}
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, color: '#F7F5EC', fontSize: '0.85rem' }}
                >
                  Price Range
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#B9EBD0',
                    fontWeight: 700,
                    bgcolor: 'rgba(185,235,208, 0.1)',
                    px: 1,
                    py: 0.3,
                    borderRadius: '6px',
                  }}
                >
                  ₱{priceRange[0].toLocaleString()} - ₱{priceRange[1].toLocaleString()}
                </Typography>
              </Box>

              <Slider
                value={priceRange}
                onChange={handlePriceChange}
                min={0}
                max={maxPrice}
                step={100}
                sx={{
                  color: '#087F5B',
                  height: 6,
                  '& .MuiSlider-track': {
                    bgcolor: '#B9EBD0',
                    border: 'none',
                  },
                  '& .MuiSlider-thumb': {
                    height: 18,
                    width: 18,
                    bgcolor: 'var(--sh-page-tint)',
                    border: '2px solid #087F5B',
                    '&:hover, &.Mui-focusVisible, &.Mui-active': {
                      boxShadow: '0 0 0 8px rgba(185,235,208, 0.16)',
                    },
                  },
                  '& .MuiSlider-rail': {
                    bgcolor: '#365C4B',
                    opacity: 1,
                  },
                  '& .MuiSlider-markLabel': {
                    color: '#617B6C',
                    fontSize: '0.7rem',
                  },
                }}
              />
            </Box>

            {/* Sort Options */}
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, color: '#F7F5EC', fontSize: '0.85rem', mb: 1 }}
              >
                Sort By
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {[
                  { value: 'relevant', label: 'Most Relevant' },
                  { value: 'price-low', label: 'Price: Low to High' },
                  { value: 'price-high', label: 'Price: High to Low' },
                  { value: 'newest', label: 'Newest' },
                  { value: 'popular', label: 'Most Popular' },
                ].map((option) => {
                  const isSelected = sortBy === option.value;
                  return (
                    <Chip
                      key={option.value}
                      label={option.label}
                      onClick={() => handleSortChange(option.value)}
                      sx={{
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        bgcolor: isSelected ? 'rgba(185,235,208, 0.15)' : '#254D3F',
                        color: isSelected ? '#B9EBD0' : '#839B8C',
                        border: '1px solid',
                        borderColor: isSelected ? 'rgba(185,235,208, 0.4)' : 'transparent',
                        transition: 'all 0.2s ease',

                        '&:hover': {
                          bgcolor: isSelected ? 'rgba(185,235,208, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          color: isSelected ? '#B9EBD0' : '#F7F5EC',
                        },
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>

            {/* In Stock Toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={inStockOnly}
                    onChange={handleInStockToggle}
                    sx={{
                      color: '#617B6C',
                      '&.Mui-checked': {
                        color: '#B9EBD0',
                      },
                    }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: '#CBD5E1', fontWeight: 600, fontSize: '0.85rem' }}>
                    In Stock Only
                  </Typography>
                }
              />
            </Box>

            {/* Actions */}
            <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ pt: 1 }}>
              <Button
                variant="text"
                size="small"
                startIcon={<RefreshRounded />}
                onClick={handleReset}
                sx={{
                  color: '#839B8C',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  '&:hover': {
                    color: '#F7F5EC',
                    bgcolor: 'transparent',
                  },
                }}
              >
                Reset Filters
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => setShowFilters(false)}
                sx={{
                  bgcolor: '#087F5B',
                  color: '#F7F5EC',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  textTransform: 'none',
                  px: 2.5,
                  boxShadow: '0 4px 12px rgba(8,127,91, 0.3)',

                  '&:hover': {
                    bgcolor: '#087F5B',
                    filter: 'brightness(1.1)',
                  },
                }}
              >
                Apply
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Collapse>
    </Box>
  );
};

export default SearchFilterBar;