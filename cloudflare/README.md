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

El navegador recibe una cookie anónima `HttpOnly`; no se guarda nombre, correo ni cuenta personal. La moderación puede aprobar después las composiciones cambiando su estado en D1.

El `database_id` es específico de la cuenta y no debe inventarse ni compartirse en el código antes de crear la base.
