import { Client } from '@liquality/client';

import { BitcoinSwapProvider } from '@liquality/bitcoin-swap-provider';
import { BitcoinJsWalletProvider } from '@liquality/bitcoin-js-wallet-provider';
import { BitcoinEsploraBatchApiProvider } from '@liquality/bitcoin-esplora-batch-api-provider';
import { BitcoinEsploraSwapFindProvider } from '@liquality/bitcoin-esplora-swap-find-provider';
import { BitcoinFeeApiProvider } from '@liquality/bitcoin-fee-api-provider';
import { BitcoinRpcFeeProvider } from '@liquality/bitcoin-rpc-fee-provider';

import { EthereumRpcProvider } from '@liquality/ethereum-rpc-provider';
import { EthereumJsWalletProvider } from '@liquality/ethereum-js-wallet-provider';
import { EthereumSwapProvider } from '@liquality/ethereum-swap-provider';
import { EthereumScraperSwapFindProvider } from '@liquality/ethereum-scraper-swap-find-provider';
import { EthereumRpcFeeProvider } from '@liquality/ethereum-rpc-fee-provider';
import { EthereumEIP1559FeeProvider } from '@liquality/ethereum-eip1559-fee-provider';

import { EthereumErc20Provider } from '@liquality/ethereum-erc20-provider';
import { EthereumErc20SwapProvider } from '@liquality/ethereum-erc20-swap-provider';
import { EthereumErc20ScraperSwapFindProvider } from '@liquality/ethereum-erc20-scraper-swap-find-provider';

import { NearSwapProvider } from '@liquality/near-swap-provider';
import { NearJsWalletProvider } from '@liquality/near-js-wallet-provider';
import { NearRpcProvider } from '@liquality/near-rpc-provider';
import { NearSwapFindProvider } from '@liquality/near-swap-find-provider';

import { SolanaRpcProvider } from '@liquality/solana-rpc-provider';
import { SolanaWalletProvider } from '@liquality/solana-wallet-provider';
import { SolanaSwapProvider } from '@liquality/solana-swap-provider';
import { SolanaSwapFindProvider } from '@liquality/solana-swap-find-provider';

import { TerraSwapProvider } from '@liquality/terra-swap-provider';
import { TerraWalletProvider } from '@liquality/terra-wallet-provider';
import { TerraRpcProvider } from '@liquality/terra-rpc-provider';
import { TerraSwapFindProvider } from '@liquality/terra-swap-find-provider';

import { ChainId } from '@liquality/cryptoassets';

import { isERC20 } from '../../utils/asset';
import cryptoassets from '../../utils/cryptoassets';
import buildConfig from '../../build.config';
import { ChainNetworks } from '../../utils/networks';
import { LEDGER_BITCOIN_OPTIONS } from '../../utils/ledger';
import { walletOptionsStore } from '../../walletOptions';
import { AccountType } from '../types';

function createBtcClient(
  network,
  mnemonic,
  accountType: AccountType,
  derivationPath
) {
  const isTestnet = network === 'testnet';
  const bitcoinNetwork = ChainNetworks.bitcoin[network];
  const esploraApi = buildConfig.exploraApis[network];
  const batchEsploraApi = buildConfig.batchEsploraApis[network];

  const btcClient = new Client();
  btcClient.addProvider(
    new BitcoinEsploraBatchApiProvider({
      batchUrl: batchEsploraApi,
      url: esploraApi,
      network: bitcoinNetwork,
      numberOfBlockConfirmation: 2,
    })
  );

  if (accountType.includes('bitcoin_ledger')) {
    const option = LEDGER_BITCOIN_OPTIONS.find((o) => o.name === accountType);
    if (!option) {
      throw new Error(`Account type ${accountType} not an option`);
    }
    const { addressType } = option;
    if (!walletOptionsStore.walletOptions.createBitcoinLedgerProvider) {
      throw new Error(
        'Wallet Options: createBitcoinLedgerProvider is not defined - unable to build ledger client'
      );
    }
    const ledgerProvider =
      walletOptionsStore.walletOptions.createBitcoinLedgerProvider(
        network,
        addressType,
        derivationPath
      );
    // @ts-ignore
    btcClient.addProvider(ledgerProvider);
  } else {
    btcClient.addProvider(
      // @ts-ignore
      new BitcoinJsWalletProvider({
        network: bitcoinNetwork,
        mnemonic,
        baseDerivationPath: derivationPath,
      })
    );
  }

  btcClient.addProvider(new BitcoinSwapProvider({ network: bitcoinNetwork }));
  btcClient.addProvider(new BitcoinEsploraSwapFindProvider(esploraApi));
  if (isTestnet) btcClient.addProvider(new BitcoinRpcFeeProvider());
  else
    btcClient.addProvider(
      new BitcoinFeeApiProvider(
        'https://liquality.io/swap/mempool/v1/fees/recommended'
      )
    );

  return btcClient;
}

