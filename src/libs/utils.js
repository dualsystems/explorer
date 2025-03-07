import {
  Bech32, fromBase64, fromHex, toHex,
} from '@cosmjs/encoding'
import { sha256, stringToPath } from '@cosmjs/crypto'
// ledger
import TransportWebBLE from '@ledgerhq/hw-transport-web-ble'
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'
import CosmosApp from 'ledger-cosmos-js'
import { LedgerSigner } from '@cosmjs/ledger-amino'

import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import RIPEMD160 from 'ripemd160'
import localeData from 'dayjs/plugin/localeData'
import { $themeColors } from '@themeConfig'
// import { SigningStargateClient } from '@cosmjs/stargate'
import PingWalletClient from './data/signing'

dayjs.extend(localeData)
dayjs.extend(duration)
dayjs.extend(relativeTime)
dayjs.extend(utc)

export function getLocalObject(name) {
  const text = localStorage.getItem(name)
  if (text) {
    return JSON.parse(text)
  }
  return null
}

export function getLocalChains() {
  return getLocalObject('chains')
}

export function getLocalAccounts() {
  return getLocalObject('accounts')
}

export function getLocalTxHistory() {
  return getLocalObject('txHistory')
}

export function setLocalTxHistory(tx) {
  const newTx = tx
  const txs = getLocalTxHistory()
  if (txs) {
    txs.push(newTx)
    return localStorage.setItem('txHistory', JSON.stringify(txs))
  }
  return localStorage.setItem('txHistory', JSON.stringify([newTx]))
}

export async function connectLedger(transport = 'usb') {
  const trans = await transport === 'usb' ? TransportWebUSB.create() : TransportWebBLE.create()
  return new CosmosApp(trans)
}

export function operatorAddressToAccount(operAddress) {
  const { prefix, data } = Bech32.decode(operAddress)
  if (prefix === 'iva') { // handle special cases
    return Bech32.encode('iaa', data)
  }
  if (prefix === 'crocncl') { // handle special cases
    return Bech32.encode('cro', data)
  }
  return Bech32.encode(prefix.replace('valoper', ''), data)
}

// TODO, not tested
export function pubkeyToAccountAddress(pubkey, prefix) {
  return Bech32.encode(prefix, pubkey, 40)
}

export function addressDecode(address) {
  return Bech32.decode(address)
}

export function addressEnCode(prefix, pubkey) {
  return Bech32.encode(prefix, pubkey)
}

export function getUserCurrency() {
  const currency = localStorage.getItem('currency')
  return currency || 'usd'
}

export function setUserCurrency(currency) {
  localStorage.setItem('currency', currency)
}

export function chartColors() {
  const colors = ['#6610f2', '#20c997', '#000000', '#FF0000',
    '#800000', '#FFFF00', '#808000', '#00FF00', '#008000', '#00FFFF',
    '#008080', '#0000FF', '#000080', '#FF00FF', '#800080']
  return Object.values($themeColors).concat(colors)
}

export function getUserCurrencySign() {
  let s = ''
  switch (getUserCurrency()) {
    case 'cny':
    case 'jpy':
      s = '¥'
      break
    case 'krw':
      s = '₩'
      break
    case 'eur':
      s = '€'
      break
    default:
      s = '$'
  }
  return s
}

export function consensusPubkeyToHexAddress(consensusPubkey) {
  let raw = null
  if (typeof consensusPubkey === 'object') {
    if (consensusPubkey.type === 'tendermint/PubKeySecp256k1') {
      raw = new RIPEMD160().update(Buffer.from(sha256(fromBase64(consensusPubkey.value)))).digest('hex').toUpperCase()
      return raw
    }
    raw = sha256(fromBase64(consensusPubkey.value))
  } else {
    raw = sha256(fromHex(toHex(Bech32.decode(consensusPubkey).data).toUpperCase().replace('1624DE6420', '')))
  }
  const address = toHex(raw).slice(0, 40).toUpperCase()
  return address
}

function toSignAddress(addr) {
  const { data } = addressDecode(addr)
  return addressEnCode('cosmos', data)
}

function getHdPath(address) {
  let hdPath = "m/44'/118/0'/0/0"
  Object.values(getLocalAccounts()).forEach(item => {
    const curr = item.address.find(i => i.addr === address)
    if (curr && curr.hdpath) {
      hdPath = curr.hdpath
    }
  })
  // return [44, 118, 0, 0, 0]
  //  m/0'/1/2'/2/1000000000
  return stringToPath(hdPath)
}

