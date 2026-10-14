const fs = require('fs');
function edit(file, fn) { const old = fs.readFileSync(file, 'utf8'); const text = fn(old.replace(/\r\n/g, '\n')); fs.writeFileSync(file, text); }
function replace(text, from, to) { if (!text.includes(from)) throw new Error('Missing: ' + from.slice(0, 100)); return text.replace(from, to); }
edit('frontend/src/pages/staff/ReceiptManagement.jsx', s => {
  s = s.replace('  const [walkInRequests, setWalkInRequests] = useState([]);\n', '').replace('  const [walkInRequestId, setWalkInRequestId] = useState(null);\n', '').replaceAll('    setWalkInRequestId(null);\n', '');
  s = replace(s, 'transactionsResponse, productsResponse, usersResponse, walkInResponse', 'transactionsResponse, productsResponse, usersResponse');
  s = s.replace('            API.get("/transactions/walk-in-requests/pending"),\n', '').replace(/        setWalkInRequests\([\s\S]*?\n        \);\n/, '');
  s = s.replace(/  const openWalkInRequest = \(request\) => \{[\s\S]*?\n  \};\n/, '');
  s = s.replace(/      const response = walkInRequestId[\s\S]*?: await API.post\("\/transactions", payload\);/, '      const response = await API.post("/transactions", payload);');
  s = s.replace(/      \{walkInRequests.length > 0 && \([\s\S]*?\n      \)\}\n/, '');
  s = s.replace('Loading receipt management...', 'Loading cashier and receipts...').replaceAll('Receipt Management', 'Cashier & Receipts');
  return s;
});
edit('frontend/src/components/DashboardLayout.jsx', s => s.replace("    { label: 'Orders', href: '/staff/order-management', icon: ShoppingBagRounded },\n", '').replace("label: 'Receipts'", "label: 'Cashier & Receipts'"));
edit('frontend/src/components/Navbar.jsx', s => s.replace('label: "Receipts"', 'label: "Cashier & Receipts"'));
edit('frontend/src/App.js', s => s.replace("import OrderManagement from './pages/staff/OrderManagement';\n", '').replace('<OrderManagement />', '<Navigate to="/staff/receipts" replace />'));
edit('frontend/src/pages/staff/OrderManagement.jsx', () => `import React from 'react';\nimport { Navigate } from 'react-router-dom';\n\n// Preserve old bookmarks while keeping a single direct-sale cashier workflow.\nexport default function OrderManagement() {\n  return <Navigate to="/staff/receipts" replace />;\n}\n`);
edit('frontend/src/pages/user/Checkout.jsx', () => `import React from 'react';\nimport { Alert, Box, Button, Typography } from '@mui/material';\nimport { Link } from 'react-router-dom';\n\nexport default function Checkout() {\n  return <Box sx={{ p: 3 }}>\n    <Typography variant="h5" gutterBottom>Shop in store</Typography>\n    <Alert severity="info">Choose your products in store and pay directly at the cashier. Completed purchases appear in your purchase history.</Alert>\n    <Button component={Link} to="/client/history" sx={{ mt: 2 }}>View purchase history</Button>\n  </Box>;\n}\n`);
edit('frontend/src/pages/user/Dashboard.jsx', s => {
  s = 'import { useOrderStatusSSE } from "../../hooks/useOrderStatusSSE";\n' + s;
  return replace(s, '  useEffect(() => {\n    fetchData();', '  useOrderStatusSSE({ onUpdate: () => fetchData(true), onReconnect: () => fetchData(true) });\n\n  useEffect(() => {\n    fetchData();');
});
edit('frontend/src/pages/public/Homepage.jsx', s => {
  s = replace(s, '  const isOpen =\n    now.getHours() >= STORE.openingHour &&\n    now.getHours() < STORE.closingHour;', '  const storeHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", hourCycle: "h23" }).format(now));\n  const isOpen = storeHour >= STORE.openingHour && storeHour < STORE.closingHour;');
  s = s.replace('now.getHours() < STORE.openingHour', 'storeHour < STORE.openingHour');
  s = replace(s, 'simple place.', 'simple place. Purchases and payments are handled directly at our in-store cashier.');
  s = replace(s, '                    View Promotions\n                      </Button>', '                    View Promotions\n                      </Button>');
  s = replace(s, '                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.4} sx={{ mt: 3.3 }}>', '                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.4} sx={{ mt: 3.3 }}>\n                    <Button variant="outlined" onClick={() => navigate("/register/client")} sx={{ borderRadius: "15px", textTransform: "none", fontWeight: 800 }}>Sign Up</Button>');
  s = replace(s, '[<Inventory2Outlined />, "Updated availability", "See the products currently listed by your local store."],', '[<Inventory2Outlined />, "1. Choose products in store", "Browse our product availability and promotions, then visit the store to shop."],');
  s = replace(s, '[<LocalOfferRounded />, "Current promotions", "Find active StoreHub deals in one convenient place."],', '[<LocalOfferRounded />, "2. Pay at the cashier", "The cashier records your items, computes your total, and accepts your payment."],');
  s = replace(s, '[<SupportAgentRounded />, "Local support", "Call or email the store when you need help with an item."],', '[<SupportAgentRounded />, "3. Receive your receipt", "Get your receipt immediately. Purchases linked to your account appear in your purchase history."],');
  return s;
});
