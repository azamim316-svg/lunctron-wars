#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
    to_binary, Binary, Deps, DepsMut, Env, MessageInfo,
    Response, StdResult, Uint128, BankMsg, CosmosMsg, Coin,
    StdError,
};
use cw2::set_contract_version;

use crate::error::ContractError;
use crate::msg::{
    ExecuteMsg, InstantiateMsg, QueryMsg,
    RobotResponse, BattleResponse, GameStatsResponse,
};
use crate::state::{
    Config, Robot, BattleRecord, DailyTracker,
    CONFIG, ROBOTS, BATTLES, DAILY_TRACKER,
    BATTLE_COUNT, TOTAL_BURNED,
};

// Contract name and version — saved on chain
const CONTRACT_NAME: &str = "lunctron-wars";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

// Token denoms on Terra Classic
const LUNC_DENOM: &str = "uluna";        // LUNC (microLUNA)
const LTRN_DENOM: &str = "ultrn";       // LTRN token denom

// Fee split percentages for LTRN
const LTRN_REWARD_POOL_PCT: u128 = 60;  // 60% to winner pool
const LTRN_BURN_PCT: u128 = 20;         // 20% burned
const LTRN_DEV_PCT: u128 = 10;          // 10% to dev wallet
const LTRN_POOL_TOPUP_PCT: u128 = 10;   // 10% tops up reward pool

// Fee split percentages for LUNC
const LUNC_BURN_PCT: u128 = 20;         // 20% burned
const LUNC_BUYBACK_PCT: u128 = 50;      // 50% for LTRN buyback
const LUNC_DEV_PCT: u128 = 20;          // 20% to dev wallet
const LUNC_POOL_PCT: u128 = 10;         // 10% to reward pool

// Upgrade costs in LTRN
const UPGRADE_COST_LVL1: u128 = 2_000_000;
const UPGRADE_COST_LVL2: u128 = 5_000_000;
const UPGRADE_COST_LVL3: u128 = 10_000_000;
const UPGRADE_COST_LVL4: u128 = 20_000_000;

// Streak bonus multipliers
const STREAK_3_BONUS: u128 = 10; // +10%
const STREAK_5_BONUS: u128 = 20; // +20%

// Minimum reward pool before game auto-pauses
const MIN_POOL_THRESHOLD: u128 = 10_000_000;
// ── INSTANTIATE ──────────────────────────────────────────────
// This runs ONCE when the contract is first deployed
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    // Save the contract version on chain
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    // Validate the addresses provided
    let dev_wallet = deps.api.addr_validate(&msg.dev_wallet)?;
    let reward_pool = deps.api.addr_validate(&msg.reward_pool)?;

    // Build the initial game config
    let config = Config {
        owner: info.sender.clone(),  // Deployer becomes owner
        dev_wallet,
        reward_pool,
        ltrn_entry_fee: msg.ltrn_entry_fee,
        lunc_entry_fee: msg.lunc_entry_fee,
        daily_battle_cap: msg.daily_battle_cap,
        is_paused: false,  // Game starts unpaused
    };

    // Save config to blockchain storage
    CONFIG.save(deps.storage, &config)?;

    // Initialize battle counter at 0
    BATTLE_COUNT.save(deps.storage, &0u64)?;

    // Initialize total burned at 0
    TOTAL_BURNED.save(deps.storage, &0u128)?;

    Ok(Response::new()
        .add_attribute("action", "instantiate")
        .add_attribute("owner", info.sender)
        .add_attribute("game", "LUNCtron Wars"))
}

