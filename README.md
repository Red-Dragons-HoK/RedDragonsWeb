# RedWeb

RedWeb es una página comunitaria de Honor of Kings publicada con GitHub Pages. La idea es juntar en un solo lugar los cambios de balance, los eventos, la información de los héroes y una herramienta para armar composiciones.

El detalle de los cambios del proyecto está separado en [CHANGELOG.md](CHANGELOG.md), así este archivo no termina siendo una lista interminable de modificaciones.

## Estado actual

La entrada principal de la web es `index.html`. Las secciones más importantes están en `htmls/`:

- `htmls/mapa.html`: cambios de balance y mapa de héroes.
- `htmls/actualizacion.html`: detalle de cualquier anuncio, incluidos los no-update.
- `htmls/eventos.html`: eventos y torneos.
- `htmls/composiciones.html`: creador de composiciones.
- `data/`: archivos JSON que consulta la web.
- `assets/css/`: estilos generales y estilos específicos.
- `assets/js/`: código que se ejecuta en el navegador.

## Cómo funciona

El sitio es estático. El frontend está hecho con HTML, CSS y JavaScript; la parte de datos se prepara con Node.js y se actualiza desde GitHub Actions.

El recorrido de los datos, a grandes rasgos, es el siguiente:

1. Se consulta la fuente oficial.
2. La Action guarda el contenido original en `data/anuncios-raw.json`.
3. El procesador ordena la información y arma los JSON que usa la página.
4. Si hay novedades, GitHub Actions guarda los cambios.
5. GitHub Pages publica los archivos que necesita el frontend.

Los scripts que hacen el procesamiento no son parte de la interfaz pública, y no son necesarios para el publico general, por eso unicamente tenemos el archivo que actualiza los parches mas recientes en Actions.

## Creador de composiciones

El creador trabaja con cinco posiciones fijas: `clash`, `jungle`, `mid`, `roam` y `farm`.

Desde ahí se puede:

- Buscar héroes por nombre o por línea.
- Elegir en qué posición va cada uno.
- Moverlos entre posiciones arrastrando los slots.
- Ver la composición sobre el mapa.
- Cargar alguna composición de referencia.
- Escribir una descripción y una nota personal.
- Se está trabajando en una solucion para subir publicamente las composiciones y no se guarde localmente.

El guardado queda bloqueado hasta que haya cinco héroes diferentes, una descripción y una nota. No se intenta decidir si una composición es buena o mala: la moderación está pensada para los textos que eventualmente se publiquen.

## Datos y procesamiento

El catálogo principal de héroes está en `data/heroes.json`. Cada héroe tiene su `nameTag`, su `displayName`, la línea principal y varias estadísticas de referencia. `assets/js/hero-catalog.js` carga ese catálogo y resuelve los aliases antes de mostrar los nombres.

Los archivos de datos más importantes son:

- `data/hero-lanes.json`: líneas y posiciones de los héroes.
- `data/anuncios.json`: todos los anuncios procesados (Updates y no-Updates)
- `data/updates.json`: actualizaciones usadas en la home, el ranking y el mapa.
- `data/otros-anuncios.json`: anuncios que no son actualizaciones.
- `data/events.json`: eventos que muestra la página.

El chequeo automático de parches está en `.github/actions/check-patch/`. En esa carpeta también está la copia del procesador que usa la Action. Para trabajar localmente se conserva otra copia.

## Catálogo de HoK Camp

La página no consulta esa API directamente. Primero se guardan los resultados en archivos locales y después `data/heroes.json` queda como fuente estable para la interfaz.
En ningún momento se utiliza información no publica perteneciente Honor Of Kings.

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

### Creditos

Ni esta pagina ni su creador/es son dueños de la totalidad del contenido de la misma, los créditos de propiedad se dirigen a quienes corresponda.
