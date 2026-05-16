use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized — only the contract owner can do this")]
    Unauthorized {},

    #[error("Game is paused — check back soon")]
    GamePaused {},

    #[error("You already have a robot registered")]
    RobotAlreadyExists {},

    #[error("Robot not found — register first")]
    RobotNotFound {},

    #[error("You cannot battle yourself")]
    CannotBattleSelf {},

    #[error("Daily battle cap reached — come back tomorrow")]
    DailyCapReached {},

    #[error("Insufficient LTRN fee sent")]
    InsufficientLtrnFee {},

    #[error("Insufficient LUNC fee sent")]
    InsufficientLuncFee {},

    #[error("Insufficient LTRN sent for upgrade")]
    InsufficientUpgradeFee {},

    #[error("Invalid stat — use attack, defense or speed")]
    InvalidStat {},

    #[error("Stat is already at maximum level")]
    StatMaxed {},
}