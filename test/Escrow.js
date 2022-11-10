const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether');
}

describe('Escrow', () => {
    let buyer, seller, inspector, lender;
    let realEstate, escrow;

    beforeEach(async () => {
        // Setup accounts
        [buyer, seller, inspector, lender] = await ethers.getSigners();

        // Deploy Real Estate contract
        const realEstateContract = await ethers.getContractFactory('RealEstate');
        realEstate = await realEstateContract.deploy();

        // Mint NFT as Seller
        const tokenURI = "https://ipfs.io/ipfs/QmQUozrHLAusXDxrvsESJ3PYB3rUeUuBAvVWw6nop2uu7c/1.png";
        let transaction = await realEstate.connect(seller).mint(tokenURI);
        await transaction.wait();

        // Deploy Escrow contract
        const escrowContract = await ethers.getContractFactory('Escrow');
        escrow = await escrowContract.deploy(
            realEstate.address,
            seller.address,
            inspector.address,
            lender.address
        );
    });

    describe('Deployment', () => {
        it('Returns NFT Address', async () => {
            const result = await escrow.nftAddress();
            expect(result).to.be.equal(realEstate.address);
        });
    
        it('Returns Seller', async () => {
            const result = await escrow.seller();
            expect(result).to.be.equal(seller.address);
        });
    
        it('Returns Inspector', async () => {
            const result = await escrow.inspector();
            expect(result).to.be.equal(inspector.address);
        });
    
        it('Returns Lender', async () => {
            const result = await escrow.lender();
            expect(result).to.be.equal(lender.address);
        });
    });
})
