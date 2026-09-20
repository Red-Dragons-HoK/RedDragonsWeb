# Red Dragons Community API

Worker y base D1 para guardar composiciones públicas con una identidad anónima.

## Configuración inicial

1. Instala Wrangler:

   ```powershell
   npm install -g wrangler
   ```

2. Inicia sesión:

   ```powershell
   wrangler login
   ```

3. Crea la base D1:

   ```powershell
   wrangler d1 create reddragons-community
   ```

4. Copia el `database_id` que devuelve Cloudflare en `wrangler.toml`.

5. Crea las tablas:

   ```powershell
   wrangler d1 execute reddragons-community --remote --file=cloudflare/schema.sql
   ```

6. Publica el Worker:

   ```powershell
   wrangler deploy --config cloudflare/wrangler.toml
   ```

## API

- `GET /health`: comprueba que el Worker está disponible.
- `GET /compositions`: devuelve composiciones aprobadas y marca `mine: true` para las del navegador actual.
- `POST /compositions`: guarda una composición con estado `pending`.
- `POST /moderation-reports`: registra en D1 un reporte JSON cuando el usuario considera que una palabra fue detectada por error.
- `POST /moderation-reports/export`: exporta los reportes pendientes al JSON del repositorio y los elimina de D1 después de confirmar el commit. Requiere `Authorization: Bearer <REPORT_EXPORT_TOKEN>`.

El navegador recibe una cookie anónima `HttpOnly`; no se guarda nombre, correo ni cuenta personal. La moderación puede aprobar después las composiciones cambiando su estado en D1.
Los reportes de moderación se guardan en `moderation_reports` con el texto afectado, el campo, las coincidencias detectadas y los héroes seleccionados.

### Exportación de reportes

Configura los secretos sin incluirlos en Git:

```powershell
wrangler secret put REPORT_EXPORT_TOKEN --config cloudflare/wrangler.toml
wrangler secret put GITHUB_TOKEN --config cloudflare/wrangler.toml
```

El token de GitHub debe poder leer y escribir contenidos del repositorio. El endpoint usa por defecto `Red-Dragons-HoK/RedDragonsWeb`, la rama `main` y `data/moderation-reports.json`; pueden cambiarse con `GITHUB_OWNER`, `GITHUB_REPOSITORY`, `GITHUB_BRANCH` y `GITHUB_REPORTS_PATH` en la configuración del Worker.

GitHub Actions exporta automáticamente los reportes cada hora. Configura el mismo valor usado en el secreto `REPORT_EXPORT_TOKEN` del Worker como secreto del repositorio de GitHub:

```powershell
gh secret set REPORT_EXPORT_TOKEN
```

El workflow está en `.github/workflows/export-moderation-reports.yml` y también puede ejecutarse manualmente desde la pestaña **Actions**.

Para exportar manualmente desde PowerShell:

```powershell
curl.exe -X POST https://reddragons-community.ed-ragons-eb.workers.dev/moderation-reports/export `
  -H "Authorization: Bearer <REPORT_EXPORT_TOKEN>"
```

El Worker primero confirma el commit en GitHub y después elimina únicamente los reportes incluidos en esa exportación.

El `database_id` es específico de la cuenta y no debe inventarse ni compartirse en el código antes de crear la base.