// ── EXECUTE ───────────────────────────────────────────────────
// Routes player actions to the right function
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    // Block all actions if game is paused
    let config = CONFIG.load(deps.storage)?;
    if config.is_paused {
        match msg {
            // Only allow admin to unpause
            ExecuteMsg::SetPaused { paused: false } => {},
            _ => return Err(ContractError::GamePaused {}),
        }
    }

    match msg {
        ExecuteMsg::RegisterRobot {} => execute_register_robot(deps, env, info),
        ExecuteMsg::EnterBattle { opponent } => execute_enter_battle(deps, env, info, opponent),
        ExecuteMsg::UpgradeStat { stat } => execute_upgrade_stat(deps, env, info, stat),
        ExecuteMsg::UpdateConfig {
            ltrn_entry_fee,
            lunc_entry_fee,
            daily_battle_cap,
        } => execute_update_config(deps, info, ltrn_entry_fee, lunc_entry_fee, daily_battle_cap),
        ExecuteMsg::SetPaused { paused } => execute_set_paused(deps, info, paused),
        ExecuteMsg::TopUpRewardPool { amount } => execute_topup_pool(deps, info, amount),
    }
}// ── REGISTER ROBOT ───────────────────────────────────────────
// Player calls this once to create their robot
fn execute_register_robot(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
) -> Result<Response, ContractError> {
    // Check if player already has a robot
    if ROBOTS.has(deps.storage, &info.sender) {
        return Err(ContractError::RobotAlreadyExists {});
    }

    // Generate stats from wallet address + block height
    // This makes every robot unique but consistent
    let addr_bytes = info.sender.as_bytes();
    let block = env.block.height;

    let attack  = ((addr_bytes[0] as u64 + block) % 80 + 15) as u8;  // 15-95
    let defense = ((addr_bytes[1] as u64 + block) % 80 + 15) as u8;  // 15-95
    let speed   = ((addr_bytes[2] as u64 + block) % 80 + 15) as u8;  // 15-95

    // Assign class based on highest stat
    let class = if attack >= defense && attack >= speed {
        "Striker".to_string()
    } else if defense >= attack && defense >= speed {
        "Guardian".to_string()
    } else {
        "Phantom".to_string()
    };

    // Build the robot
    let robot = Robot {
        owner: info.sender.clone(),
        attack,
        defense,
        speed,
        class: class.clone(),
        wins: 0,
        losses: 0,
        streak: 0,
    };

    // Save robot to blockchain
    ROBOTS.save(deps.storage, &info.sender, &robot)?;

    Ok(Response::new()
        .add_attribute("action", "register_robot")
        .add_attribute("owner", info.sender)
        .add_attribute("class", class)
        .add_attribute("attack", attack.to_string())
        .add_attribute("defense", defense.to_string())
        .add_attribute("speed", speed.to_string()))
}

