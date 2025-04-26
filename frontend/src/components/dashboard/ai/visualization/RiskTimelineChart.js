import React, { useState } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip as MuiTooltip,
  useTheme
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Dot
} from 'recharts';
import { CalendarViewWeek, CalendarViewMonth, Event } from '@mui/icons-material';

const RiskTimelineChart = ({ data, height = 400 }) => {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState('month'); // 'week', 'month', 'all'
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  
  // Filter data based on selected time range
  const getFilteredData = () => {
    if (!data || data.length === 0) return [];
    
    const now = new Date();
    let cutoff = new Date(now);
    
    if (timeRange === 'week') {
      cutoff.setDate(cutoff.getDate() - 7);
    } else if (timeRange === 'month') {
      cutoff.setDate(cutoff.getDate() - 30);
    } else {
      // Return all data for 'all' timeRange
      return data;
    }
    
    return data.filter(item => new Date(item.date) >= cutoff);
  };
  
  // Handle time range change
  const handleTimeRangeChange = (event, newTimeRange) => {
    if (newTimeRange !== null) {
      setTimeRange(newTimeRange);
    }
  };
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const score = payload[0].value;
      const date = payload[0].payload.date;
      
      return (
        <Box sx={{ 
          bgcolor: 'background.paper', 
          p: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          boxShadow: theme.shadows[1]
        }}>
          <Typography variant="subtitle2">
            {new Date(date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              fontWeight: 'medium',
              color: score <= 30 ? theme.palette.success.main :
                     score <= 60 ? theme.palette.warning.main :
                     theme.palette.error.main
            }}
          >
            Risk Score: {score}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {score <= 30 ? 'Low Risk' :
             score <= 60 ? 'Medium Risk' :
             'High Risk'}
          </Typography>
        </Box>
      );
    }
    return null;
  };
  
  // Custom dot to highlight risk thresholds
  const renderCustomDot = (props) => {
    const { cx, cy, payload } = props;
    const score = payload.score;
    
    // Highlight dots that cross risk thresholds (30 and 60)
    const isPrevDifferentCategory = data.indexOf(payload) > 0 && 
      ((data[data.indexOf(payload) - 1].score <= 30 && score > 30) || 
       (data[data.indexOf(payload) - 1].score > 30 && score <= 30) ||
       (data[data.indexOf(payload) - 1].score <= 60 && score > 60) ||
       (data[data.indexOf(payload) - 1].score > 60 && score <= 60));
    
    if (isPrevDifferentCategory) {
      return (
        <Dot 
          cx={cx} 
          cy={cy} 
          r={5} 
          fill={score <= 30 ? theme.palette.success.main :
                score <= 60 ? theme.palette.warning.main :
                theme.palette.error.main} 
          stroke={theme.palette.background.paper}
          strokeWidth={2}
        />
      );
    }
    
    return null;
  };
  
  // Get risk category color
  const getRiskColor = (score) => {
    if (score <= 30) return theme.palette.success.main;
    if (score <= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };
  
  // Get filtered data
  const filteredData = getFilteredData();
  
  // If no data, show message
  if (!filteredData || filteredData.length === 0) {
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
          No timeline data available for the selected period
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ height, width: '100%' }}>
      {/* Time range selector */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={handleTimeRangeChange}
          aria-label="time range"
          size="small"
        >
          <ToggleButton value="week" aria-label="week">
            <CalendarViewWeek sx={{ mr: 0.5 }} fontSize="small" />
            Week
          </ToggleButton>
          <ToggleButton value="month" aria-label="month">
            <CalendarViewMonth sx={{ mr: 0.5 }} fontSize="small" />
            Month
          </ToggleButton>
          <ToggleButton value="all" aria-label="all time">
            <Event sx={{ mr: 0.5 }} fontSize="small" />
            All Time
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      
      {/* Chart */}
      <ResponsiveContainer width="100%" height={height - 50}>
        <LineChart
          data={filteredData}
          margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            domain={[0, 100]}
            ticks={[0, 20, 30, 40, 60, 80, 100]}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Reference areas for risk categories */}
          <ReferenceArea y1={0} y2={30} fill={theme.palette.success.main} fillOpacity={0.1} />
          <ReferenceArea y1={30} y2={60} fill={theme.palette.warning.main} fillOpacity={0.1} />
          <ReferenceArea y1={60} y2={100} fill={theme.palette.error.main} fillOpacity={0.1} />
          
          {/* Reference lines for risk thresholds */}
          <ReferenceLine y={30} stroke={theme.palette.success.main} strokeDasharray="3 3">
            <Typography variant="caption" fill={theme.palette.success.main}>
              Low Risk
            </Typography>
          </ReferenceLine>
          <ReferenceLine y={60} stroke={theme.palette.error.main} strokeDasharray="3 3">
            <Typography variant="caption" fill={theme.palette.error.main}>
              High Risk
            </Typography>
          </ReferenceLine>
          
          {/* The risk score line */}
          <Line
            type="monotone"
            dataKey="score"
            stroke={theme.palette.primary.main}
            strokeWidth={2}
            dot={({ payload }) => 
              <circle 
                cx={0} 
                cy={0} 
                r={3} 
                fill={getRiskColor(payload.score)} 
                stroke={theme.palette.background.paper}
                strokeWidth={1}
              />
            }
            activeDot={{ r: 6, fill: theme.palette.primary.main }}
            dot={renderCustomDot}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RiskTimelineChart;
