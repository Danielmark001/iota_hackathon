import React, { useState } from 'react';
import { ethers } from 'ethers';
import LendingPoolABI from '../../abis/LendingPool.json';
import { LENDING_POOL_ADDRESS } from '../../config';

/**
 * Generic transaction modal component for lending operations
 */
const TransactionModal = ({ 
  isOpen, 
  onClose, 
  type,
  provider,
  address,
  maxAmount,
  onSuccess
}) => {
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  
  // Determine modal title and action button text based on type
  const getModalTitle = () => {
    switch (type) {
      case 'deposit': return 'Deposit Funds';
      case 'withdraw': return 'Withdraw Funds';
      case 'borrow': return 'Borrow Funds';
      case 'repay': return 'Repay Loan';
      case 'addCollateral': return 'Add Collateral';
      case 'removeCollateral': return 'Remove Collateral';
      default: return 'Transaction';
    }
  };
  
  const getActionText = () => {
    switch (type) {
      case 'deposit': return 'Deposit';
      case 'withdraw': return 'Withdraw';
      case 'borrow': return 'Borrow';
      case 'repay': return 'Repay';
      case 'addCollateral': return 'Add';
      case 'removeCollateral': return 'Remove';
      default: return 'Submit';
    }
  };
  
  // Handle amount input change
  const handleAmountChange = (e) => {
    setAmount(e.target.value);
    setError('');
  };
  
  // Set maximum amount
  const handleMaxClick = () => {
    setAmount(maxAmount || '0');
    setError('');
  };
  
  // Process the transaction
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    if (parseFloat(amount) > parseFloat(maxAmount)) {
      setError(`Amount exceeds maximum (${maxAmount} IOTA)`);
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      const signer = provider.getSigner(address);
      const contract = new ethers.Contract(
        LENDING_POOL_ADDRESS,
        LendingPoolABI,
        signer
      );
      
      // Convert amount to wei
      const amountWei = ethers.utils.parseEther(amount);
      
      // Determine which contract function to call based on type
      let tx;
      switch (type) {
        case 'deposit': 
          tx = await contract.deposit(amountWei);
          break;
        case 'withdraw': 
          tx = await contract.withdraw(amountWei);
          break;
        case 'borrow': 
          tx = await contract.borrow(amountWei);
          break;
        case 'repay': 
          tx = await contract.repay(amountWei);
          break;
        case 'addCollateral': 
          tx = await contract.addCollateral(amountWei);
          break;
        case 'removeCollateral': 
          tx = await contract.removeCollateral(amountWei);
          break;
        default:
          throw new Error('Invalid transaction type');
      }
      
      setTxHash(tx.hash);
      
      // Wait for transaction to be mined
      await tx.wait();
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(tx.hash, amount);
      }
      
      // Reset form and close modal after a delay
      setTimeout(() => {
        setAmount('');
        setTxHash('');
        setIsProcessing(false);
        onClose();
      }, 3000);
      
    } catch (error) {
      console.error(`Error processing ${type}:`, error);
      setError(error.message || `Failed to process ${type}`);
      setIsProcessing(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>{getModalTitle()}</h2>
          <button className="close-button" onClick={onClose} disabled={isProcessing}>×</button>
        </div>
        
        <div className="modal-body">
          {txHash ? (
            <div className="success-message">
              <h3>Transaction Submitted</h3>
              <p>Your transaction is being processed...</p>
              <div className="transaction-hash">
                <span>Transaction Hash:</span>
                <a 
                  href={`https://explorer.wasp.sc.iota.org/mainnet/transaction/${txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  {`${txHash.substring(0, 8)}...${txHash.substring(txHash.length - 8)}`}
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="amount">Amount (IOTA)</label>
                <div className="amount-input-container">
                  <input
                    id="amount"
                    type="number"
                    step="0.000001"
                    min="0"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0.0"
                    disabled={isProcessing}
                    required
                  />
                  <button
                    type="button"
                    className="max-button"
                    onClick={handleMaxClick}
                    disabled={isProcessing || !maxAmount}
                  >
                    MAX
                  </button>
                </div>
                {maxAmount && (
                  <div className="max-amount">
                    Maximum: {parseFloat(maxAmount).toFixed(6)} IOTA
                  </div>
                )}
              </div>
              
              {error && <div className="error-message">{error}</div>}
              
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onClose}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : getActionText()}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionModal;
