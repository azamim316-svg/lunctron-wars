import { useState, useEffect } from "react";
import { useWallet, useConnectedWallet } from "@terra-money/wallet-kit";
import { LCDClient, MsgExecuteContract, Coin } from "@terra-money/feather.js";
import "./App.css";

const CONTRACT = "terra1fldmn62qm52qarx6k63v5mrkypccvpmtnxes7z9s9dc6vsmmnd2qwrs65x";

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
  const { connect, disconnect, status, availableWallets, post } = useWallet();
  const connectedWallet = useConnectedWallet();

  const [robot, setRobot]         = useState<Robot | null>(null);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [opponent, setOpponent]   = useState("");
  const [message, setMessage]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState<"home" | "battle" | "robot">("home");
  const [showWallets, setShowWallets] = useState(false);

  const address = connectedWallet?.addresses["columbus-5"];
  const isConnected = status === "WALLET_CONNECTED" && !!address;

  useEffect(() => {
    if (isConnected) {
      loadRobot();
      loadGameStats();
    }
  }, [isConnected]);

  async function loadRobot() {
    if (!address) return;
    try {
      const result = await terra.wasm.contractQuery(CONTRACT, {
        get_robot: { address }
      });
      setRobot(result as Robot);
    } catch {
      setRobot(null);
    }
  }

  async function loadGameStats() {
    try {
      const result = await terra.wasm.contractQuery(CONTRACT, {
        get_game_stats: {}
      });
      setGameStats(result as GameStats);
    } catch {}
  }

  async function registerRobot() {
    if (!address) return;
    setLoading(true);
    setMessage("");
    try {
      const msg = new MsgExecuteContract(
        address, CONTRACT,
        { register_robot: {} }
      );
      const tx = await post({ msgs: [msg as any], chainID: "columbus-5" });
      setMessage("Robot registered! Tx: " + tx.txhash);
      setTimeout(loadRobot, 3000);
    } catch (e: any) {
      setMessage("Error: " + e.message);
    }
    setLoading(false);
  }

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
      const tx = await post({ msgs: [msg as any], chainID: "columbus-5" });
      setMessage("Battle complete! Tx: " + tx.txhash);
      setTimeout(() => { loadRobot(); loadGameStats(); }, 3000);
    } catch (e: any) {
      setMessage("Error: " + e.message);
    }
    setLoading(false);
  }

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
      const tx = await post({ msgs: [msg as any], chainID: "columbus-5" });
      setMessage("Stat upgraded! Tx: " + tx.txhash);
      setTimeout(loadRobot, 3000);
    } catch (e: any) {
      setMessage("Error: " + e.message);
    }
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
            <button onClick={() => disconnect()} className="wallet-btn connected">
              {address?.slice(0,8)}...{address?.slice(-4)}
            </button>
          ) : (
            <button onClick={() => setShowWallets(!showWallets)} className="wallet-btn">
              Connect Wallet
            </button>
          )}
          {showWallets && !isConnected && (
            <div className="wallet-dropdown">
              {availableWallets.map(({ id, name, isInstalled }) => (
                <button
                  key={id}
                  disabled={!isInstalled}
                  onClick={() => { connect(id); setShowWallets(false); }}
                  className="wallet-option"
                >
                  {name} {!isInstalled && "(Not installed)"}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="main">

        {/* HOME PAGE */}
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

        {/* ROBOT PAGE */}
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

        {/* BATTLE PAGE */}
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