function createEthereumClient(
  asset,
  network,
  ethereumNetwork,
  rpcApi,
  scraperApi,
  feeProvider,
  mnemonic,
  accountType: AccountType,
  derivationPath,
  hardfork?
) {
  const ethClient = new Client();
  ethClient.addProvider(new EthereumRpcProvider({ uri: rpcApi }));
  ethClient.addProvider(feeProvider);

  if (
    accountType === AccountType.EthereumLedger ||
    accountType === AccountType.RskLedger
  ) {
    const assetData = cryptoassets[asset];
    const chainId = assetData.chain || ChainId.Ethereum;
    if (!walletOptionsStore.walletOptions.createEthereumLedgerProvider) {
      throw new Error(
        'Wallet Options: createEthereumLedgerProvider is not defined - unable to build ledger client'
      );
    }
    const ledgerProvider =
      walletOptionsStore.walletOptions.createEthereumLedgerProvider(
        network,
        chainId,
        derivationPath,
        hardfork
      );
    ethClient.addProvider(ledgerProvider);
  } else {
    ethClient.addProvider(
      new EthereumJsWalletProvider({
        network: ethereumNetwork,
        mnemonic,
        derivationPath,
        hardfork,
      })
    );
  }

  if (isERC20(asset)) {
    const contractAddress = cryptoassets[asset].contractAddress;
    if (!contractAddress) {
      throw new Error(
        `Client creation failed. Could not retrieve contract address for ${asset}`
      );
    }
    ethClient.addProvider(new EthereumErc20Provider(contractAddress));
    ethClient.addProvider(new EthereumErc20SwapProvider());
    if (scraperApi)
      ethClient.addProvider(
        new EthereumErc20ScraperSwapFindProvider(scraperApi)
      );
  } else {
    ethClient.addProvider(new EthereumSwapProvider());
    if (scraperApi)
      ethClient.addProvider(new EthereumScraperSwapFindProvider(scraperApi));
  }

  return ethClient;
}

function createEthClient(
  asset,
  network,
  mnemonic,
  accountType,
  derivationPath
) {
  const isTestnet = network === 'testnet';
  const ethereumNetwork = ChainNetworks.ethereum[network];
  const infuraApi = isTestnet
    ? `https://ropsten.infura.io/v3/${buildConfig.infuraApiKey}`
    : `https://mainnet.infura.io/v3/${buildConfig.infuraApiKey}`;
  const scraperApi = isTestnet
    ? 'https://eth-ropsten-api.liq-chainhub.net/'
    : 'https://eth-mainnet-api.liq-chainhub.net/';

  const feeProvider = new EthereumEIP1559FeeProvider({ uri: infuraApi });

  return createEthereumClient(
    asset,
    network,
    ethereumNetwork,
    infuraApi,
    scraperApi,
    feeProvider,
    mnemonic,
    accountType,
    derivationPath,
    'london'
  );
}

function createNearClient(network, mnemonic, derivationPath) {
  const nearConfig = ChainNetworks.near[network];
  const nearClient = new Client();
  const nodeUrl =
    network === 'testnet'
      ? nearConfig.nodeUrl
      : process.env.VUE_APP_NEAR_MAINNET_URL || nearConfig.nodeUrl;
  const nearNetwork = { ...nearConfig, nodeUrl };
  nearClient.addProvider(new NearRpcProvider(nearNetwork));
  nearClient.addProvider(
    new NearJsWalletProvider({
      network: nearNetwork,
      mnemonic,
      derivationPath,
    })
  );
  nearClient.addProvider(new NearSwapProvider());
  nearClient.addProvider(new NearSwapFindProvider(nearNetwork?.helperUrl));

  return nearClient;
}

