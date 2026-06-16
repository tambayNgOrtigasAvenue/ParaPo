#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

struct Setup<'a> {
    env: Env,
    vault_id: Address,
    client: DriverVaultClient<'a>,
    token: TokenClient<'a>,
    token_admin: StellarAssetClient<'a>,
    driver: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let driver = Address::generate(&env);
    let escrow_id = Address::generate(&env);

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = TokenClient::new(&env, &sac.address());
    let token_admin = StellarAssetClient::new(&env, &sac.address());

    let vault_id = env.register(DriverVault, ());
    let client = DriverVaultClient::new(&env, &vault_id);
    client.init(&admin, &sac.address());
    client.set_escrow(&escrow_id);
    client.register_driver(&driver);

    Setup {
        env,
        vault_id,
        client,
        token,
        token_admin,
        driver,
    }
}

#[test]
fn test_register_and_credit() {
    let s = setup();
    let amount = 25_0000000i128;

    // Simulate escrow sending XLM then crediting the driver ledger.
    s.token_admin.mint(&s.vault_id, &amount);
    s.client.credit(&s.driver, &amount);

    assert_eq!(s.client.get_balance(&s.driver), amount);
    assert_eq!(s.token.balance(&s.vault_id), amount);
    assert_eq!(s.token.balance(&s.driver), 0);
}

#[test]
fn test_withdraw() {
    let s = setup();
    let amount = 25_0000000i128;

    s.token_admin.mint(&s.vault_id, &amount);
    s.client.credit(&s.driver, &amount);
    s.client.withdraw(&s.driver, &amount);

    assert_eq!(s.client.get_balance(&s.driver), 0);
    assert_eq!(s.token.balance(&s.driver), amount);
    assert_eq!(s.token.balance(&s.vault_id), 0);
}

#[test]
fn test_credit_unregistered_driver_fails() {
    let s = setup();
    let stranger = Address::generate(&s.env);
    s.token_admin.mint(&s.vault_id, &10_0000000);

    let res = s.client.try_credit(&stranger, &10_0000000);
    assert_eq!(res, Err(Ok(Error::DriverNotRegistered)));
}

#[test]
fn test_withdraw_over_balance_fails() {
    let s = setup();
    s.token_admin.mint(&s.vault_id, &5_0000000);
    s.client.credit(&s.driver, &5_0000000);

    let res = s.client.try_withdraw(&s.driver, &10_0000000);
    assert_eq!(res, Err(Ok(Error::InsufficientBalance)));
}
