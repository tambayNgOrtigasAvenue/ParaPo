#![no_std]
//! ParaPo driver vault.
//!
//! Holds driver fare balances separately from the ride escrow contract:
//! - Admin registers coop-approved drivers.
//! - The fare-escrow contract credits a driver's balance after settlement.
//! - Drivers withdraw accumulated XLM to their own wallet when ready.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, BytesN,
};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Token,
    Escrow,
    Driver(Address),
    Balance(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    EscrowAlreadySet = 3,
    EscrowNotSet = 4,
    DriverNotRegistered = 5,
    DriverAlreadyRegistered = 6,
    InvalidAmount = 7,
    InsufficientBalance = 8,
    NotAuthorized = 9,
}

#[contract]
pub struct DriverVault;

#[contractimpl]
impl DriverVault {
    /// Initialize with admin + XLM token (SAC). Escrow is wired later via `set_escrow`.
    pub fn init(env: Env, admin: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        Ok(())
    }

    /// One-time link to the fare-escrow contract that may credit driver balances.
    pub fn set_escrow(env: Env, escrow: Address) -> Result<(), Error> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Escrow) {
            return Err(Error::EscrowAlreadySet);
        }
        env.storage().instance().set(&DataKey::Escrow, &escrow);
        Ok(())
    }

    /// Coop admin approves a driver to receive fares.
    pub fn register_driver(env: Env, driver: Address) -> Result<(), Error> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();
        if env.storage().persistent().has(&DataKey::Driver(driver.clone())) {
            return Err(Error::DriverAlreadyRegistered);
        }
        env.storage().persistent().set(&DataKey::Driver(driver), &true);
        Ok(())
    }

    pub fn is_registered(env: Env, driver: Address) -> bool {
        env.storage().persistent().has(&DataKey::Driver(driver))
    }

    /// Escrow settles a fare: XLM must already be transferred to this contract.
    pub fn credit(env: Env, driver: Address, amount: i128) -> Result<(), Error> {
        let escrow = Self::get_escrow(env.clone())?;
        escrow.require_auth();

        if !Self::is_registered(env.clone(), driver.clone()) {
            return Err(Error::DriverNotRegistered);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(driver.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(driver.clone()), &(bal + amount));

        env.events().publish(
            (symbol_short!("credited"), driver),
            amount,
        );
        Ok(())
    }

    /// Driver withdraws accumulated fare balance to their wallet.
    pub fn withdraw(env: Env, driver: Address, amount: i128) -> Result<(), Error> {
        driver.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(driver.clone()))
            .unwrap_or(0);
        if amount > bal {
            return Err(Error::InsufficientBalance);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Balance(driver.clone()), &(bal - amount));

        let token_client = Self::token_client(&env)?;
        token_client.transfer(&env.current_contract_address(), &driver, &amount);

        env.events().publish(
            (symbol_short!("withdrew"), driver),
            amount,
        );
        Ok(())
    }

    pub fn get_balance(env: Env, driver: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(driver))
            .unwrap_or(0)
    }

    pub fn get_token(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    pub fn get_escrow(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Escrow)
            .ok_or(Error::EscrowNotSet)
    }

    fn token_client<'a>(env: &'a Env) -> Result<token::Client<'a>, Error> {
        let token_addr = Self::get_token(env.clone())?;
        Ok(token::Client::new(env, &token_addr))
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[cfg(test)]
mod test;
