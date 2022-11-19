// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
//
// To deploy:
//   Open console at root directory, run: npx hardhat node
//   Expect: Local blockchain network starts
//
//   Open another console at root directory, run: npx hardhat run scripts/deploy.js --network localhost
//   Expect: Script completes and transactions are printed to blockchain network console
const hre = require("hardhat");

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

async function main() {
  // Setup accounts
  [buyer, seller, inspector, lender] = await ethers.getSigners();

  // Deploy Real Estate contract
  const realEstateContract = await ethers.getContractFactory('RealEstate');
  const realEstate = await realEstateContract.deploy();
  await realEstate.deployed();

  console.log(`Real Estate contract deployed at: ${realEstate.address}`);
  console.log(`Minting 3 properties...`);

  for (let i = 0; i < 3; i++) {
    const transaction = await realEstate.connect(seller).
      mint(`https://ipfs.io/ipfs/QmQVcpsjrA6cr1iJjZAodYwmPekYgbnXGo4DFubJiLc2EB/${i + 1}.json`);
    await transaction.wait();
  }

  // Deploy Escrow contract
  const escrowContract = await ethers.getContractFactory('Escrow');
  const escrow = await escrowContract.deploy(
      realEstate.address,
      seller.address,
      inspector.address,
      lender.address
  );
  await escrow.deployed();

  for (let i = 0; i < 3; i++) {
    const transaction = await realEstate.connect(seller).approve(escrow.address, i+1);
    await transaction.wait();
  }

  // List properties
  let transaction = await escrow.connect(seller).
    listProperty(1, buyer.address, tokens(20), tokens(10));
  await transaction.wait();

  transaction = await escrow.connect(seller).
    listProperty(2, buyer.address, tokens(15), tokens(5));
  await transaction.wait();

  transaction = await escrow.connect(seller).
    listProperty(3, buyer.address, tokens(10), tokens(5));
  await transaction.wait();

  console.log(`Deployment finished`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
