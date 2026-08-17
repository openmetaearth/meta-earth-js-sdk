import { GeneratedType } from '@cosmjs/proto-signing'
import { MsgUpdateDao } from './types/metaearth/dao/tx'

// CosmJS 0.27's GeneratedType type only models protobufjs writers. Buf writers
// expose the same encode(...).finish() contract used by Registry at runtime.
const msgTypes = [['/metaearth.dao.MsgUpdateDao', MsgUpdateDao]] as unknown as Array<
  [string, GeneratedType]
>

export { msgTypes }
