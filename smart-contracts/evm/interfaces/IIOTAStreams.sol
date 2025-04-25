// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IIOTAStreams
 * @dev Interface for interacting with IOTA Streams protocol
 */
interface IIOTAStreams {
    /**
     * @dev Create a new IOTA Streams channel
     * @param seed Seed for channel creation
     * @return channelAddress Address of the created channel
     */
    function createChannel(bytes memory seed) external returns (bytes memory channelAddress);
    
    /**
     * @dev Send a message to an IOTA Streams channel
     * @param channelAddress Address of the channel
     * @param message Message to send
     * @param messageType Type of the message
     * @return messageId ID of the sent message
     */
    function sendMessage(
        bytes memory channelAddress, 
        bytes memory message, 
        string memory messageType
    ) external returns (bytes memory messageId);
    
    /**
     * @dev Fetch a message from an IOTA Streams channel
     * @param channelAddress Address of the channel
     * @param messageId ID of the message to fetch
     * @return message The fetched message
     * @return messageType Type of the message
     */
    function fetchMessage(
        bytes memory channelAddress, 
        bytes memory messageId
    ) external view returns (bytes memory message, string memory messageType);
    
    /**
     * @dev Subscribe to messages from an IOTA Streams channel
     * @param channelAddress Address of the channel
     * @param callback Address of the callback contract
     * @return subscriptionId ID of the subscription
     */
    function subscribe(
        bytes memory channelAddress, 
        address callback
    ) external returns (bytes32 subscriptionId);
    
    /**
     * @dev Unsubscribe from messages from an IOTA Streams channel
     * @param subscriptionId ID of the subscription
     */
    function unsubscribe(bytes32 subscriptionId) external;
    
    /**
     * @dev Encrypt data using IOTA Streams secure encryption
     * @param data Data to encrypt
     * @param publicKey Public key of the recipient
     * @return encryptedData Encrypted data
     */
    function encrypt(
        bytes memory data, 
        bytes memory publicKey
    ) external pure returns (bytes memory encryptedData);
    
    /**
     * @dev Decrypt data using IOTA Streams secure encryption
     * @param encryptedData Encrypted data
     * @param privateKey Private key of the recipient
     * @return data Decrypted data
     */
    function decrypt(
        bytes memory encryptedData, 
        bytes memory privateKey
    ) external pure returns (bytes memory data);
}