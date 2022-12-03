import { useEffect, useState } from 'react';
import { ethers } from 'ethers';

// Components
import Navigation from './components/Navigation';
import Search from './components/Search';
import Home from './components/Home';

// ABIs
import RealEstate from './abis/RealEstate.json'
import Escrow from './abis/Escrow.json'

// Config
import config from './config.json';

function App() {
  const [provider, setProvider] = useState(null);
  const [escrow, setEscrow] = useState(null);
  const [account, setAccount] = useState(null);
  const [homes, setHomes] = useState([]);

  const loadBlockchainData = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(provider);

    const network = await provider.getNetwork();

    const realEstateContract = new ethers.Contract(
      config[network.chainId].realEstate.address,
      RealEstate,
      provider
    );
    const totalSupply = await realEstateContract.totalSupply();
    const homes = [];

    for (var i = 0; i < totalSupply; i++) {
      const uri = await realEstateContract.tokenURI(i+1);
      const reponse = await fetch(uri);
      const metadata = await reponse.json();
      homes.push(metadata);
    }
    setHomes(homes);

    const escrowContract = new ethers.Contract(
      config[network.chainId].escrow.address,
      Escrow,
      provider
    );
    setEscrow(escrowContract);

    window.ethereum.on('accountsChanged', async () => {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = ethers.utils.getAddress(accounts[0]);
      setAccount(account);
    });
  };

  useEffect(() => {
    loadBlockchainData();
  }, []);

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />
      <Search />
      <div className='cards__section'>

        <h3>Homes For You</h3>
        <hr />
        <div className='cards'>
          {homes.map((home, index) => (
            <div className='card' key={index}>
              <div className='card__image'>
                <img src={home.image} alt='Home' />
              </div>
              <div className='card__info'>
                <h4>{home.attributes[0].value} ETH</h4>
                <p>
                  <strong>{home.attributes[2].value} </strong> beds |
                  <strong>{home.attributes[3].value} </strong> bath |
                  <strong>{home.attributes[4].value} </strong> sqft
                </p>
                <p>{home.address}</p>
              </div>
            </div>
          ))};
        </div>
      </div>

    </div>
  );
}

export default App;
