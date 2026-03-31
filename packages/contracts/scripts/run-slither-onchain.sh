#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TARGETS=(
  "core/Diamond.sol"
  "core/DiamondCutFacet.sol"
  "core/DiamondLoupeFacet.sol"
  "core/GameOracleFacet.sol"
  "core/PerpAdminFacet.sol"
  "core/PerpCollateralFacet.sol"
  "core/PerpOrderFacet.sol"
  "core/PerpSettlementFacet.sol"
  "core/PerpViewFacet.sol"
  "identity/ERC8004IdentityRegistry.sol"
  "identity/ERC8004ReputationSystem.sol"
  "src/game/BabylonGameOracle.sol"
  "src/moderation/BanManager.sol"
  "src/prediction-markets/BabylonPredictionAMMRouter.sol"
  "src/prediction-markets/BabylonPredictionOracleAdapter.sol"
  "src/tokens/MockUSDC.sol"
)

cd "$ROOT_DIR"

for target in "${TARGETS[@]}"; do
  printf '\n==> slither %s\n' "$target"
  rm -rf out/build-info
  forge build --build-info --force "$target"
  slither "$target" \
    --compile-force-framework foundry \
    --foundry-ignore-compile \
    --ignore-compile \
    --config-file slither.config.json \
    --checklist
done
