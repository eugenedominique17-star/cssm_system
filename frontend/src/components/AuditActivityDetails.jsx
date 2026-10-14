import React from 'react';
import { Alert, Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { auditPresentation, auditValue } from '../utils/auditDetails.mjs';

export default function AuditActivityDetails({ entry }) {
  const details = entry.details || {};
  const view = auditPresentation(entry);
  const record = details.snapshot_version === 1 ? details : details.linked_request || details;
  const fields = [
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
    {view.changes?.length > 0 && <TableContainer><Table size="small" aria-label="Recorded changes"><TableHead><TableRow><TableCell>What changed</TableCell><TableCell>Before</TableCell><TableCell>After</TableCell></TableRow></TableHead><TableBody>{view.changes.map(change => <TableRow key={change.field}><TableCell>{change.label}</TableCell><TableCell sx={{ overflowWrap: 'anywhere' }}>{auditValue(change.before)}</TableCell><TableCell sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{auditValue(change.after)}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
    {!view.changes && Object.keys(details.requested || {}).length > 0 && <Box><Typography fontWeight={700} sx={{ mb: 1 }}>Requested values</Typography>{Object.entries(details.requested).map(([key, value]) => <Typography key={key} variant="body2">{key.replace(/_/g, ' ')}: {auditValue(value)}</Typography>)}</Box>}
    {details.linked_request && <Typography variant="caption" color="text.secondary">Request details are linked from the saved stock request. No historical stock total has been estimated.</Typography>}
    {!fields.length && !view.changes?.length && !Object.keys(details.requested || {}).length && <Typography color="text.secondary">Detailed changes were not recorded for this activity.</Typography>}
  </Stack>;
}
