#![no_std]
//! ParaPo fare-escrow contract.
//!
//! Lifecycle of a ride:
//! 1. `start_ride` — commuter authorizes locking the maximum end-to-end route
//!    fare (`max_fare`) of XLM into this contract.
//! 2. `finalize_ride` — commuter authorizes the actual fare for the distance
//!    travelled. The driver receives `actual_fare`; the commuter is refunded
//!    `max_fare - actual_fare`.
//! 3. `cancel_ride` — either party can cancel an active ride; the full locked
//!    amount is refunded to the commuter (used for disputes / no-shows).

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol,
};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Token,
    RideCount,
    Ride(u64),
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RideStatus {
    Active,
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Ride {
    pub id: u64,
    pub commuter: Address,
    pub driver: Address,
    /// Short route identifier, e.g. `R_CUBAO` (symbols are <= 9 chars).
    pub route_id: Symbol,
    /// Maximum end-to-end fare locked in escrow (stroops of XLM, 7 decimals).
    pub max_fare: i128,
    /// Actual fare released to the driver once finalized.
    pub actual_fare: i128,
    pub status: RideStatus,
    pub started_at: u64,
    pub finalized_at: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    RideNotFound = 3,
    RideNotActive = 4,
    /// actual_fare is negative or greater than the locked max_fare.
    InvalidFare = 5,
    /// max_fare must be strictly positive.
    InvalidAmount = 6,
    /// Caller is neither the commuter nor the driver of the ride.
    NotAuthorized = 7,
}

#[contract]
pub struct FareEscrow;

#[contractimpl]
impl FareEscrow {
    /// Initialize the contract with an admin and the XLM token (SAC) address.
    pub fn init(env: Env, admin: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::RideCount, &0u64);
        Ok(())
    }

    /// Board the vehicle: lock `max_fare` XLM from the commuter into escrow.
    /// Requires the commuter's authorization. Returns the new ride id.
    pub fn start_ride(
        env: Env,
        commuter: Address,
        driver: Address,
        route_id: Symbol,
        max_fare: i128,
    ) -> Result<u64, Error> {
        commuter.require_auth();

        if max_fare <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token_client = Self::token_client(&env)?;
        // Pull the locked fare into the contract's custody.
        token_client.transfer(&commuter, &env.current_contract_address(), &max_fare);

        let id = Self::next_ride_id(&env);
        let now = env.ledger().timestamp();
        let ride = Ride {
            id,
            commuter,
            driver,
            route_id,
            max_fare,
            actual_fare: 0,
            status: RideStatus::Active,
            started_at: now,
            finalized_at: 0,
        };
        env.storage().persistent().set(&DataKey::Ride(id), &ride);

        env.events().publish(
            (symbol_short!("started"), ride.commuter.clone()),
            (id, ride.driver.clone(), max_fare),
        );
        Ok(id)
    }

    /// Alight the vehicle: release `actual_fare` to the driver and refund the
    /// remainder to the commuter. Requires the commuter's authorization (the
    /// commuter agrees to the fare computed from the GPS route + fare matrix).
    pub fn finalize_ride(env: Env, ride_id: u64, actual_fare: i128) -> Result<Ride, Error> {
        let mut ride = Self::get_ride(env.clone(), ride_id)?;
        if ride.status != RideStatus::Active {
            return Err(Error::RideNotActive);
        }
        if actual_fare < 0 || actual_fare > ride.max_fare {
            return Err(Error::InvalidFare);
        }

        // The commuter authorizes the final settlement amount.
        ride.commuter.require_auth();

        let token_client = Self::token_client(&env)?;
        let contract = env.current_contract_address();

        if actual_fare > 0 {
            token_client.transfer(&contract, &ride.driver, &actual_fare);
        }
        let refund = ride.max_fare - actual_fare;
        if refund > 0 {
            token_client.transfer(&contract, &ride.commuter, &refund);
        }

        ride.actual_fare = actual_fare;
        ride.status = RideStatus::Completed;
        ride.finalized_at = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::Ride(ride_id), &ride);

        env.events().publish(
            (symbol_short!("finalized"), ride.driver.clone()),
            (ride_id, actual_fare, refund),
        );
        Ok(ride)
    }

    /// Cancel an active ride and refund the full locked amount to the commuter.
    /// `caller` must be the ride's commuter or driver and must authorize.
    pub fn cancel_ride(env: Env, ride_id: u64, caller: Address) -> Result<Ride, Error> {
        let mut ride = Self::get_ride(env.clone(), ride_id)?;
        if ride.status != RideStatus::Active {
            return Err(Error::RideNotActive);
        }
        if caller != ride.commuter && caller != ride.driver {
            return Err(Error::NotAuthorized);
        }
        caller.require_auth();

        let token_client = Self::token_client(&env)?;
        token_client.transfer(
            &env.current_contract_address(),
            &ride.commuter,
            &ride.max_fare,
        );

        ride.status = RideStatus::Cancelled;
        ride.finalized_at = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::Ride(ride_id), &ride);

        env.events().publish(
            (symbol_short!("cancelled"), ride.commuter.clone()),
            (ride_id, ride.max_fare),
        );
        Ok(ride)
    }

    /// Read a ride by id.
    pub fn get_ride(env: Env, ride_id: u64) -> Result<Ride, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Ride(ride_id))
            .ok_or(Error::RideNotFound)
    }

    /// Total number of rides ever started (also the next id to be assigned).
    pub fn get_ride_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::RideCount)
            .unwrap_or(0)
    }

    /// The XLM token (SAC) address used for settlement.
    pub fn get_token(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)
    }

    /// The admin address.
    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    /// Build a token client for the configured XLM (SAC) address.
    /// Centralizes the "load token address + make client" step the money
    /// functions all share.
    fn token_client<'a>(env: &'a Env) -> Result<token::Client<'a>, Error> {
        let token_addr = Self::get_token(env.clone())?;
        Ok(token::Client::new(env, &token_addr))
    }

    fn next_ride_id(env: &Env) -> u64 {
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::RideCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::RideCount, &(id + 1));
        id
    }
}

#[cfg(test)]
mod test;
