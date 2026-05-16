use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use cosmwasm_std::Addr;

// ── Instantiate Message ──────────────────────────────────────
// This runs ONCE when we first deploy the contract
// This is where we set the initial game configuration
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub dev_wallet: String,    // Your personal wallet address
    pub reward_pool: String,   // Wallet that holds LTRN rewards
    pub ltrn_entry_fee: u128,  // 500000 LTRN
    pub lunc_entry_fee: u128,  // 500 LUNC
    pub daily_battle_cap: u8,  // 20 battles per day
}

// ── Execute Messages ─────────────────────────────────────────
// These are the ACTIONS players and admin can take
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    // Player registers and gets their robot assigned
    RegisterRobot {},

    // Player enters a battle against another player
    EnterBattle {
        opponent: String,  // Opponent's wallet address
    },

    // Player upgrades one of their robot's stats
    UpgradeStat {
        stat: String,  // "attack", "defense" or "speed"
    },

    // Admin only — update game settings
    UpdateConfig {
        ltrn_entry_fee: Option<u128>,
        lunc_entry_fee: Option<u128>,
        daily_battle_cap: Option<u8>,
    },

    // Admin only — pause or unpause the game
    SetPaused {
        paused: bool,
    },

    // Admin only — top up the reward pool manually
    TopUpRewardPool {
        amount: u128,
    },
}

// ── Query Messages ───────────────────────────────────────────
// These are READ ONLY requests — no fees, just fetching data
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    // Get a player's robot stats
    GetRobot {
        address: String,
    },

    // Get details of a specific battle
    GetBattle {
        battle_id: u64,
    },

    // Get the game config
    GetConfig {},

    // Get total battles and total LTRN burned
    GetGameStats {},

    // Get a player's daily battle count
    GetDailyTracker {
        address: String,
    },
}

// ── Query Responses ──────────────────────────────────────────
// These define what data comes BACK when someone queries

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct RobotResponse {
    pub owner: String,
    pub attack: u8,
    pub defense: u8,
    pub speed: u8,
    pub class: String,
    pub wins: u32,
    pub losses: u32,
    pub streak: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct BattleResponse {
    pub battle_id: u64,
    pub player1: String,
    pub player2: String,
    pub winner: String,
    pub ltrn_reward: u128,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct GameStatsResponse {
    pub total_battles: u64,
    pub total_burned: u128,
}