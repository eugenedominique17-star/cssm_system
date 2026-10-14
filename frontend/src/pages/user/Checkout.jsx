import React from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export default function Checkout() {
  return <Box sx={{ p: 3 }}>
    <Typography variant="h5" gutterBottom>Shop in store</Typography>
    <Alert severity="info">Choose your products in store and pay directly at the cashier. Completed purchases appear in your purchase history.</Alert>
    <Button component={Link} to="/client/history" sx={{ mt: 2 }}>View purchase history</Button>
  </Box>;
}
