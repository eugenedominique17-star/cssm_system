import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { StorefrontRounded, WbSunnyRounded, NightsStayRounded } from '@mui/icons-material';

export default function DashboardWelcome({ name, role }) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const hour = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', hour: 'numeric', hourCycle: 'h23' }).format(now));
  const greeting = hour < 12 ? 'Maayong buntag' : hour < 18 ? 'Maayong hapon' : 'Maayong gabii';
  const SunIcon = hour < 18 && hour >= 6 ? WbSunnyRounded : NightsStayRounded;
  return (
    <Stack className="dashboard-welcome" direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, color: '#066649' }}>
          <SunIcon sx={{ fontSize: 18 }} />
          <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: '.12em' }}>A fresh start</Typography>
        </Stack>
        <Typography component="h1" sx={{ fontSize: { xs: 23, md: 30 }, fontWeight: 800, letterSpacing: '-.04em', overflowWrap: 'anywhere' }}>
          {greeting}, {name.split(' ')[0]}!
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          {role === 'client' ? 'Your everyday essentials, all in one place.' : 'A little clarity for a productive day at your store.'}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#4C695A' }}>
          {new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now)}
        </Typography>
      </Box>
      <Box className="welcome-store" aria-hidden="true" sx={{ display: { xs: 'none', sm: 'grid' }, flexShrink: 0 }}>
        <StorefrontRounded sx={{ fontSize: 72, color: '#087F5B' }} />
        <Box className="welcome-store-dot" />
      </Box>
    </Stack>
  );
}
