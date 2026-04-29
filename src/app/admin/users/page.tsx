"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/lib/auth-context";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  active?: boolean;
  avatar?: string | null;
};

const API_ROOT = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export default function UsersPage() {
  const { token } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<User & { password?: string }>>({});

  useEffect(() => {
    fetchUsers();
  }, [token]);

  async function fetchUsers() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data || []);
      } else {
        setMessage("Failed to load users");
      }
    } catch (err: any) {
      setMessage(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_ROOT}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ name, email, password, role }),
      });

      if (res.status === 201) {
        setMessage("User created successfully");
        setName("");
        setEmail("");
        setPassword("");
        setRole("staff");
        await fetchUsers();
      } else {
        const data = await res.json();
        setMessage(data.message || "Failed to create user");
      }
    } catch (err: any) {
      setMessage(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(u: User) {
    setEditingId(u.id);
    setEditValues({ name: u.name, email: u.email, role: u.role, active: !!u.active, avatar: u.avatar });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({});
  }

  async function saveEdit(id: number) {
    setLoading(true);
    setMessage(null);
    try {
      const body: any = { ...editValues };
      const res = await fetch(`${API_ROOT}/users/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMessage("User updated");
        cancelEdit();
        await fetchUsers();
      } else {
        try {
          const data = await res.json();
          setMessage(data.message || "Failed to update user");
        } catch {
          setMessage(`Error: ${res.status} ${res.statusText}`);
        }
      }
    } catch (err: any) {
      setMessage(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(u: User) {
    if (!token) return;
    try {
      const res = await fetch(`${API_ROOT}/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !u.active }),
      });
      if (res.ok) await fetchUsers();
      else setMessage("Failed to toggle active");
    } catch (err: any) {
      setMessage(err.message || "Request failed");
    }
  }

  async function handleDelete(u: User) {
    if (!token) return;
    if (!confirm(`Delete user ${u.email}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/users/${u.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMessage("User deleted");
        await fetchUsers();
      } else setMessage("Failed to delete user");
    } catch (err: any) {
      setMessage(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h2 className="text-xl font-semibold">Manage Users</h2>
      {message && (
        <div className="rounded border p-3 text-sm bg-white">{message}</div>
      )}

      <form onSubmit={handleCreate} className="space-y-4 bg-white p-6 rounded shadow">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded border px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" className="w-full rounded border px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" className="w-full rounded border px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <button disabled={loading} type="submit" className="rounded bg-[#2f7c5f] text-white px-4 py-2">
            {loading ? "Creating..." : "Create User"}
          </button>
        </div>
      </form>

      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-medium mb-3">Users</h3>
        {loading && <div className="text-sm mb-3">Loading...</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">#</th>
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Role</th>
                {/* <th className="p-2">Active</th> */}
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-2 align-top">{u.id}</td>
                  <td className="p-2 align-top">{editingId === u.id ? <input className="w-full rounded border px-2 py-1" value={editValues.name || ""} onChange={(e) => setEditValues((s) => ({ ...s, name: e.target.value }))} /> : u.name}</td>
                  <td className="p-2 align-top">{editingId === u.id ? <input className="w-full rounded border px-2 py-1" value={editValues.email || ""} onChange={(e) => setEditValues((s) => ({ ...s, email: e.target.value }))} /> : u.email}</td>
                  <td className="p-2 align-top">{editingId === u.id ? <select className="rounded border px-2 py-1" value={editValues.role || u.role} onChange={(e) => setEditValues((s) => ({ ...s, role: e.target.value }))}><option value="staff">Staff</option><option value="admin">Admin</option></select> : u.role}</td>
                  {/* <td className="p-2 align-top">{editingId === u.id ? <button type="button" onClick={() => setEditValues((s) => ({ ...s, active: !s.active }))} className={`rounded px-3 py-1 text-xs font-medium border ${editValues.active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-neutral-700 border-neutral-300"}`}>{editValues.active ? "Active" : "Inactive"}</button> : <button type="button" onClick={() => toggleActive(u)} className={`rounded px-3 py-1 text-xs font-medium border ${u.active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-neutral-700 border-neutral-300"}`}>{u.active ? "Active" : "Inactive"}</button>}</td> */}
                  <td className="p-2 align-top space-x-2">{editingId === u.id ? <><button type="button" onClick={() => saveEdit(u.id)} className="rounded bg-blue-600 text-white px-3 py-1 text-sm">Save</button><button type="button" onClick={cancelEdit} className="rounded border px-3 py-1 text-sm">Cancel</button></> : <><button type="button" onClick={() => startEdit(u)} className="rounded border px-3 py-1 text-sm">Edit</button><button type="button" onClick={() => handleDelete(u)} className="rounded bg-red-600 text-white px-3 py-1 text-sm">Delete</button></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
