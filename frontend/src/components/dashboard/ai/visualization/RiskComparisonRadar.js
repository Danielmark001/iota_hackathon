import React from 'react';
import {
  Box,
  Typography,
  useTheme
} from '@mui/material';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

const RiskComparisonRadar = ({ factors, height = 400 }) => {
  const theme = useTheme();
  
  // Transform risk factors for radar chart
  const transformFactorsForRadar = () => {
    if (!factors || factors.length === 0) return [];
    
    // Map risk factors to radar format
    return factors.map(factor => {
      // Get factor name formatted nicely
      const name = factor.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      
      // Calculate optimal value (inverse of risk contribution)
      // Negative contribution = better, so we want a higher value on the chart
      // Positive contribution = worse, so we want a lower value on the chart
      const userValue = factor.contribution < 0 ? 80 + Math.abs(factor.contribution) : 80 - factor.contribution;
      
      // Create data point
      return {
        subject: name,
        user: Math.max(0, Math.min(100, userValue)), // Clamp between 0-100
        optimal: 90, // Optimal value is always high (good)
        fullMark: 100
      };
    });
  };
  
  // Custom tooltip for the radar chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <Box sx={{ 
          bgcolor: 'background.paper', 
          p: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          boxShadow: theme.shadows[1]
        }}>
          <Typography variant="subtitle2">
            {data.subject}
          </Typography>
          {payload.map((entry, index) => (
            <Typography 
              key={index} 
              variant="body2" 
              sx={{ 
                color: entry.name === 'user' ? theme.palette.primary.main : theme.palette.success.main,
                mt: 0.5
              }}
            >
              {entry.name === 'user' ? 'Your Value: ' : 'Optimal Value: '}
              {entry.value}
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };
  
  // Transform the data
  const radarData = transformFactorsForRadar();
  
  // If no data, show message
  if (!radarData || radarData.length === 0) {
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
          No risk factor data available for comparison
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart 
          cx="50%" 
          cy="50%" 
          outerRadius={height / 3} 
          data={radarData}
        >
          <PolarGrid gridType="polygon" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]}
            tick={{ fill: theme.palette.text.secondary, fontSize: 10 }}
            axisLine={false}
          />
          
          {/* User's actual values */}
          <Radar
            name="Your Profile"
            dataKey="user"
            stroke={theme.palette.primary.main}
            fill={theme.palette.primary.main}
            fillOpacity={0.3}
          />
          
          {/* Optimal values */}
          <Radar
            name="Optimal Profile"
            dataKey="optimal"
            stroke={theme.palette.success.main}
            fill={theme.palette.success.main}
            fillOpacity={0.1}
            strokeDasharray="5 5"
          />
          
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RiskComparisonRadar;
