// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IVerifier {
    function verify(bytes calldata request, bytes calldata response) external view returns(bytes memory);
}
