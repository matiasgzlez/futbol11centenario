# Fútbol 11 · Centenario

Web estática para organizar el partido en el Estadio Centenario. Estaba previsto para el domingo 4 de octubre de 2026, pero se suspendió por lluvia y la nueva fecha está a confirmar. HTML, CSS y JavaScript, sin compilación. Supabase comparte jugadores, fotos, chat y Prode.

## Activar esta versión

1. Abrir el proyecto Supabase `xeukyzwstqbaciugubtf` y entrar en **SQL Editor**.
2. Ejecutar **solo `supabase_reparacion.sql`**. Este archivo incluye las ampliaciones necesarias y puede ejecutarse nuevamente. Conserva los nombres, fotos, propietarios y boletas existentes. Los archivos SQL anteriores quedan como referencia histórica: no volver a ejecutar `supabase_owner.sql`, que reinicia propietarios, ni las políticas anteriores, que permiten borrar boletas ajenas.
3. Publicar juntos `index.html`, `styles.css` y `app.js` en el alojamiento actual. No hacen falta `node_modules`, `tests` ni los archivos SQL para servir la web.
4. Abrir la web por HTTPS. Comprobar que el indicador muestre **Al día** y probar con dos navegadores: guardar un nombre/foto, comprobarlo desde el otro y recargar ambos. El Prode debe mostrar una sola boleta por acceso después de actualizarlo.

La corrección de la base fue comprobada en PostgreSQL aislado mediante PGlite, partiendo de los scripts anteriores. Las pruebas del navegador usan esa base aislada y el SDK real de Supabase. No modifican el proyecto de producción. La migración **todavía debe ejecutarse en el Supabase real** y los archivos **todavía deben publicarse**.

## Qué se corrigió

- El guardado de jugadores, fotos, chat y boletas se confirma únicamente después de una respuesta válida de la base. Un error conserva el formulario y los datos anteriores.
- Los lugares de titulares, suplentes y árbitro comparten permisos coherentes. Un acceso puede editar sus lugares; los lugares anteriores sin dueño se pueden reclamar al guardarlos.
- Cambiar de posición o intercambiar dos lugares del mismo acceso se hace en una transacción. El cambio de capitán también queda compartido y solo puede haber uno por equipo al guardarlo.
- Las fotos se recortan y comprimen antes de subirlas. Si la subida falla, el nombre y la foto no se dan por guardados. El archivo publicado usa una URL distinta para cada foto nueva, evitando cachés antiguas.
- La sincronización interpreta correctamente los eventos de Supabase y vuelve a leer los datos confirmados. También actualiza al recuperar internet, volver a la pestaña y cada 20 segundos mientras está visible. Las listas vacías del servidor limpian la caché.
- El chat muestra los últimos 50 mensajes, no los primeros 50.
- El Prode reemplaza la boleta anterior del mismo acceso en una transacción y protege su borrado. Dos personas con el mismo nombre conservan boletas independientes. Las boletas históricas duplicadas se muestran una vez por propietario; se reemplazan al guardar el próximo pronóstico de ese acceso.
- Los selectores usan únicamente jugadores anotados. Los nombres con apóstrofes no rompen los botones. Los pronósticos nuevos guardan un identificador estable del jugador, que conserva sus votos al renombrarse o moverse.
- Se corrigieron diálogos visibles estando cerrados, inserción de nombres sin escapar, selección errónea de jugadores por nombres parcialmente coincidentes y límites de marcador inconsistentes.
- Diseño adaptable, lista de planteles, lugares disponibles, controles accesibles con teclado y estado de conexión visible.

## Editar desde otro celular

En el navegador con el que se anotó al jugador, abrir **Mi acceso → Copiar mi código de acceso**. Guardar ese código en privado. En el otro navegador, abrir **Mi acceso**, pegar el código y elegir **Recuperar mi acceso**. Ambos usarán el mismo acceso.

El código permite editar todos los lugares y la boleta cargados con ese acceso. No compartirlo en el grupo. Borrar los datos del navegador sin guardar el código pierde ese acceso. Los propietarios existentes no se pueden recuperar a partir de su nombre o foto: si ya se perdió el navegador original, el administrador deberá liberar específicamente ese lugar desde Supabase después de verificar con la persona. Esta versión conserva el mecanismo de acceso existente; no incorpora cuentas personales ni una administración con login.

Las boletas antiguas guardan nombres en lugar de identificadores; sus votos se buscan por coincidencia exacta. Al volver a elegir jugadores y guardar una boleta, sus selecciones usan los identificadores nuevos. El Prode utiliza puntos virtuales: no procesa dinero, no liquida premios ni calcula una clasificación final.

## Vista previa y pruebas

Con Node.js y pnpm disponibles:

```sh
pnpm install
pnpm preview
```

Abrir `http://127.0.0.1:4173`. La vista previa consulta el Supabase configurado: no usarla para cargar datos ficticios en producción.

```sh
pnpm test:database
pnpm test
```

La prueba visual usa Chrome instalado, en modo headless, e intercepta todas las peticiones a Supabase para dirigirlas a PostgreSQL aislado. Se puede cambiar el navegador instalado mediante `PLAYWRIGHT_BROWSER_CHANNEL=msedge`. Las capturas se guardan en `.test-output/`, excluido de Git. Se prueban anchos de 320, 390, 768, 1024 y 1440 píxeles.

El SDK está fijado en `@supabase/supabase-js@2.117.2`. La clave pública `anon` puede estar en el frontend; los permisos los controlan las funciones y políticas de Supabase. No agregar una clave `service_role` al navegador.

Referencias: [devolver filas modificadas](https://supabase.com/docs/reference/javascript/using-modifiers-select) y [eventos Broadcast](https://supabase.com/docs/guides/realtime/broadcast).
