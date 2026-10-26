import React, { useState } from "react";
import {
  Box,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from "@mui/material";
import {
  ShareRounded,
  TuneRounded,
  HomeRounded,
} from "@mui/icons-material";

/**
 * Floating Action Panel with Quick Access Menu
 * Cart removed — clients are view-only.
 */
const FloatingActionPanel = ({
  onShare,
  onToggleFilters,
}) => {
  const [open, setOpen] = useState(false);

  // Configuration object for SpeedDial actions
  const actions = [
    {
      icon: <ShareRounded />,
      name: "Share",
      action: onShare,
    },
    {
      icon: <TuneRounded />,
      name: "Filters",
      action: onToggleFilters,
    },
    {
      icon: <HomeRounded />,
      name: "Top of Page",
      action: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    },
  ];

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: { xs: 24, sm: 32 },
        right: { xs: 16, sm: 32 },
        zIndex: 1100,
      }}
    >
      <SpeedDial
        ariaLabel="Quick navigation and action panel"
        icon={<SpeedDialIcon />}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        open={open}
        direction="up"
        sx={{
          "& .MuiFab-primary": {
            bgcolor: "#087F5B",
            color: "#FFFFFF",
            boxShadow: "0px 8px 24px rgba(8,127,91, 0.4)",
            transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            "&:hover": {
              bgcolor: "#066649",
              boxShadow: "0px 10px 28px rgba(8,127,91, 0.55)",
              transform: "scale(1.05)",
            },
            "&:active": {
              transform: "scale(0.95)",
            },
          },
          "& .MuiSpeedDialAction-fab": {
            bgcolor: "#254D3F",
            color: "#B9EBD0",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            transition: "all 0.2s ease",
            "&:hover": {
              bgcolor: "#183D32",
              color: "#FFFFFF",
              borderColor: "#B9EBD0",
              transform: "scale(1.1)",
            },
          },
          "& .MuiSpeedDialAction-staticTooltipLabel": {
            bgcolor: "#254D3F",
            color: "#F7F5EC",
            fontSize: "0.75rem",
            fontWeight: 600,
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.3)",
            whiteSpace: "nowrap",
          },
        }}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            tooltipOpen
            onClick={() => {
              setOpen(false);
              action.action?.();
            }}
          />
        ))}
      </SpeedDial>
    </Box>
  );
};

export default FloatingActionPanel;
