import { getInitialConfig, WalletProvider } from "@terra-money/wallet-kit";
import App from "./App";
import ReactDOM from "react-dom";
import "./index.css";

const classicNetworks = {
  "columbus-5": {
    chainID: "columbus-5",
    lcd: "https://terra-classic-lcd.publicnode.com",
    gasAdjustment: 1.4,
    gasPrices: { uluna: 28.325 },
    prefix: "terra",
  },
};

ReactDOM.render(
  <WalletProvider defaultNetworks={classicNetworks as unknown as any}>
    <App />
  </WalletProvider>,
  document.getElementById("root")
);