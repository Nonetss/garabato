import { useOrpcMutation } from "@/hooks/use-orpc-mutation"
import { authClient, unwrapAuth } from "@/lib/auth-client"

export function useUpdateName() {
  return useOrpcMutation({
    mutationFn: (input: { name: string }) =>
      unwrapAuth(authClient.updateUser({ name: input.name })),
    success: "Nombre actualizado",
    error: "No se pudo actualizar el nombre",
  })
}

export function useChangePassword() {
  return useOrpcMutation({
    mutationFn: (input: {
      currentPassword: string
      newPassword: string
      revokeOtherSessions?: boolean
    }) => unwrapAuth(authClient.changePassword(input)),
    success: "Contraseña actualizada",
    error: "No se pudo cambiar la contraseña",
  })
}
