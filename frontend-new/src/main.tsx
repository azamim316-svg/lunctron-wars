import { Buffer } from 'buffer'
window.Buffer = Buffer
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChainProvider } from '@cosmos-kit/react-lite'
import { wallets as keplrExtension } from '@cosmos-kit/keplr-extension'
import { wallets as keplrMobile } from '@cosmos-kit/keplr-mobile'
import './index.css'
import App from './App.tsx'

// Terra Classic chain definition (not in chain-registry)
const terraClassicChain = {
  chain_name: 'terra-classic',
  chain_id: 'columbus-5',
  pretty_name: 'Terra Classic',
  status: 'live',
  network_type: 'mainnet',
  bech32_prefix: 'terra',
  slip44: 330,
  fees: {
    fee_tokens: [{
      denom: 'uluna',
      fixed_min_gas_price: 28.325,
      low_gas_price: 28.325,
      average_gas_price: 28.325,
      high_gas_price: 28.325,
    }]
  },
  staking: {
    staking_tokens: [{ denom: 'uluna' }]
  },
  apis: {
    rpc: [{ address: 'https://terra-classic-rpc.publicnode.com' }],
    rest: [{ address: 'https://terra-classic-lcd.publicnode.com' }],
  },
  explorers: [{
    name: 'Terra Finder',
    url: 'https://finder.terra.money/classic',
    tx_page: 'https://finder.terra.money/classic/tx/${txHash}',
  }],
}

const terraClassicAssets = {
  chain_name: 'terra-classic',
  assets: [{
    name: 'Terra Classic',
    base: 'uluna',
    display: 'lunc',
    symbol: 'LUNC',
    denom_units: [
      { denom: 'uluna', exponent: 0 },
      { denom: 'lunc', exponent: 6 },
    ],
    coingecko_id: 'terra-luna',
    images: [{
      png: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/terra/images/luna.png'
    }],
  }]
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChainProvider
      chains={[terraClassicChain as any]}
      assetLists={[terraClassicAssets as any]}
      wallets={[...keplrExtension, ...keplrMobile] as any}
      walletConnectOptions={{
        signClient: {
          projectId: '54aab0c16932375eebc8fc7aefb383ea',
          metadata: {
            name: 'LUNCtron Wars',
            description: 'Sci-Fi Robot Battle Game on Terra Classic',
            url: 'https://peaceful-crisp-fdf816.netlify.app',
            icons: ['https://peaceful-crisp-fdf816.netlify.app/robots/guardian.jpg'],
          },
        },
      }}
    >
      <App />
    </ChainProvider>
  </StrictMode>,
)