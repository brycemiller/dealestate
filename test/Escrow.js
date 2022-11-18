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

        // Approve property
        transaction = await realEstate.connect(seller).approve(escrow.address, 1);
        await transaction.wait();

        // List property
        transaction = await escrow.connect(seller).
            listProperty(1, buyer.address, tokens(10), tokens(5));
        await transaction.wait();
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

    describe('Listing', () => {
        it('Updates as listed', async () => {
            const result = await escrow.isListed(1);
            expect(result).to.be.equal(true);
        });

        it('Updates ownership', async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address);
        });

        it('Returns buyer', async () => {
            const result = await escrow.buyer(1);
            expect(result).to.be.equal(buyer.address);
        });

        it('Returns purchase price', async () => {
            const result = await escrow.purchasePrice(1);
            expect(result).to.be.equal(tokens(10));
        });

        it('Returns escrow amount', async () => {
            const result = await escrow.escrowAmount(1);
            expect(result).to.be.equal(tokens(5));
        });

        it('Only allows seller to list property', async () => {
            expect(
                escrow.connect(inspector).
                    listProperty(1, buyer.address, tokens(10), tokens(5))
            ).to.be.revertedWith("Only the seller can call this method");
        });
    });

    describe('Deposits', () => {
        it('Updates contract balance', async () => {
            const transaction = await escrow.connect(buyer).depositEarnestMoney(1, { value: tokens(5) });
            await transaction.wait();

            const result = await escrow.getBalance();
            expect(result).to.be.equal(tokens(5));
        });

        it('Does not allow too small deposits', async () => {
            expect(
                escrow.connect(buyer).
                    depositEarnestMoney(1, { value: tokens(4) })
            ).to.be.revertedWith("Deposit amount must be at least 5");
        });

        it('Only allows buyer to deposit', async () => {
            expect(
                escrow.connect(inspector).
                    depositEarnestMoney(1, { value: tokens(5) })
            ).to.be.revertedWith("Only the buyer can call this method");
        });
    });

    describe('Inspection', () => {
        it('Initial inspection status is false', async () => {
            const result = await escrow.inspectionPassed(1);
            expect(result).to.be.equal(false);
        });

        it('Updates inspection status', async () => {
            const transaction = await escrow.connect(inspector).
                updateInspectionStatus(1, true);
            await transaction.wait();

            const result = await escrow.inspectionPassed(1);
            expect(result).to.be.equal(true);
        });

        it('Only allows inspector to pass inspection', async () => {
            expect(
                escrow.connect(seller).
                updateInspectionStatus(1, true)
            ).to.be.revertedWith("Only the inspector can call this method");
        });
    });

    describe('Approval', () => {
        it('Updates approval status', async () => {
            let transaction = await escrow.connect(buyer).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(seller).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(lender).approveSale(1);
            await transaction.wait();

            expect(await escrow.approval(1, buyer.address)).to.be.equal(true);
            expect(await escrow.approval(1, seller.address)).to.be.equal(true);
            expect(await escrow.approval(1, lender.address)).to.be.equal(true);
        });
    });

    describe('Sale', () => {
        beforeEach(async () => {
            let transaction = await escrow.connect(buyer).
                depositEarnestMoney(1, { value: tokens(5) });
            await transaction.wait();

            transaction = await escrow.connect(inspector).
                updateInspectionStatus(1, true);
            await transaction.wait();

            transaction = await escrow.connect(buyer).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(seller).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(lender).approveSale(1);
            await transaction.wait();

            await lender.sendTransaction(
                { to: escrow.address, value: tokens(5) }
            );

            transaction = await escrow.connect(seller).finalizeSale(1);
            await transaction.wait();
        });

        it('Updates ownership', async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address);
        });

        it('Updates balance', async () => {
            expect(await escrow.getBalance()).to.be.equal(0);
        });
    });

    describe('Cancel sale', () => {
        beforeEach(async () => {
            let transaction = await escrow.connect(buyer).
                depositEarnestMoney(1, { value: tokens(5) });
            await transaction.wait();

            transaction = await escrow.connect(inspector).
                updateInspectionStatus(1, true);
            await transaction.wait();

            transaction = await escrow.connect(buyer).
                depositEarnestMoney(1, { value: tokens(5) });
            await transaction.wait();
        });

        it('Doesn\'t allow canceling approved sales', async () => {
            // Pass inspection
            let transaction = await escrow.connect(inspector).
                updateInspectionStatus(1, true);
            await transaction.wait();

            transaction = await escrow.connect(buyer).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(seller).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(lender).approveSale(1);
            await transaction.wait();

            expect(escrow.connect(buyer).cancelSale(1)).to.be.
                revertedWith("Cannot call this method on approved sales");
        });

        it('Doesn\'t allow canceling finalized sales', async () => {
            // Pass inspection
            let transaction = await escrow.connect(inspector).
                updateInspectionStatus(1, true);
            await transaction.wait();

            transaction = await escrow.connect(buyer).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(seller).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(lender).approveSale(1);
            await transaction.wait();

            await lender.sendTransaction(
                { to: escrow.address, value: tokens(5) }
            );

            transaction = await escrow.connect(seller).finalizeSale(1);
            await transaction.wait();

            expect(escrow.connect(buyer).cancelSale(1)).to.be.
                revertedWith("Cannot call this method on approved sales");
        });

        it('Returns earnest money to buyer when inspection not passed', async () => {
            // Fail inspection
            let transaction = await escrow.connect(inspector).
                updateInspectionStatus(1, false);
            await transaction.wait();

            // Cancel sale
            transaction = await escrow.connect(buyer).cancelSale(1);
            await transaction.wait();

            expect(await escrow.getBalance()).to.be.equal(0);
        });

        it('Forfeits earnest money to seller when inspection passed', async () => {
            // Pass inspection
            let transaction = await escrow.connect(inspector).
                updateInspectionStatus(1, true);
            await transaction.wait();

            // Cancel sale
            transaction = await escrow.connect(buyer).cancelSale(1);
            await transaction.wait();

            expect(await escrow.getBalance()).to.be.equal(0);
        });

        it('Unlists property', async () => {
            // Cancel sale
            transaction = await escrow.connect(buyer).cancelSale(1);
            await transaction.wait();

            const result = await escrow.isListed(1);
            expect(result).to.be.equal(false);
        });

        it('Doesn\'t allow canceling unlisted properties', async () => {
            // Cancel sale
            transaction = await escrow.connect(buyer).cancelSale(1);
            await transaction.wait();

            const result = await escrow.isListed(1);
            expect(result).to.be.equal(false);

            expect(escrow.connect(buyer).cancelSale(1)).to.be.
                revertedWith("Cannot call this method on approved sales");
        });

        it('Updates ownership to seller', async () => {
            // Cancel sale
            transaction = await escrow.connect(buyer).cancelSale(1);
            await transaction.wait();

            expect(await realEstate.ownerOf(1)).to.be.equal(seller.address);
        });
    });
})
