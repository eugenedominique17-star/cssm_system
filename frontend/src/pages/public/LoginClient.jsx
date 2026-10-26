import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment, IconButton
} from '@mui/material';
import {
  Person, Email, Lock, Visibility, VisibilityOff, ArrowBack
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../theme';

const LoginClient = () => {
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
      if (user.role !== 'client') {
        setError('Access denied. This login is for clients only.');
        return;
      }
      navigate('/client/dashboard');
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
        background: 'linear-gradient(135deg, #00A896 0%, #00897B 50%, #00695C 100%)',
      }}
    >
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/login')}
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          color: 'white',
          bgcolor: 'rgba(255,255,255,0.2)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
        }}
      >
        Back
      </Button>

      <Box
        sx={{
          width: '100%',
          maxWidth: 450,
          bgcolor: 'white',
          borderRadius: 4,
          p: 4,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              bgcolor: 'rgba(0,168,150,0.1)',
              borderRadius: 3,
              p: 2,
              display: 'inline-flex',
              mb: 2,
            }}
          >
            <Person sx={{ fontSize: 60, color: '#00A896' }} />
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 1, color: '#00A896' }}>
            Client Login
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Client access only
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
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
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Email sx={{ color: '#00A896' }} />
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
                  <Lock sx={{ color: '#00A896' }} />
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
              mb: 2,
              py: 1.5,
              fontSize: 16,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #00A896 0%, #00897B 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #00897B 0%, #00695C 100%)',
              },
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Login as Client'}
          </Button>
        </form>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Don't have an account?
          </Typography>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => navigate('/register/client')}
            sx={{
              py: 1.2,
              fontSize: 15,
              borderColor: '#00A896',
              color: '#00A896',
              '&:hover': {
                borderColor: '#00897B',
                bgcolor: 'rgba(0,168,150,0.05)',
              },
            }}
          >
            Create New Account
          </Button>
        </Box>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Link to="/login/staff" style={{ color: '#4A90E2', textDecoration: 'none', fontWeight: 600 }}>
            Staff Login
          </Link>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginClient;