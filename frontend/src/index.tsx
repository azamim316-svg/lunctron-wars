import { getInitialConfig, WalletProvider } from "@terra-money/wallet-kit";
import App from "./App";
import ReactDOM from "react-dom";
import "./index.css";

const classicNetworks = {
  mainnet: {
    "columbus-5": {
      chainID: "columbus-5",
      lcd: "https://terra-classic-lcd.publicnode.com",
      gasAdjustment: 1.4,
      gasPrices: { uluna: 28.325 },
      prefix: "terra",
    },
  },
};

getInitialConfig().then((config) => {
  ReactDOM.render(
    <WalletProvider defaultNetworks={classicNetworks}>
      <App />
    </WalletProvider>,
    document.getElementById("root")
  );
});