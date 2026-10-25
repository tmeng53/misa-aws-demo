"""Configuration read from the environment, so the same code runs locally and on AgentCore Runtime."""

import os
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

# Base Sepolia, the testnet every piece of the demo uses (see contract.md, "Network and money").
BASE_SEPOLIA = "eip155:84532"
USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
USDC_DECIMALS = 6
# XRPL Testnet, for the optional XRP escrow path (XRPL_PAYMENTS=1).
XRPL_TESTNET = "xrpl:1"
XRP_DROPS = 1_000_000


def _env(name: str) -> Optional[str]:
    value = os.environ.get(name, "").strip()
    return value or None


def _gateway_url_from_cli_env() -> Optional[str]:
    # `agentcore deploy` injects AGENTCORE_GATEWAY_<NAME>_URL for each project Gateway.
    for key, value in os.environ.items():
        if key.startswith("AGENTCORE_GATEWAY_") and key.endswith("_URL") and value.strip():
            return value.strip()
    return None


def _payment_manager_arn_from_cli_env() -> Optional[str]:
    # `agentcore deploy` injects AGENTCORE_PAYMENT_<NAME>_MANAGER_ARN for each payment manager.
    for key, value in os.environ.items():
        if key.startswith("AGENTCORE_PAYMENT_") and key.endswith("_MANAGER_ARN") and value.strip():
            return value.strip()
    return None


@dataclass(frozen=True)
class Settings:
    region: str
    model_id: str
    # AgentCore Gateway MCP endpoint with semantic tool search (discovery, optional).
    tool_gateway_url: Optional[str]
    # Misa's public catalog (discovery fallback, and the only host the agent will pay).
    misa_url: Optional[str]
    payment_manager_arn: Optional[str]
    payment_user_id: str
    # Most the agent will pay for a single call, whatever the session budget allows.
    max_price_per_call_usd: Decimal
    # XRP escrow payments from the agent's own XRPL wallet instead of AgentCore Payments (off by default).
    xrpl_payments: bool = False
    xrpl_buyer_seed: Optional[str] = None
    xrpl_network: str = XRPL_TESTNET
    xrpl_rpc_url: str = "https://testnet.xrpl-labs.com/"
    # What the agent values XRP at when checking a price against MAX_PRICE_PER_CALL_USD.
    xrp_usd_rate: Decimal = Decimal("2.40")
    # Most this runtime will lock in XRP escrows, in USD (AgentCore Payments' session cap doesn't cover XRP).
    xrpl_budget_usd: Decimal = Decimal("2.00")

    @staticmethod
    def from_env() -> "Settings":
        region = _env("AWS_REGION") or _env("AWS_DEFAULT_REGION") or "us-west-2"
        return Settings(
            region=region,
            model_id=_env("MODEL_ID") or "global.anthropic.claude-sonnet-5-5",
            tool_gateway_url=_env("TOOL_GATEWAY_URL") or _gateway_url_from_cli_env(),
            misa_url=(_env("MISA_GATEWAY_URL") or "").rstrip("/") or None,
            payment_manager_arn=_env("PAYMENT_MANAGER_ARN") or _payment_manager_arn_from_cli_env(),
            payment_user_id=_env("PAYMENT_USER_ID") or "demo-buyer",
            max_price_per_call_usd=Decimal(_env("MAX_PRICE_PER_CALL_USD") or "1.00"),
            xrpl_payments=_env("XRPL_PAYMENTS") == "1",
            xrpl_buyer_seed=_env("XRPL_BUYER_SEED"),
            xrpl_network=_env("XRPL_NETWORK") or XRPL_TESTNET,
            xrpl_rpc_url=_env("XRPL_RPC_URL") or "https://testnet.xrpl-labs.com/",
            xrp_usd_rate=Decimal(_env("XRP_USD_RATE") or "2.40"),
            xrpl_budget_usd=Decimal(_env("XRPL_BUDGET_USD") or "2.00"),
        )
