import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, Card, Grid } from '@mui/material';
import { PersonAdd } from '@mui/icons-material';
import AccountApprovalCards from '../../components/AccountApprovalCards';
import API from '../../api/accountAdmin';
import { colors } from '../../theme';

const ClientApprovals = () => {
  const [pendingClients, setPendingClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'success' });

  useEffect(() => { fetchPending(); }, []);

  const fetchPending = async () => {
    try {
      const response = await API.get('/admin/pending-clients');
      setPendingClients(response.data);
    } catch (error) {
      console.error('Failed to fetch pending clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await API.put(`/users/${id}/approve`);
      showAlert('Client account approved!');
      await fetchPending();
    } catch (error) {
      showAlert('Failed to approve client.', 'error');
    }
  };

  const handleReject = async (id) => {
    try {
      await API.put(`/users/${id}/reject`);
      showAlert('Client account rejected successfully.', 'success');
      await fetchPending();
    } catch (error) {
      showAlert('Failed to reject client.', 'error');
    }
  };

  const showAlert = (message, severity = 'success') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'success' }), 3000);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
        <CircularProgress size={48} sx={{ color: colors.primary }} />
      </Box>
    );
  }

  return (
    <Box className="page-container">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" className="page-title" sx={{ mb: 1, fontWeight: 900 }}>
          Client Account Approvals
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review and approve pending client registration requests.
        </Typography>
      </Box>

      {/* Summary Card */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #00A896 0%, #00897B 100%)',
              color: 'white',
              borderRadius: 3,
              boxShadow: '0 8px 24px rgba(0,168,150,0.25)',
              border: 'none',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PersonAdd sx={{ fontSize: 32 }} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                  Pending Clients
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>
                  {pendingClients.length}
                </Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {alert.show && (
        <Alert severity={alert.severity} sx={{ mb: 3, borderRadius: 2.5, animation: 'fadeInUp 0.3s ease' }}>
          {alert.message}
        </Alert>
      )}

      {pendingClients.length === 0 ? (
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(0,168,150,0.04) 0%, rgba(252,163,17,0.04) 100%)',
            border: '1px solid rgba(0,0,0,0.04)',
          }}
        >
          <Box
            sx={{
              bgcolor: 'rgba(0,168,150,0.1)',
              borderRadius: 3,
              p: 2,
              display: 'inline-flex',
              mb: 2,
              color: colors.primary,
            }}
          >
            <PersonAdd sx={{ fontSize: 48 }} />
          </Box>
          <Typography variant="h6" fontWeight={600} color="text.secondary">
            No pending client account requests.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            New client registrations will appear here for your approval.
          </Typography>
        </Paper>
      ) : (
        <AccountApprovalCards accounts={pendingClients} role="client" onApprove={handleApprove} onReject={handleReject} />
      )}
    </Box>
  );
};

export default ClientApprovals;
