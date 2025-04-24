import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useWeb3 } from './useWeb3';
import { API_BASE_URL } from '../config';

/**
 * Custom hook for fetching and managing risk assessment data
 * 
 * @param {string} address - The wallet address to get risk assessment for
 * @param {boolean} autoFetch - Whether to fetch data automatically on mount
 * @returns {Object} Risk assessment data and control functions
 */
export const useRiskAssessment = (address, autoFetch = true) => {
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { connected, web3 } = useWeb3();
  
  /**
   * Fetch risk assessment data from the API
   */
  const fetchRiskAssessment = useCallback(async () => {
    if (!address) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_BASE_URL}/api/risk/${address}`);
      
      if (response.data && response.data.success) {
        setRiskAssessment(response.data.data);
      } else {
        setError(response.data?.error || 'Failed to fetch risk assessment');
      }
    } catch (err) {
      console.error('Error fetching risk assessment:', err);
      setError(
        err.response?.data?.error || 
        err.message || 
        'An error occurred while fetching risk assessment'
      );
    } finally {
      setLoading(false);
    }
  }, [address]);
  
  /**
   * Fetch detailed risk analysis from the API
   * @returns {Promise<Object>} Detailed risk analysis data
   */
  const fetchDetailedAnalysis = useCallback(async () => {
    if (!address) return null;
    
    try {
      setLoading(true);
      
      const response = await axios.get(`${API_BASE_URL}/api/risk/${address}/detailed`);
      
      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data?.error || 'Failed to fetch detailed analysis');
      }
    } catch (err) {
      console.error('Error fetching detailed risk analysis:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address]);
  
  /**
   * Fetch risk score history from the API
   * @param {number} days - Number of days of history to fetch
   * @returns {Promise<Array>} Risk score history data
   */
  const fetchRiskHistory = useCallback(async (days = 30) => {
    if (!address) return [];
    
    try {
      setLoading(true);
      
      const response = await axios.get(
        `${API_BASE_URL}/api/risk/${address}/history?days=${days}`
      );
      
      if (response.data && response.data.success) {
        return response.data.data.history || [];
      } else {
        throw new Error(response.data?.error || 'Failed to fetch risk history');
      }
    } catch (err) {
      console.error('Error fetching risk history:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address]);
  
  /**
   * Fetch risk recommendations from the API
   * @returns {Promise<Array>} Risk recommendations data
   */
  const fetchRecommendations = useCallback(async () => {
    if (!address) return [];
    
    try {
      setLoading(true);
      
      const response = await axios.get(
        `${API_BASE_URL}/api/risk/${address}/recommendations`
      );
      
      if (response.data && response.data.success) {
        return response.data.data.recommendations || [];
      } else {
        throw new Error(response.data?.error || 'Failed to fetch recommendations');
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address]);
  
  /**
   * Trigger a manual refresh of the risk assessment
   */
  const refetch = useCallback(() => {
    fetchRiskAssessment();
  }, [fetchRiskAssessment]);
  
  // Fetch risk assessment on mount and address change
  useEffect(() => {
    if (autoFetch && address) {
      fetchRiskAssessment();
    }
  }, [autoFetch, address, fetchRiskAssessment]);
  
  return {
    riskAssessment,
    loading,
    error,
    refetch,
    fetchDetailedAnalysis,
    fetchRiskHistory,
    fetchRecommendations
  };
};
