import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { Box, Typography, useTheme, alpha } from '@mui/material';

const RiskFactorBreakdownChart = ({ factors, height = 400 }) => {
  const theme = useTheme();

  // Format data for the chart
  const formatData = (factors) => {
    return factors.map(factor => ({
      name: factor.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      contribution: factor.contribution,
      impact: factor.impact,
      description: factor.description,
      details: factor.details
    }));
  };

  const data = formatData(factors);

  // Create custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const factor = payload[0].payload;
      return (
        <Box
          sx={{
            background: theme.palette.background.paper,
            p: 2,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            boxShadow: theme.shadows[3],
            maxWidth: 300
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {factor.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {factor.description}
          </Typography>
          <Typography variant="body2">
            <strong>Contribution:</strong> {factor.contribution > 0 ? '+' : ''}{factor.contribution} points
          </Typography>
          <Typography variant="body2">
            <strong>Impact:</strong> {(factor.impact * 100).toFixed(0)}%
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.7)} />
          <XAxis 
            type="number" 
            domain={[-20, 20]} 
            tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`}
            stroke={theme.palette.text.secondary}
          />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={120}
            tick={{ fontSize: 12 }}
            stroke={theme.palette.text.secondary}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine x={0} stroke={theme.palette.divider} />
          <Bar dataKey="contribution" name="Impact on Risk Score" radius={[4, 4, 4, 4]}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.contribution > 0 ? theme.palette.error.main : theme.palette.success.main} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RiskFactorBreakdownChart;
