## MODIFIED Requirements

### Requirement: Select several documents

Every document card and row on `/documents` SHALL have a checkbox to select it, and the page SHALL offer to select every listed document. While at least one document is selected, a selection bar SHALL show "N seleccionados" and the actions "Mover a…", "Etiquetas", "Fijar", "Quitar de fijados", "Unir en un PDF" (only while at least two documents are selected) and "Eliminar", plus a control to clear the selection; on narrow viewports it SHALL take the place of the filter action bar. The actions SHALL apply to every selected document. "Etiquetas" over a selection SHALL show a tag checked when every selected document carries it and indeterminate when only some do, and SHALL change only the tags the user toggles. "Eliminar" SHALL ask for confirmation naming how many documents will be deleted. Changing the open folder or the filters SHALL clear the selection, and pressing Escape SHALL clear it too. Folders SHALL NOT be selectable.

#### Scenario: Tag a mixed selection

- **WHEN** two selected documents carry tag `Urgente`, a third does not, and the user opens "Etiquetas"
- **THEN** `Urgente` SHALL be shown indeterminate, and checking it SHALL add it to the third document without touching the other tags of any of them

#### Scenario: Bulk delete

- **WHEN** the user selects four documents, chooses "Eliminar" and confirms
- **THEN** the four documents SHALL disappear from the list and the selection SHALL be cleared

#### Scenario: Merge needs two documents

- **WHEN** exactly one document is selected
- **THEN** the selection bar SHALL not offer "Unir en un PDF"
