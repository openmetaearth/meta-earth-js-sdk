import { GeneratedType } from '@cosmjs/proto-signing'
import { MsgCreateSequencer } from './types/metaearth/sequencer/tx'
import { MsgUnbond } from './types/metaearth/sequencer/tx'
import { MsgReplaceProposerRequest } from './types/metaearth/sequencer/tx'

// CosmJS 0.27's GeneratedType type only models protobufjs writers. Buf writers
// expose the same encode(...).finish() contract used by Registry at runtime.
const msgTypes = [
  ['/metaearth.sequencer.MsgCreateSequencer', MsgCreateSequencer],
  ['/metaearth.sequencer.MsgUnbond', MsgUnbond],
  ['/metaearth.sequencer.MsgReplaceProposerRequest', MsgReplaceProposerRequest],
] as unknown as Array<[string, GeneratedType]>

export { msgTypes }
