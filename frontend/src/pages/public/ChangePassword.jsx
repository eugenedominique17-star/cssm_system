import React, { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  LockReset as LockResetIcon,
  Visibility,
  VisibilityOff,
  CheckCircleRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

// Additive: forced first-login password change page (completes the Login.jsx redirect)
const ChangePassword = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = (() => {
    let score = 0;
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 10) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/\d/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;
    return score;
  })();

  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const strengthColors = ['#EF4444', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#087F5B'];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from the temporary password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await API.post('/auth/change-password', { currentPassword, newPassword });
      navigate('/change-password/success', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'var(--sh-page-tint)',
        p: 2,
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 3, sm: 5 },
          borderRadius: 4,
          border: '1px solid rgba(24,61,50,0.08)',
          boxShadow: '0 8px 30px rgba(24,61,50,0.06)',
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 3,
            bgcolor: 'rgba(8,127,91,0.1)',
            color: '#087F5B',
            mb: 2.5,
          }}
        >
          <LockResetIcon fontSize="large" />
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 800, color: '#183D32', mb: 0.5 }}>
          Set Your New Password
        </Typography>
        <Typography variant="body2" sx={{ color: '#617B6C', mb: 3 }}>
          Hi {user?.name || 'there'}! You're using a temporary password.
          Please create your own secure password to continue.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            type={showCurrent ? 'text' : 'password'}
            label="Temporary Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            sx={{ mb: 2.5 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowCurrent(!showCurrent)} edge="end">
                    {showCurrent ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            type={showNew ? 'text' : 'password'}
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            sx={{ mb: 1 }}
            helperText="At least 6 characters"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowNew(!showNew)} edge="end">
                    {showNew ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {newPassword && (
            <Box sx={{ mb: 2.5 }}>
              <LinearProgress
                variant="determinate"
                value={(strength / 5) * 100}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'rgba(24,61,50,0.06)',
                  '& .MuiLinearProgress-bar': { bgcolor: strengthColors[strength], borderRadius: 3 },
                }}
              />
              <Typography variant="caption" sx={{ color: strengthColors[strength], fontWeight: 700 }}>
                {strengthLabels[strength]}
              </Typography>
            </Box>
          )}

          <TextField
            fullWidth
            type={showConfirm ? 'text' : 'password'}
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={Boolean(confirmPassword) && confirmPassword !== newPassword}
            sx={{ mb: 3 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowConfirm(!showConfirm)} edge="end">
                    {showConfirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{
              py: 1.4,
              borderRadius: 2.5,
              fontWeight: 700,
              textTransform: 'none',
              fontSize: '1rem',
              bgcolor: '#087F5B',
              '&:hover': { bgcolor: '#066649' },
            }}
          >
            {loading ? 'Saving...' : 'Save New Password'}
          </Button>
        </form>
      </Card>
    </Box>
  );
};

// Simple success screen after changing the password
export const ChangePasswordSuccess = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const dashboardPath =
    user?.role === 'admin'
      ? '/admin/dashboard'
      : user?.role === 'staff'
      ? '/staff/dashboard'
      : '/client/dashboard';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'var(--sh-page-tint)',
        p: 2,
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 4, sm: 6 },
          textAlign: 'center',
          borderRadius: 4,
          border: '1px solid rgba(24,61,50,0.08)',
          boxShadow: '0 8px 30px rgba(24,61,50,0.06)',
        }}
      >
        <CheckCircleRounded sx={{ fontSize: 72, color: '#22C55E', mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#183D32', mb: 1 }}>
          Password Changed!
        </Typography>
        <Typography variant="body2" sx={{ color: '#617B6C', mb: 4 }}>
          Your new password is now active. Use it next time you sign in.
        </Typography>
        <Button
          fullWidth
          variant="contained"
          onClick={() => navigate(dashboardPath, { replace: true })}
          sx={{
            py: 1.3,
            borderRadius: 2.5,
            fontWeight: 700,
            textTransform: 'none',
            fontSize: '1rem',
            bgcolor: '#087F5B',
            '&:hover': { bgcolor: '#066649' },
          }}
        >
          Continue to Dashboard
        </Button>
      </Card>
    </Box>
  );
};

export default ChangePassword;

