import React from 'react';
import { Alert, Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { auditPresentation, auditValue } from '../utils/auditDetails.mjs';

export default function AuditActivityDetails({ entry }) {
  const details = entry.details || {};
  const view = auditPresentation(entry);
  const record = details.snapshot_version === 1 ? details : details.linked_request || details;
  const order = details.linked_order;
  const fields = [
    ['Submission ID', record.submission?.id || (['Approve submission', 'Reject submission'].includes(entry.action) ? entry.entity_id : null)],
    ['Submission type', record.submission?.type?.replace(/_/g, ' ')],
    ['Account', record.account?.name],
    ['Account ID', record.account?.user_id || (['Approve account', 'Reject account'].includes(entry.action) ? entry.entity_id : null)],
    ['Account role', record.account?.role],
    [record.product?.name ? (details.linked_request ? 'Product (current name)' : 'Product') : null, record.product?.name],
    ['Requested by', record.requested_by?.name],
    ['Reviewed by', record.reviewed_by?.name],
    ['Requested quantity', record.quantity_requested == null ? null : `${record.quantity_requested} units`],
    ['Expiration date', record.expiry_date],
    ['Batch', record.batch_code],
    ['Reason', record.reason],
  ].filter(([label, value]) => label && value !== null && value !== undefined && value !== '');
  return <Stack spacing={2}>
    <Alert severity={view.severity}>{view.message}</Alert>
    {fields.length > 0 && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>{fields.map(([label, value]) => <Box key={label}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ overflowWrap: 'anywhere' }}>{auditValue(value)}</Typography></Box>)}</Box>}
    {entry.action === 'Change password' && entry.outcome === 'succeeded' && <Box><Typography variant="caption" color="text.secondary">Previous password</Typography><Typography>{details.previous_password?.masked || 'Unavailable'}</Typography><Typography variant="caption" color="text.secondary">Reveal this from User Management for the affected account.</Typography></Box>}
    {order && <Box>
      <Typography fontWeight={700} sx={{ mb: 1 }}>Saved order record</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
        {[
          ['Receipt', order.receipt_number],
          ['Customer', order.customer_name],
          ['Total', order.total_amount == null ? null : `PHP ${Number(order.total_amount).toFixed(2)}`],
          ['Payment method', order.payment_method],
          ['Tendered', order.tendered_amount == null ? null : `PHP ${Number(order.tendered_amount).toFixed(2)}`],
          ['Change', order.change_amount == null ? null : `PHP ${Number(order.change_amount).toFixed(2)}`],
        ].filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => <Box key={label}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography>{auditValue(value)}</Typography></Box>)}
      </Box>
      {order.items?.length > 0 && <TableContainer><Table size="small" aria-label="Saved order items">
        <TableHead><TableRow>{['Product (current name)', 'Quantity', 'Unit price', 'Subtotal'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
        <TableBody>{order.items.map((item, index) => <TableRow key={`${item.product_id}-${index}`}>
          <TableCell>{item.product_name || `Product #${item.product_id}`}</TableCell>
          <TableCell>{auditValue(item.quantity)}</TableCell>
          <TableCell>{item.unit_price == null ? 'Not set' : `PHP ${Number(item.unit_price).toFixed(2)}`}</TableCell>
          <TableCell>{item.subtotal == null ? 'Not set' : `PHP ${Number(item.subtotal).toFixed(2)}`}</TableCell>
        </TableRow>)}</TableBody>
      </Table></TableContainer>}
      <Typography variant="caption" color="text.secondary">Order values come from the saved transaction. Product names reflect the current catalog.</Typography>
    </Box>}
    {view.changes?.length > 0 && <TableContainer><Table size="small" aria-label="Recorded changes"><TableHead><TableRow><TableCell>What changed</TableCell><TableCell>Before</TableCell><TableCell>After</TableCell></TableRow></TableHead><TableBody>{view.changes.map(change => <TableRow key={change.field}><TableCell>{change.label}</TableCell><TableCell sx={{ overflowWrap: 'anywhere' }}>{auditValue(change.before)}</TableCell><TableCell sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{auditValue(change.after)}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
    {!view.changes && Object.keys(details.requested || {}).length > 0 && <Box><Typography fontWeight={700} sx={{ mb: 1 }}>Requested values</Typography>{Object.entries(details.requested).map(([key, value]) => <Typography key={key} variant="body2">{key.replace(/_/g, ' ')}: {auditValue(value)}</Typography>)}</Box>}
    {details.linked_request && <Typography variant="caption" color="text.secondary">Request details are linked from the saved stock request. No historical stock total has been estimated.</Typography>}
    {!fields.length && !order && !view.changes?.length && !Object.keys(details.requested || {}).length && entry.entity_type === 'Order' && entry.action === 'Create order' && entry.outcome === 'succeeded' && <Typography color="text.secondary">The saved order record is not available for this audit entry.</Typography>}
  </Stack>;
}
