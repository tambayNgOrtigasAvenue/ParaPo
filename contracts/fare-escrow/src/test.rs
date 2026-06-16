#![cfg(test)]

use super::*;
use driver_vault::{DriverVault, DriverVaultClient};
use soroban_sdk::{
    symbol_short,
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env,
};

struct Setup<'a> {
    env: Env,
    contract_id: Address,
    vault_id: Address,
    client: FareEscrowClient<'a>,
    vault: DriverVaultClient<'a>,
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

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = TokenClient::new(&env, &sac.address());
    let token_admin = StellarAssetClient::new(&env, &sac.address());

    let contract_id = env.register(FareEscrow, ());
    let client = FareEscrowClient::new(&env, &contract_id);

    let vault_id = env.register(DriverVault, ());
    let vault = DriverVaultClient::new(&env, &vault_id);
    vault.init(&admin, &sac.address());
    vault.set_escrow(&contract_id);
    vault.register_driver(&driver);

    client.init(&admin, &sac.address(), &vault_id);

    token_admin.mint(&commuter, &1_000_0000000);

    Setup {
        env,
        contract_id,
        vault_id,
        client,
        vault,
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
    assert_eq!(s.client.get_driver_vault(), s.vault_id);
    assert_eq!(s.client.get_ride_count(), 0);
}

#[test]
#[should_panic]
fn test_double_init_fails() {
    let s = setup();
    let other = Address::generate(&s.env);
    s.client.init(&other, &s.token.address, &s.vault_id);
}

#[test]
fn test_start_ride_locks_max_fare() {
    let s = setup();
    let max_fare = 50_0000000i128;
    let id = s
        .client
        .start_ride(&s.commuter, &s.driver, &symbol_short!("R_CUBAO"), &max_fare);

    assert_eq!(id, 0);
    assert_eq!(s.token.balance(&s.commuter), 1_000_0000000 - max_fare);
    assert_eq!(s.token.balance(&s.contract_id), max_fare);

    let ride = s.client.get_ride(&id);
    assert_eq!(ride.status, RideStatus::Active);
    assert_eq!(ride.max_fare, max_fare);
    assert_eq!(s.client.get_ride_count(), 1);
}

#[test]
fn test_start_ride_unregistered_driver_fails() {
    let s = setup();
    let stranger = Address::generate(&s.env);
    let res = s.client.try_start_ride(
        &s.commuter,
        &stranger,
        &symbol_short!("R_CUBAO"),
        &50_0000000,
    );
    assert_eq!(res, Err(Ok(Error::DriverNotRegistered)));
}

#[test]
fn test_finalize_partial_route_refunds_remainder() {
    let s = setup();
    let max_fare = 50_0000000i128;
    let actual = 30_0000000i128;
    let id = s
        .client
        .start_ride(&s.commuter, &s.driver, &symbol_short!("R_CUBAO"), &max_fare);

    let ride = s.client.finalize_ride(&id, &actual);

    assert_eq!(ride.status, RideStatus::Completed);
    assert_eq!(ride.actual_fare, actual);
    assert_eq!(s.vault.get_balance(&s.driver), actual);
    assert_eq!(s.token.balance(&s.vault_id), actual);
    assert_eq!(s.token.balance(&s.driver), 0);
    assert_eq!(
        s.token.balance(&s.commuter),
        1_000_0000000 - max_fare + (max_fare - actual)
    );
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

    assert_eq!(s.vault.get_balance(&s.driver), max_fare);
    assert_eq!(s.token.balance(&s.vault_id), max_fare);
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
    assert_eq!(s.token.balance(&s.commuter), 1_000_0000000);
    assert_eq!(s.token.balance(&s.contract_id), 0);
    assert_eq!(s.vault.get_balance(&s.driver), 0);
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
    let _ = &s.token_admin;
}

#[test]
fn test_upgrade_requires_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let vault_id = env.register(DriverVault, ());
    let vault = DriverVaultClient::new(&env, &vault_id);

    let contract_id = env.register(FareEscrow, ());
    let client = FareEscrowClient::new(&env, &contract_id);
    vault.init(&admin, &sac.address());
    client.init(&admin, &sac.address(), &vault_id);

    let bogus_hash = BytesN::from_array(&env, &[0u8; 32]);
    let res = client.try_upgrade(&bogus_hash);
    assert!(res.is_err());
}
