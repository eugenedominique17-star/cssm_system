const fs = require('node:fs');
const file = 'frontend/src/components/Navbar.jsx';
let source = fs.readFileSync(file, 'utf8');
const start = source.indexOf('          {/* ================= DESKTOP NAV ================= */}');
const end = source.indexOf('          {/* ================= RIGHT SIDE ================= */}', start);
if (start < 0 || end < 0) throw new Error('Navigation section not found');
const nav = `          {/* Role and homepage links share one wrapping navigation area. */}
          {!isDashboardRoute && (isAuthenticated || homepage) ? (
            <Box
              component="nav"
              aria-label="Main navigation"
              sx={{
                display: { xs: "none", lg: "flex" },
                flex: "1 1 auto",
                minWidth: 0,
                alignItems: "center",
                flexWrap: "wrap",
                columnGap: 0.75,
                rowGap: 0.5,
                "& .MuiButton-root": {
                  flexShrink: 0,
                  minWidth: "max-content",
                  minHeight: 40,
                  px: 1.35,
                  borderRadius: "10px",
                  textTransform: "none",
                  fontSize: "0.77rem",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  color: "#63756F",
                  "&:hover": { bgcolor: "#F4F7F6", color: "#066649" },
                },
                "& .MuiButton-startIcon": {
                  flexShrink: 0,
                  ml: 0,
                  mr: 0.75,
                  "& svg": { fontSize: 18 },
                },
              }}
            >
              {isAuthenticated && navItems.map(item => (
                <Button
                  key={item.link}
                  onClick={() => handleNavigate(item.link)}
                  startIcon={item.icon}
                  aria-current={isActive(item.link) ? "page" : undefined}
                  disableRipple
                  sx={isActive(item.link) ? { "&&": { color: "#066649", bgcolor: "#EDF8F4", fontWeight: 800 } } : undefined}
                >
                  {item.label}
                </Button>
              ))}
              {homepage && [
                ["Home", "home-section", <HomeRounded fontSize="small" />],
                ["Services", "services-section", <StorefrontRounded fontSize="small" />],
              ].map(([label, sectionId, icon]) => (
                <Button key={sectionId} onClick={() => handleHomepageSection(sectionId)} startIcon={icon} disableRipple>
                  {label}
                </Button>
              ))}
            </Box>
          ) : <Box sx={{ flex: 1 }} />}

`;
source = source.slice(0, start) + nav + source.slice(end);
source = source.replace('            maxWidth: 1440,', '            maxWidth: 1440,\n            boxSizing: "border-box",\n            py: 1,');
source = source.replace('                md: 2.5,', '                md: 0.5,');
source = source.replace('              ml: "auto",', '              ml: "auto",\n              flexShrink: 0,');
source = source.replace('<IconButton\r\n                onClick={(event) => setMobileAnchor(event.currentTarget)}', '<IconButton\r\n                aria-label="Open navigation menu"\r\n                aria-expanded={Boolean(mobileAnchor)}\r\n                onClick={(event) => setMobileAnchor(event.currentTarget)}');
fs.writeFileSync(file, source);
