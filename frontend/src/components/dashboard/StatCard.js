import React from 'react';
import { Card, CardContent, Typography, Box, Skeleton, Tooltip } from '@mui/material';
import { Info } from '@mui/icons-material';

const StatCard = ({
  title,
  value,
  secondaryValue,
  icon,
  tooltip,
  loading = false,
  gradient = false,
  gradientType = 'primary',
}) => {
  const cardClass = gradient ? `gradient-card-${gradientType}` : '';
  
  return (
    <Card 
      className={cardClass}
      elevation={gradient ? 3 : 1}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2" color={gradient ? 'inherit' : 'text.secondary'} sx={{ display: 'flex', alignItems: 'center' }}>
            {title}
            {tooltip && (
              <Tooltip title={tooltip} placement="top">
                <Info fontSize="small" sx={{ ml: 0.5, opacity: 0.7 }} />
              </Tooltip>
            )}
          </Typography>
          {icon && (
            <Box 
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8,
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
        
        {loading ? (
          <>
            <Skeleton variant="text" width="80%" height={40} className="loading-pulse" />
            {secondaryValue && <Skeleton variant="text" width="50%" height={20} className="loading-pulse" />}
          </>
        ) : (
          <>
            <Typography variant="h4" component="div" fontWeight="500">
              {value}
            </Typography>
            {secondaryValue && (
              <Typography variant="body2" color={gradient ? 'inherit' : 'text.secondary'} sx={{ opacity: 0.8, mt: 0.5 }}>
                {secondaryValue}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;
