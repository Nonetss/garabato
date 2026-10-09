import type {
  DocumentVersion,
  DocumentVersionKind,
} from "@/features/documents/shared/model/types"

/** How the version list names each origin. */
export const versionKindLabels: Record<DocumentVersionKind, string> = {
  upload: "original",
  merge: "unión de documentos",
  signature: "firmada",
  pages: "páginas editadas",
}

/** `v2 · firmada`: the version's number and what produced it. */
export function versionLabel(
  version: Pick<DocumentVersion, "number" | "kind">
) {
  return `v${version.number} · ${versionKindLabels[version.kind]}`
}

// `1 página`, `3 páginas`.
function counted(count: number, one: string, many: string) {
  if (count === 1) return `1 ${one}`
  return `${count} ${many}`
}

export const documentLabels = {
  upload: "Subir PDF",
  uploadSubmit: "Subir",
  uploadDescription:
    "El PDF se guarda cifrado. Debe ocupar como máximo 20 MB y no estar protegido con contraseña.",
  file: "Archivo PDF",
  filePrompt: "Arrastra el PDF aquí o haz clic para elegirlo",
  fileRequirements: "PDF · hasta 20 MB · sin contraseña",
  fileRequired: "Elige un archivo PDF",
  fileTooLarge: "El PDF ocupa más de 20 MB",
  fileNotPdf: "Ese archivo no es un PDF",
  dropTitle: "Suelta un PDF para firmarlo",
  dropActive: "Suéltalo para subirlo",
  dropDescription:
    "Hasta 20 MB y sin contraseña. Se guarda cifrado y se abre listo para firmar.",
  dropChoose: "Elegir PDF",
  dropUploading: (name: string) => `Subiendo «${name}»…`,
  library: "Ver todos los documentos",
  open: "Abrir",
  download: "Descargar",
  rename: "Renombrar",
  renameTitle: "Renombrar documento",
  name: "Nombre",
  nameHint: "Se guarda con la extensión .pdf.",
  save: "Guardar",
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
  signedElsewhere: "Firmado fuera de Garabato",
  // Organization: folders, tags and pins.
  root: "Documentos",
  folderPath: "Ruta de la carpeta",
  newFolder: "Nueva carpeta",
  folder: "Carpeta",
  folderName: "Nombre de la carpeta",
  folderIcon: "Icono",
  folderNameHint: "No puede repetirse dentro de la misma carpeta.",
  folderIconSavedHint: "El icono se guarda en cuanto lo eliges.",
  createIn: (path: string) => {
    if (path === "") return "Se creará en la raíz de Documentos."
    return `Se creará dentro de ${path}.`
  },
  create: "Crear",
  editFolder: "Editar",
  editFolderTitle: "Editar carpeta",
  deleteFolderTitle: "Eliminar carpeta",
  deleteFolderDescription: (name: string) =>
    `Se eliminará la carpeta "${name}". Sus documentos y subcarpetas pasan a la carpeta que la contiene; no se elimina ningún documento.`,
  folderNotFound: "Carpeta no encontrada",
  folderNotFoundDescription:
    "La carpeta no existe o se ha eliminado. Vuelve al inicio de la biblioteca.",
  backToRoot: "Ir a Documentos",
  emptyFolder: "Esta carpeta está vacía",
  emptyFolderDescription: "Sube un PDF aquí o crea una subcarpeta.",
  documentCount: (count: number) => {
    if (count === 1) return "1 documento"
    return `${count} documentos`
  },
  move: "Mover a…",
  moveTitle: (count: number) => {
    if (count === 1) return "Mover documento"
    return `Mover ${count} documentos`
  },
  moveFolderTitle: (name: string) => `Mover "${name}"`,
  moveSubmit: "Mover",
  moveHere: "Mover aquí",
  tags: "Etiquetas",
  tagsTitle: (count: number) => {
    if (count === 1) return "Etiquetas del documento"
    return `Etiquetas de ${count} documentos`
  },
  tagSearch: "Buscar o crear etiqueta",
  createTagNamed: (name: string) => `Crear «${name}»`,
  noTags:
    "Todavía no tienes etiquetas. Escribe un nombre para crear la primera.",
  manageTags: "Gestionar etiquetas",
  manageTagsDescription:
    "Renombra, cambia el color o elimina tus etiquetas. Al eliminar una se quita de todos los documentos.",
  tagName: "Nombre",
  tagColor: "Color",
  newTag: "Nueva etiqueta",
  newTagPlaceholder: "Por ejemplo, Clientes",
  createTag: "Crear etiqueta",
  yourTags: "Tus etiquetas",
  close: "Cerrar",
  tagEditHint: "Cambia el nombre directamente; se guarda al salir del campo.",
  deleteTagTitle: "Eliminar etiqueta",
  deleteTagDescription: (name: string, count: number) => {
    if (count === 0) return `Se eliminará la etiqueta "${name}".`
    if (count === 1) {
      return `Se eliminará la etiqueta "${name}" y se quitará del documento que la lleva.`
    }
    return `Se eliminará la etiqueta "${name}" y se quitará de los ${count} documentos que la llevan.`
  },
  pin: "Fijar",
  unpin: "Quitar de fijados",
  pinned: "Fijado",
  notPinned: "No fijado",
  select: (name: string) => `Seleccionar ${name}`,
  selectAll: "Seleccionar todo",
  selectedCount: (count: number) => {
    if (count === 1) return "1 seleccionado"
    return `${count} seleccionados`
  },
  clearSelection: "Quitar selección",
  deleteManyTitle: (count: number) => `Eliminar ${count} documentos`,
  deleteManyDescription: (count: number) =>
    `Se eliminarán ${count} documentos con todas sus versiones de forma permanente. El registro de sus firmas se conserva.`,
  searchName: "Nombre",
  searchPlaceholder: "Buscar en toda la biblioteca…",
  status: "Estado",
  pinState: "Fijado",
  noMatches: "Ningún documento coincide",
  noMatchesDescription: "Prueba con otro nombre o quita algún filtro.",
  clearFilters: "Limpiar filtros",
  libraryResults: (count: number) => {
    if (count === 1) return "1 documento en toda la biblioteca"
    return `${count} documentos en toda la biblioteca`
  },
  // Page editing and merging.
  editPages: "Editar páginas",
  editPagesTitle: "Editar páginas",
  editPagesDescription:
    "Arrastra las páginas para ordenarlas, gíralas o quítalas. Al guardar se crea una versión nueva; las anteriores se conservan.",
  editPagesSigned:
    "Este documento tiene firmas: editar sus páginas las invalidaría",
  pageNumber: (number: number) => `Página ${number}`,
  pageRemoved: "Quitada",
  moveBefore: "Mover antes",
  moveAfter: "Mover después",
  rotateLeft: "Girar a la izquierda",
  rotateRight: "Girar a la derecha",
  removePage: "Quitar página",
  restorePage: "Recuperar página",
  pageAction: (action: string, number: number) =>
    `${action} (página ${number})`,
  pageSummary: (pages: number, removed: number, rotated: number) => {
    const parts = [counted(pages, "página", "páginas")]
    if (removed > 0) parts.push(counted(removed, "quitada", "quitadas"))
    if (rotated > 0) parts.push(counted(rotated, "girada", "giradas"))
    return parts.join(" · ")
  },
  noPagesLeft: "Deja al menos una página para poder guardar.",
  cancel: "Cancelar",
  merge: "Unir en un PDF",
  mergeTitle: (count: number) => `Unir ${count} documentos en un PDF`,
  mergeDescription:
    "Ordena los documentos como quieras que aparezcan. Se crea un documento nuevo y los originales no cambian.",
  mergeOrder: "Orden",
  mergeName: "Nombre del documento nuevo",
  mergeSubmit: "Unir",
  mergeIn: (path: string) => {
    if (path === "") return "Se guardará en la raíz de Documentos."
    return `Se guardará en ${path}.`
  },
  moveUp: "Subir",
  moveDown: "Bajar",
} as const
