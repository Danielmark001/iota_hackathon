"""
Correlation Analyzer Module

This module analyzes correlations between market conditions (price, volatility, sentiment)
and loan performance metrics to identify leading indicators of credit risk.
"""

import os
import logging
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.tsa.stattools import grangercausalitytests
from scipy.stats import pearsonr, spearmanr
from typing import Dict, List, Optional, Any
import matplotlib.pyplot as plt
import seaborn as sns
import json
import pickle
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CorrelationAnalyzer:
    """
    Analyzes relationships between market conditions and loan performance
    to identify leading indicators and risk factors.
    """
    
    def __init__(
        self,
        config: Dict[str, Any] = None,
        cache_dir: str = "./cache/correlation"
    ):
        """
        Initialize the correlation analyzer
        
        Args:
            config: Configuration dictionary
            cache_dir: Directory to cache analysis results
        """
        self.config = config or {}
        self.cache_dir = cache_dir
        
        # Create cache directory if it doesn't exist
        os.makedirs(cache_dir, exist_ok=True)
        os.makedirs(os.path.join(cache_dir, 'figures'), exist_ok=True)
        
        # Set analysis parameters
        self.min_correlation_threshold = self.config.get("min_correlation_threshold", 0.3)
        self.metrics = self.config.get("metrics", ["price", "volume", "volatility", "sentiment"])
        self.loan_metrics = self.config.get("loan_metrics", [
            "utilization_rate", "default_rate", "liquidation_rate", "avg_health_factor"
        ])
        self.lookback_days = self.config.get("loan_data_lookback_days", 90)
        self.lag_days = self.config.get("lag_days", 30)
        
        logger.info(f"Initialized CorrelationAnalyzer with {len(self.metrics)} market metrics and {len(self.loan_metrics)} loan metrics")
    
    async def analyze_correlations(
        self,
        market_condition_data: Dict[str, Dict[str, pd.DataFrame]],
        loan_performance_data: pd.DataFrame,
        lookback_days: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Analyze correlations between market conditions and loan performance
        
        Args:
            market_condition_data: Dictionary with market data for different assets
                Format: {asset: {metric: DataFrame}}
            loan_performance_data: DataFrame with loan performance metrics
            lookback_days: Number of days to look back
            
        Returns:
            Dictionary with correlation analysis results
        """
        if lookback_days is None:
            lookback_days = self.lookback_days
        
        logger.info(f"Analyzing correlations with {lookback_days} days lookback")
        
        # Prepare market and loan data
        market_df = self._prepare_market_data(market_condition_data)
        loan_df = loan_performance_data.copy()
        
        # Ensure data is properly aligned
        combined_df = self._align_data(market_df, loan_df)
        
        # Calculate correlations
        correlations = self._calculate_correlations(combined_df)
        
        # Identify leading indicators using Granger causality
        leading_indicators = self._identify_leading_indicators(combined_df)
        
        # Create predictive models for loan metrics
        model_results = self._create_predictive_models(combined_df)
        
        # Generate visualizations
        visualization_paths = await self._generate_visualizations(combined_df, correlations)
        
        # Prepare analysis results
        result = {
            "timestamp": datetime.now().isoformat(),
            "lookback_days": lookback_days,
            "correlations": correlations,
            "leading_indicators": leading_indicators,
            "model_results": model_results,
            "visualization_paths": visualization_paths,
            "insights": self._generate_insights(correlations, leading_indicators, model_results),
            "recommendations": self._generate_recommendations(correlations, leading_indicators, model_results)
        }
        
        # Cache results
        self._cache_results(result)
        
        return result
    
    def _prepare_market_data(self, market_condition_data: Dict[str, Dict[str, pd.DataFrame]]) -> pd.DataFrame:
        """
        Prepare market data for correlation analysis
        
        Args:
            market_condition_data: Dictionary with market data
            
        Returns:
            DataFrame with combined market data
        """
        # Create empty DataFrames for each metric
        combined_data = {}
        
        # For each asset and metric
        for asset, metrics in market_condition_data.items():
            for metric_name, metric_df in metrics.items():
                if metric_name not in self.metrics:
                    continue
                
                # Resample to daily frequency if needed
                if metric_df.index.inferred_freq != 'D':
                    resampled_df = metric_df.resample('D').mean()
                else:
                    resampled_df = metric_df
                
                # Create column name
                column_name = f"{asset}_{metric_name}"
                
                # Extract values (depends on the metric)
                if metric_name == "price":
                    values = resampled_df["price"]
                elif metric_name == "volume":
                    values = resampled_df["volume"]
                elif metric_name == "volatility":
                    values = resampled_df["volatility"]
                elif metric_name == "sentiment":
                    values = resampled_df["sentiment"]
                else:
                    logger.warning(f"Unknown metric: {metric_name}")
                    continue
                
                # Add to combined data
                combined_data[column_name] = values
        
        # Create DataFrame from combined data
        df = pd.DataFrame(combined_data)
        
        # Add lags for all columns
        for col in df.columns:
            for lag in range(1, self.lag_days + 1):
                df[f"{col}_lag{lag}"] = df[col].shift(lag)
        
        # Drop NaN values
        df.dropna(inplace=True)
        
        return df
    
    def _align_data(self, market_df: pd.DataFrame, loan_df: pd.DataFrame) -> pd.DataFrame:
        """
        Align market and loan data for correlation analysis
        
        Args:
            market_df: DataFrame with market data
            loan_df: DataFrame with loan performance data
            
        Returns:
            DataFrame with aligned data
        """
        # Ensure both DataFrames have compatible indices
        common_dates = market_df.index.intersection(loan_df.index)
        
        # Filter both DataFrames to only include common dates
        filtered_market_df = market_df.loc[common_dates]
        filtered_loan_df = loan_df.loc[common_dates]
        
        # Combine DataFrames
        combined_df = pd.concat([filtered_market_df, filtered_loan_df], axis=1)
        
        return combined_df
    
    def _calculate_correlations(self, combined_df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
        """
        Calculate correlations between market conditions and loan performance
        
        Args:
            combined_df: DataFrame with combined market and loan data
            
        Returns:
            Dictionary with correlation coefficients
        """
        # Identify loan metric columns
        loan_columns = [col for col in combined_df.columns if col in self.loan_metrics]
        
        # Identify market metric columns (excluding lagged variables for now)
        market_columns = [
            col for col in combined_df.columns 
            if not col in loan_columns and not "_lag" in col
        ]
        
        # Calculate correlations
        correlations = {}
        for loan_metric in loan_columns:
            correlations[loan_metric] = {}
            
            for market_metric in market_columns:
                # Calculate Pearson correlation
                pearson_corr, p_value = pearsonr(combined_df[market_metric], combined_df[loan_metric])
                
                # Calculate Spearman rank correlation
                spearman_corr, spearman_p = spearmanr(combined_df[market_metric], combined_df[loan_metric])
                
                # Store results
                correlations[loan_metric][market_metric] = {
                    "pearson": pearson_corr,
                    "pearson_p_value": p_value,
                    "spearman": spearman_corr,
                    "spearman_p_value": spearman_p,
                    "is_significant": p_value < 0.05 and abs(pearson_corr) >= self.min_correlation_threshold
                }
                
            # Calculate correlations with lagged variables
            for market_metric in market_columns:
                for lag in range(1, self.lag_days + 1):
                    lagged_col = f"{market_metric}_lag{lag}"
                    
                    # Skip if column doesn't exist
                    if lagged_col not in combined_df.columns:
                        continue
                    
                    # Calculate Pearson correlation
                    pearson_corr, p_value = pearsonr(combined_df[lagged_col], combined_df[loan_metric])
                    
                    # Calculate Spearman rank correlation
                    spearman_corr, spearman_p = spearmanr(combined_df[lagged_col], combined_df[loan_metric])
                    
                    # Store results
                    correlations[loan_metric][lagged_col] = {
                        "pearson": pearson_corr,
                        "pearson_p_value": p_value,
                        "spearman": spearman_corr,
                        "spearman_p_value": spearman_p,
                        "is_significant": p_value < 0.05 and abs(pearson_corr) >= self.min_correlation_threshold
                    }
        
        return correlations
    
    def _identify_leading_indicators(self, combined_df: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
        """
        Identify leading indicators using Granger causality tests
        
        Args:
            combined_df: DataFrame with combined market and loan data
            
        Returns:
            Dictionary with leading indicators for each loan metric
        """
        # Identify loan metric columns
        loan_columns = [col for col in combined_df.columns if col in self.loan_metrics]
        
        # Identify market metric columns (excluding lagged variables)
        market_columns = [
            col for col in combined_df.columns 
            if not col in loan_columns and not "_lag" in col
        ]
        
        # Maximum lag to test
        max_lag = min(12, len(combined_df) // 4)  # Avoid using too many lags for small datasets
        
        # Results dictionary
        leading_indicators = {}
        
        # For each loan metric
        for loan_metric in loan_columns:
            leading_indicators[loan_metric] = []
            
            for market_metric in market_columns:
                # Prepare data for Granger causality test
                data = pd.DataFrame({
                    'market_metric': combined_df[market_metric],
                    'loan_metric': combined_df[loan_metric]
                })
                
                # Run Granger causality test
                try:
                    result = grangercausalitytests(data, maxlag=max_lag, verbose=False)
                    
                    # Find the lag with the lowest p-value
                    best_lag = None
                    min_p_value = 1.0
                    
                    for lag, test_results in result.items():
                        p_value = test_results[0]['ssr_ftest'][1]  # p-value from F-test
                        
                        if p_value < min_p_value:
                            min_p_value = p_value
                            best_lag = lag
                    
                    # Check if significant
                    if min_p_value < 0.05:
                        leading_indicators[loan_metric].append({
                            "market_metric": market_metric,
                            "optimal_lag": best_lag,
                            "p_value": min_p_value,
                            "f_statistic": result[best_lag][0]['ssr_ftest'][0]
                        })
                except Exception as e:
                    logger.warning(f"Error in Granger causality test for {market_metric} -> {loan_metric}: {e}")
            
            # Sort by p-value
            leading_indicators[loan_metric].sort(key=lambda x: x["p_value"])
        
        return leading_indicators
    
    def _create_predictive_models(self, combined_df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
        """
        Create predictive models for loan metrics based on market conditions
        
        Args:
            combined_df: DataFrame with combined market and loan data
            
        Returns:
            Dictionary with model results
        """
        # Identify loan metric columns
        loan_columns = [col for col in combined_df.columns if col in self.loan_metrics]
        
        # Identify market metric columns (including lagged variables)
        market_columns = [
            col for col in combined_df.columns 
            if not col in loan_columns
        ]
        
        # Split data into train and test
        train_size = int(len(combined_df) * 0.8)
        train_df = combined_df.iloc[:train_size]
        test_df = combined_df.iloc[train_size:]
        
        # Results dictionary
        model_results = {}
        
        # For each loan metric
        for loan_metric in loan_columns:
            # Prepare features and target
            X_train = train_df[market_columns]
            y_train = train_df[loan_metric]
            
            X_test = test_df[market_columns]
            y_test = test_df[loan_metric]
            
            # Train Random Forest model
            model = RandomForestRegressor(n_estimators=100, random_state=42)
            model.fit(X_train, y_train)
            
            # Make predictions
            y_pred = model.predict(X_test)
            
            # Calculate metrics
            mse = mean_squared_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            # Get feature importance
            feature_importance = dict(zip(market_columns, model.feature_importances_))
            
            # Sort feature importance
            sorted_features = sorted(
                feature_importance.items(), 
                key=lambda x: x[1], 
                reverse=True
            )
            
            # Store results
            model_results[loan_metric] = {
                "model_type": "RandomForest",
                "mse": mse,
                "r2": r2,
                "feature_importance": dict(sorted_features[:10]),  # Top 10 features
                "model_path": self._save_model(model, loan_metric)
            }
        
        return model_results
    
    def _save_model(self, model, loan_metric: str) -> str:
        """
        Save predictive model to file
        
        Args:
            model: Trained model
            loan_metric: Loan metric name
            
        Returns:
            Path to saved model
        """
        # Create model path
        model_path = os.path.join(self.cache_dir, f"{loan_metric}_model.pkl")
        
        # Save model
        with open(model_path, 'wb') as f:
            pickle.dump(model, f)
        
        return model_path
    
    async def _generate_visualizations(
        self, 
        combined_df: pd.DataFrame,
        correlations: Dict[str, Dict[str, Dict[str, float]]]
    ) -> Dict[str, str]:
        """
        Generate visualizations for correlation analysis
        
        Args:
            combined_df: DataFrame with combined market and loan data
            correlations: Dictionary with correlation coefficients
            
        Returns:
            Dictionary with paths to visualization files
        """
        visualization_paths = {}
        
        # Identify loan metric columns
        loan_columns = [col for col in combined_df.columns if col in self.loan_metrics]
        
        # Identify market metric columns (excluding lagged variables)
        market_columns = [
            col for col in combined_df.columns 
            if not col in loan_columns and not "_lag" in col
        ]
        
        # 1. Correlation heatmap
        try:
            plt.figure(figsize=(12, 10))
            
            # Calculate correlation matrix
            corr_matrix = combined_df[market_columns + loan_columns].corr()
            
            # Create mask for upper triangle
            mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
            
            # Plot heatmap
            sns.heatmap(
                corr_matrix, 
                mask=mask,
                annot=True, 
                fmt=".2f", 
                cmap='coolwarm', 
                vmin=-1, 
                vmax=1,
                square=True,
                linewidths=0.5
            )
            
            plt.title('Correlation Heatmap: Market Conditions vs Loan Performance')
            plt.tight_layout()
            
            # Save figure
            heatmap_path = os.path.join(self.cache_dir, 'figures', 'correlation_heatmap.png')
            plt.savefig(heatmap_path)
            plt.close()
            
            visualization_paths['heatmap'] = heatmap_path
        except Exception as e:
            logger.error(f"Error generating heatmap: {e}")
        
        # 2. Scatter plots for significant correlations
        for loan_metric in loan_columns:
            for market_metric, corr_data in correlations[loan_metric].items():
                if corr_data["is_significant"] and "_lag" not in market_metric:
                    try:
                        plt.figure(figsize=(10, 6))
                        
                        # Create scatter plot
                        sns.regplot(
                            x=market_metric, 
                            y=loan_metric, 
                            data=combined_df,
                            scatter_kws={'alpha': 0.5}
                        )
                        
                        plt.title(f'Relationship between {market_metric} and {loan_metric}')
                        plt.xlabel(market_metric)
                        plt.ylabel(loan_metric)
                        
                        # Add correlation coefficient to plot
                        plt.annotate(
                            f"Pearson r: {corr_data['pearson']:.2f} (p={corr_data['pearson_p_value']:.3f})\n"
                            f"Spearman r: {corr_data['spearman']:.2f} (p={corr_data['spearman_p_value']:.3f})",
                            xy=(0.05, 0.95),
                            xycoords='axes fraction',
                            bbox=dict(boxstyle="round,pad=0.3", fc="white", alpha=0.8)
                        )
                        
                        plt.tight_layout()
                        
                        # Save figure
                        scatter_path = os.path.join(
                            self.cache_dir, 
                            'figures', 
                            f'scatter_{market_metric}_{loan_metric}.png'
                        )
                        plt.savefig(scatter_path)
                        plt.close()
                        
                        visualization_paths[f'scatter_{market_metric}_{loan_metric}'] = scatter_path
                    except Exception as e:
                        logger.error(f"Error generating scatter plot for {market_metric} vs {loan_metric}: {e}")
        
        # 3. Time series plots for leading indicators
        for loan_metric in loan_columns:
            for market_metric in market_columns:
                try:
                    plt.figure(figsize=(12, 6))
                    
                    # Create time series plot
                    plt.plot(combined_df.index, combined_df[market_metric], label=market_metric)
                    plt.plot(combined_df.index, combined_df[loan_metric], label=loan_metric)
                    
                    plt.title(f'Time Series: {market_metric} vs {loan_metric}')
                    plt.legend()
                    plt.xticks(rotation=45)
                    plt.tight_layout()
                    
                    # Save figure
                    timeseries_path = os.path.join(
                        self.cache_dir, 
                        'figures', 
                        f'timeseries_{market_metric}_{loan_metric}.png'
                    )
                    plt.savefig(timeseries_path)
                    plt.close()
                    
                    visualization_paths[f'timeseries_{market_metric}_{loan_metric}'] = timeseries_path
                except Exception as e:
                    logger.error(f"Error generating time series plot for {market_metric} vs {loan_metric}: {e}")
        
        return visualization_paths
    
    def _generate_insights(
        self,
        correlations: Dict[str, Dict[str, Dict[str, float]]],
        leading_indicators: Dict[str, List[Dict[str, Any]]],
        model_results: Dict[str, Dict[str, Any]]
    ) -> List[str]:
        """
        Generate human-readable insights from correlation analysis
        
        Args:
            correlations: Dictionary with correlation coefficients
            leading_indicators: Dictionary with leading indicators
            model_results: Dictionary with model results
            
        Returns:
            List of insight statements
        """
        insights = []
        
        # 1. Identify strongest correlations
        for loan_metric, correlations_dict in correlations.items():
            # Sort by absolute correlation
            sorted_correlations = sorted(
                [(metric, data) for metric, data in correlations_dict.items() if "_lag" not in metric],
                key=lambda x: abs(x[1]["pearson"]),
                reverse=True
            )
            
            if sorted_correlations:
                top_metric, top_data = sorted_correlations[0]
                corr_value = top_data["pearson"]
                
                insight = f"The strongest correlation with {loan_metric} is {top_metric} (r={corr_value:.2f}), "
                
                if corr_value > 0:
                    insight += f"suggesting that increased {top_metric} is associated with higher {loan_metric}."
                else:
                    insight += f"suggesting that increased {top_metric} is associated with lower {loan_metric}."
                
                insights.append(insight)
        
        # 2. Highlight leading indicators
        for loan_metric, indicators in leading_indicators.items():
            if indicators:
                top_indicator = indicators[0]
                
                insight = (
                    f"{top_indicator['market_metric']} is a leading indicator for {loan_metric} "
                    f"with optimal lag of {top_indicator['optimal_lag']} days "
                    f"(p-value: {top_indicator['p_value']:.3f})."
                )
                
                insights.append(insight)
        
        # 3. Summarize predictive models
        for loan_metric, result in model_results.items():
            insight = (
                f"The predictive model for {loan_metric} achieved an R² of {result['r2']:.2f}, "
                f"with the most important factors being: "
            )
            
            # Add top 3 features
            top_features = list(result["feature_importance"].items())[:3]
            feature_texts = [f"{feature} ({importance:.3f})" for feature, importance in top_features]
            
            insight += ", ".join(feature_texts) + "."
            
            insights.append(insight)
        
        # 4. Identify any unusual correlations or patterns
        unusual_correlations = []
        
        for loan_metric, correlations_dict in correlations.items():
            for metric, data in correlations_dict.items():
                # Check if there's a significant difference between Pearson and Spearman
                pearson_diff = abs(data["pearson"] - data["spearman"])
                
                if pearson_diff > 0.3 and data["is_significant"]:
                    unusual_correlations.append((loan_metric, metric, pearson_diff))
        
        if unusual_correlations:
            unusual_correlations.sort(key=lambda x: x[2], reverse=True)
            loan_metric, metric, diff = unusual_correlations[0]
            
            insight = (
                f"The relationship between {metric} and {loan_metric} may be non-linear, "
                f"as evidenced by the large difference between Pearson and Spearman correlations "
                f"({diff:.2f})."
            )
            
            insights.append(insight)
        
        return insights
    
    def _generate_recommendations(
        self,
        correlations: Dict[str, Dict[str, Dict[str, float]]],
        leading_indicators: Dict[str, List[Dict[str, Any]]],
        model_results: Dict[str, Dict[str, Any]]
    ) -> List[str]:
        """
        Generate recommendations based on correlation analysis
        
        Args:
            correlations: Dictionary with correlation coefficients
            leading_indicators: Dictionary with leading indicators
            model_results: Dictionary with model results
            
        Returns:
            List of recommendation statements
        """
        recommendations = []
        
        # 1. Recommendations for risk monitoring
        risk_indicators = []
        
        # Look for significant correlations with default_rate and liquidation_rate
        for loan_metric in ["default_rate", "liquidation_rate"]:
            if loan_metric in correlations:
                for metric, data in correlations[loan_metric].items():
                    if data["is_significant"] and abs(data["pearson"]) > 0.4:
                        risk_indicators.append((metric, loan_metric, data["pearson"]))
        
        if risk_indicators:
            risk_indicators.sort(key=lambda x: abs(x[2]), reverse=True)
            
            recommendation = "For improved risk monitoring, focus on these key indicators: "
            indicator_texts = [f"{metric} (correlation with {loan_metric}: {corr:.2f})" 
                               for metric, loan_metric, corr in risk_indicators[:3]]
            
            recommendation += ", ".join(indicator_texts) + "."
            recommendations.append(recommendation)
        
        # 2. Recommendations for early warning systems
        if leading_indicators:
            early_warning_metrics = []
            
            for loan_metric, indicators in leading_indicators.items():
                if loan_metric in ["default_rate", "liquidation_rate"] and indicators:
                    for indicator in indicators[:2]:  # Top 2 indicators
                        early_warning_metrics.append((
                            indicator["market_metric"], 
                            loan_metric, 
                            indicator["optimal_lag"]
                        ))
            
            if early_warning_metrics:
                recommendation = "For early warning systems, implement alerts based on these leading indicators: "
                warning_texts = [f"{metric} (predicts {loan_metric} {lag} days ahead)" 
                                 for metric, loan_metric, lag in early_warning_metrics]
                
                recommendation += ", ".join(warning_texts) + "."
                recommendations.append(recommendation)
        
        # 3. Recommendations for model enhancement
        best_models = []
        for loan_metric, result in model_results.items():
            if result["r2"] > 0.5:  # Good predictive power
                best_models.append((loan_metric, result["r2"]))
        
        if best_models:
            best_models.sort(key=lambda x: x[1], reverse=True)
            
            recommendation = (
                "Consider integrating predictive models for these metrics into the risk assessment system: "
            )
            model_texts = [f"{loan_metric} (R²: {r2:.2f})" for loan_metric, r2 in best_models]
            
            recommendation += ", ".join(model_texts) + "."
            recommendations.append(recommendation)
        
        # 4. Recommendation for adjusting risk parameters
        if "utilization_rate" in correlations:
            utilization_correlations = []
            
            for metric, data in correlations["utilization_rate"].items():
                if data["is_significant"]:
                    utilization_correlations.append((metric, data["pearson"]))
            
            if utilization_correlations:
                utilization_correlations.sort(key=lambda x: abs(x[1]), reverse=True)
                top_metric, corr = utilization_correlations[0]
                
                direction = "increase" if corr > 0 else "decrease"
                
                recommendation = (
                    f"Consider adjusting utilization rate parameters when {top_metric} "
                    f"{direction}s, as these metrics show a significant correlation (r={corr:.2f})."
                )
                
                recommendations.append(recommendation)
        
        return recommendations
    
    def _cache_results(self, result: Dict[str, Any]):
        """
        Cache analysis results to file
        
        Args:
            result: Analysis results
        """
        # Create result path
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        result_path = os.path.join(self.cache_dir, f"analysis_result_{timestamp}.json")
        
        # Create serializable version of the result (excluding any non-serializable objects)
        serializable_result = {}
        
        for key, value in result.items():
            if key == "visualization_paths":
                # Convert visualization paths to relative paths
                serializable_result[key] = {
                    viz_name: os.path.relpath(path, self.cache_dir)
                    for viz_name, path in value.items()
                }
            else:
                # Attempt to serialize the value
                try:
                    json.dumps(value)
                    serializable_result[key] = value
                except (TypeError, OverflowError):
                    # Skip non-serializable values
                    pass
        
        # Save result
        with open(result_path, 'w') as f:
            json.dump(serializable_result, f, indent=2)
        
        logger.info(f"Cached analysis results to {result_path}")