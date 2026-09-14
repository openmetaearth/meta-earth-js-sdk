import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import solc from 'solc'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const demoDirectory = path.resolve(scriptDirectory, '..')
const sourcePath = path.join(demoDirectory, 'src', 'evm', 'ERC20Token.sol')
const artifactPath = path.join(demoDirectory, 'src', 'evm', 'ERC20Token.artifact.json')
const openZeppelinDirectory = path.join(demoDirectory, 'node_modules', '@openzeppelin', 'contracts')

const input = {
  language: 'Solidity',
  sources: {
    'ERC20Token.sol': {
      content: fs.readFileSync(sourcePath, 'utf8'),
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    // Paris bytecode avoids PUSH0 so the example remains compatible with pre-Shanghai EVM nodes.
    evmVersion: 'paris',
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
  },
}

const resolveImport = (importPath) => {
  const prefix = '@openzeppelin/contracts/'
  if (!importPath.startsWith(prefix)) {
    return { error: `Unsupported Solidity import: ${importPath}` }
  }

  const relativePath = importPath.slice(prefix.length)
  const resolvedPath = path.resolve(openZeppelinDirectory, relativePath)
  const allowedPrefix = `${path.resolve(openZeppelinDirectory)}${path.sep}`
  if (!resolvedPath.startsWith(allowedPrefix)) {
    return { error: `Solidity import escapes the OpenZeppelin directory: ${importPath}` }
  }

  try {
    return { contents: fs.readFileSync(resolvedPath, 'utf8') }
  } catch (error) {
    return { error: `Unable to load ${importPath}: ${error.message}` }
  }
}

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: resolveImport }))
const diagnostics = output.errors ?? []
const errors = diagnostics.filter(({ severity }) => severity === 'error')

for (const diagnostic of diagnostics) {
  const write = diagnostic.severity === 'error' ? console.error : console.warn
  write(diagnostic.formattedMessage.trim())
}

if (errors.length > 0) {
  throw new Error(`ERC20Token.sol compilation failed with ${errors.length} error(s)`)
}

const contract = output.contracts?.['ERC20Token.sol']?.ERC20Token
const bytecodeObject = contract?.evm?.bytecode?.object
if (!contract?.abi || !bytecodeObject) {
  throw new Error('ERC20Token compilation did not produce ABI and bytecode')
}

const artifact = {
  contractName: 'ERC20Token',
  sourceName: 'ERC20Token.sol',
  compilerVersion: solc.version(),
  evmVersion: input.settings.evmVersion,
  abi: contract.abi,
  bytecode: `0x${bytecodeObject}`,
}

fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
console.log(`Generated ${path.relative(demoDirectory, artifactPath)}`)
