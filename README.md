# RedWeb

RedWeb es una página comunitaria de Honor of Kings publicada con GitHub Pages. La idea es juntar en un solo lugar los cambios de balance, los eventos, la información de los héroes y una herramienta para armar composiciones.

El detalle de los cambios del proyecto está separado en [CHANGELOG.md](CHANGELOG.md), así este archivo no termina siendo una lista interminable de modificaciones.

## Estado actual

La entrada principal de la web es `index.html`. Las secciones más importantes están en `htmls/`:

- `htmls/mapa.html`: cambios de balance y mapa de héroes.
- `htmls/actualizacion.html`: detalle de cualquier anuncio, incluidos anuncios generales sin cambios de héroes.
- `htmls/eventos.html`: eventos y torneos.
- `htmls/composiciones.html`: creador de composiciones.
- `data/`: archivos JSON que consulta la web.
- `assets/css/`: estilos generales y estilos específicos.
- `assets/js/`: código que se ejecuta en el navegador.
- `scripts/`: herramientas locales para preparar y mantener los datos.
- `.github/actions/`: código que ejecuta GitHub Actions.

En la validación responsive del 18/09/2026 se comprobó la home y las páginas principales en resolución vertical y horizontal. Las pruebas se ejecutaron en 390x844, 768x1024, 844x390, 1024x768, 1280x720 y 1440x900. El criterio usado fue detectar desbordamiento real con `body.scrollWidth > window.innerWidth + 1`, y en todas las pantallas probadas el resultado fue `false`.

Páginas validadas:

- `index.html`
- `htmls/mapa.html`
- `htmls/composiciones.html`
- `htmls/eventos.html`
- `htmls/arizacion.html`

## Cómo funciona

El sitio es estático. El frontend está hecho con HTML, CSS y JavaScript; la parte de datos se prepara con Node.js y se actualiza desde GitHub Actions.

El recorrido de los datos, a grandes rasgos, es el siguiente:

1. Se consulta la fuente oficial.
2. La Action guarda el contenido original en `data/anuncios-raw.json`.
3. El procesador ordena la información y arma los JSON que usa la página.
4. Si hay novedades, GitHub Actions guarda los cambios.
5. GitHub Pages publica los archivos que necesita el frontend.

Los scripts que hacen el procesamiento no son parte de la interfaz pública. Los archivos de `assets/js/`, en cambio, sí tienen que estar disponibles porque el navegador los descarga para que la página funcione.

## Creador de composiciones

El creador trabaja con cinco posiciones fijas: `clash`, `jungle`, `mid`, `roam` y `farm`.

Desde ahí se puede:

- Buscar héroes por nombre o por línea.
- Elegir en qué posición va cada uno.
- Moverlos entre posiciones arrastrando los slots.
- Ver la composición sobre el mapa.
- Cargar alguna composición de referencia.
- Escribir una descripción y una nota personal.
- Guardar el borrador en `localStorage`.

El guardado queda bloqueado hasta que haya cinco héroes diferentes, una descripción y una nota. No se intenta decidir si una composición es buena o mala: la moderación está pensada para los textos que eventualmente se publiquen.

## Datos y procesamiento

El catálogo principal de héroes está en `data/heroes.json`. Cada héroe tiene su `nameTag`, su `displayName`, la línea principal y varias estadísticas de referencia. `assets/js/hero-catalog.js` carga ese catálogo y resuelve los aliases antes de mostrar los nombres.

Los archivos de datos más importantes son:

- `data/hero-lanes.json`: líneas y posiciones de los héroes.
- `data/anuncios-raw.json`: HTML original de los anuncios.
- `data/anuncios.json`: todos los anuncios procesados, con `contentText` para búsquedas/resúmenes y `contentHtml` para conservar la estructura visual limpia.
- `data/updates.json`: actualizaciones usadas en la home, el ranking y el mapa.
- `data/otros-anuncios.json`: anuncios que no son actualizaciones.
- `data/events.json`: eventos que muestra la página.

`contentHtml` conserva párrafos, encabezados, listas, tablas, imágenes y enlaces, pero elimina los envoltorios del CMS (`head`, `body`, `style` y `script`), atributos de estilo/eventos y entidades visuales innecesarias como `&nbsp;`. El HTML original permanece disponible en `rawContentHtml` como respaldo.

