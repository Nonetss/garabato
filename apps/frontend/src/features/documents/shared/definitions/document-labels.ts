export const documentLabels = {
  upload: "Subir PDF",
  uploadSubmit: "Subir",
  uploadDescription:
    "El PDF se guarda cifrado. Debe ocupar como máximo 20 MB y no estar protegido con contraseña.",
  file: "Archivo PDF",
  fileRequired: "Elige un archivo PDF",
  fileTooLarge: "El PDF ocupa más de 20 MB",
  open: "Abrir",
  download: "Descargar",
  delete: "Eliminar",
  deleteTitle: "Eliminar documento",
  deleteDescription: (name: string) =>
    `Se eliminará "${name}" con todas sus versiones de forma permanente. El registro de sus firmas se conserva.`,
  pages: "Páginas",
  size: "Tamaño",
  signatures: "Firmas",
  lastSigned: "Última firma",
  unsigned: "Sin firmar",
  signed: "Firmado",
} as const