function createSolanaClient(network, mnemonic, derivationPath) {
  const solanaNetwork = ChainNetworks.solana[network];
  const solanaClient = new Client();
  solanaClient.addProvider(new SolanaRpcProvider(solanaNetwork));
  solanaClient.addProvider(
    new SolanaWalletProvider({
      network: solanaNetwork,
      mnemonic,
      derivationPath,
    })
  );
  solanaClient.addProvider(new SolanaSwapProvider(solanaNetwork));
  solanaClient.addProvider(new SolanaSwapFindProvider(solanaNetwork));

  return solanaClient;
}

function createRskClient(
  asset,
  network,
  mnemonic,
  accountType,
  derivationPath
) {
  const isTestnet = network === 'testnet';
  const rskNetwork = ChainNetworks.rsk[network];
  const rpcApi = isTestnet
    ? buildConfig.rskRpcUrls.testnet
    : buildConfig.rskRpcUrls.mainnet;
  const scraperApi = isTestnet
    ? 'https://rsk-testnet-api.liq-chainhub.net/'
    : 'https://rsk-mainnet-api.liq-chainhub.net/';
  const feeProvider = new EthereumRpcFeeProvider({
    slowMultiplier: 1,
    averageMultiplier: 1,
    fastMultiplier: 1.25,
  });

  return createEthereumClient(
    asset,
    network,
    rskNetwork,
    rpcApi,
    scraperApi,
    feeProvider,
    mnemonic,
    accountType,
    derivationPath
  );
}

function createBSCClient(asset, network, mnemonic, derivationPath) {
  const isTestnet = network === 'testnet';
  const bnbNetwork = ChainNetworks.bsc[network];
  const rpcApi = isTestnet
    ? 'https://data-seed-prebsc-1-s1.binance.org:8545'
    : 'https://bsc-dataseed.binance.org';
  const scraperApi = isTestnet
    ? 'https://liquality.io/bsc-testnet-api'
    : 'https://liquality.io/bsc-mainnet-api';
  const feeProvider = new EthereumRpcFeeProvider({
    slowMultiplier: 1,
    averageMultiplier: 2,
    fastMultiplier: 2.2,
  });

  return createEthereumClient(
    asset,
    network,
    bnbNetwork,
    rpcApi,
    scraperApi,
    feeProvider,
    mnemonic,
    AccountType.Default,
    derivationPath
  );
}

function createPolygonClient(asset, network, mnemonic, derivationPath) {
  const isTestnet = network === 'testnet';
  const polygonNetwork = ChainNetworks.polygon[network];
  const rpcApi = isTestnet
    ? 'https://rpc-mumbai.maticvigil.com'
    : 'https://polygon-rpc.com';
  const scraperApi = isTestnet
    ? 'https://polygon-mumbai-api.liq-chainhub.net/'
    : 'https://polygon-mainnet-api.liq-chainhub.net/';

  const feeProvider = isTestnet
    ? new EthereumEIP1559FeeProvider({ uri: rpcApi })
    : new EthereumRpcFeeProvider({
        slowMultiplier: 1,
        averageMultiplier: 2,
        fastMultiplier: 2.2,
      });

  return createEthereumClient(
    asset,
    network,
    polygonNetwork,
    rpcApi,
    scraperApi,
    feeProvider,
    mnemonic,
    AccountType.Default,
    derivationPath,
    'london'
  );
}

function createArbitrumClient(asset, network, mnemonic, derivationPath) {
  const isTestnet = network === 'testnet';
  const arbitrumNetwork = ChainNetworks.arbitrum[network];
  const rpcApi = isTestnet
    ? 'https://rinkeby.arbitrum.io/rpc'
    : `https://arbitrum-mainnet.infura.io/v3/${buildConfig.infuraApiKey}`;
  const scraperApi = isTestnet
    ? 'https://arbitrum-rinkeby-api.liq-chainhub.net/'
    : 'https://arbitrum-mainnet-api.liq-chainhub.net/';
  const feeProvider = new EthereumRpcFeeProvider({
    slowMultiplier: 1,
    averageMultiplier: 1,
    fastMultiplier: 1.25,
  });

  return createEthereumClient(
    asset,
    network,
    arbitrumNetwork,
    rpcApi,
    scraperApi,
    feeProvider,
    mnemonic,
    AccountType.Default,
    derivationPath
  );
}

