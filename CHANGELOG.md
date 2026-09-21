# Historial de cambios

Registro cronológico de la evolución técnica de RedWeb. El estado actual y la arquitectura se documentan en [README.md](README.md).

## 21/09/2026

- Se ajustó la carga inicial de la home para usar datos derivados más livianos y reducir el trabajo de render de la vista principal.
- Se agregó una etapa de generación de JSON auxiliares en GitHub Actions para apoyar calendario, resumenes y búsqueda rápida sin duplicar lógica.
- Se mejoró el tema claro de los pins del mapa para mantener legibilidad y consistencia visual.
- Se movió el bloque de chips del mapa un poco más arriba para ajustar la composición visual sin cambiar la estructura.
- Se mantuvo el estilo visual del sitio intacto y solo se tocaron ajustes de rendimiento y pulido visual.

## 18/09/2026

- Se cerró la revisión responsive de la web principal con validación real en navegador sobre `index.html`, `htmls/mapa.html`, `htmls/composiciones.html`, `htmls/eventos.html` y `htmls/actualizacion.html`.
- Las pruebas se ejecutaron en 390x844, 768x1024, 844x390, 1024x768, 1280x720 y 1440x900.
- Se verificó la ausencia de desbordamiento estructural usando `body.scrollWidth > window.innerWidth + 1` y el resultado fue `false` en todas las pantallas testeadas.
- La revisión confirma que la web mantiene una estructura estable en portrait y landscape para las páginas principales.
- Se registró el estado final en [qa-report/visual-qa-report.md](qa-report/visual-qa-report.md).

## 15/09/2026

- `process-patches.js` genera `contentHtml` además de `contentText`, conservando la estructura útil de los anuncios y eliminando estilos, scripts, envoltorios del CMS, escapes visuales y atributos peligrosos.
- Se sincronizó el procesador local con la copia usada por GitHub Actions.
- `htmls/actualizacion.html` renderiza el HTML procesado para mostrar anuncios generales, cambios de héroes, listas, tablas, enlaces e imágenes sin reducir todo a texto plano.
- La home incorpora un calendario anual tipo GitHub basado en todos los registros de `anuncios.json`, con colores por categoría y navegación al detalle de cada anuncio.
- Se validaron los 106 anuncios en escritorio y móvil sin errores de carga, imágenes rotas ni desbordamiento horizontal.

## 13/09/2026

- Se separó la documentación general del historial técnico.
- La lógica de `process-patches.js` quedó integrada en `.github/actions/check-patch/`.
- GitHub Actions obtiene los anuncios recientes desde la fuente española de `backfill-patches`, conserva `anuncios-raw.json` y regenera los JSON derivados.
- Se mantuvo una copia local de respaldo en `scripts/process-patches.js`.
- El constructor de composiciones solo permite guardar cuando tiene cinco héroes distintos, descripción y nota personal.

## 10/09/2026

- El procesador normaliza los héroes del patch: `Mulan`, `Changgong`, `Luara`, `La Voz del Flujo (Carry)`, `Ying` y `Lapulapu`.
- El parser reconoce labels de balance en español y los convierte en `Potenciado`, `Ajuste` y `Reducido` según la estructura del texto y los valores `antes -> ahora`.
- Se incorporaron correcciones de UI/UX del patch: vista previa duplicada de recompensas, estados incorrectos en la Bóveda del tiempo, visual de `Biron Inuyasha`, fondo de carga y disponibilidad de `Yango` en 1v1.
- `assets/js/index.js` y `assets/js/stats.js` actualizan el resumen del último parche y sus etiquetas visibles.

## 27/08/2026

- El timeline incluye buffs para `Luna`, `Yao`, `Dolia`, `Sima Yi` y `Kongming`, además de ajustes para `Li Xin`, `Feyd` y `Agudo`.
- Se reforzó la clasificación de mejoras, reducciones y ajustes sin depender solo de `buff` o `nerf`.
- `assets/js/script-mapUp.js` utiliza esos estados para renderizar los labels del mapa.
- Se incorporaron correcciones de audio, voz y gameplay para `Lam Okarun`, `Yaria`, `Ultracaos`, `Li Xin`, `Lady Zhen Aventura Congelada`, `Mayene`, `Butterfly` y `Ming`.

## 13/08/2026

- El pipeline procesa cambios de `Luara`, `Mai Shiranui`, `Xuance`, `Fatih`, `Dharma`, `Meng Ya`, `Hou Yi`, `Erin` y `Sakeer`.
- Se normalizaron variantes de `La Voz del Flujo` y otros nombres duplicados.
- `assets/js/eventos.js` integra el estado `Finalizado` y badges de eventos.
- Se registraron validaciones de gameplay y visuales para `La Voz del Flujo`, `Diaochan`, `Allain`, `Consorte Yu` y `Lady Sun`.

## Evolución del sistema

- Se creó `data/heroes.json` con catálogo, aliases, líneas y estadísticas iniciales.
- `assets/js/hero-catalog.js` carga el catálogo activo y convierte tags internos en nombres visibles.
- Se construyó el selector de composiciones con cinco slots fijos, referencias prearmadas, arrastre entre slots, pines de mapa y confirmaciones visuales.
- Se añadieron `htmls/composiciones.html`, `assets/css/composiciones.css` y la carga de eventos desde `common.js`.
- Se normalizaron las rutas entre la raíz, `htmls/` y `recicle/`.
- Se ajustaron el mapa de balance, sus coordenadas, zoom interno, interacción táctil y comportamiento responsive.
- Se añadieron cabeceras compartidas, modo claro/oscuro persistente y navegación responsive.
- Se revisaron las páginas activas y los snapshots móviles para evitar desbordes horizontales.

## Pipeline de datos

- `anuncios-raw.json` conserva el HTML original de los anuncios.
- `anuncios.json` contiene los anuncios procesados.
- `updates.json` alimenta la home, el ranking y el mapa de balance.
- `otros-anuncios.json` conserva los anuncios que no son actualizaciones.
- El pipeline de Actions valida la sintaxis, obtiene los anuncios recientes y regenera los JSON derivados.
