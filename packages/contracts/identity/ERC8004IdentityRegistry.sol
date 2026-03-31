// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ERC8004IdentityRegistry
/// @notice ERC-8004 compliant identity registry for AI agents on Base
/// @dev Each agent gets a unique NFT representing their identity
/// @dev Can optionally link to agent0 identity on Ethereum for cross-chain discovery
contract ERC8004IdentityRegistry is ERC721, Ownable {
    struct AgentProfile {
        string name;
        string endpoint; // A2A endpoint URL
        bytes32 capabilitiesHash; // Hash of agent capabilities
        uint256 registeredAt;
        bool isActive;
        string metadata; // JSON metadata
    }

    struct Agent0Link {
        uint256 chainId; // Ethereum chainId (e.g., 11155111 for Sepolia)
        uint256 tokenId; // agent0 token ID on Ethereum
        bool verified; // Whether this link has been verified
    }

    mapping(uint256 => AgentProfile) public profiles;
    mapping(address => uint256) public addressToTokenId;
    mapping(string => bool) public endpointTaken;
    mapping(uint256 => Agent0Link) public agent0Links; // Base tokenId → agent0 identity

    uint256 private _nextTokenId = 1;

    event AgentRegistered(uint256 indexed tokenId, address indexed owner, string name, string endpoint);
    event AgentUpdated(uint256 indexed tokenId, string endpoint, bytes32 capabilitiesHash);
    event AgentDeactivated(uint256 indexed tokenId);
    event AgentReactivated(uint256 indexed tokenId);
    event Agent0Linked(uint256 indexed tokenId, uint256 indexed agent0ChainId, uint256 indexed agent0TokenId);
    event Agent0Unlinked(uint256 indexed tokenId);

    constructor() ERC721("BabylonAgent", "BAGENT") Ownable(msg.sender) {}

    /// @notice Register a new AI agent
    /// @param name Agent name
    /// @param endpoint A2A endpoint URL
    /// @param capabilitiesHash Hash of capabilities
    /// @param metadata JSON metadata string
    /// @return tokenId The minted token ID
    function registerAgent(
        string calldata name,
        string calldata endpoint,
        bytes32 capabilitiesHash,
        string calldata metadata
    ) external returns (uint256 tokenId) {
        require(addressToTokenId[msg.sender] == 0, "Already registered");
        require(!endpointTaken[endpoint], "Endpoint already taken");
        require(bytes(name).length > 0, "Name required");
        require(bytes(endpoint).length > 0, "Endpoint required");

        tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);

        profiles[tokenId] = AgentProfile({
            name: name,
            endpoint: endpoint,
            capabilitiesHash: capabilitiesHash,
            registeredAt: block.timestamp,
            isActive: true,
            metadata: metadata
        });

        addressToTokenId[msg.sender] = tokenId;
        endpointTaken[endpoint] = true;

        emit AgentRegistered(tokenId, msg.sender, name, endpoint);
    }

    /// @notice Update agent profile
    /// @param endpoint New endpoint
    /// @param capabilitiesHash New capabilities hash
    /// @param metadata New metadata
    function updateAgent(
        string calldata endpoint,
        bytes32 capabilitiesHash,
        string calldata metadata
    ) external {
        uint256 tokenId = addressToTokenId[msg.sender];
        require(tokenId != 0, "Not registered");
        require(ownerOf(tokenId) == msg.sender, "Not owner");

        AgentProfile storage profile = profiles[tokenId];

        // Update endpoint if changed
        if (keccak256(bytes(endpoint)) != keccak256(bytes(profile.endpoint))) {
            require(!endpointTaken[endpoint], "Endpoint taken");
            endpointTaken[profile.endpoint] = false;
            endpointTaken[endpoint] = true;
            profile.endpoint = endpoint;
        }

        profile.capabilitiesHash = capabilitiesHash;
        profile.metadata = metadata;

        emit AgentUpdated(tokenId, endpoint, capabilitiesHash);
    }

    /// @notice Deactivate agent
    function deactivateAgent() external {
        uint256 tokenId = addressToTokenId[msg.sender];
        require(tokenId != 0, "Not registered");
        require(ownerOf(tokenId) == msg.sender, "Not owner");

        profiles[tokenId].isActive = false;
        emit AgentDeactivated(tokenId);
    }

    /// @notice Reactivate agent
    function reactivateAgent() external {
        uint256 tokenId = addressToTokenId[msg.sender];
        require(tokenId != 0, "Not registered");
        require(ownerOf(tokenId) == msg.sender, "Not owner");

        profiles[tokenId].isActive = true;
        emit AgentReactivated(tokenId);
    }

    /// @notice Link this agent to an agent0 identity on Ethereum
    /// @param agent0ChainId The chainId where agent0 is deployed (e.g., 11155111 for Sepolia)
    /// @param agent0TokenId The token ID of the agent0 identity
    /// @dev This creates a cross-chain link for discovery and reputation aggregation
    function linkAgent0Identity(
        uint256 agent0ChainId,
        uint256 agent0TokenId
    ) external {
        uint256 tokenId = addressToTokenId[msg.sender];
        require(tokenId != 0, "Not registered");
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(agent0TokenId > 0, "Invalid agent0 token ID");

        agent0Links[tokenId] = Agent0Link({
            chainId: agent0ChainId,
            tokenId: agent0TokenId,
            verified: false // Can be verified by oracle/proof later
        });

        emit Agent0Linked(tokenId, agent0ChainId, agent0TokenId);
    }

    /// @notice Unlink agent0 identity
    function unlinkAgent0Identity() external {
        uint256 tokenId = addressToTokenId[msg.sender];
        require(tokenId != 0, "Not registered");
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(agent0Links[tokenId].tokenId != 0, "No agent0 link");

        delete agent0Links[tokenId];
        emit Agent0Unlinked(tokenId);
    }

    /// @notice Get agent0 link for a token
    /// @return agent0Id The agent0 identity in format "chainId:tokenId", or empty if not linked
    function getAgent0Link(uint256 tokenId) external view returns (string memory agent0Id) {
        Agent0Link storage link = agent0Links[tokenId];

        if (link.tokenId == 0) {
            return "";
        }

        // Format as "chainId:tokenId" (e.g., "11155111:123")
        return string(abi.encodePacked(
            _uintToString(link.chainId),
            ":",
            _uintToString(link.tokenId)
        ));
    }

    /// @notice Check if agent has a linked agent0 identity
    function hasAgent0Link(uint256 tokenId) external view returns (bool) {
        return agent0Links[tokenId].tokenId != 0;
    }

    /// @notice Get agent profile
    function getAgentProfile(uint256 tokenId) external view returns (
        string memory name,
        string memory endpoint,
        bytes32 capabilitiesHash,
        uint256 registeredAt,
        bool isActive,
        string memory metadata
    ) {
        AgentProfile storage profile = profiles[tokenId];
        return (
            profile.name,
            profile.endpoint,
            profile.capabilitiesHash,
            profile.registeredAt,
            profile.isActive,
            profile.metadata
        );
    }

    /// @notice Check if address is a registered agent
    function isRegistered(address account) external view returns (bool) {
        return addressToTokenId[account] != 0;
    }

    /// @notice Get token ID for address
    function getTokenId(address account) external view returns (uint256) {
        return addressToTokenId[account];
    }

    /// @notice Verify agent ownership
    function verifyAgent(address account, uint256 tokenId) external view returns (bool) {
        return addressToTokenId[account] == tokenId && ownerOf(tokenId) == account;
    }

    /// @notice Get all active agent token IDs
    // slither-disable-next-line timestamp
    function getAllActiveAgents() external view returns (uint256[] memory) {
        uint256[] memory activeAgents = new uint256[](_nextTokenId - 1);
        uint256 count = 0;
        
        for (uint256 i = 1; i < _nextTokenId; i++) {
            if (profiles[i].isActive && ownerOf(i) != address(0)) {
                activeAgents[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeAgents[i];
        }
        
        return result;
    }
    
    /// @notice Check if endpoint is active
    // slither-disable-next-line timestamp
    function isEndpointActive(string memory endpoint) external view returns (bool) {
        if (!endpointTaken[endpoint]) return false;
        bytes32 endpointHash = keccak256(bytes(endpoint));
        
        // Find token ID with this endpoint
        for (uint256 i = 1; i < _nextTokenId; i++) {
            // slither-disable-next-line incorrect-equality
            if (keccak256(bytes(profiles[i].endpoint)) == endpointHash) {
                return profiles[i].isActive && ownerOf(i) != address(0);
            }
        }
        
        return false;
    }

    /// @notice Get agents by capability hash
    // slither-disable-next-line timestamp
    function getAgentsByCapability(bytes32 capabilityHash) external view returns (uint256[] memory) {
        uint256[] memory matchingAgents = new uint256[](_nextTokenId - 1);
        uint256 count = 0;
        
        for (uint256 i = 1; i < _nextTokenId; i++) {
            // slither-disable-next-line incorrect-equality
            if (profiles[i].capabilitiesHash == capabilityHash && profiles[i].isActive && ownerOf(i) != address(0)) {
                matchingAgents[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = matchingAgents[i];
        }
        
        return result;
    }

    /// @notice Convert uint256 to string
    /// @dev Helper for agent0 link formatting
    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 j = value;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (value != 0) {
            k = k - 1;
            uint8 temp = 48 + uint8(value % 10);
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            value /= 10;
        }
        return string(bstr);
    }

    /// @notice Override transfer to update address mapping
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);

        // Update address mapping on transfer
        if (from != address(0)) {
            addressToTokenId[from] = 0;
        }
        if (to != address(0)) {
            addressToTokenId[to] = tokenId;
        }

        return from;
    }
}
