import React, { useState, useEffect } from "react";
import { Users, UserCog, Shield, ShieldCheck, UserX, Loader2, Mail, Calendar } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Switch } from "./ui/switch";
import { toast } from "sonner";
import { usersApi, type User, type UserUpdate } from "../lib/api";

export function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [editingNames, setEditingNames] = useState<Record<number, { first_name: string; last_name: string; phone: string }>>({});

  useEffect(() => {
    loadUsers();
    // Отримуємо email поточного користувача з токену
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserEmail(payload.email || null);
      } catch (e) {
        console.error("Помилка декодування токену:", e);
      }
    }
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersData = await usersApi.getUsers();
      setUsers(usersData);
    } catch (error: any) {
      toast.error("Помилка завантаження користувачів");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (user: User) => {
    // Перевірка: тільки адміністратори можуть призначати інших адміністраторів
    const currentUser = users.find(u => u.email === currentUserEmail);
    if (!currentUser?.is_admin) {
      toast.error("Тільки адміністратори можуть призначати інших адміністраторів");
      return;
    }

    // Не можна зняти права адміністратора з себе
    if (user.email === currentUserEmail && user.is_admin) {
      toast.error("Ви не можете зняти права адміністратора з себе");
      return;
    }

    try {
      const updateData: UserUpdate = {
        is_admin: !user.is_admin,
      };
      const updated = await usersApi.updateUser(user.id, updateData);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      toast.success(
        updated.is_admin
          ? "Користувачу надано права адміністратора"
          : "Права адміністратора знято"
      );
    } catch (error: any) {
      toast.error("Помилка оновлення користувача");
      console.error(error);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      const updateData: UserUpdate = {
        is_active: !user.is_active,
      };
      const updated = await usersApi.updateUser(user.id, updateData);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      toast.success(
        updated.is_active
          ? "Користувача активовано"
          : "Користувача деактивовано"
      );
    } catch (error: any) {
      toast.error("Помилка оновлення користувача");
      console.error(error);
    }
  };

  const handleRoleChange = async (user: User, newRole: string) => {
    // Перевірка: тільки адміністратори можуть змінювати ролі
    const currentUser = users.find(u => u.email === currentUserEmail);
    if (!currentUser?.is_admin) {
      toast.error("Тільки адміністратори можуть змінювати ролі користувачів");
      return;
    }

    try {
      const updateData: UserUpdate = {
        role: newRole,
      };
      const updated = await usersApi.updateUser(user.id, updateData);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      toast.success(`Роль користувача змінено на "${getRoleLabel(newRole)}"`);
    } catch (error: any) {
      toast.error("Помилка оновлення ролі користувача");
      console.error(error);
    }
  };

  const getRoleLabel = (role: string): string => {
    const roleLabels: Record<string, string> = {
      "OWNER": "Адміністратор",
      "ACCOUNTANT": "Бухгалтер",
      "MANAGER": "Менеджер",
    };
    return roleLabels[role] || role;
  };

  const availableRoles = [
    { value: "MANAGER", label: "Менеджер" },
    { value: "ACCOUNTANT", label: "Бухгалтер" },
    { value: "OWNER", label: "Адміністратор" },
  ];

  const handleNameChange = async (user: User, field: "first_name" | "last_name" | "phone", value: string) => {
    // Перевірка: тільки адміністратори можуть змінювати дані користувачів
    const currentUser = users.find(u => u.email === currentUserEmail);
    if (!currentUser?.is_admin) {
      toast.error("Тільки адміністратори можуть змінювати дані користувачів");
      return;
    }

    // Оновлюємо локальний стан для миттєвого відображення
    setEditingNames((prev) => ({
      ...prev,
      [user.id]: {
        ...prev[user.id],
        [field]: value,
      },
    }));

    try {
      const updateData: UserUpdate = {
        [field]: value.trim() || undefined,
      };
      const updated = await usersApi.updateUser(user.id, updateData);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      // Очищаємо локальний стан після успішного оновлення
      setEditingNames((prev) => {
        const newState = { ...prev };
        delete newState[user.id];
        return newState;
      });
      const fieldNames: Record<string, string> = {
        first_name: "Ім'я",
        last_name: "Прізвище",
        phone: "Телефон",
      };
      toast.success(`${fieldNames[field]} оновлено`);
    } catch (error: any) {
      toast.error("Помилка оновлення даних користувача");
      console.error(error);
      // Відновлюємо оригінальні значення при помилці
      setEditingNames((prev) => {
        const newState = { ...prev };
        delete newState[user.id];
        return newState;
      });
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchQuery ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.first_name &&
        user.first_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.last_name &&
        user.last_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const isCurrentUserAdmin = users.find(u => u.email === currentUserEmail)?.is_admin || false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Користувачі
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {!isCurrentUserAdmin && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Тільки адміністратори можуть призначати інших адміністраторів.
                Поточний email: {currentUserEmail || "не визначено"}
              </p>
            </div>
          )}

          <div className="mb-4">
            <Input
              placeholder="Пошук користувачів за email, ім'ям..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-12 w-12 text-[#FF5A00] animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Завантаження користувачів...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Користувачів не знайдено</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Ім'я</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Відділ</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Адміністратор</TableHead>
                    <TableHead className="text-right">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const isCurrentUser = user.email === currentUserEmail;
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{user.email}</span>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">
                                Ви
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isCurrentUserAdmin ? (
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                placeholder="Ім'я"
                                value={editingNames[user.id]?.first_name !== undefined 
                                  ? editingNames[user.id].first_name 
                                  : (user.first_name || "")}
                                onChange={(e) => {
                                  setEditingNames((prev) => ({
                                    ...prev,
                                    [user.id]: {
                                      ...prev[user.id],
                                      first_name: e.target.value,
                                    },
                                  }));
                                }}
                                onBlur={(e) => {
                                  const newValue = e.target.value.trim();
                                  const oldValue = user.first_name || "";
                                  if (newValue !== oldValue) {
                                    handleNameChange(user, "first_name", newValue);
                                  } else {
                                    // Очищаємо локальний стан, якщо значення не змінилося
                                    setEditingNames((prev) => {
                                      const newState = { ...prev };
                                      if (newState[user.id]) {
                                        delete newState[user.id].first_name;
                                        if (Object.keys(newState[user.id]).length === 0) {
                                          delete newState[user.id];
                                        }
                                      }
                                      return newState;
                                    });
                                  }
                                }}
                                className="w-24 text-sm h-8"
                              />
                              <Input
                                type="text"
                                placeholder="Прізвище"
                                value={editingNames[user.id]?.last_name !== undefined 
                                  ? editingNames[user.id].last_name 
                                  : (user.last_name || "")}
                                onChange={(e) => {
                                  setEditingNames((prev) => ({
                                    ...prev,
                                    [user.id]: {
                                      ...prev[user.id],
                                      last_name: e.target.value,
                                    },
                                  }));
                                }}
                                onBlur={(e) => {
                                  const newValue = e.target.value.trim();
                                  const oldValue = user.last_name || "";
                                  if (newValue !== oldValue) {
                                    handleNameChange(user, "last_name", newValue);
                                  } else {
                                    // Очищаємо локальний стан, якщо значення не змінилося
                                    setEditingNames((prev) => {
                                      const newState = { ...prev };
                                      if (newState[user.id]) {
                                        delete newState[user.id].last_name;
                                        if (Object.keys(newState[user.id]).length === 0) {
                                          delete newState[user.id];
                                        }
                                      }
                                      return newState;
                                    });
                                  }
                                }}
                                className="w-24 text-sm h-8"
                              />
                              <Input
                                type="tel"
                                placeholder="Телефон"
                                value={editingNames[user.id]?.phone !== undefined 
                                  ? editingNames[user.id].phone 
                                  : (user.phone || "")}
                                onChange={(e) => {
                                  setEditingNames((prev) => ({
                                    ...prev,
                                    [user.id]: {
                                      ...prev[user.id],
                                      phone: e.target.value,
                                    },
                                  }));
                                }}
                                onBlur={(e) => {
                                  const newValue = e.target.value.trim();
                                  const oldValue = user.phone || "";
                                  if (newValue !== oldValue) {
                                    handleNameChange(user, "phone", newValue);
                                  } else {
                                    // Очищаємо локальний стан, якщо значення не змінилося
                                    setEditingNames((prev) => {
                                      const newState = { ...prev };
                                      if (newState[user.id]) {
                                        delete newState[user.id].phone;
                                        if (Object.keys(newState[user.id]).length === 0) {
                                          delete newState[user.id];
                                        }
                                      }
                                      return newState;
                                    });
                                  }
                                }}
                                className="w-32 text-sm h-8"
                              />
                            </div>
                          ) : (
                            <span>
                              {user.first_name || user.last_name
                                ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                                : "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.phone || "-"}
                        </TableCell>
                        <TableCell>
                          {isCurrentUserAdmin ? (
                            <select
                              className="border rounded-md px-2 py-1 text-sm min-w-[180px]"
                              value={user.role}
                              onChange={(e) => handleRoleChange(user, e.target.value)}
                            >
                              {availableRoles.map((role) => (
                                <option key={role.value} value={role.value}>
                                  {role.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge variant="outline">{getRoleLabel(user.role)}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{user.department || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={user.is_active ? "default" : "secondary"}
                          >
                            {user.is_active ? "Активний" : "Неактивний"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {user.is_admin ? (
                              <ShieldCheck className="w-5 h-5 text-[#FF5A00]" />
                            ) : (
                              <Shield className="w-5 h-5 text-gray-300" />
                            )}
                            <span className="text-sm">
                              {user.is_admin ? "Так" : "Ні"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`active-${user.id}`} className="text-xs">
                                Активний
                              </Label>
                              <Switch
                                id={`active-${user.id}`}
                                checked={user.is_active}
                                onCheckedChange={() => handleToggleActive(user)}
                              />
                            </div>
                            {isCurrentUserAdmin && (
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`admin-${user.id}`} className="text-xs">
                                  Адмін
                                </Label>
                                <Switch
                                  id={`admin-${user.id}`}
                                  checked={user.is_admin}
                                  onCheckedChange={() => handleToggleAdmin(user)}
                                  disabled={isCurrentUser && user.is_admin}
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Примітка:</strong> Тільки адміністратори можуть призначати інших адміністраторів.
              Адміністратор не може зняти права адміністратора з себе.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

