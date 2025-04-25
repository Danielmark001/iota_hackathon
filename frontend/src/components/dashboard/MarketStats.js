import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Skeleton,
  Tooltip,
} from '@mui/material';
import { Info, TrendingUp, TrendingDown } from '@mui/icons-material';

const MarketStats = ({ data, loading = false }) => {
  const [marketData, setMarketData] = useState([]);
  
  // Process market data when it changes
  useEffect(() => {
    if (loading || !data) return;
    
    // Format market data for table display
    setMarketData(data);
  }, [data, loading]);
  
  return (
    <Paper
      elevation={2}
      sx={{
        height: '100%',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          Market Overview
          <Tooltip title="Current market statistics for IOTA lending pools" placement="top">
            <Info fontSize="small" sx={{ ml: 0.5, opacity: 0.7 }} />
          </Tooltip>
        </Typography>
      </Box>
      
      <TableContainer sx={{ flexGrow: 1 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Asset</TableCell>
              <TableCell align="right">Supply APY</TableCell>
              <TableCell align="right">Borrow APY</TableCell>
              <TableCell align="right">Total Supply</TableCell>
              <TableCell align="right">Total Borrowed</TableCell>
              <TableCell align="right">Utilization</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Skeleton rows for loading state
              Array.from(new Array(5)).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
                      <Skeleton variant="text" width={80} />
                    </Box>
                  </TableCell>
                  <TableCell align="right"><Skeleton variant="text" /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" /></TableCell>
                  <TableCell align="right"><Skeleton variant="text" width={60} /></TableCell>
                </TableRow>
              ))
            ) : marketData.length > 0 ? (
              // Actual market data
              marketData.map((asset) => (
                <TableRow
                  key={asset.id}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <img
                        src={asset.icon}
                        alt={asset.name}
                        style={{ width: 24, height: 24, marginRight: 8 }}
                      />
                      <Typography variant="body2" fontWeight="medium">
                        {asset.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <Typography color="success.main" fontWeight="medium">
                        {asset.supplyAPY}%
                      </Typography>
                      {asset.supplyAPYChange > 0 ? (
                        <TrendingUp fontSize="small" color="success" sx={{ ml: 0.5 }} />
                      ) : (
                        <TrendingDown fontSize="small" color="error" sx={{ ml: 0.5 }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography color="error.main" fontWeight="medium">
                      {asset.borrowAPY}%
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography>
                      {asset.totalSupply.toLocaleString()} {asset.symbol}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography>
                      {asset.totalBorrowed.toLocaleString()} {asset.symbol}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={`${asset.utilization}%`}
                      size="small"
                      color={
                        asset.utilization > 80
                          ? 'error'
                          : asset.utilization > 60
                          ? 'warning'
                          : 'success'
                      }
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              // No data state
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No market data available
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
        <Typography variant="caption" color="text.secondary">
          Last updated: {loading ? 'Loading...' : new Date().toLocaleTimeString()}
        </Typography>
      </Box>
    </Paper>
  );
};

export default MarketStats;
