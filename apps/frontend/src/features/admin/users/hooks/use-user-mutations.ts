import { useOrpcMutation } from "@/hooks/use-orpc-mutation"
import { authClient, unwrapAuth } from "@/lib/auth-client"

const usersKey = ["admin", "users"] as const

export function useUserMutations() {
  const createUser = useOrpcMutation({
    mutationFn: (input: {
      name: string
      email: string
      password: string
      role: "user" | "admin"
    }) => unwrapAuth(authClient.admin.createUser(input)),
    success: "Usuario creado",
    error: "No se pudo crear el usuario",
    invalidate: [usersKey],
  })

  const setUserPassword = useOrpcMutation({
    mutationFn: (input: { userId: string; newPassword: string }) =>
      unwrapAuth(authClient.admin.setUserPassword(input)),
    success: "Contraseña actualizada",
    error: "No se pudo cambiar la contraseña",
  })

  const banUser = useOrpcMutation({
    mutationFn: (input: { userId: string; banReason?: string }) =>
      unwrapAuth(authClient.admin.banUser(input)),
    success: "Usuario baneado",
    error: "No se pudo banear al usuario",
    invalidate: [usersKey],
  })

  const unbanUser = useOrpcMutation({
    mutationFn: (input: { userId: string }) =>
      unwrapAuth(authClient.admin.unbanUser(input)),
    success: "Baneo retirado",
    error: "No se pudo quitar el baneo",
    invalidate: [usersKey],
  })

  const removeUser = useOrpcMutation({
    mutationFn: (input: { userId: string }) =>
      unwrapAuth(authClient.admin.removeUser(input)),
    success: "Usuario eliminado",
    error: "No se pudo eliminar el usuario",
    invalidate: [usersKey],
  })

  const setRole = useOrpcMutation({
    mutationFn: (input: { userId: string; role: "user" | "admin" }) =>
      unwrapAuth(authClient.admin.setRole(input)),
    success: "Rol actualizado",
    error: "No se pudo actualizar el rol",
    invalidate: [usersKey],
  })

  return {
    createUser,
    setUserPassword,
    banUser,
    unbanUser,
    removeUser,
    setRole,
  }
}
