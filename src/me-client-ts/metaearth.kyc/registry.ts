import { GeneratedType } from '@cosmjs/proto-signing'
import { MsgDeleteSBT } from './types/metaearth/kyc/tx'
import { MsgApprove } from './types/metaearth/kyc/tx'
import { MsgRemove } from './types/metaearth/kyc/tx'
import { MsgUpdateSBT } from './types/metaearth/kyc/tx'
import { MsgUpdate } from './types/metaearth/kyc/tx'
import { MsgCreateSBT } from './types/metaearth/kyc/tx'

// CosmJS 0.27's GeneratedType type only models protobufjs writers. Buf writers
// expose the same encode(...).finish() contract used by Registry at runtime.
const msgTypes = [
  ['/metaearth.kyc.MsgDeleteSBT', MsgDeleteSBT],
  ['/metaearth.kyc.MsgApprove', MsgApprove],
  ['/metaearth.kyc.MsgRemove', MsgRemove],
  ['/metaearth.kyc.MsgUpdateSBT', MsgUpdateSBT],
  ['/metaearth.kyc.MsgUpdate', MsgUpdate],
  ['/metaearth.kyc.MsgCreateSBT', MsgCreateSBT],
] as unknown as Array<[string, GeneratedType]>

export { msgTypes }