export async function sign(device, chainId, signerAddress, messages, fee, memo, signerData) {
  let transport
  let signer
  switch (device) {
    case 'ledgerBle':
      transport = await TransportWebBLE.create()
      signer = new LedgerSigner(transport, { hdPaths: [getHdPath(signerAddress)] })
      break
    case 'ledgerUSB':
      transport = await TransportWebUSB.create()
      signer = new LedgerSigner(transport, { hdPaths: [getHdPath(signerAddress)] })
      break
    case 'keplr':
    default:
      if (!window.getOfflineSigner || !window.keplr) {
        throw new Error('Please install keplr extension')
      }
      await window.keplr.enable(chainId)
      // signer = window.getOfflineSigner(chainId)
      signer = window.getOfflineSignerOnlyAmino(chainId)
  }

  // if (signer) return signAmino(signer, signerAddress, messages, fee, memo, signerData)

  // Ensure the address has some tokens to spend
  const client = await PingWalletClient.offline(signer)
  // const client = await SigningStargateClient.offline(signer)
  return client.signAmino2(device === 'keplr' ? signerAddress : toSignAddress(signerAddress), messages, fee, memo, signerData)
  // return signDirect(signer, signerAddress, messages, fee, memo, signerData)
}

export async function getLedgerAddress(transport = 'blu', hdPath = "m/44'/118/0'/0/0") {
  const trans = transport === 'usb' ? await TransportWebUSB.create() : await TransportWebBLE.create()
  const signer = new LedgerSigner(trans, { hdPaths: [stringToPath(hdPath)] })
  return signer.getAccounts()
}

export function toDuration(value) {
  return dayjs.duration(value).humanize()
}

// unit(y M d h m s ms)
export function timeIn(time, amount, unit = 's') {
  const input = dayjs(time).add(amount, unit)
  return dayjs().unix() > input.unix()
}

