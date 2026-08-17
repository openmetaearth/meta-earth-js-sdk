import { GeneratedType } from '@cosmjs/proto-signing'
import { MsgDeleteGroup } from './types/metaearth/megroup/tx'
import { MsgCreateGroup } from './types/metaearth/megroup/tx'
import { MsgUpdateGroup } from './types/metaearth/megroup/tx'
import { MsgJoinGroup } from './types/metaearth/megroup/tx'
import { MsgLeaveGroupRequest } from './types/metaearth/megroup/tx'

// CosmJS 0.27's GeneratedType type only models protobufjs writers. Buf writers
// expose the same encode(...).finish() contract used by Registry at runtime.
const msgTypes = [
  ['/metaearth.megroup.MsgDeleteGroup', MsgDeleteGroup],
  ['/metaearth.megroup.MsgCreateGroup', MsgCreateGroup],
  ['/metaearth.megroup.MsgUpdateGroup', MsgUpdateGroup],
  ['/metaearth.megroup.MsgJoinGroup', MsgJoinGroup],
  ['/metaearth.megroup.MsgLeaveGroupRequest', MsgLeaveGroupRequest],
] as unknown as Array<[string, GeneratedType]>

export { msgTypes }
