// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/resolvers/SupportsInterface.sol";
import "./IExtendedResolver.sol";
import "./SignatureVerifier.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IResolverService {
    function resolve(
        bytes calldata name,
        bytes calldata data
    )
        external
        view
        returns (bytes memory result, uint64 expires, bytes memory sig);
}

/**
 * Implements an ENS resolver that directs all queries to a CCIP read gateway.
 * Callers must implement EIP 3668 and ENSIP 10.
 */
contract OffchainResolver is
    IExtendedResolver,
    SupportsInterface,
    Ownable2Step
{
    // ================ Mutable Ownership Configuration ==================

    /**
     * The address of the contract's relayer.
     * Relayer has the permission to relay certain actions to this contract (i.e., set Signer and GatewayUrl)
     */
    address private _relayer;

    // ================================ Events ==============================

    event RelayerUpdated(address newRelayer);
    event GatewayUrlUpdated(string newUrl);
    event NewSigners(address[] signers);
    event SignersUpdated(address[] signers);

    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    // ============================ Variables ==============================

    string public url;
    mapping(address => bool) public signers;

    // ============================== Modifiers ==============================

    /**
     * @dev Modifier to check whether the `msg.sender` is the relayer.
     */
    modifier onlyRelayer() {
        require(
            msg.sender == relayer(),
            "Unauthorized: caller is not the relayer"
        );
        _;
    }

    // ============================== Constructor ============================

    constructor(string memory _url, address[] memory _initialSigners) {
        url = _url;
        for (uint i = 0; i < _initialSigners.length; i++) {
            signers[_initialSigners[i]] = true;
        }
        emit NewSigners(_initialSigners);
    }

    // ======================== Configuration Management ======================

    /**
     * Allows the owner to set a relayer address.
     */
    function setRelayer(address newRelayer) external onlyOwner {
        _relayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }

    /**
     * Allows the relayer to set/update the gateway URL.
     */
    function setGatewayUrl(string calldata newUrl) external onlyRelayer {
        url = newUrl;
        emit GatewayUrlUpdated(newUrl);
    }

    /**
     Function to add new signers, can only be called by the relayer
    */
    function addSigners(address[] memory newSigners) external onlyRelayer {
        for (uint i = 0; i < newSigners.length; i++) {
            signers[newSigners[i]] = true;
        }
        emit SignersUpdated(newSigners);
    }

    /**
     Function to remove signers, can only be called by the relayer
    */
    function removeSigners(
        address[] memory signersToRemove
    ) external onlyRelayer {
        for (uint i = 0; i < signersToRemove.length; i++) {
            signers[signersToRemove[i]] = false;
        }
        emit SignersUpdated(signersToRemove);
    }

    // ================================ Getters ==============================

    /**
     * @dev Returns the address of the current relayer.
     */
    function relayer() public view returns (address) {
        return _relayer == address(0) ? owner() : _relayer;
    }

    // ================================ Functions =============================

    function makeSignatureHash(
        address target,
        uint64 expires,
        bytes memory request,
        bytes memory result
    ) external pure returns (bytes32) {
        return
            SignatureVerifier.makeSignatureHash(
                target,
                expires,
                request,
                result
            );
    }

    /**
     * Resolves a name, as specified by ENSIP 10.
     * @param name The DNS-encoded name to resolve.
     * @param data The ABI encoded data for the underlying resolution function (Eg, addr(bytes32), text(bytes32,string), etc).
     * @return The return data, ABI encoded identically to the underlying function.
     */
    function resolve(
        bytes calldata name,
        bytes calldata data
    ) external view override returns (bytes memory) {
        bytes memory callData = abi.encodeWithSelector(
            IResolverService.resolve.selector,
            name,
            data
        );
        string[] memory urls = new string[](1);
        urls[0] = url;
        revert OffchainLookup(
            address(this),
            urls,
            callData,
            OffchainResolver.resolveWithProof.selector,
            callData
        );
    }

    /**
     * Callback used by CCIP read compatible clients to verify and parse the response.
     */
    function resolveWithProof(
        bytes calldata response,
        bytes calldata extraData
    ) external view returns (bytes memory) {
        (address signer, bytes memory result) = SignatureVerifier.verify(
            extraData,
            response
        );
        require(signers[signer], "SignatureVerifier: Invalid signature");
        return result;
    }

    function supportsInterface(
        bytes4 interfaceID
    ) public pure override returns (bool) {
        return
            interfaceID == type(IExtendedResolver).interfaceId ||
            super.supportsInterface(interfaceID);
    }
}
