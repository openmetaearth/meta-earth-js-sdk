import { GeneratedType } from '@cosmjs/proto-signing'
import { MsgSkipDelayRollapp } from './types/metaearth/rollapp/tx'
import { MsgCreateRollapp } from './types/metaearth/rollapp/tx'
import { MsgUpdateState } from './types/metaearth/rollapp/tx'
import { MsgUpdateRollapp } from './types/metaearth/rollapp/tx'

// CosmJS 0.27's GeneratedType type only models protobufjs writers. Buf writers
// expose the same encode(...).finish() contract used by Registry at runtime.
const msgTypes = [
  ['/metaearth.rollapp.MsgSkipDelayRollapp', MsgSkipDelayRollapp],
  ['/metaearth.rollapp.MsgCreateRollapp', MsgCreateRollapp],
  ['/metaearth.rollapp.MsgUpdateState', MsgUpdateState],
  ['/metaearth.rollapp.MsgUpdateRollapp', MsgUpdateRollapp],
] as unknown as Array<[string, GeneratedType]>

export { msgTypes }
