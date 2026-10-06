"use client"

import * as raw from "./actions"

type Res<T> = { ok: true; data: T } | { ok: false; error: string }

function wrap<A extends unknown[], R>(fn: (...a: A) => Promise<Res<R>>) {
  return async (...a: A): Promise<R> => {
    const r = await fn(...a)
    if (!r.ok) throw new Error(r.error)
    return r.data
  }
}

export const actionUpdatePlan = wrap(raw.actionUpdatePlan)
export const actionUpdateProfile = wrap(raw.actionUpdateProfile)
export const actionBanUser = wrap(raw.actionBanUser)
export const actionUnbanUser = wrap(raw.actionUnbanUser)
export const actionDeleteUser = wrap(raw.actionDeleteUser)
export const actionInviteUser = wrap(raw.actionInviteUser)
export const actionUpdateScheduleFrequency = wrap(raw.actionUpdateScheduleFrequency)
export const actionToggleSchedule = wrap(raw.actionToggleSchedule)
export const actionCreateUser = wrap(raw.actionCreateUser)
export const actionSetPassword = wrap(raw.actionSetPassword)
export const actionCreateTeam = wrap(raw.actionCreateTeam)
export const actionRenameTeam = wrap(raw.actionRenameTeam)
export const actionCreateTeamMember = wrap(raw.actionCreateTeamMember)
export const actionAddUsersToTeam = wrap(raw.actionAddUsersToTeam)
export const actionSearchUsers = wrap(raw.actionSearchUsers)
export const actionRemoveFromTeam = wrap(raw.actionRemoveFromTeam)
export const actionDeleteTeam = wrap(raw.actionDeleteTeam)