// ── ENTER BATTLE ─────────────────────────────────────────────
// The main game function — two players battle each other
fn execute_enter_battle(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    opponent: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let opponent_addr = deps.api.addr_validate(&opponent)?;

    // Cannot battle yourself
    if info.sender == opponent_addr {
        return Err(ContractError::CannotBattleSelf {});
    }

    // Load both robots — both must be registered
    let robot1 = ROBOTS.load(deps.storage, &info.sender)
        .map_err(|_| ContractError::RobotNotFound {})?;
    let robot2 = ROBOTS.load(deps.storage, &opponent_addr)
        .map_err(|_| ContractError::RobotNotFound {})?;

    // Check daily battle cap for the attacker
    let today = env.block.time.seconds() / 86400; // Convert to day number
    let tracker = DAILY_TRACKER
        .may_load(deps.storage, &info.sender)?
        .unwrap_or(DailyTracker { battles_today: 0, last_battle_day: 0 });

    let battles_today = if tracker.last_battle_day == today {
        tracker.battles_today
    } else {
        0 // New day — reset counter
    };

    if battles_today >= config.daily_battle_cap {
        return Err(ContractError::DailyCapReached {});
    }

    // Verify entry fees were sent
    let ltrn_sent = info.funds.iter()
        .find(|c| c.denom == LTRN_DENOM)
        .map(|c| c.amount.u128())
        .unwrap_or(0);

    let lunc_sent = info.funds.iter()
        .find(|c| c.denom == LUNC_DENOM)
        .map(|c| c.amount.u128())
        .unwrap_or(0);

    if ltrn_sent < config.ltrn_entry_fee {
        return Err(ContractError::InsufficientLtrnFee {});
    }
    if lunc_sent < config.lunc_entry_fee {
        return Err(ContractError::InsufficientLuncFee {});
    }

    // ── Run the battle ───────────────────────────────────────
    // Use block hash + addresses as randomness seed
    let seed = env.block.height
        .wrapping_add(info.sender.as_bytes()[0] as u64)
        .wrapping_add(opponent_addr.as_bytes()[0] as u64);

    let winner_is_player1 = simulate_battle(&robot1, &robot2, seed);

    let (winner_addr, mut winner_robot, mut loser_robot) = if winner_is_player1 {
        (info.sender.clone(), robot1.clone(), robot2.clone())
    } else {
        (opponent_addr.clone(), robot2.clone(), robot1.clone())
    };

    // ── Calculate reward ─────────────────────────────────────
    // Total LTRN collected from both players
    let total_ltrn = config.ltrn_entry_fee * 2;

    // Base reward is 60% of total
    let base_reward = total_ltrn * LTRN_REWARD_POOL_PCT / 100;

    // Apply streak bonus
    let reward = if winner_robot.streak >= 5 {
        base_reward + (base_reward * STREAK_5_BONUS / 100)
    } else if winner_robot.streak >= 3 {
        base_reward + (base_reward * STREAK_3_BONUS / 100)
    } else {
        base_reward
    };

    // ── Calculate fee splits ─────────────────────────────────
    let ltrn_burn   = total_ltrn * LTRN_BURN_PCT / 100;
    let ltrn_dev    = total_ltrn * LTRN_DEV_PCT / 100;
    let ltrn_topup  = total_ltrn * LTRN_POOL_TOPUP_PCT / 100;

    let lunc_total  = config.lunc_entry_fee * 2;
    let lunc_burn   = lunc_total * LUNC_BURN_PCT / 100;
    let lunc_buyback = lunc_total * LUNC_BUYBACK_PCT / 100;
    let lunc_dev    = lunc_total * LUNC_DEV_PCT / 100;
    let lunc_pool   = lunc_total * LUNC_POOL_PCT / 100;

    // ── Update winner stats ──────────────────────────────────
    winner_robot.wins += 1;
    winner_robot.streak += 1;
    loser_robot.losses += 1;
    loser_robot.streak = 0;

    // Save updated robot stats
    ROBOTS.save(deps.storage, &winner_addr, &winner_robot)?;
    let loser_addr = if winner_is_player1 { &opponent_addr } else { &info.sender };
    ROBOTS.save(deps.storage, loser_addr, &loser_robot)?;

    // ── Update daily tracker ─────────────────────────────────
    DAILY_TRACKER.save(deps.storage, &info.sender, &DailyTracker {
        battles_today: battles_today + 1,
        last_battle_day: today,
    })?;

    // ── Update battle count and burned total ─────────────────
    let battle_id = BATTLE_COUNT.load(deps.storage)?;
    BATTLE_COUNT.save(deps.storage, &(battle_id + 1))?;

    let total_burned = TOTAL_BURNED.load(deps.storage)?;
    TOTAL_BURNED.save(deps.storage, &(total_burned + ltrn_burn))?;

    // ── Save battle record ───────────────────────────────────
    let record = BattleRecord {
        battle_id,
        player1: info.sender.clone(),
        player2: opponent_addr.clone(),
        winner: winner_addr.clone(),
        ltrn_reward: reward,
        timestamp: env.block.time.seconds(),
    };
    BATTLES.save(deps.storage, battle_id, &record)?;

    // ── Build blockchain messages ────────────────────────────
    // Send reward to winner
    let mut messages: Vec<CosmosMsg> = vec![
        CosmosMsg::Bank(BankMsg::Send {
            to_address: winner_addr.to_string(),
            amount: vec![Coin {
                denom: LTRN_DENOM.to_string(),
                amount: Uint128::from(reward),
            }],
        }),
        // Send LTRN dev fee
        CosmosMsg::Bank(BankMsg::Send {
            to_address: config.dev_wallet.to_string(),
            amount: vec![Coin {
                denom: LTRN_DENOM.to_string(),
                amount: Uint128::from(ltrn_dev),
            }],
        }),
        // Send LUNC dev fee
        CosmosMsg::Bank(BankMsg::Send {
            to_address: config.dev_wallet.to_string(),
            amount: vec![Coin {
                denom: LUNC_DENOM.to_string(),
                amount: Uint128::from(lunc_dev),
            }],
        }),
        // Send LUNC buyback amount to dev wallet
        // Dev wallet executes the buyback manually or via script
        CosmosMsg::Bank(BankMsg::Send {
            to_address: config.dev_wallet.to_string(),
            amount: vec![Coin {
                denom: LUNC_DENOM.to_string(),
                amount: Uint128::from(lunc_buyback),
            }],
        }),
        // Send pool top-up to reward pool
        CosmosMsg::Bank(BankMsg::Send {
            to_address: config.reward_pool.to_string(),
            amount: vec![Coin {
                denom: LTRN_DENOM.to_string(),
                amount: Uint128::from(ltrn_topup),
            }],
        }),
    ];

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("action", "battle")
        .add_attribute("battle_id", battle_id.to_string())
        .add_attribute("winner", winner_addr)
        .add_attribute("reward", reward.to_string())
        .add_attribute("ltrn_burned", ltrn_burn.to_string())
        .add_attribute("lunc_burned", lunc_burn.to_string()))
}

