import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { Box, Typography, useTheme, alpha } from '@mui/material';

const RiskComparisonRadar = ({ factors, height = 400 }) => {
  const theme = useTheme();

  // Transform risk factors data for the radar chart
  // We need to invert negative contributions (good factors) to display them correctly
  // For this chart, higher values = better (less risk)
  const prepareData = (factors) => {
    // Create an optimal profile with maximum values
    const optimalProfile = {};
    factors.forEach(factor => {
      // Format the name for display
      const formattedName = factor.name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Assign an optimal value (10 for this example)
      optimalProfile[formattedName] = 10;
    });

    // Calculate normalized user values (0-10 scale)
    // For negative contributions (good factors), higher is better
    // For positive contributions (risk factors), lower is better
    const userProfile = {};
    factors.forEach(factor => {
      const formattedName = factor.name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Normalize the contribution to a 0-10 scale
      // If contribution is negative (good), invert it to make it a positive value
      // If contribution is positive (bad), subtract from 10 to invert the scale
      const normalizedValue = factor.contribution < 0 
        ? Math.min(10, Math.abs(factor.contribution)) 
        : Math.max(0, 10 - factor.contribution);
      
      userProfile[formattedName] = normalizedValue;
    });

    // Combine into radar format
    const factorNames = Object.keys(optimalProfile);
    return factorNames.map(name => ({
      factor: name,
      User: userProfile[name],
      Optimal: optimalProfile[name],
      details: factors.find(f => 
        f.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') === name
      )?.details || ''
    }));
  };

  const radarData = prepareData(factors);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
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
            {payload[0].payload.factor}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Your Score:</strong> {payload[0].value.toFixed(1)}/10
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Optimal Score:</strong> {payload[1].value.toFixed(1)}/10
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {payload[0].payload.details}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RadarChart outerRadius={90} data={radarData}>
          <PolarGrid stroke={alpha(theme.palette.divider, 0.8)} />
          <PolarAngleAxis 
            dataKey="factor" 
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 10]} 
            stroke={alpha(theme.palette.divider, 0.8)}
            tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
          />
          <Radar
            name="Your Profile"
            dataKey="User"
            stroke={theme.palette.primary.main}
            fill={alpha(theme.palette.primary.main, 0.4)}
            dot={{ fill: theme.palette.primary.main, r: 3 }}
          />
          <Radar
            name="Optimal Profile"
            dataKey="Optimal"
            stroke={theme.palette.success.main}
            fill={alpha(theme.palette.success.main, 0.2)}
            dot={{ fill: theme.palette.success.main, r: 3 }}
          />
          <Legend 
            wrapperStyle={{ 
              paddingTop: 10,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RiskComparisonRadar;
