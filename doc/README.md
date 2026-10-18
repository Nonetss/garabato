# Documentación de Garabato

Esta carpeta es un **repositorio de contenido de colofon**: la plataforma lo
clona, lo valida y lo publica como sitio de documentación. Se registra en la
plataforma con este repositorio y la **carpeta del contenido** `doc`. Aquí no
se compila ni se ejecuta nada.

| Ruta | Qué contiene |
| --- | --- |
| `doc.config.yaml` | El sitio: nombre, versión del contrato y los campos extra de cabecera |
| `menu.yaml` | Los grupos de la barra lateral |
| `docs/` | Las páginas, en MDX; cada carpeta es una sección con su `index.mdx` |
| `catalog/` | Los datos como tablas: workspaces, variables de entorno, comandos y ficheros compose |
| `diagrams/` | Los diagramas, uno por fichero, mostrados en las páginas con `<Diagram id="…" />` |
| `screenshots/` | Las capturas del `README.md` de la raíz y de `apps/site`; la plataforma no las lee |
| `readme/` | Los diagramas en inglés del `README.md` de la raíz (cada SVG con su `.html` original); la plataforma no los lee |

Las convenciones de este sitio están en `AGENTS.md` de la raíz, sección
«Documentation site (`doc/`)». Para escribir con un agente, instala las skills de
escritura de colofon (`colofon-documentation` y las demás `colofon-*`) desde la
plataforma.
