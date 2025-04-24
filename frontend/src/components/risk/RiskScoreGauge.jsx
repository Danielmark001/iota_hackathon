import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, useTheme, Tooltip } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';

/**
 * RiskScoreGauge component displays a semi-circular gauge visualization 
 * of a user's risk score, with color coding based on the risk level.
 * 
 * @param {Object} props - Component props
 * @param {number} props.score - Risk score (0-100)
 * @param {number} props.size - Size of the gauge in pixels
 * @param {boolean} props.showLabel - Whether to show the score label
 * @param {boolean} props.showTooltip - Whether to show an info tooltip
 * @param {string} props.tooltipText - Custom tooltip text
 */
const RiskScoreGauge = ({ 
  score = 50, 
  size = 200,
  showLabel = true,
  showTooltip = true,
  tooltipText = "This risk score is calculated using AI to analyze on-chain activity, transaction patterns, and lending behavior."
}) => {
  const theme = useTheme();
  const [animatedScore, setAnimatedScore] = useState(0);
  
  // Calculate dimensions based on size
  const radius = size / 2;
  const innerRadius = radius * 0.75;
  const thickness = radius - innerRadius;
  const centerX = radius;
  const centerY = radius;
  
  // Animation effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [score]);
  
  // Calculate angle based on score (0-100 maps to 0-180 degrees)
  const calculateAngle = (value) => {
    return Math.min(180, Math.max(0, (value / 100) * 180));
  };
  
  // Calculate coordinates on the arc for a given angle
  const getCoordinatesForAngle = (angle) => {
    // Convert angle to radians and adjust for the semi-circle starting position
    const radians = (angle - 180) * Math.PI / 180;
    
    const x = centerX + innerRadius * Math.cos(radians);
    const y = centerY + innerRadius * Math.sin(radians);
    
    return { x, y };
  };
  
  // Generate the SVG path for the gauge arc
  const generateGaugePath = (startAngle, endAngle) => {
    const start = getCoordinatesForAngle(startAngle);
    const end = getCoordinatesForAngle(endAngle);
    
    // Arc flags for SVG path
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    
    return `
      M ${start.x},${start.y}
      A ${innerRadius},${innerRadius} 0 ${largeArcFlag} 1 ${end.x},${end.y}
    `;
  };
  
  // Get color based on score
  const getColorForScore = (score) => {
    if (score < 20) return theme.palette.success.main; // Very Low Risk
    if (score < 40) return theme.palette.success.light; // Low Risk
    if (score < 60) return theme.palette.warning.main; // Medium Risk
    if (score < 80) return theme.palette.warning.dark; // High Risk
    return theme.palette.error.main; // Very High Risk
  };
  
  // Get risk label based on score
  const getRiskLabel = (score) => {
    if (score < 20) return 'Very Low Risk';
    if (score < 40) return 'Low Risk';
    if (score < 60) return 'Medium Risk';
    if (score < 80) return 'High Risk';
    return 'Very High Risk';
  };
  
  // Calculate the angle for the current score
  const angle = calculateAngle(animatedScore);
  
  // Generate ticks for the gauge
  const ticks = [];
  for (let i = 0; i <= 180; i += 30) {
    const tickCoordinates = getCoordinatesForAngle(i);
    const outerTickCoordinates = getCoordinatesForAngle(i);
    
    // Adjust outer tick position
    const radians = (i - 180) * Math.PI / 180;
    outerTickCoordinates.x = centerX + (innerRadius + thickness / 2) * Math.cos(radians);
    outerTickCoordinates.y = centerY + (innerRadius + thickness / 2) * Math.sin(radians);
    
    ticks.push(
      <line
        key={`tick-${i}`}
        x1={tickCoordinates.x}
        y1={tickCoordinates.y}
        x2={outerTickCoordinates.x}
        y2={outerTickCoordinates.y}
        stroke={theme.palette.grey[300]}
        strokeWidth={i % 60 === 0 ? 2 : 1}
      />
    );
    
    // Add labels for major ticks
    if (i % 60 === 0) {
      const labelCoordinates = getCoordinatesForAngle(i);
      const labelRadians = (i - 180) * Math.PI / 180;
      const labelDistance = innerRadius - 15;
      
      const labelX = centerX + labelDistance * Math.cos(labelRadians);
      const labelY = centerY + labelDistance * Math.sin(labelRadians);
      
      ticks.push(
        <text
          key={`label-${i}`}
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={theme.palette.text.secondary}
          fontSize="10"
        >
          {i / 180 * 100}
        </text>
      );
    }
  }
  
  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size / 2 + 30, // Add extra space for label
        margin: '0 auto',
      }}
    >
      <svg width={size} height={size / 2 + 10}>
        {/* Background track */}
        <path
          d={generateGaugePath(0, 180)}
          fill="none"
          stroke={theme.palette.grey[200]}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y1="0%">
            <stop offset="0%" stopColor={theme.palette.success.main} />
            <stop offset="40%" stopColor={theme.palette.success.light} />
            <stop offset="60%" stopColor={theme.palette.warning.main} />
            <stop offset="80%" stopColor={theme.palette.warning.dark} />
            <stop offset="100%" stopColor={theme.palette.error.main} />
          </linearGradient>
        </defs>
        
        {/* Ticks */}
        {ticks}
        
        {/* Colored track based on score */}
        <path
          d={generateGaugePath(0, angle)}
          fill="none"
          stroke={getColorForScore(animatedScore)}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        
        {/* Needle */}
        <line
          x1={centerX}
          y1={centerY}
          x2={getCoordinatesForAngle(angle).x}
          y2={getCoordinatesForAngle(angle).y}
          stroke={theme.palette.grey[800]}
          strokeWidth={2}
          strokeLinecap="round"
        />
        
        {/* Center point */}
        <circle
          cx={centerX}
          cy={centerY}
          r={thickness / 3}
          fill={theme.palette.grey[800]}
        />
        
        {/* Score text in the middle */}
        <text
          x={centerX}
          y={centerY + radius / 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={theme.palette.text.primary}
          fontSize={radius / 3}
          fontWeight="bold"
        >
          {Math.round(animatedScore)}
        </text>
      </svg>
      
      {/* Risk score label */}
      {showLabel && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          mt: 1 
        }}>
          <Typography 
            variant="subtitle1" 
            color="textPrimary" 
            fontWeight="medium"
            sx={{ 
              color: getColorForScore(animatedScore) 
            }}
          >
            Risk Score: {Math.round(animatedScore)} - {getRiskLabel(animatedScore)}
          </Typography>
          
          {showTooltip && (
            <Tooltip title={tooltipText} arrow placement="top">
              <InfoOutlined 
                sx={{ 
                  ml: 1, 
                  color: theme.palette.text.secondary,
                  fontSize: 18,
                  cursor: 'help'
                }} 
              />
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
};

RiskScoreGauge.propTypes = {
  score: PropTypes.number,
  size: PropTypes.number,
  showLabel: PropTypes.bool,
  showTooltip: PropTypes.bool,
  tooltipText: PropTypes.string
};

export default RiskScoreGauge;
