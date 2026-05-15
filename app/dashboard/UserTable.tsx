"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition, useState } from "react"
import type { Profile } from "@/lib/supabase/admin"
import {
  actionUpdatePlan,
  actionBanUser,
  actionUnbanUser,
  actionDeleteUser,
} from "./actions"

const PLANS = ["free", "starter", "pro", "enterprise"] as const

export default function UserTable({
  users,
  totalCount,
  page,
  search,
}: {
  users: Profile[]
  totalCount: number
  page: number
  search: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const totalPages = Math.ceil(totalCount / 20)

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString())
    Object.entries(params).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)))
    router.push(`/dashboard?${sp.toString()}`)
  }

  function handleSearch(q: string) {
    navigate({ q, page: "1" })
  }

  function handlePlan(userId: string, plan: string) {
    startTransition(async () => {
      await actionUpdatePlan(userId, plan)
    })
  }

  function handleBan(userId: string, banned: boolean) {
    startTransition(async () => {
      if (banned) await actionUnbanUser(userId)
      else await actionBanUser(userId)
    })
  }

  function handleDelete(userId: string) {
    if (confirmDelete !== userId) {
      setConfirmDelete(userId)
      return
    }
    startTransition(async () => {
      await actionDeleteUser(userId)
      setConfirmDelete(null)
    })
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          defaultValue={search}
          placeholder="Nach E-Mail filtern…"
          onChange={e => handleSearch(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#4F6EF7] focus:ring-1 focus:ring-[#4F6EF7]/20 w-72 transition-colors"
        />
        <span className="text-sm text-[#64748b]">
          {totalCount} Nutzer gesamt
        </span>
        {isPending && (
          <span className="text-xs text-[#4F6EF7] flex items-center gap-1.5">
            <span className="w-3 h-3 border border-blue-200 border-t-[#4F6EF7] rounded-full animate-spin" />
            Wird gespeichert…
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f8f9fb] border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">#</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Nutzer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Erstellt</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[#94a3b8] text-sm">
                  Keine Nutzer gefunden.
                </td>
              </tr>
            )}
            {users.map((user, idx) => {
              const initials = (user.full_name ?? user.email)
                .split(" ").map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2)
              const isBanned = !!user.banned_at
              const rowNum = (page - 1) * 20 + idx + 1

              return (
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${isBanned ? "opacity-60" : ""}`}>
                  {/* # */}
                  <td className="px-4 py-3 text-[#94a3b8]">{rowNum}</td>

                  {/* Nutzer */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-[#4F6EF7]">{initials}</span>
                      </div>
                      <div>
                        <p className="font-medium text-[#0f172a]">{user.full_name ?? "—"}</p>
                        <p className="text-xs text-[#64748b]">{user.email}</p>
                      </div>
                      {user.is_admin && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-[#64748b] font-medium">
                          Admin
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="px-4 py-3">
                    <select
                      value={user.plan}
                      onChange={e => handlePlan(user.id, e.target.value)}
                      disabled={isPending}
                      className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-[#0f172a] focus:outline-none focus:border-[#4F6EF7] transition-colors capitalize cursor-pointer"
                    >
                      {PLANS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </td>

                  {/* Erstellt */}
                  <td className="px-4 py-3 text-[#64748b] text-xs">
                    {new Date(user.created_at).toLocaleDateString("de-DE", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {isBanned ? (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium border border-red-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"/>
                        Gesperrt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-600 font-medium border border-green-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>
                        Aktiv
                      </span>
                    )}
                  </td>

                  {/* Aktionen */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleBan(user.id, isBanned)}
                        disabled={isPending || user.is_admin}
                        title={user.is_admin ? "Admins können nicht gesperrt werden" : undefined}
                        className="text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={isBanned
                          ? { borderColor: "#d1fae5", background: "#f0fdf4", color: "#16a34a" }
                          : { borderColor: "#fee2e2", background: "#fff5f5", color: "#dc2626" }
                        }
                      >
                        {isBanned ? "Entsperren" : "Sperren"}
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={isPending || user.is_admin}
                        title={user.is_admin ? "Admins können nicht gelöscht werden" : undefined}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          confirmDelete === user.id
                            ? "bg-red-500 text-white border-red-500"
                            : "border-gray-200 text-[#64748b] hover:border-red-200 hover:text-red-500"
                        }`}
                      >
                        {confirmDelete === user.id ? "Bestätigen" : "Löschen"}
                      </button>
                      {confirmDelete === user.id && (
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-[#94a3b8] hover:text-[#64748b] transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate({ page: String(page - 1) })}
            disabled={page <= 1}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-[#64748b] hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Zurück
          </button>
          <span className="text-sm text-[#64748b]">
            Seite {page} von {totalPages}
          </span>
          <button
            onClick={() => navigate({ page: String(page + 1) })}
            disabled={page >= totalPages}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-[#64748b] hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Weiter →
          </button>
        </div>
      )}
    </div>
  )
}