function createAvalancheClient(asset, network, mnemonic, derivationPath) {
  const isTestnet = network === 'testnet';
  const avalancheNetwork = ChainNetworks.avalanche[network];
  const rpcApi = isTestnet
    ? process.env.VUE_APP_AVALANCHE_TESTNET_NODE ||
      'https://api.avax-test.network/ext/bc/C/rpc'
    : process.env.VUE_APP_AVALANCHE_MAINNET_NODE ||
      'https://api.avax.network/ext/bc/C/rpc';
  const scraperApi = isTestnet
    ? 'http://avax-testnet-api.liq-chainhub.net/'
    : 'http://avax-mainnet-api.liq-chainhub.net/';
  const feeProvider = new EthereumRpcFeeProvider({
    slowMultiplier: 1,
    averageMultiplier: 2,
    fastMultiplier: 2.2,
  });

  return createEthereumClient(
    asset,
    network,
    avalancheNetwork,
    rpcApi,
    scraperApi,
    feeProvider,
    mnemonic,
    AccountType.Default,
    derivationPath
  );
}

function createTerraClient(network, mnemonic, baseDerivationPath, asset) {
  const isTestnet = network === 'testnet';
  const terraNetwork = ChainNetworks.terra[network];

  let _asset, feeAsset, tokenAddress, stableFee;

  const nodeUrl = isTestnet
    ? terraNetwork.nodeUrl
    : process.env.VUE_APP_TERRA_MAINNET_URL || terraNetwork.nodeUrl;

  switch (asset) {
    case 'LUNA': {
      _asset = 'uluna';
      feeAsset = 'uluna';
      break;
    }
    case 'UST': {
      _asset = 'uusd';
      feeAsset = 'uusd';
      stableFee = false;
      break;
    }
    default: {
      _asset = asset;
      feeAsset = 'uluna';
      tokenAddress = cryptoassets[asset].contractAddress;
      break;
    }
  }

  const terraClient = new Client();

  terraClient.addProvider(
    new TerraRpcProvider(
      { ...terraNetwork, nodeUrl },
      _asset,
      feeAsset,
      tokenAddress
    )
  );
  terraClient.addProvider(
    new TerraWalletProvider({
      network: { ...terraNetwork, nodeUrl },
      mnemonic,
      baseDerivationPath,
      asset: _asset,
      feeAsset,
      tokenAddress,
      stableFee,
    })
  );
  terraClient.addProvider(
    new TerraSwapProvider({ ...terraNetwork, nodeUrl }, _asset)
  );
  terraClient.addProvider(
    new TerraSwapFindProvider({ ...terraNetwork, nodeUrl }, _asset)
  );

  return terraClient;
}

function createFuseClient(asset, network, mnemonic, derivationPath) {
  const isTestnet = network === 'testnet';
  const fuseNetwork = ChainNetworks.fuse[network];
  const rpcApi = isTestnet ? 'https://rpc.fusespark.io' : 'https://rpc.fuse.io';
  const scraperApi = undefined;
  const feeProvider = new EthereumRpcFeeProvider({
    slowMultiplier: 1,
    averageMultiplier: 1,
    fastMultiplier: 1.25,
  });

  return createEthereumClient(
    asset,
    network,
    fuseNetwork,
    rpcApi,
    scraperApi,
    feeProvider,
    mnemonic,
    AccountType.Default,
    derivationPath
  );
}

export const createClient = (
  asset,
  network,
  mnemonic,
  accountType,
  derivationPath
) => {
  const assetData = cryptoassets[asset];

  if (assetData.chain === 'bitcoin')
    return createBtcClient(network, mnemonic, accountType, derivationPath);
  if (assetData.chain === 'rsk')
    return createRskClient(
      asset,
      network,
      mnemonic,
      accountType,
      derivationPath
    );
  if (assetData.chain === 'bsc')
    return createBSCClient(asset, network, mnemonic, derivationPath);
  if (assetData.chain === 'polygon')
    return createPolygonClient(asset, network, mnemonic, derivationPath);
  if (assetData.chain === 'arbitrum')
    return createArbitrumClient(asset, network, mnemonic, derivationPath);
  if (assetData.chain === 'near')
    return createNearClient(network, mnemonic, derivationPath);
  if (assetData?.chain === 'solana')
    return createSolanaClient(network, mnemonic, derivationPath);
  if (assetData.chain === 'terra')
    return createTerraClient(network, mnemonic, derivationPath, asset);
  if (assetData.chain === 'avalanche')
    return createAvalancheClient(asset, network, mnemonic, derivationPath);
  if (assetData.chain === 'fuse')
    return createFuseClient(asset, network, mnemonic, derivationPath);

  return createEthClient(asset, network, mnemonic, accountType, derivationPath);
};
