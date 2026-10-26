import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment, IconButton, Paper, Divider
} from '@mui/material';
import {
  Email, Lock, Visibility, VisibilityOff, ArrowBack, Shield
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../theme';

const LoginAdmin = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(identifier, password);
      if (user.role !== 'admin') {
        setError('Access denied. This login is for administrators only.');
        return;
      }
      navigate('/admin/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
      }}
    >
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/login')}
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          color: 'rgba(255,255,255,0.8)',
          bgcolor: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.15)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
        }}
      >
        Back
      </Button>

      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
          animation: 'fadeInUp 0.5s ease',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 4,
            textAlign: 'center',
            background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
            color: 'white',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Box
            sx={{
              bgcolor: 'rgba(255,255,255,0.08)',
              borderRadius: 3,
              p: 2,
              display: 'inline-flex',
              mb: 2,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Shield sx={{ fontSize: 48, color: '#FFD166' }} />
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 0.5, letterSpacing: '0.5px' }}>
            Admin Portal
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Secure administrator access
          </Typography>
        </Box>

        {/* Form */}
        <Box sx={{ p: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin} autoComplete="off">
            <TextField
              fullWidth
              autoComplete="off" label="Email or User ID"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              variant="outlined"
              sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              autoComplete="off" label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              variant="outlined"
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              fullWidth
              variant="contained"
              type="submit"
              disabled={loading}
              sx={{
                py: 1.5,
                fontSize: 16,
                fontWeight: 600,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #16213E 0%, #0F3460 100%)',
                  boxShadow: '0 8px 24px rgba(26,26,46,0.3)',
                },
                boxShadow: '0 4px 16px rgba(26,26,46,0.2)',
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.disabled">
              OR
            </Typography>
          </Divider>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Need a different account?
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
              <Link to="/login/staff" style={{ color: '#4A90E2', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                Staff Login
              </Link>
              <Link to="/login/client" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                Client Login
              </Link>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginAdmin;