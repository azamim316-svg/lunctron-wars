import { useState, useEffect, useCallback } from "react";
import { LCDClient, MsgExecuteContract, Coin } from "@terra-money/feather.js";
import "./App.css";

const CONTRACT = "terra1fldmn62qm52qarx6k63v5mrkypccvpmtnxes7z9s9dc6vsmmnd2qwrs65x";
const CHAIN_ID = "columbus-5";

const TERRA_CLASSIC_CHAIN = {
  chainId: "columbus-5",
  chainName: "Terra Classic",
  rpc: "https://terra-classic-rpc.publicnode.com",
  rest: "https://terra-classic-lcd.publicnode.com",
  bip44: { coinType: 330 },
  bech32Config: {
    bech32PrefixAccAddr: "terra",
    bech32PrefixAccPub: "terrapub",
    bech32PrefixValAddr: "terravaloper",
    bech32PrefixValPub: "terravaloperpub",
    bech32PrefixConsAddr: "terravalcons",
    bech32PrefixConsPub: "terravalconspub",
  },
  currencies: [{ coinDenom: "LUNC", coinMinimalDenom: "uluna", coinDecimals: 6 }],
  feeCurrencies: [{
    coinDenom: "LUNC",
    coinMinimalDenom: "uluna",
    coinDecimals: 6,
    gasPriceStep: { low: 28.325, average: 28.325, high: 28.325 }
  }],
  stakeCurrency: { coinDenom: "LUNC", coinMinimalDenom: "uluna", coinDecimals: 6 },
};

const terra = new LCDClient({
  "columbus-5": {
    lcd: "https://terra-classic-lcd.publicnode.com",
    chainID: "columbus-5",
    gasAdjustment: 1.4,
    gasPrices: { uluna: 28.325 },
    prefix: "terra",
  },
});

const ROBOT_IMAGES: Record<string, string> = {
  Striker:  "/robots/striker.jpg",
  Guardian: "/robots/guardian.jpg",
  Phantom:  "/robots/phantom.jpg",
};

interface Robot {
  class: string;
  attack: number;
  defense: number;
  speed: number;
  wins: number;
  losses: number;
  streak: number;
}

interface GameStats {
  total_battles: string;
  total_burned: string;
}

export default function App() {
  const [address, setAddress]         = useState<string>("");
  const [walletType, setWalletType]   = useState<string>("");
  const [robot, setRobot]             = useState<Robot | null>(null);
  const [gameStats, setGameStats]     = useState<GameStats | null>(null);
  const [opponent, setOpponent]       = useState("");
  const [message, setMessage]         = useState("");
  const [loading, setLoading]         = useState(false);
  const [page, setPage]               = useState<"home" | "battle" | "robot">("home");
  const [showWallets, setShowWallets] = useState(false);

  const isConnected = !!address;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => { loadGameStats(); }, []);

  useEffect(() => {
    if (address) loadRobot();
  }, [address]);

  const loadRobot = useCallback(async () => {
    if (!address) return;
    try {
      const result = await terra.wasm.contractQuery(CONTRACT, { get_robot: { address } });
      setRobot(result as Robot);
    } catch { setRobot(null); }
  }, [address]);

  async function loadGameStats() {
    try {
      const result = await terra.wasm.contractQuery(CONTRACT, { get_game_stats: {} });
      setGameStats(result as GameStats);
    } catch {}
  }

  // ── Connect Keplr ─────────────────────────────────────────
  async function connectKeplr() {
    try {
      const keplr = (window as any).keplr;
      if (!keplr) {
        if (isMobile) {
          window.open("https://www.keplr.app/download", "_blank");
          setMessage("Install Keplr app, then open this site inside Keplr's built-in browser.");
        } else {
          window.open("https://www.keplr.app/download", "_blank");
          setMessage("Keplr extension not found. Install it then refresh this page.");
        }
        setShowWallets(false);
        return;
      }
      await keplr.experimentalSuggestChain(TERRA_CLASSIC_CHAIN);
      await keplr.enable(CHAIN_ID);
      const offlineSigner = keplr.getOfflineSigner(CHAIN_ID);
      const accounts = await offlineSigner.getAccounts();
      setAddress(accounts[0].address);
      setWalletType("keplr");
      setShowWallets(false);
      setMessage("");
    } catch (e: any) {
      setMessage("Keplr error: " + e.message);
    }
  }

  // ── Connect Galaxy Station ────────────────────────────────
  async function connectGalaxy() {
    try {
      const galaxy = (window as any).station || (window as any).galaxystation;
      if (!galaxy) {
        if (isMobile) {
          window.open("https://station.terraclassic.community", "_blank");
          setMessage("Open this site inside Galaxy Station's built-in browser.");
        } else {
          window.open("https://chromewebstore.google.com/detail/galaxy-station-wallet/akckefnapafjbpphkefbpkpcamkoaoai", "_blank");
          setMessage("Galaxy Station not found. Install it then refresh this page.");
        }
        setShowWallets(false);
        return;
      }
      const info = await galaxy.connect();
      const addr = info?.address || info?.addresses?.[CHAIN_ID] || info?.[CHAIN_ID];
      if (addr) {
        setAddress(addr);
        setWalletType("galaxy");
        setShowWallets(false);
        setMessage("");
      } else {
        setMessage("Could not get address from Galaxy Station.");
      }
    } catch (e: any) {
      setMessage("Galaxy Station error: " + e.message);
    }
  }

  // ── Connect LuncDash ──────────────────────────────────────
  function connectLuncDash() {
    setShowWallets(false);
    if (isMobile) {
      window.open("https://wallet.luncdash.com", "_blank");
      setMessage("Open this site inside LuncDash's built-in browser to play.");
    } else {
      setMessage("LuncDash is mobile only. Download the app and open this site in its browser.");
    }
  }

  // ── Disconnect ────────────────────────────────────────────
  function disconnect() {
    setAddress("");
    setWalletType("");
    setRobot(null);
    setMessage("");
  }

  // ── Post transaction ──────────────────────────────────────
  async function postTx(msgs: any[]) {
    if (walletType === "keplr") {
      const keplr = (window as any).keplr;
      await keplr.enable(CHAIN_ID);
      const offlineSigner = keplr.getOfflineSigner(CHAIN_ID);
      const accounts = await offlineSigner.getAccounts();
      const aminoMsgs = msgs.map((msg: any) => ({
        type: "wasm/MsgExecuteContract",
        value: {
          sender: msg.sender,
          contract: msg.contract,
          msg: msg.execute_msg || msg.msg,
          funds: msg.coins?.toArray().map((c: any) => ({ denom: c.denom, amount: c.amount.toString() })) || [],
        },
      }));
      const fee = { amount: [{ denom: "uluna", amount: "200000" }], gas: "200000" };
      const memo = "LUNCtron Wars";
      const signed = await keplr.signAmino(CHAIN_ID, accounts[0].address, {
        chain_id: CHAIN_ID,
        account_number: "0",
        sequence: "0",
        fee,
        msgs: aminoMsgs,
        memo,
      });
      return { txhash: signed.signature.pub_key.value };
    }

    if (walletType === "galaxy") {
      const galaxy = (window as any).station || (window as any).galaxystation;
      const tx = await galaxy.post({ msgs, chainID: CHAIN_ID });
      return tx;
    }

    throw new Error("No wallet connected");
  }

  // ── Register robot ────────────────────────────────────────
  async function registerRobot() {
    if (!address) return;
    setLoading(true);
    setMessage("");
    try {
      const msg = new MsgExecuteContract(address, CONTRACT, { register_robot: {} });
      const tx = await postTx([msg as any]);
      setMessage("Robot registered! Tx: " + tx.txhash);
      setTimeout(loadRobot, 3000);
    } catch (e: any) { setMessage("Error: " + e.message); }
    setLoading(false);
  }

  // ── Enter battle ──────────────────────────────────────────
  async function enterBattle() {
    if (!address || !opponent) return;
    setLoading(true);
    setMessage("");
    try {
      const msg = new MsgExecuteContract(
        address, CONTRACT,
        { enter_battle: { opponent } },
        [new Coin("ultrn", 500000), new Coin("uluna", 500)]
      );
      const tx = await postTx([msg as any]);
      setMessage("Battle complete! Tx: " + tx.txhash);
      setTimeout(() => { loadRobot(); loadGameStats(); }, 3000);
    } catch (e: any) { setMessage("Error: " + e.message); }
    setLoading(false);
  }

  // ── Upgrade stat ──────────────────────────────────────────
  async function upgradeStat(stat: string) {
    if (!address) return;
    setLoading(true);
    setMessage("");
    try {
      const msg = new MsgExecuteContract(
        address, CONTRACT,
        { upgrade_stat: { stat } },
        [new Coin("ultrn", 2000000)]
      );
      const tx = await postTx([msg as any]);
      setMessage("Stat upgraded! Tx: " + tx.txhash);
      setTimeout(loadRobot, 3000);
    } catch (e: any) { setMessage("Error: " + e.message); }
    setLoading(false);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">LUNCTRON WARS</span>
        </div>
        <nav className="nav">
          <button onClick={() => setPage("home")}   className={page === "home"   ? "nav-btn active" : "nav-btn"}>Home</button>
          <button onClick={() => setPage("robot")}  className={page === "robot"  ? "nav-btn active" : "nav-btn"}>My Robot</button>
          <button onClick={() => setPage("battle")} className={page === "battle" ? "nav-btn active" : "nav-btn"}>Battle</button>
        </nav>
        <div style={{position:"relative"}}>
          {isConnected ? (
            <button onClick={disconnect} className="wallet-btn connected">
              {address.slice(0,8)}...{address.slice(-4)}
            </button>
          ) : (
            <button onClick={() => setShowWallets(!showWallets)} className="wallet-btn">
              Connect Wallet
            </button>
          )}
          {showWallets && !isConnected && (
            <div className="wallet-dropdown">
              <div className="wallet-section-label">
                {isMobile ? "📱 Mobile Wallets" : "🖥️ Browser Wallets"}
              </div>
              <button onClick={connectKeplr} className="wallet-option">
                🔑 Keplr {isMobile ? "(Open in Keplr browser)" : "Extension"}
              </button>
              <button onClick={connectGalaxy} className="wallet-option">
                🌌 Galaxy Station {isMobile ? "(Open in Galaxy browser)" : "Extension"}
              </button>
              <button onClick={connectLuncDash} className="wallet-option">
                🌙 LuncDash {isMobile ? "(Open in LuncDash browser)" : "(Mobile only)"}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main">
        {page === "home" && (
          <div className="page-home">
            <div className="hero">
              <h1 className="hero-title">LUNCTRON WARS</h1>
              <p className="hero-sub">Sci-Fi Robot Battles on Terra Classic</p>
              <p className="hero-desc">
                Deploy your robot. Pay in LTRN + LUNC. Win battles. Earn rewards.<br/>
                Every battle burns tokens. Every win grows your power.
              </p>
              {!isConnected && (
                <button onClick={() => setShowWallets(true)} className="cta-btn">
                  Connect Wallet to Play
                </button>
              )}
              {isConnected && !robot && (
                <button onClick={registerRobot} className="cta-btn" disabled={loading}>
                  {loading ? "Registering..." : "Register Your Robot"}
                </button>
              )}
              {isConnected && robot && (
                <button onClick={() => setPage("battle")} className="cta-btn">
                  Enter Battle ⚔️
                </button>
              )}
            </div>

            {gameStats && (
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-val">{gameStats.total_battles}</div>
                  <div className="stat-lbl">Total Battles</div>
                </div>
                <div className="stat-card">
                  <div className="stat-val">{(parseInt(gameStats.total_burned) / 1_000_000).toLocaleString()}M</div>
                  <div className="stat-lbl">LTRN Burned</div>
                </div>
                <div className="stat-card">
                  <div className="stat-val">LIVE</div>
                  <div className="stat-lbl">Network Status</div>
                </div>
              </div>
            )}

            <div className="classes-section">
              <h2 className="section-title">Choose Your Fighter</h2>
              <div className="classes-grid">
                <div className="class-card">
                  <img src="/robots/striker.jpg" alt="Striker" className="class-img"/>
                  <h3>STRIKER</h3>
                  <p>High Attack · Glass Cannon</p>
                </div>
                <div className="class-card">
                  <img src="/robots/guardian.jpg" alt="Guardian" className="class-img"/>
                  <h3>GUARDIAN</h3>
                  <p>High Defense · Tank</p>
                </div>
                <div className="class-card">
                  <img src="/robots/phantom.jpg" alt="Phantom" className="class-img"/>
                  <h3>PHANTOM</h3>
                  <p>High Speed · Trickster</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {page === "robot" && (
          <div className="page-robot">
            {!isConnected ? (
              <div className="connect-prompt">
                <p>Connect your wallet to see your robot</p>
                <button onClick={() => setShowWallets(true)} className="cta-btn">Connect Wallet</button>
              </div>
            ) : !robot ? (
              <div className="connect-prompt">
                <p>You don't have a robot yet!</p>
                <button onClick={registerRobot} className="cta-btn" disabled={loading}>
                  {loading ? "Registering..." : "Register Robot"}
                </button>
              </div>
            ) : (
              <div className="robot-page">
                <div className="robot-display">
                  <img src={ROBOT_IMAGES[robot.class]} alt={robot.class} className="robot-img"/>
                  <div className="robot-info">
                    <h2 className="robot-class">{robot.class}</h2>
                    <div className="robot-record">{robot.wins}W / {robot.losses}L · Streak: {robot.streak}</div>
                    <div className="stats-bars">
                      <div className="stat-bar-row">
                        <span>Attack</span>
                        <div className="bar-track"><div className="bar-fill attack" style={{width: robot.attack + "%"}}/></div>
                        <span>{robot.attack}</span>
                      </div>
                      <div className="stat-bar-row">
                        <span>Defense</span>
                        <div className="bar-track"><div className="bar-fill defense" style={{width: robot.defense + "%"}}/></div>
                        <span>{robot.defense}</span>
                      </div>
                      <div className="stat-bar-row">
                        <span>Speed</span>
                        <div className="bar-track"><div className="bar-fill speed" style={{width: robot.speed + "%"}}/></div>
                        <span>{robot.speed}</span>
                      </div>
                    </div>
                    <div className="upgrade-section">
                      <h3>Upgrade Stats (2M LTRN each)</h3>
                      <div className="upgrade-btns">
                        <button onClick={() => upgradeStat("attack")}  disabled={loading} className="upgrade-btn">⚔️ Attack</button>
                        <button onClick={() => upgradeStat("defense")} disabled={loading} className="upgrade-btn">🛡️ Defense</button>
                        <button onClick={() => upgradeStat("speed")}   disabled={loading} className="upgrade-btn">⚡ Speed</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {page === "battle" && (
          <div className="page-battle">
            {!isConnected ? (
              <div className="connect-prompt">
                <p>Connect your wallet to battle</p>
                <button onClick={() => setShowWallets(true)} className="cta-btn">Connect Wallet</button>
              </div>
            ) : !robot ? (
              <div className="connect-prompt">
                <p>Register your robot first!</p>
                <button onClick={() => setPage("robot")} className="cta-btn">Go to My Robot</button>
              </div>
            ) : (
              <div className="battle-arena">
                <h2 className="section-title">⚔️ Battle Arena</h2>
                <div className="battle-info">
                  <div className="battle-cost">
                    <span>Entry fee:</span>
                    <strong>500,000 LTRN + 500 LUNC</strong>
                  </div>
                  <div className="battle-reward">
                    <span>Winner earns:</span>
                    <strong>600,000 LTRN</strong>
                  </div>
                </div>
                <div className="battle-form">
                  <input
                    className="opponent-input"
                    placeholder="Enter opponent wallet address (terra1...)"
                    value={opponent}
                    onChange={e => setOpponent(e.target.value)}
                  />
                  <button onClick={enterBattle} disabled={loading || !opponent} className="battle-btn">
                    {loading ? "Battling..." : "⚔️ ENTER BATTLE"}
                  </button>
                </div>
                {message && (
                  <div className={message.startsWith("Error") ? "msg-error" : "msg-success"}>
                    {message}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {message && page !== "battle" && (
          <div className={message.startsWith("Error") ? "msg-error" : "msg-success"}>
            {message}
          </div>
        )}
      </main>
    </div>
  );
}