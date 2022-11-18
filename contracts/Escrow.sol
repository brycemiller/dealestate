//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Strings.sol";

interface IERC721 {
    function transferFrom(
        address _from,
        address _to,
        uint256 _id
    ) external;
}

contract Escrow {
    address public nftAddress;
    address payable public seller;
    address public inspector;
    address public lender;

    modifier onlyBuyer(uint256 _nftId) {
        require(msg.sender == buyer[_nftId], "Only the buyer can call this method");
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller, "Only the seller can call this method");
        _;
    }

    modifier onlyInspector() {
        require(msg.sender == inspector, "Only the inspector can call this method");
        _;
    }

    modifier onlyListed(uint256 _nftId) {
        require(isListed[_nftId], "This method can only be called on listed properties");
        _;
    }

    /**
     * Only sales that have not been approved by all parties can access
     */
    modifier onlyNotApproved(uint256 _nftId) {
        require(
            (!approval[_nftId][buyer[_nftId]] ||
            !approval[_nftId][seller] ||
            !approval[_nftId][lender]),
            "Cannot call this method on approved sales"
        );
        _;
    }

    mapping(uint256 => bool) public isListed;
    mapping(uint256 => uint256) public purchasePrice;
    mapping(uint256 => uint256) public escrowAmount;
    mapping(uint256 => address) public buyer;
    mapping(uint256 => bool) public inspectionPassed;
    mapping(uint256 => mapping(address => bool)) public approval;

    constructor(
        address _nftAddress,
        address payable _seller,
        address _inspector,
        address _lender
    ) {
        nftAddress = _nftAddress;
        seller = _seller;
        inspector = _inspector;
        lender = _lender;
    }

    function listProperty(
        uint256 _nftId,
        address _buyer,
        uint256 _purchasePrice,
        uint256 _escrowAmount
    ) public payable onlySeller {
        // Transfer NFT from seller to this contract
        IERC721(nftAddress).transferFrom(msg.sender, address(this), _nftId);

        isListed[_nftId] = true;
        purchasePrice[_nftId] = _purchasePrice;
        escrowAmount[_nftId] = _escrowAmount;
        buyer[_nftId] = _buyer;
    }

    function depositEarnestMoney(uint256 _nftId)
        public
        payable
        onlyListed(_nftId)
        onlyBuyer(_nftId)
    {
        require(
            msg.value >= escrowAmount[_nftId],
            string.concat(
                "Deposit amount must be at least ",
                Strings.toString(escrowAmount[_nftId])
            )
        );
    }

    function updateInspectionStatus(uint256 _nftId, bool _passed)
        public
        onlyListed(_nftId)
        onlyInspector
    {
        inspectionPassed[_nftId] = _passed;
    }

    function approveSale(uint256 _nftId) public onlyListed(_nftId) {
        approval[_nftId][msg.sender] = true;
    }

    /**
     * Require inspection passed
     * Require sale authorized
     * Require correct amount of funds
     * 
     * Then: Transfer NFT to buyer, funds to seller
     */
    function finalizeSale(uint256 _nftId) public onlyListed(_nftId) {
        require(inspectionPassed[_nftId]);
        require(approval[_nftId][buyer[_nftId]]);
        require(approval[_nftId][seller]);
        require(approval[_nftId][lender]);
        require(address(this).balance >= purchasePrice[_nftId]);

        isListed[_nftId] = false;

        (bool success, ) = payable(seller).call{ value: address(this).balance}("");
        require(success);

        // Transfer NFT from this contract to buyer
        IERC721(nftAddress).transferFrom(address(this), buyer[_nftId], _nftId);
    }

    /**
     * Cancel a sale:
     * Cannot cancel sale if approval has been given by all parties
     * Cannot cancel sale if property is not listed
     * If inspection is not passed, then refund earnest money
     * If inspection is passed, then transfer earnest money to seller
     */
    function cancelSale(uint256 _nftId)
        public
        onlyListed(_nftId)
        onlyNotApproved(_nftId)
    {
        isListed[_nftId] = false;

        if(inspectionPassed[_nftId] == false) {
            payable(buyer[_nftId]).transfer(address(this).balance);
        } else {
            payable(seller).transfer(address(this).balance);
        }

        // Transfer NFT from this contract back to seller
        IERC721(nftAddress).transferFrom(address(this), seller, _nftId);
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
    }
}
