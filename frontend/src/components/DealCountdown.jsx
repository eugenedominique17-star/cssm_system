import React, { useState, useEffect } from "react";
import { Box, Chip, Typography, Stack } from "@mui/material";
import { TimerRounded } from "@mui/icons-material";

/**
 * Countdown timer component for promo deals
 * Shows days:hours:minutes:seconds remaining with color urgency indicator
 */
const DealCountdown = ({ endTime, compact = false }) => {
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false,
  });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const end = new Date(endTime);
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          expired: true,
        });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeRemaining({
        days,
        hours,
        minutes,
        seconds,
        expired: false,
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  if (timeRemaining.expired) {
    return (
      <Chip
        label="Offer Expired"
        size="small"
        sx={{
          fontWeight: 800,
          bgcolor: "rgba(239, 68, 68, 0.15)",
          color: "#EF4444",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "8px",
          px: 0.5,
        }}
      />
    );
  }

  // Urgent if less than 1 hour remaining or 0 days and 0 hours
  const isUrgent = timeRemaining.days === 0 && timeRemaining.hours < 1;
  const accentColor = isUrgent ? "#F87171" : "#B9EBD0";
  const bgColor = isUrgent
    ? "rgba(248, 113, 113, 0.12)"
    : "rgba(8,127,91, 0.15)";
  const borderColor = isUrgent
    ? "rgba(248, 113, 113, 0.25)"
    : "rgba(185,235,208, 0.25)";

  if (compact) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        sx={{
          px: 1.25,
          py: 0.5,
          borderRadius: "8px",
          bgcolor: bgColor,
          border: `1px solid ${borderColor}`,
          backdropFilter: "blur(4px)",
        }}
      >
        <TimerRounded
          sx={{
            fontSize: "0.95rem",
            color: accentColor,
            animation: isUrgent ? "pulse 1.2s infinite" : "none",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.4 },
            },
          }}
        />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            fontSize: "0.75rem",
            color: accentColor,
            letterSpacing: "0.3px",
          }}
        >
          {timeRemaining.days > 0
            ? `${timeRemaining.days}d ${timeRemaining.hours}h`
            : timeRemaining.hours > 0
              ? `${timeRemaining.hours}h ${timeRemaining.minutes}m`
              : `${timeRemaining.minutes}m ${timeRemaining.seconds}s`}
        </Typography>
      </Stack>
    );
  }

  // Full Box View with Time Cards
  const timeUnits = [
    ...(timeRemaining.days > 0
      ? [{ label: "DAYS", value: timeRemaining.days }]
      : []),
    { label: "HRS", value: timeRemaining.hours },
    { label: "MIN", value: timeRemaining.minutes },
    { label: "SEC", value: timeRemaining.seconds },
  ];

  return (
    <Box
      sx={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.25,
      }}
    >
      {/* Title Header */}
      <Stack direction="row" spacing={0.75} alignItems="center">
        <TimerRounded
          sx={{
            fontSize: "1.1rem",
            color: accentColor,
            animation: isUrgent ? "pulse 1.2s infinite" : "none",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.4 },
            },
          }}
        />
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 800,
            color: accentColor,
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          {isUrgent ? "Ends Very Soon" : "Limited Time Offer"}
        </Typography>
      </Stack>

      {/* Time Cards Container */}
      <Stack direction="row" spacing={1} alignItems="center">
        {timeUnits.map((unit, idx) => (
          <React.Fragment key={unit.label}>
            <Box
              sx={{
                bgcolor: "#183D32",
                border: `1px solid ${borderColor}`,
                borderRadius: "10px",
                minWidth: 46,
                px: 1,
                py: 0.75,
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
              }}
            >
              <Typography
                sx={{
                  fontSize: "1.15rem",
                  fontWeight: 900,
                  color: "#F7F5EC",
                  lineHeight: 1,
                  fontFamily: "monospace, sans-serif",
                }}
              >
                {String(unit.value).padStart(2, "0")}
              </Typography>
              <Typography
                sx={{
                  color: "#617B6C",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  mt: 0.5,
                  letterSpacing: "0.5px",
                }}
              >
                {unit.label}
              </Typography>
            </Box>

            {/* Separator dots */}
            {idx < timeUnits.length - 1 && (
              <Typography
                sx={{
                  fontWeight: 900,
                  color: borderColor,
                  fontSize: "1.2rem",
                }}
              >
                :
              </Typography>
            )}
          </React.Fragment>
        ))}
      </Stack>
    </Box>
  );
};

export default DealCountdown;
