"""Create the buyer's test wallet (an AgentCore payment instrument) and print the link to fund it.

Run once after `agentcore deploy`. Open the printed link to give the agent signing permission and add
test USDC on Base Sepolia (Circle faucet: https://faucet.circle.com). With --wait it polls until the
wallet is ACTIVE and saves the ids to .demo/state.json for run_demo.py.

    PAYMENT_MANAGER_ARN=... PAYMENT_CONNECTOR_ID=... python scripts/setup_wallet.py --email you@example.com --wait
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

from bedrock_agentcore.payments import PaymentManager

STATE = Path(__file__).resolve().parents[1] / ".demo" / "state.json"


def load_state() -> dict:
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save_state(state: dict) -> None:
    STATE.parent.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True, help="email linked to the wallet (wallet hub sign-in)")
    parser.add_argument("--user-id", default=os.environ.get("PAYMENT_USER_ID", "demo-buyer"))
    parser.add_argument("--manager-arn", default=os.environ.get("PAYMENT_MANAGER_ARN"))
    parser.add_argument("--connector-id", default=os.environ.get("PAYMENT_CONNECTOR_ID"))
    parser.add_argument("--region", default=os.environ.get("AWS_DEFAULT_REGION", "us-west-2"))
    parser.add_argument("--wait", action="store_true")
    args = parser.parse_args()
    if not args.manager_arn or not args.connector_id:
        print("need PAYMENT_MANAGER_ARN and PAYMENT_CONNECTOR_ID (see `agentcore status --json`)", file=sys.stderr)
        return 2

    manager = PaymentManager(payment_manager_arn=args.manager_arn, region_name=args.region)
    state = load_state()
    instrument_id = state.get("payment_instrument_id")
    if not instrument_id:
        instrument = manager.create_payment_instrument(
            user_id=args.user_id,
            payment_connector_id=args.connector_id,
            payment_instrument_type="EMBEDDED_CRYPTO_WALLET",
            payment_instrument_details={
                "embeddedCryptoWallet": {"network": "ETHEREUM", "linkedAccounts": [{"email": {"emailAddress": args.email}}]}
            },
        )
        instrument_id = instrument["paymentInstrumentId"]
        details = instrument.get("paymentInstrumentDetails", {}).get("embeddedCryptoWallet", {})
        state.update(
            payment_manager_arn=args.manager_arn,
            payment_connector_id=args.connector_id,
            payment_user_id=args.user_id,
            payment_instrument_id=instrument_id,
            wallet_address=details.get("walletAddress") or details.get("address"),
            wallet_hub_url=details.get("redirectUrl"),
        )
        save_state(state)
    print(f"wallet (payment instrument): {instrument_id}")
    if state.get("wallet_address"):
        print(f"address on Base Sepolia:    {state['wallet_address']}")
    print(f"fund + authorize here:       {state.get('wallet_hub_url')}")

    while args.wait:
        status = manager.get_payment_instrument(user_id=args.user_id, payment_instrument_id=instrument_id)["status"]
        print(f"status: {status}")
        if status == "ACTIVE":
            break
        time.sleep(10)
    return 0


if __name__ == "__main__":
    sys.exit(main())
