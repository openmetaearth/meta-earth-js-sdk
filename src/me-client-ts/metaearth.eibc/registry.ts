import { GeneratedType } from '@cosmjs/proto-signing'
import { MsgFulfillOrder } from './types/metaearth/eibc/tx'
import { MsgUpdateDemandOrder } from './types/metaearth/eibc/tx'

// CosmJS 0.27's GeneratedType type only models protobufjs writers. Buf writers
// expose the same encode(...).finish() contract used by Registry at runtime.
const msgTypes = [
  ['/metaearth.eibc.MsgFulfillOrder', MsgFulfillOrder],
  ['/metaearth.eibc.MsgUpdateDemandOrder', MsgUpdateDemandOrder],
] as unknown as Array<[string, GeneratedType]>

export { msgTypes }