// ── BATTLE SIMULATION ────────────────────────────────────────
// Pure math — no storage access — runs the actual battle
fn simulate_battle(robot1: &Robot, robot2: &Robot, seed: u64) -> bool {
    let mut hp1: i32 = 100;
    let mut hp2: i32 = 100;
    let mut rng = seed;

    for _ in 0..10 {
        // Simple random number generator
        rng = rng.wrapping_mul(6364136223846793005)
                 .wrapping_add(1442695040888963407);
        let rand = (rng >> 33) % 40; // 0-39 random modifier

        // Determine who attacks first based on speed
        let p1_first = robot1.speed >= robot2.speed;

        if p1_first {
            // Robot 1 attacks Robot 2
            let damage = (robot1.attack as i32 + rand as i32) 
                       - (robot2.defense as i32 / 2);
            hp2 -= damage.max(1);
            if hp2 <= 0 { return true; }

            // Robot 2 attacks Robot 1
            let damage = (robot2.attack as i32 + rand as i32)
                       - (robot1.defense as i32 / 2);
            hp1 -= damage.max(1);
            if hp1 <= 0 { return false; }
        } else {
            // Robot 2 attacks first
            let damage = (robot2.attack as i32 + rand as i32)
                       - (robot1.defense as i32 / 2);
            hp1 -= damage.max(1);
            if hp1 <= 0 { return false; }

            let damage = (robot1.attack as i32 + rand as i32)
                       - (robot2.defense as i32 / 2);
            hp2 -= damage.max(1);
            if hp2 <= 0 { return true; }
        }
    }

    // After 10 rounds whoever has more HP wins
    hp1 > hp2
}// ── UPGRADE STAT ─────────────────────────────────────────────
// Player spends LTRN to boost one of their robot's stats
fn execute_upgrade_stat(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    stat: String,
) -> Result<Response, ContractError> {
    // Load player's robot
    let mut robot = ROBOTS.load(deps.storage, &info.sender)
        .map_err(|_| ContractError::RobotNotFound {})?;

    // Get current stat value
    let current_stat = match stat.as_str() {
        "attack"  => robot.attack,
        "defense" => robot.defense,
        "speed"   => robot.speed,
        _ => return Err(ContractError::InvalidStat {}),
    };

    // Check stat is not already maxed (max is 100)
    if current_stat >= 95 {
        return Err(ContractError::StatMaxed {});
    }

    // Calculate upgrade cost based on current stat level
    let upgrade_cost = if current_stat < 35 {
        UPGRADE_COST_LVL1
    } else if current_stat < 55 {
        UPGRADE_COST_LVL2
    } else if current_stat < 75 {
        UPGRADE_COST_LVL3
    } else {
        UPGRADE_COST_LVL4
    };

    // Check LTRN was sent
    let ltrn_sent = info.funds.iter()
        .find(|c| c.denom == LTRN_DENOM)
        .map(|c| c.amount.u128())
        .unwrap_or(0);

    if ltrn_sent < upgrade_cost {
        return Err(ContractError::InsufficientUpgradeFee {});
    }

    // Apply the upgrade — +5 to chosen stat
    match stat.as_str() {
        "attack"  => robot.attack  = (robot.attack  + 5).min(100),
        "defense" => robot.defense = (robot.defense + 5).min(100),
        "speed"   => robot.speed   = (robot.speed   + 5).min(100),
        _ => {}
    }

    // Save upgraded robot
    ROBOTS.save(deps.storage, &info.sender, &robot)?;

    // All upgrade fees are burned — send to burn address
    let burn_addr = "terra1qg5ega6dykkxc307y25pecuufrjkxkaggkkxh";

    Ok(Response::new()
        .add_message(CosmosMsg::Bank(BankMsg::Send {
            to_address: burn_addr.to_string(),
            amount: vec![Coin {
                denom: LTRN_DENOM.to_string(),
                amount: Uint128::from(upgrade_cost),
            }],
        }))
        .add_attribute("action", "upgrade_stat")
        .add_attribute("stat", stat)
        .add_attribute("new_value", robot.attack.to_string())
        .add_attribute("cost_burned", upgrade_cost.to_string()))
}

