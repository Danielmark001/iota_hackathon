import React from 'react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  Cell,
  ResponsiveContainer 
} from 'recharts';
import { Box, Typography, Paper, Grid, useTheme, alpha } from '@mui/material';

const FactorImpactHeatmap = ({ factors, height = 400 }) => {
  const theme = useTheme();

  // Prepare data for the heatmap
  const prepareData = (factors) => {
    // Sort factors by impact (highest to lowest)
    const sortedFactors = [...factors].sort((a, b) => b.impact - a.impact);
    
    // Create data points for the scatter plot
    // We'll use a grid where:
    // - x-axis: factor contribution (positive/negative)
    // - y-axis: factor categories in order of impact
    // - z-axis (color): impact value
    return sortedFactors.map((factor, index) => ({
      name: factor.name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      x: factor.contribution,
      y: sortedFactors.length - index, // Reverse index for y-axis ordering
      z: factor.impact,
      description: factor.description,
      details: factor.details,
      contribution: factor.contribution
    }));
  };

  const data = prepareData(factors);

  // Custom tooltip to show detailed information
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const factor = payload[0].payload;
      return (
        <Paper 
          elevation={3} 
          sx={{ 
            p: 2, 
            maxWidth: 300,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {factor.name}
          </Typography>
          <Typography variant="body2" paragraph>
            {factor.description}
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Impact:
              </Typography>
              <Typography 
                variant="body2" 
                fontWeight="medium"
              >
                {(factor.z * 100).toFixed(0)}%
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Contribution:
              </Typography>
              <Typography 
                variant="body2" 
                fontWeight="medium"
                color={factor.contribution > 0 ? 'error.main' : 'success.main'}
              >
                {factor.contribution > 0 ? '+' : ''}{factor.contribution} pts
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      );
    }
    return null;
  };

  // Function to determine circle color based on contribution
  const getColor = (contribution, impact) => {
    if (contribution > 0) {
      // Risk-increasing factors (bad)
      return alpha(theme.palette.error.main, 0.3 + impact * 0.7);
    } else {
      // Risk-decreasing factors (good)
      return alpha(theme.palette.success.main, 0.3 + impact * 0.7);
    }
  };

  // Calculate axis domains with some padding
  const minContribution = Math.min(...data.map(d => d.x));
  const maxContribution = Math.max(...data.map(d => d.x));
  const contributionPadding = Math.max(5, Math.abs(minContribution) * 0.2, Math.abs(maxContribution) * 0.2);
  const xDomain = [
    Math.floor(minContribution - contributionPadding),
    Math.ceil(maxContribution + contributionPadding)
  ];

  // Calculate maximum impact for scaling circle size
  const maxImpact = Math.max(...data.map(d => d.z));

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ScatterChart
          margin={{
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={alpha(theme.palette.divider, 0.7)} 
          />
          <XAxis 
            type="number" 
            dataKey="x" 
            name="Contribution" 
            domain={xDomain}
            label={{ 
              value: 'Risk Contribution (points)', 
              position: 'bottom',
              style: { fill: theme.palette.text.secondary }
            }}
            stroke={theme.palette.text.secondary}
          />
          <YAxis 
            type="number"
            dataKey="y" 
            name="Factor"
            tickCount={data.length}
            tick={props => {
              const { x, y, payload } = props;
              const index = data.length - payload.value;
              const label = index >= 0 && index < data.length ? data[index].name : '';
              
              return (
                <text 
                  x={x} 
                  y={y} 
                  dy={3} 
                  textAnchor="end" 
                  fill={theme.palette.text.secondary}
                  fontSize={12}
                >
                  {label}
                </text>
              );
            }}
            axisLine={false}
            domain={[0, data.length + 1]}
          />
          <ZAxis 
            type="number" 
            dataKey="z" 
            range={[40, 100]} 
            name="Impact" 
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            payload={[
              { 
                value: 'Increases Risk', 
                type: 'circle', 
                color: theme.palette.error.main 
              },
              { 
                value: 'Decreases Risk', 
                type: 'circle', 
                color: theme.palette.success.main 
              }
            ]}
          />
          <Scatter name="Risk Factors" data={data}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={getColor(entry.contribution, entry.z / maxImpact)}
                stroke={entry.contribution > 0 ? theme.palette.error.main : theme.palette.success.main}
                strokeWidth={1}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default FactorImpactHeatmap;
