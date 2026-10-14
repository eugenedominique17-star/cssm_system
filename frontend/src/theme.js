import { createTheme } from '@mui/material/styles';

export const colors = {
  primary: '#087F5B', // Emerald
  primaryDark: '#066649', // Deep emerald
  primaryLight: '#8EDDB8', // Mint
  secondary: '#D8F3E5', // Soft mint
  secondaryDark: '#B9EBD0',
  accent: '#087F5B', // Emerald
  dark: '#183D32', // Forest ink
  bg: '#F7F5EC', // Cream
  white: '#FFFFFF',
  textPrimary: '#183D32',
  textSecondary: '#4C695A',
  lightGray: '#EDF3E8',
  borderGray: '#D5E5D9',
  emerald: '#10B981',
  green: '#10B981',
  orange: '#F59E0B',
  red: '#EF4444',
  purple: '#8B5CF6',
  blue: '#3B82F6',
};

// Dark mode specific colors
export const darkColors = {
  primary: '#087F5B',
  primaryDark: '#066649',
  primaryLight: '#8EDDB8',
  secondary: '#F59E0B',
  secondaryDark: '#D97706',
  accent: '#F43F5E',
  dark: '#0B281E', // Slate 950
  bg: '#183D32', // Slate 900
  paper: '#254D3F', // Slate 800
  white: '#F7F5EC',
  textPrimary: '#F7F5EC',
  textSecondary: '#839B8C', // Slate 400
  lightGray: '#365C4B',
  borderGray: '#365C4B',
  emerald: '#10B981',
  green: '#10B981',
  orange: '#F59E0B',
  red: '#EF4444',
  purple: '#8B5CF6',
  blue: '#3B82F6',
};

const getTheme = (mode = 'light') => {
  const colorScheme = mode === 'dark' ? darkColors : colors;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: colorScheme.primary,
        dark: colorScheme.primaryDark,
        light: colorScheme.primaryLight,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: colorScheme.secondary,
        dark: colorScheme.secondaryDark,
        light: '#EFF9F1',
        contrastText: mode === 'dark' ? '#F7F5EC' : '#183D32',
      },
      background: {
        default: colorScheme.bg,
        paper: mode === 'dark' ? colorScheme.paper : colorScheme.white,
      },
      text: {
        primary: colorScheme.textPrimary,
        secondary: colorScheme.textSecondary,
      },
      error: { main: colorScheme.red },
      success: { main: colorScheme.green },
      warning: { main: colorScheme.orange },
      info: { main: colorScheme.blue },
      divider: colorScheme.borderGray,
    },
    typography: {
      fontFamily: `'Plus Jakarta Sans', 'Poppins', 'Segoe UI', -apple-system, sans-serif`,
      h1: { fontWeight: 800 },
      h2: { fontWeight: 800 },
      h3: { fontWeight: 800 },
      h4: { fontWeight: 800 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.9rem',
      },
      body1: { fontSize: '1rem', lineHeight: 1.7 },
      body2: { fontSize: '0.875rem', lineHeight: 1.7 },
      subtitle1: { fontWeight: 600 },
    },
    shape: {
      borderRadius: 14,
    },
    components: {
      MuiSkeleton: {
        defaultProps: { animation: 'wave' },
        styleOverrides: { root: { backgroundColor: 'rgba(8,127,91,.08)', borderRadius: 12 } },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            textTransform: 'none',
            fontWeight: 600,
            padding: '8px 20px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:active': {
              transform: 'scale(0.97)',
            },
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: mode === 'dark' ? '0 8px 20px rgba(0,0,0,0.3)' : '0 8px 20px rgba(8,127,91, 0.12)',
            },
          },
          containedPrimary: {
            background: colorScheme.primary,
            boxShadow: mode === 'dark' ? 'none' : '0 4px 12px rgba(8,127,91, 0.15)',
            '&:hover': {
              background: colorScheme.primaryDark,
              boxShadow: mode === 'dark' ? 'none' : '0 6px 16px rgba(8,127,91, 0.25)',
            },
          },
          containedSecondary: {
            background: colorScheme.secondary,
            boxShadow: mode === 'dark' ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.15)',
            '&:hover': {
              background: colorScheme.secondaryDark,
              boxShadow: mode === 'dark' ? 'none' : '0 6px 16px rgba(245, 158, 11, 0.25)',
            },
          },
          outlined: {
            borderColor: colorScheme.borderGray,
            '&:hover': {
              borderColor: colorScheme.primary,
              backgroundColor: `rgba(8,127,91, ${mode === 'dark' ? '0.12' : '0.04'})`,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            border: `1px solid ${colorScheme.borderGray}`,
            boxShadow: mode === 'dark'
              ? '0 4px 20px rgba(0,0,0,0.3)'
              : '0 4px 20px rgba(131,155,140, 0.05)',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            backgroundColor: mode === 'dark' ? 'rgba(24,61,50,0.88)' : 'var(--sh-glass-bg)',
            backgroundImage: 'none',
            backdropFilter: 'blur(18px) saturate(125%)',
            WebkitBackdropFilter: 'blur(18px) saturate(125%)',
            border: '1px solid rgba(255,255,255,0.72)',
            boxShadow: '0 12px 36px rgba(24,61,50,0.07), inset 0 1px 0 rgba(255,255,255,0.6)',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
              transition: 'all 0.2s ease-in-out',
              backgroundColor: mode === 'dark' ? colorScheme.paper : 'transparent',
              '&:hover': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: colorScheme.primaryLight,
                },
              },
              '&.Mui-focused': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: colorScheme.primary,
                  borderWidth: 1.5,
                },
              },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            transition: 'all 0.2s ease-in-out',
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: mode === 'dark'
              ? '0 4px 24px rgba(0,0,0,0.4)'
              : '0 4px 24px rgba(131,155,140, 0.06)',
            border: `1px solid ${colorScheme.borderGray}`,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              backgroundColor: mode === 'dark' ? '#254D3F' : '#F7F5EC',
              color: mode === 'dark' ? colorScheme.textPrimary : '#254D3F',
              fontWeight: 700,
              fontSize: '0.85rem',
              borderBottom: `2px solid ${colorScheme.borderGray}`,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: '14px 18px',
            borderBottom: `1px solid ${colorScheme.borderGray}`,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: `rgba(8,127,91, ${mode === 'dark' ? '0.1' : '0.03'})`,
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            '& .MuiAlert-icon': { animation: 'fadeInUp 240ms ease-out both' },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 18,
            backgroundColor: mode === 'dark' ? 'rgba(24,61,50,0.96)' : 'var(--sh-glass-raised)',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            backgroundColor: mode === 'dark' ? 'rgba(24,61,50,0.96)' : 'var(--sh-glass-raised)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: `rgba(8,127,91, ${mode === 'dark' ? '0.12' : '0.06'})`,
            },
          },
        },
      },
    },
  });
};

export const theme = getTheme('light');
export const darkTheme = getTheme('dark');
export const createAppTheme = (mode = 'light') => getTheme(mode);

export default theme;