// ── ADMIN FUNCTIONS ──────────────────────────────────────────
fn execute_update_config(
    deps: DepsMut,
    info: MessageInfo,
    ltrn_entry_fee: Option<u128>,
    lunc_entry_fee: Option<u128>,
    daily_battle_cap: Option<u8>,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;

    // Only owner can update config
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {});
    }

    if let Some(fee) = ltrn_entry_fee { config.ltrn_entry_fee = fee; }
    if let Some(fee) = lunc_entry_fee { config.lunc_entry_fee = fee; }
    if let Some(cap) = daily_battle_cap { config.daily_battle_cap = cap; }

    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new().add_attribute("action", "update_config"))
}

fn execute_set_paused(
    deps: DepsMut,
    info: MessageInfo,
    paused: bool,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;

    // Only owner can pause
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {});
    }

    config.is_paused = paused;
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("action", "set_paused")
        .add_attribute("paused", paused.to_string()))
}

fn execute_topup_pool(
    deps: DepsMut,
    info: MessageInfo,
    amount: u128,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    // Only owner can top up
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {});
    }

    Ok(Response::new()
        .add_message(CosmosMsg::Bank(BankMsg::Send {
            to_address: config.reward_pool.to_string(),
            amount: vec![Coin {
                denom: LTRN_DENOM.to_string(),
                amount: Uint128::from(amount),
            }],
        }))
        .add_attribute("action", "topup_pool")
        .add_attribute("amount", amount.to_string()))
}

// ── QUERY ────────────────────────────────────────────────────
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(
    deps: Deps,
    _env: Env,
    msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetRobot { address } => {
            let addr = deps.api.addr_validate(&address)?;
            let robot = ROBOTS.load(deps.storage, &addr)?;
            to_binary(&RobotResponse {
                owner:   robot.owner.to_string(),
                attack:  robot.attack,
                defense: robot.defense,
                speed:   robot.speed,
                class:   robot.class,
                wins:    robot.wins,
                losses:  robot.losses,
                streak:  robot.streak,
            })
        }
        QueryMsg::GetBattle { battle_id } => {
            let battle = BATTLES.load(deps.storage, battle_id)?;
            to_binary(&BattleResponse {
                battle_id: battle.battle_id,
                player1:   battle.player1.to_string(),
                player2:   battle.player2.to_string(),
                winner:    battle.winner.to_string(),
                ltrn_reward: battle.ltrn_reward,
                timestamp: battle.timestamp,
            })
        }
        QueryMsg::GetConfig {} => {
            let config = CONFIG.load(deps.storage)?;
            to_binary(&config)
        }
        QueryMsg::GetGameStats {} => {
            let total_battles = BATTLE_COUNT.load(deps.storage)?;
            let total_burned  = TOTAL_BURNED.load(deps.storage)?;
            to_binary(&GameStatsResponse {
                total_battles,
                total_burned,
            })
        }
        QueryMsg::GetDailyTracker { address } => {
            let addr = deps.api.addr_validate(&address)?;
            let tracker = DAILY_TRACKER
                .may_load(deps.storage, &addr)?
                .unwrap_or(DailyTracker {
                    battles_today: 0,
                    last_battle_day: 0,
                });
            to_binary(&tracker)
        }
    }
}