export function toDay(time, format = 'long') {
  if (format === 'long') {
    return dayjs(time).format('YYYY-MM-DD HH:mm')
  }
  if (format === 'date') {
    return dayjs(time).format('YYYY-MM-DD')
  }
  if (format === 'time') {
    return dayjs(time).format('HH:mm:ss')
  }
  if (format === 'from') {
    return dayjs(time).fromNow()
  }
  if (format === 'to') {
    return dayjs(time).toNow()
  }
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

export function percent(num) {
  return parseFloat((num * 100).toFixed(2))
}

export function abbr(string, length = 6, suffix = '...') {
  if (string && string.length > length) {
    return `${string.substring(0, length)}${suffix}`
  }
  return string
}

export function abbrRight(string, length = 6, suffix = '...') {
  if (string && string.length > length) {
    return `${string.substring(string.length - length)}${suffix}`
  }
  return string
}

export function abbrMessage(msg) {
  if (Array.isArray(msg)) {
    const sum = msg.map(x => abbrMessage(x)).reduce((s, c) => {
      const sh = s
      if (sh[c]) {
        sh[c] += 1
      } else {
        sh[c] = 1
      }
      return sh
    }, {})
    const output = []
    Object.keys(sum).forEach(k => {
      output.push(sum[k] > 1 ? `${k}×${sum[k]}` : k)
    })
    return output.join(', ')
  }
  if (msg.typeUrl) {
    return msg.typeUrl.substring(msg.typeUrl.lastIndexOf('.') + 1).replace('Msg', '')
  }
  return msg.type.substring(msg.type.lastIndexOf('/') + 1).replace('Msg', '')
}

export function abbrAddress(address, length = 10) {
  return address.substring(0, length).concat('...', address.substring(address.length - length))
}

export function isStringArray(value) {
  let is = false
  if (Array.isArray(value)) {
    is = value.findIndex(x => typeof x === 'string') > -1
  }
  return is
}

export function isToken(value) {
  let is = false
  if (Array.isArray(value)) {
    is = value.findIndex(x => Object.keys(x).includes('denom')) > -1
  }
  return is
}

export function formatTokenDenom(tokenDenom) {
  if (tokenDenom && tokenDenom.code === undefined) {
    let denom = tokenDenom.denom_trace ? tokenDenom.denom_trace.base_denom.toUpperCase() : tokenDenom.toUpperCase()
    if (denom.charAt(0) === 'U' && denom !== 'USDX') {
      denom = denom.substring(1)
    } else if (denom === 'BASECRO') {
      denom = 'CRO'
    } else if (denom.startsWith('IBC')) {
      denom = 'IBC...'
    } else if (denom.startsWith('NANOLIKE')) {
      denom = 'LIKE'
    } else if (denom.startsWith('APHOTON')) {
      denom = 'PHOTON'
    }

    return denom
  }
  return ''
}

export function getUnitAmount(amount, denom) {
  if (denom === 'boot') {
    return String(amount)
  }
  if (denom.startsWith('basecro')) {
    return String((Number(amount) * 100000000).toFixed())
  }
  if (denom.startsWith('rowan') || denom.startsWith('aphoton')) {
    // eslint-disable-next-line no-undef
    return (BigInt(amount) * 1000000000000000000n).toString()
  }
  if (denom.startsWith('nanolike')) {
    // eslint-disable-next-line no-undef
    return String((Number(amount) * 1000000000).toFixed())
  }
  return String((Number(amount) * 1000000).toFixed())
}

export function formatTokenAmount(tokenAmount, fraction = 2, denom = 'uatom') {
  let amount
  if (denom === 'boot') {
    amount = Number(tokenAmount)
  } else if (denom.startsWith('inj')) {
    // eslint-disable-next-line no-undef
    amount = Number(BigInt(Number(tokenAmount)) / 1000000000000000000n)
    // }
  } else if (denom === 'rowan' || denom === 'aphoton') {
    // eslint-disable-next-line no-undef
    amount = Number(BigInt(Number(tokenAmount)) / 1000000000000000000n)
    // }
  } else if (denom.startsWith('basecro')) {
    amount = Number(tokenAmount) / 100000000
  } else if (denom.startsWith('nanolike')) {
    amount = Number(tokenAmount) / 1000000000
  } else {
    amount = Number(tokenAmount) / 1000000
  }
  if (amount > 10) {
    return parseFloat(amount.toFixed(fraction))
  }
  return parseFloat(amount)
}

export function isTestnet() {
  return (window.location.hostname.startsWith('testnet')
   || window.location.search.indexOf('testnet') > -1)
}

export function formatToken(token, IBCDenom = {}, decimals = 2, withDenom = true) {
  if (token) {
    if (withDenom) {
      return `${formatTokenAmount(token.amount, decimals, token.denom)} ${formatTokenDenom(IBCDenom[token.denom] || token.denom)}`
    }
    return formatTokenAmount(token.amount, decimals, token.denom)
  }
  return token
}

const COUNT_ABBRS = ['', 'K', 'M', 'B', 't', 'q', 's', 'S', 'o', 'n', 'd', 'U', 'D', 'T', 'Qt', 'Qd', 'Sd', 'St']

export function formatNumber(count, withAbbr = false, decimals = 2) {
  const i = count === 0 ? count : Math.floor(Math.log(count) / Math.log(1000))
  let result = parseFloat((count / (1000 ** i)).toFixed(decimals))
  if (withAbbr && COUNT_ABBRS[i]) {
    result += `${COUNT_ABBRS[i]}`
  }
  return result
}

export function tokenFormatter(tokens, denoms = {}) {
  if (Array.isArray(tokens)) {
    return tokens.map(t => formatToken(t, denoms, 2)).join()
  }
  return formatToken(tokens, denoms, 2)
}

export function getCachedValidators(chainName) {
  const locals = localStorage.getItem(`validators-${chainName}`)
  return locals
}

export function isHexAddress(v) {
  const re = /^[A-Z\d]{40}$/
  return re.test(v)
}

export function getStakingValidatorByHex(chainName, hex) {
  const locals = localStorage.getItem(`validators-${chainName}`)
  if (locals) {
    const val = JSON.parse(locals).find(x => consensusPubkeyToHexAddress(x.consensus_pubkey) === hex)
    if (val) {
      return val.description.moniker
    }
  }
  return abbr(hex)
}

export function getStakingValidatorByAccount(chainName, addr) {
  const locals = localStorage.getItem(`validators-${chainName}`)
  if (locals) {
    const val = JSON.parse(locals).find(x => operatorAddressToAccount(x.operator_address) === addr)
    if (val) {
      return val.description.moniker
    }
  }
  return addr
}

export function getStakingValidatorOperator(chainName, addr, length = -1) {
  const locals = localStorage.getItem(`validators-${chainName}`)
  if (locals) {
    const val = JSON.parse(locals).find(x => x.operator_address === addr)
    if (val) {
      return val.description.moniker
    }
  }
  if (length > 0) {
    return addr.substring(addr.length - length)
  }
  return addr
}

export * from 'compare-versions'

export * from './data'
export class Data {

}
