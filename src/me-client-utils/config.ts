import { gas_min_fee, gas_price } from '../config/define'

const GAS_LIMIT_MULTIPLIER = 1.5

const compareDecimal = (left: string | number, right: string | number) => {
  const leftUnits = Number(left)
  const rightUnits = Number(right)

  if (leftUnits === rightUnits) {
    return 0
  }

  return leftUnits < rightUnits ? -1 : 1
}

/**
 * Calculate final gas fee
 * @param simulateGas Simulated gas
 * @param _customGas Retained for generated-code compatibility
 * @returns Final gas fee string
 */
export const getFinalGas = (simulateGas: string, _customGas: string | number) => {
  // Keep the second parameter for generated-code compatibility; callers cannot override the shared formula.
  const gasFee = Math.ceil(Number(getFinalGasLimit(simulateGas)) * gas_price)
  if (compareDecimal(gasFee, gas_min_fee) <= 0) {
    // Coin amounts must be integers; add 0-999 umec to the minimum to match the wallet runtime.
    return String(Number(gas_min_fee) + Math.floor(Math.random() * 1000))
  }

  return gasFee.toString()
}

/**
 * Calculate final gas
 * @param simulateGas Simulated gas
 * @returns Final gas limit string
 */
export const getFinalGasLimit = (simulateGas: string) => {
  return Math.ceil(Number(simulateGas) * GAS_LIMIT_MULTIPLIER).toString()
}

export default {}
