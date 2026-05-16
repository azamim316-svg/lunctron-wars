use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use cosmwasm_std::Addr;
use cw_storage_plus::{Item, Map};

// ── Game Config ─────────────────────────────────────────────
// Stores the global game settings set by the developer
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    pub owner: Addr,           // Developer wallet address
    pub reward_pool: Addr,     // Address holding LTRN rewards
    pub dev_wallet: Addr,      // Developer revenue wallet
    pub ltrn_entry_fee: u128,  // 500000 LTRN per player
    pub lunc_entry_fee: u128,  // 500 LUNC per player
    pub daily_battle_cap: u8,  // Max 20 battles per wallet per day
    pub is_paused: bool,       // Emergency pause switch
}

// ── Robot Stats ──────────────────────────────────────────────
// Stores each player's robot — one robot per wallet address
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Robot {
    pub owner: Addr,        // Player's wallet address
    pub attack: u8,         // 1-100 attack stat
    pub defense: u8,        // 1-100 defense stat
    pub speed: u8,          // 1-100 speed stat
    pub class: String,      // "Striker", "Guardian" or "Phantom"
    pub wins: u32,          // Total wins
    pub losses: u32,        // Total losses
    pub streak: u8,         // Current win streak
}

// ── Battle Record ────────────────────────────────────────────
// Stores the result of every battle for transparency
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct BattleRecord {
    pub battle_id: u64,       // Unique battle number
    pub player1: Addr,        // First player
    pub player2: Addr,        // Second player
    pub winner: Addr,         // Who won
    pub ltrn_reward: u128,    // How much LTRN winner received
    pub timestamp: u64,       // When the battle happened
}

// ── Daily Battle Tracker ─────────────────────────────────────
// Tracks how many battles a wallet has done today (anti-bot)
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct DailyTracker {
    pub battles_today: u8,   // Number of battles today
    pub last_battle_day: u64, // The day number of last battle
}

// ── Storage ──────────────────────────────────────────────────
// These are the actual database tables stored on the blockchain

// One global config for the whole game
pub const CONFIG: Item<Config> = Item::new("config");

// One robot per player wallet (wallet address → robot)
pub const ROBOTS: Map<&Addr, Robot> = Map::new("robots");

// Battle history (battle_id → battle record)
pub const BATTLES: Map<u64, BattleRecord> = Map::new("battles");

// Daily battle counter per wallet (wallet address → tracker)
pub const DAILY_TRACKER: Map<&Addr, DailyTracker> = Map::new("daily_tracker");

// Total number of battles ever — used as battle ID counter
pub const BATTLE_COUNT: Item<u64> = Item::new("battle_count");

// Total LTRN burned all time — for display on the website
pub const TOTAL_BURNED: Item<u128> = Item::new("total_burned");