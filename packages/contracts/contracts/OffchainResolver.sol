// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/resolvers/SupportsInterface.sol";
import "./IExtendedResolver.sol";
import "./SignatureVerifier.sol";

interface IResolverService {
    function resolve(bytes calldata name, bytes calldata data) external view returns(bytes memory result, uint64 expires, bytes memory sig);
}

/**
 * Implements an ENS resolver that directs all queries to a CCIP read gateway.
 * Callers must implement EIP 3668 and ENSIP 10.
 */
contract OffchainResolver is IExtendedResolver, SupportsInterface {
    string public url;
    mapping(address=>bool) public signers;

    event NewSigners(address[] signers);
    error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData);

    constructor(string memory _url, address[] memory _signers) {
        url = _url;
        for(uint i = 0; i < _signers.length; i++) {
            signers[_signers[i]] = true;
        }
        emit NewSigners(_signers);
    }

    function makeSignatureHash(address target, uint64 expires, bytes memory request, bytes memory result) external pure returns(bytes32) {
        return SignatureVerifier.makeSignatureHash(target, expires, request, result);
    }

    /**
     * Resolves a name, as specified by ENSIP 10.
     * @param name The DNS-encoded name to resolve.
     * @param data The ABI encoded data for the underlying resolution function (Eg, addr(bytes32), text(bytes32,string), etc).
     * @return The return data, ABI encoded identically to the underlying function.
     */
    function resolve(bytes calldata name, bytes calldata data) external override view returns(bytes memory) {
        bytes memory callData = abi.encodeWithSelector(IResolverService.resolve.selector, name, data);
        string[] memory urls = new string[](1);
        urls[0] = url;
        revert OffchainLookup(
            address(this),
            urls,
            callData,
            OffchainResolver.resolveWithProof.selector,
            abi.encode(callData, address(this))
        );
    }

    /**
     * Callback used by CCIP read compatible clients to verify and parse the response.
     */
    function resolveWithProof(bytes calldata response, bytes calldata extraData) external view returns(bytes memory) {
        (address signer, bytes memory result) = SignatureVerifier.verify(extraData, response);
        require(
            signers[signer],
            "SignatureVerifier: Invalid sigature");
        return result;
    }

    function supportsInterface(bytes4 interfaceID) public pure override returns(bool) {
        return interfaceID == type(IExtendedResolver).interfaceId || super.supportsInterface(interfaceID);
    }
}
