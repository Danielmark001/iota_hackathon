import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  useTheme
} from '@mui/material';
import {
  ResponsiveContainer,
  Treemap,
  Tooltip as RechartsTooltip
} from 'recharts';

const FactorImpactHeatmap = ({ factors, height = 400 }) => {
  const theme = useTheme();
  const [displayMode, setDisplayMode] = useState('contribution'); // 'contribution' or 'impact'
  const [treeMapData, setTreeMapData] = useState({ name: 'Risk Factors', children: [] });
  
  // Process factors data when it changes or display mode changes
  useEffect(() => {
    if (!factors || factors.length === 0) {
      setTreeMapData({ name: 'Risk Factors', children: [] });
      return;
    }
    
    // Map factors to treemap format
    const children = factors.map(factor => {
      // Format factor name
      const name = factor.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      
      // Get value based on display mode
      let value;
      if (displayMode === 'contribution') {
        // For contribution, we use the absolute value for size but keep track of type
        value = Math.abs(factor.contribution);
      } else {
        // For impact, we use the impact percentage
        value = factor.impact * 100;
      }
      
      return {
        name,
        value,
        contribution: factor.contribution,
        impact: factor.impact * 100,
        description: factor.description,
        // Type determines color: positive (green) or negative (red)
        type: factor.contribution < 0 ? 'positive' : 'negative'
      };
    });
    
    // Sort by value (highest first)
    children.sort((a, b) => b.value - a.value);
    
    // Set treemap data
    setTreeMapData({
      name: 'Risk Factors',
      children
    });
  }, [factors, displayMode]);
  
  // Handle display mode change
  const handleDisplayModeChange = (event) => {
    setDisplayMode(event.target.value);
  };
  
  // Get color based on factor type and value
  const getColor = (data) => {
    if (!data) return theme.palette.grey[300];
    
    const { type, value } = data;
    
    if (displayMode === 'contribution') {
      // For contribution display mode
      if (type === 'positive') {
        // Green scale for positive factors
        const intensity = Math.min(1, value / 20); // Scale up to 20 points
        return theme.palette.success[intensity < 0.5 ? 200 : intensity < 0.7 ? 400 : intensity < 0.9 ? 600 : 800];
      } else {
        // Red scale for negative factors
        const intensity = Math.min(1, value / 20); // Scale up to 20 points
        return theme.palette.error[intensity < 0.5 ? 200 : intensity < 0.7 ? 400 : intensity < 0.9 ? 600 : 800];
      }
    } else {
      // For impact display mode (neutral scale)
      const intensity = Math.min(1, value / 40); // Scale up to 40% impact
      return theme.palette.primary[intensity < 0.3 ? 100 : intensity < 0.5 ? 200 : intensity < 0.7 ? 400 : intensity < 0.9 ? 600 : 800];
    }
  };
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      
      return (
        <Paper sx={{ p: 1.5, maxWidth: 250 }}>
          <Typography variant="subtitle2">{data.name}</Typography>
          
          {displayMode === 'contribution' ? (
            <>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: data.type === 'positive' ? theme.palette.success.main : theme.palette.error.main,
                  fontWeight: 'medium',
                  mt: 0.5
                }}
              >
                Contribution: {data.type === 'positive' ? '-' : '+'}{Math.abs(data.contribution)} points
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Impact: {data.impact.toFixed(0)}% of risk score
              </Typography>
            </>
          ) : (
            <>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: theme.palette.primary.main,
                  fontWeight: 'medium',
                  mt: 0.5
                }}
              >
                Impact: {data.impact.toFixed(0)}% of risk score
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Contribution: {data.type === 'positive' ? '-' : '+'}{Math.abs(data.contribution)} points
              </Typography>
            </>
          )}
          
          {data.description && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {data.description}
            </Typography>
          )}
        </Paper>
      );
    }
    return null;
  };
  
  // If no factors data
  if (!factors || factors.length === 0) {
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
    <Box sx={{ height, width: '100%' }}>
      {/* Display mode selector */}
      <Box sx={{ mb: 2 }}>
        <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="display-mode-label">Display Mode</InputLabel>
          <Select
            labelId="display-mode-label"
            id="display-mode"
            value={displayMode}
            onChange={handleDisplayModeChange}
            label="Display Mode"
          >
            <MenuItem value="contribution">Contribution to Risk Score</MenuItem>
            <MenuItem value="impact">Impact Weight</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      {/* Legend */}
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {displayMode === 'contribution' ? (
          <>
            <Grid item>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ 
                  width: 16, 
                  height: 16, 
                  bgcolor: theme.palette.success.main,
                  mr: 0.5,
                  borderRadius: 0.5
                }} />
                <Typography variant="caption">
                  Positive Factors (Decrease Risk)
                </Typography>
              </Box>
            </Grid>
            <Grid item>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ 
                  width: 16, 
                  height: 16, 
                  bgcolor: theme.palette.error.main,
                  mr: 0.5,
                  borderRadius: 0.5
                }} />
                <Typography variant="caption">
                  Negative Factors (Increase Risk)
                </Typography>
              </Box>
            </Grid>
          </>
        ) : (
          <Grid item>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ 
                width: 16, 
                height: 16, 
                bgcolor: theme.palette.primary.main,
                mr: 0.5,
                borderRadius: 0.5
              }} />
              <Typography variant="caption">
                Factor Importance in Risk Model
              </Typography>
            </Box>
          </Grid>
        )}
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">
            Size indicates {displayMode === 'contribution' ? 'absolute contribution magnitude' : 'relative impact weight'}
          </Typography>
        </Grid>
      </Grid>
      
      {/* Treemap visualization */}
      <ResponsiveContainer width="100%" height={height - 100}>
        <Treemap
          data={treeMapData}
          dataKey="value"
          stroke={theme.palette.background.paper}
          fill={theme.palette.primary.main}
          content={({ root, depth, x, y, width, height, index, payload, colors, rank, name }) => {
            return (
              <g>
                {root.children && root.children.map((node, i) => {
                  const nodeWidth = node.x1 - node.x0;
                  const nodeHeight = node.y1 - node.y0;
                  
                  // Only render if the node is big enough
                  if (nodeWidth < 1 || nodeHeight < 1) return null;
                  
                  return (
                    <g key={`node-${i}`}>
                      <rect
                        x={node.x0}
                        y={node.y0}
                        width={nodeWidth}
                        height={nodeHeight}
                        fill={getColor(node)}
                        stroke={theme.palette.background.paper}
                      />
                      {/* Only render text if node is big enough */}
                      {nodeWidth > 30 && nodeHeight > 30 && (
                        <text
                          x={node.x0 + nodeWidth / 2}
                          y={node.y0 + nodeHeight / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{
                            fontSize: '0.8rem',
                            fontFamily: theme.typography.fontFamily,
                            fill: theme.palette.getContrastText(getColor(node)),
                            pointerEvents: 'none'
                          }}
                        >
                          {node.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          }}
        >
          <RechartsTooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </Box>
  );
};

export default FactorImpactHeatmap;
