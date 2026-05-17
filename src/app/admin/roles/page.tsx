"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/lib/auth-context";

type PermissionOption = { key: string; label: string };
type RoleItem = { role: string; label: string; permissions: string[] };

const API_ROOT = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export default function RoleAccessPage() {
  const { token } = useAuth();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>({});
  const [draftPermissions, setDraftPermissions] = useState<Record<string, string[]>>({});
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newPermissions, setNewPermissions] = useState<string[]>([]);

  useEffect(() => {
    load();
  }, [token]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/role-permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Failed to load role permissions");
      }
      const data = await res.json();
      setRoles(data.roles || []);
      setDraftLabels(Object.fromEntries((data.roles || []).map((role: RoleItem) => [role.role, role.label])));
      setDraftPermissions(Object.fromEntries((data.roles || []).map((role: RoleItem) => [role.role, role.permissions])));
      setPermissions(data.availablePermissions || []);
    } catch (err: any) {
      setMessage(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function save(role: string, payload: { label?: string; permissions?: string[] }) {
    if (!token) return;
    setSavingRole(role);
    setMessage(null);
    try {
      const res = await fetch(`${API_ROOT}/role-permissions/${role}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save role permissions");
      }
      await load();
      setMessage("Role permissions updated");
    } catch (err: any) {
      setMessage(err.message || "Request failed");
    } finally {
      setSavingRole(null);
    }
  }

  async function createRole() {
    if (!token) return;
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_ROOT}/role-permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: newRole,
          label: newLabel,
          permissions: newPermissions,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create role");
      }

      setNewRole("");
      setNewLabel("");
      setNewPermissions([]);
      await load();
      setMessage("Role created successfully");
    } catch (err: any) {
      setMessage(err.message || "Request failed");
    } finally {
      setCreating(false);
    }
  }

  async function deleteRole(role: string) {
    if (!token) return;
    if (!confirm(`Delete role ${role}?`)) return;
    setMessage(null);
    try {
      const res = await fetch(`${API_ROOT}/role-permissions/${role}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete role");
      }
      await load();
      setMessage("Role deleted successfully");
    } catch (err: any) {
      setMessage(err.message || "Request failed");
    }
  }

  const permissionKeys = useMemo(() => permissions.map((p) => p.key), [permissions]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#18352d]">Role Access</h2>
      </div>

      <div className="rounded-2xl border border-[#e5efea] bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#1f3d34]">Add New Role</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-md font-medium">Role</label>
            <input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
              placeholder="sale"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-md font-medium">Role Label</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Sales"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={createRole}
              disabled={creating || !newRole || !newLabel}
              className="w-full rounded-lg bg-[#2f7c5f] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Role"}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-sm font-medium">Initial permissions</div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {permissions.map((permission) => {
              const checked = newPermissions.includes(permission.key);
              return (
                <label key={permission.key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setNewPermissions((current) =>
                        e.target.checked
                          ? [...current, permission.key]
                          : current.filter((item) => item !== permission.key),
                      );
                    }}
                  />
                  <span>{permission.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {message && <div className="rounded border bg-white p-3 text-sm">{message}</div>}

      {loading ? (
        <div className="rounded border bg-white p-4 text-sm">Loading...</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role.role} className="rounded-2xl border border-[#e5efea] bg-white p-5 shadow-sm">
              <div className="mb-4">
                <input
                  value={draftLabels[role.role] ?? role.label}
                  onChange={(e) => setDraftLabels((current) => ({ ...current, [role.role]: e.target.value }))}
                  className="mb-1 w-full rounded-lg border px-3 py-2 text-lg font-semibold text-[#1f3d34] outline-none"
                />
                <div className="text-xs text-neutral-500">{role.role}</div>
              </div>

              <div className="mb-4 flex items-center gap-2">
                <button
                  onClick={() =>
                    save(role.role, {
                      label: draftLabels[role.role] ?? role.label,
                      permissions: draftPermissions[role.role] ?? role.permissions,
                    })
                  }
                  disabled={savingRole === role.role}
                  className="rounded-lg bg-[#2f7c5f] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {savingRole === role.role ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => deleteRole(role.role)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete Role
                </button>
              </div>

              <div className="space-y-2">
                {permissions.map((permission) => {
                  const checked = (draftPermissions[role.role] ?? role.permissions).includes(permission.key);
                  return (
                    <label key={permission.key} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setDraftPermissions((current) => {
                            const existing = current[role.role] ?? role.permissions;
                            const next = e.target.checked
                              ? [...existing, permission.key]
                              : existing.filter((item) => item !== permission.key);
                            return {
                              ...current,
                              [role.role]: permissionKeys.filter((key) => next.includes(key)),
                            };
                          });
                        }}
                        disabled={savingRole === role.role}
                      />
                      <span>{permission.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}