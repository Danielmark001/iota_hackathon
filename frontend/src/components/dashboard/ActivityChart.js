import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, ButtonGroup, Button, Skeleton } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ActivityChart = ({ data, loading = false }) => {
  const [timeframe, setTimeframe] = useState('1W'); // Default to 1 week
  const [chartData, setChartData] = useState(null);
  
  // Process chart data based on selected timeframe
  useEffect(() => {
    if (loading || !data) return;
    
    // Determine how many data points to show based on timeframe
    let dataPoints;
    switch (timeframe) {
      case '1D':
        dataPoints = 24; // 24 hours
        break;
      case '1W':
        dataPoints = 7; // 7 days
        break;
      case '1M':
        dataPoints = 30; // 30 days
        break;
      case '3M':
        dataPoints = 90; // 90 days
        break;
      default:
        dataPoints = 7;
    }
    
    // Slice data to get the desired number of points
    // In a real app, we'd request the appropriate data from the API
    const slicedData = {
      labels: data.labels.slice(-dataPoints),
      datasets: data.datasets.map(dataset => ({
        ...dataset,
        data: dataset.data.slice(-dataPoints)
      }))
    };
    
    setChartData(slicedData);
  }, [timeframe, data, loading]);
  
  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          boxWidth: 6,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        grid: {
          drawBorder: false,
        },
      },
      y2: {
        position: 'right',
        grid: {
          display: false,
        },
        ticks: {
          callback: (value) => `${value}`,
        }
      },
    },
    elements: {
      line: {
        tension: 0.4, // Smooth lines
      },
      point: {
        radius: 2, // Small points
        hoverRadius: 4, // Larger on hover
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
  };
  
  return (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        height: '100%',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Portfolio Activity</Typography>
        <ButtonGroup variant="outlined" size="small">
          {['1D', '1W', '1M', '3M'].map((period) => (
            <Button
              key={period}
              onClick={() => setTimeframe(period)}
              variant={timeframe === period ? 'contained' : 'outlined'}
              sx={{ py: 0.5 }}
            >
              {period}
            </Button>
          ))}
        </ButtonGroup>
      </Box>
      
      <Box sx={{ flexGrow: 1, minHeight: 300 }}>
        {loading ? (
          <Skeleton variant="rectangular" width="100%" height="100%" animation="wave" />
        ) : chartData ? (
          <Line options={options} data={chartData} />
        ) : (
          <Box
            sx={{
              display: 'flex',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body1" color="text.secondary">
              No data available
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default ActivityChart;
