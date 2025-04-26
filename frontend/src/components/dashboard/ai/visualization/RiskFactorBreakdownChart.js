import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tooltip as MuiTooltip,
  IconButton,
  Menu,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  useTheme
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
  Label,
  Legend,
  Tooltip
} from 'recharts';
import { MoreVert, TrendingUp, TrendingDown, Sort } from '@mui/icons-material';

const RiskFactorBreakdownChart = ({ factors, height = 400 }) => {
  const theme = useTheme();
  const [data, setData] = useState([]);
  const [sortOrder, setSortOrder] = useState('impact'); // 'impact' or 'contribution'
  const [viewType, setViewType] = useState('all'); // 'all', 'positive', or 'negative'
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  
  // Process factors data
  useEffect(() => {
    if (!factors || factors.length === 0) {
      setData([]);
      return;
    }
    
    let processedData = factors.map(factor => ({
      name: factor.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      impact: (factor.impact * 100).toFixed(0),
      contribution: factor.contribution,
      description: factor.description,
      details: factor.details || ''
    }));
    
    // Filter by view type
    if (viewType === 'positive') {
      processedData = processedData.filter(item => item.contribution < 0);
    } else if (viewType === 'negative') {
      processedData = processedData.filter(item => item.contribution > 0);
    }
    
    // Sort data
    if (sortOrder === 'impact') {
      processedData.sort((a, b) => b.impact - a.impact);
    } else if (sortOrder === 'contribution') {
      processedData.sort((a, b) => a.contribution - b.contribution);
    }
    
    setData(processedData);
  }, [factors, sortOrder, viewType]);
  
  // Handle menu open
  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  // Handle sort order change
  const handleSortChange = (newOrder) => {
    setSortOrder(newOrder);
    handleMenuClose();
  };
  
  // Handle view type change
  const handleViewTypeChange = (event, newViewType) => {
    if (newViewType !== null) {
      setViewType(newViewType);
    }
  };
  
  // Get bar color based on contribution
  const getBarColor = (contribution) => {
    if (contribution < 0) {
      return theme.palette.success.main;
    } else {
      return theme.palette.error.main;
    }
  };
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <Box sx={{ 
          bgcolor: 'background.paper', 
          p: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          boxShadow: theme.shadows[1],
          maxWidth: 300
        }}>
          <Typography variant="subtitle2">{item.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Impact: {item.impact}% of risk score
          </Typography>
          <Typography variant="body2" color={item.contribution < 0 ? "success.main" : "error.main"}>
            Contribution: {item.contribution < 0 ? '' : '+'}
            {item.contribution} points
          </Typography>
          {item.description && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {item.description}
            </Typography>
          )}
        </Box>
      );
    }
    return null;
  };
  
  // If no data, show message
  if (!data || data.length === 0) {
    return (
      <Box sx={{ 
        height, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        flexDirection: 'column',
        p: 3
      }}>
        <Typography variant="body1" color="text.secondary">
          No risk factor data available
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ height, width: '100%', position: 'relative' }}>
      {/* Chart controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <ToggleButtonGroup
          value={viewType}
          exclusive
          onChange={handleViewTypeChange}
          aria-label="view type"
          size="small"
        >
          <ToggleButton value="all" aria-label="all factors">
            All
          </ToggleButton>
          <ToggleButton value="positive" aria-label="positive factors">
            <TrendingDown sx={{ mr: 0.5 }} fontSize="small" />
            Positive
          </ToggleButton>
          <ToggleButton value="negative" aria-label="negative factors">
            <TrendingUp sx={{ mr: 0.5 }} fontSize="small" />
            Negative
          </ToggleButton>
        </ToggleButtonGroup>
        
        <MuiTooltip title="Sort options">
          <IconButton
            aria-label="more"
            aria-controls="sort-menu"
            aria-haspopup="true"
            onClick={handleMenuClick}
            size="small"
          >
            <MoreVert />
          </IconButton>
        </MuiTooltip>
        
        <Menu
          id="sort-menu"
          anchorEl={anchorEl}
          keepMounted
          open={open}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => handleSortChange('impact')}>
            <Sort sx={{ mr: 1 }} fontSize="small" />
            Sort by Impact
          </MenuItem>
          <MenuItem onClick={() => handleSortChange('contribution')}>
            <Sort sx={{ mr: 1 }} fontSize="small" />
            Sort by Contribution
          </MenuItem>
        </Menu>
      </Box>
      
      {/* Chart */}
      <ResponsiveContainer width="100%" height={height - 50}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`}
          >
            <Label
              value="Risk Score Contribution (points)"
              position="bottom"
              style={{ textAnchor: 'middle' }}
            />
          </XAxis>
          <YAxis dataKey="name" type="category" width={120} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={0} stroke={theme.palette.grey[500]} />
          <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.contribution)} />
            ))}
          </Bar>
          <Legend
            formatter={(value, entry) => {
              const color = entry.color;
              return <span style={{ color }}>
                {color === theme.palette.success.main ? 'Positive Factors' : 'Negative Factors'}
              </span>;
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RiskFactorBreakdownChart;