El chequeo automático de parches está en `.github/actions/check-patch/`. En esa carpeta también está la copia del procesador que usa la Action. Para trabajar localmente se conserva otra copia en `scripts/process-patches.js`.

Para regenerar los datos a mano:

```powershell
node scripts/process-patches.js
```

Para revisar la sintaxis de un archivo JavaScript:

```powershell
node --check ruta/al/archivo.js
```

## Catálogo de HoK Camp

La consulta de la wiki/API se hace con `scripts/fetch-hero-wiki.js`. Puede traer la lista de héroes, pedir los datos completos de cada `heroId` y descargar las imágenes disponibles.

La página no consulta esa API directamente. Primero se guardan los resultados en archivos locales y después `data/heroes.json` queda como fuente estable para la interfaz.

Los valores `specialEncodeParam` son temporales y no se guardan en el repositorio. Cuando hace falta usarlos, se pasan desde la terminal:

```powershell
node scripts/fetch-hero-wiki.js `
  --list-special "VALOR_DE_GETALLHEROBRIEFINFO" `
  --detail-special "VALOR_DE_GETHERODATAALL"
```

## Interfaz y diseño responsive

La base visual se concentra en `assets/css/theme.css`. Ahí están las variables, las tipografías, los encabezados y los modos claro y oscuro. Cada página agrega reglas propias solamente cuando tiene algún comportamiento particular.

La web está pensada para escritorio, móvil y orientación horizontal. La validación actual confirma que la estructura principal se mantiene estable en las páginas clave en both portrait y landscape. Se prestó especial atención a:

- El mapa y sus controles de zoom.
- El selector de héroes.
- El catálogo completo dentro del modal.
- La navegación entre páginas.
- Las tarjetas de eventos, rankings y últimos cambios.
- El calendario anual tipo GitHub, alimentado por todos los anuncios y navegable por día.
- Los snapshots guardados en `recicle/`.

El mapa usa `ResizeObserver` para recalcularse cuando cambia el tamaño del tablero. Las posiciones se mantienen relativas al contenedor para que el zoom general del navegador no desacomode todo.

La validación final no detectó desbordes estructurales principales en la home, el mapa, composiciones, eventos ni la página de actualización. Eso convierte la revisión responsive en una comprobación satisfactoria para el conjunto core del proyecto.

## Ideas pendientes

### Composiciones

Todavía falta cerrar la interfaz de pros y contras, además del circuito completo para enviar composiciones comunitarias y moderar sus textos.

### Estadísticas

Las estadísticas de los héroes sirven para estimar la fuerza general de una composición. La idea es contemplar empuje en cada fase, daño continuo, daño explosivo, movilidad, iniciación, escape, aguante, alcance, control de masas, curación, control de objetivos, limpieza y rotación.

### Gráfica y explicaciones

La gráfica radar debería mostrar dos resultados: uno calculado por el sistema y otro que pueda ajustar la persona que arma la composición. Con esos valores se pueden generar observaciones como buena iniciación, mucha movilidad, poco alcance o dependencia de enfriamientos.

### Publicación

El esquema previsto es bastante simple:

- GitHub Pages para servir la página.
- JSON versionados para los datos públicos.
- `localStorage` para los borradores del navegador.
- GitHub Issues o Pull Requests para recibir propuestas.
- GitHub Actions para validar formato y contenido.
- Ningún token de GitHub dentro del frontend.

## Convenciones

- Las páginas nuevas deberían aprovechar cerca del 90% del ancho disponible.
- `nameTag` se usa en el código, los JSON y las referencias internas.
- `displayName` se reserva para lo que ve el usuario.
- Las rutas relativas tienen que funcionar desde la carpeta correspondiente del HTML.
- Cada héroe debe tener una sola identidad canónica; los aliases se resuelven antes de mostrarlo.
- Para regenerar los JSON localmente se usa `node scripts/process-patches.js`.
- Después de modificar JavaScript, conviene pasar `node --check`.
- Los cambios históricos van en [CHANGELOG.md](CHANGELOG.md), no en este README.
