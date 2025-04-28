import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine
} from 'recharts';
import { Box, Typography, useTheme, alpha } from '@mui/material';

const RiskTimelineChart = ({ data, height = 400 }) => {
  const theme = useTheme();

  // Format data for the chart - convert dates to readable format
  const formatData = (timelineData) => {
    return timelineData.map(item => ({
      date: new Date(item.date).toLocaleDateString(),
      score: item.score,
      // Format the date for tooltip display
      fullDate: new Date(item.date).toLocaleString(),
    }));
  };

  const formattedData = formatData(data);

  // Create custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            background: theme.palette.background.paper,
            p: 2,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            boxShadow: theme.shadows[3],
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {data.fullDate}
          </Typography>
          <Typography variant="body2">
            <strong>Risk Score:</strong> {data.score}
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: data.score <= 30 ? theme.palette.success.main : 
                     data.score <= 60 ? theme.palette.warning.main : 
                     theme.palette.error.main 
            }}
          >
            <strong>Risk Level:</strong> {
              data.score <= 30 ? 'Low Risk' : 
              data.score <= 60 ? 'Medium Risk' : 
              'High Risk'
            }
          </Typography>
        </Box>
      );
    }
    return null;
  };

  // Calculate domain to add some padding to the chart
  const minScore = Math.max(0, Math.min(...data.map(item => item.score)) - 10);
  const maxScore = Math.min(100, Math.max(...data.map(item => item.score)) + 10);

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart
          data={formattedData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          {/* Risk level zones */}
          <ReferenceArea 
            y1={0} 
            y2={30} 
            fill={alpha(theme.palette.success.main, 0.1)} 
            fillOpacity={0.3} 
            stroke="none"
          />
          <ReferenceArea 
            y1={30} 
            y2={60} 
            fill={alpha(theme.palette.warning.main, 0.1)} 
            fillOpacity={0.3} 
            stroke="none"
          />
          <ReferenceArea 
            y1={60} 
            y2={100} 
            fill={alpha(theme.palette.error.main, 0.1)} 
            fillOpacity={0.3} 
            stroke="none"
          />
          
          {/* Reference lines for risk level thresholds */}
          <ReferenceLine 
            y={30} 
            stroke={theme.palette.success.main} 
            strokeDasharray="3 3" 
            label={{ 
              value: 'Low Risk', 
              position: 'insideLeft',
              fill: theme.palette.success.main,
              fontSize: 12
            }} 
          />
          <ReferenceLine 
            y={60} 
            stroke={theme.palette.warning.main} 
            strokeDasharray="3 3" 
            label={{ 
              value: 'Medium Risk', 
              position: 'insideLeft',
              fill: theme.palette.warning.main,
              fontSize: 12
            }} 
          />
          
          <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.7)} />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            stroke={theme.palette.text.secondary}
          />
          <YAxis 
            domain={[minScore, maxScore]} 
            tick={{ fontSize: 12 }}
            stroke={theme.palette.text.secondary}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="score"
            name="Risk Score"
            stroke={theme.palette.primary.main}
            strokeWidth={2}
            dot={{ r: 4, fill: theme.palette.primary.main }}
            activeDot={{ r: 6, fill: theme.palette.primary.main }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RiskTimelineChart;
