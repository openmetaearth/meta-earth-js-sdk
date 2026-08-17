import { GeneratedType } from '@cosmjs/proto-signing'
import { MsgMintNFT } from './types/metaearth/wnft/tx'
import { MsgSend } from './types/metaearth/wnft/tx'
import { MsgNewClass } from './types/metaearth/wnft/tx'

// CosmJS 0.27's GeneratedType type only models protobufjs writers. Buf writers
// expose the same encode(...).finish() contract used by Registry at runtime.
const msgTypes = [
  ['/metaearth.wnft.MsgMintNFT', MsgMintNFT],
  ['/metaearth.wnft.MsgSend', MsgSend],
  ['/metaearth.wnft.MsgNewClass', MsgNewClass],
] as unknown as Array<[string, GeneratedType]>

export { msgTypes }
