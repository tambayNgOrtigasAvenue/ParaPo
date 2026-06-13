#![cfg(test)]

use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

struct Setup<'a> {
    env: Env,
    contract_id: Address,
    client: FareEscrowClient<'a>,
    token: TokenClient<'a>,
    token_admin: StellarAssetClient<'a>,
    commuter: Address,
    driver: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let commuter = Address::generate(&env);
    let driver = Address::generate(&env);

    // Deploy a Stellar Asset Contract to stand in for PHPx.
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = TokenClient::new(&env, &sac.address());
    let token_admin = StellarAssetClient::new(&env, &sac.address());

    let contract_id = env.register(FareEscrow, ());
    let client = FareEscrowClient::new(&env, &contract_id);
    client.init(&admin, &sac.address());

    // Give the commuter some PHPx (1,000.0000000).
    token_admin.mint(&commuter, &1_000_0000000);

    Setup {
        env,
        contract_id,
        client,
        token,
        token_admin,
        commuter,
        driver,
    }
}

#[test]
fn test_init_sets_state() {
    let s = setup();
    assert_eq!(s.client.get_token(), s.token.address);
    assert_eq!(s.client.get_ride_count(), 0);
}

#[test]
#[should_panic]
fn test_double_init_fails() {
    let s = setup();
    let other = Address::generate(&s.env);
    // Already initialized in setup; a second init must panic.
    s.client.init(&other, &s.token.address);
}

#[test]
fn test_start_ride_locks_max_fare() {
    let s = setup();
    let max_fare = 50_0000000i128; // 50 PHPx
    let id = s
        .client
        .start_ride(&s.commuter, &s.driver, &symbol_short!("R_CUBAO"), &max_fare);

    assert_eq!(id, 0);
    // Commuter balance reduced, escrow holds the locked fare.
    assert_eq!(s.token.balance(&s.commuter), 1_000_0000000 - max_fare);
    assert_eq!(s.token.balance(&s.contract_id), max_fare);

    let ride = s.client.get_ride(&id);
    assert_eq!(ride.status, RideStatus::Active);
    assert_eq!(ride.max_fare, max_fare);
    assert_eq!(s.client.get_ride_count(), 1);
}

#[test]
fn test_finalize_partial_route_refunds_remainder() {
    let s = setup();
    let max_fare = 50_0000000i128;
    let actual = 30_0000000i128; // commuter alighted early
    let id = s
        .client
        .start_ride(&s.commuter, &s.driver, &symbol_short!("R_CUBAO"), &max_fare);

    let ride = s.client.finalize_ride(&id, &actual);

    assert_eq!(ride.status, RideStatus::Completed);
    assert_eq!(ride.actual_fare, actual);
    // Driver paid actual fare.
    assert_eq!(s.token.balance(&s.driver), actual);
    // Commuter refunded the remainder.
    assert_eq!(
        s.token.balance(&s.commuter),
        1_000_0000000 - max_fare + (max_fare - actual)
    );
    // Escrow drained.
    assert_eq!(s.token.balance(&s.contract_id), 0);
}

#[test]
fn test_finalize_full_route_no_refund() {
    let s = setup();
    let max_fare = 50_0000000i128;
    let id = s
        .client
        .start_ride(&s.commuter, &s.driver, &symbol_short!("R_CUBAO"), &max_fare);

    s.client.finalize_ride(&id, &max_fare);

    assert_eq!(s.token.balance(&s.driver), max_fare);
    assert_eq!(s.token.balance(&s.commuter), 1_000_0000000 - max_fare);
    assert_eq!(s.token.balance(&s.contract_id), 0);
}

#[test]
fn test_finalize_above_max_fails() {
    let s = setup();
    let max_fare = 50_0000000i128;
    let id = s
        .client
        .start_ride(&s.commuter, &s.driver, &symbol_short!("R_CUBAO"), &max_fare);

    let res = s.client.try_finalize_ride(&id, &(max_fare + 1));
    assert_eq!(res, Err(Ok(Error::InvalidFare)));
}

#[test]
fn test_start_ride_zero_amount_fails() {
    let s = setup();
    let res = s
        .client
        .try_start_ride(&s.commuter, &s.driver, &symbol_short!("R_CUBAO"), &0);
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn test_cancel_refunds_full_amount() {
    let s = setup();
    let max_fare = 50_0000000i128;
    let id = s
        .client
        .start_ride(&s.commuter, &s.driver, &symbol_short!("R_CUBAO"), &max_fare);

    let ride = s.client.cancel_ride(&id, &s.driver);
    assert_eq!(ride.status, RideStatus::Cancelled);
    // Full refund, escrow empty, driver got nothing.
    assert_eq!(s.token.balance(&s.commuter), 1_000_0000000);
    assert_eq!(s.token.balance(&s.contract_id), 0);
    assert_eq!(s.token.balance(&s.driver), 0);
}

#[test]
fn test_cancel_by_stranger_fails() {
    let s = setup();
    let stranger = Address::generate(&s.env);
    let max_fare = 50_0000000i128;
    let id = s
        .client
        .start_ride(&s.commuter, &s.driver, &symbol_short!("R_CUBAO"), &max_fare);

    let res = s.client.try_cancel_ride(&id, &stranger);
    assert_eq!(res, Err(Ok(Error::NotAuthorized)));
}

#[test]
fn test_finalize_twice_fails() {
    let s = setup();
    let max_fare = 50_0000000i128;
    let id = s
        .client
        .start_ride(&s.commuter, &s.driver, &symbol_short!("R_CUBAO"), &max_fare);
    s.client.finalize_ride(&id, &max_fare);

    let res = s.client.try_finalize_ride(&id, &10_0000000);
    assert_eq!(res, Err(Ok(Error::RideNotActive)));
}

#[test]
fn test_get_missing_ride_fails() {
    let s = setup();
    let res = s.client.try_get_ride(&999);
    assert_eq!(res, Err(Ok(Error::RideNotFound)));
    // Silence unused warning for token_admin in some builds.
    let _ = &s.token_admin;
}
