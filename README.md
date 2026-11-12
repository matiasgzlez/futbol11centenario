# Fútbol 11 · Centenario

Web para organizar el partido UTN × Sarmiento de Resistencia en el Estadio Centenario, con estética de Ultimate Team. Estaba previsto para el domingo 4 de octubre de 2026, pero se suspendió por lluvia y la nueva fecha está a confirmar. Supabase comparte jugadores, fotos, comentarios y Prode.

Stack: Vite + React 19 + TypeScript + Tailwind 4 + Motion (el mismo del switch de MARQ). El código está en `src/`: `lib/store.ts` (Supabase, caché, tiempo real), `lib/game.ts` (cartas, medias y boletas) y `components/` (pantallas).

## Activar esta versión

1. Abrir el proyecto Supabase `xeukyzwstqbaciugubtf` y entrar en **SQL Editor**.
2. Ejecutar **solo `supabase_reparacion.sql`** (agrega el lugar de director técnico de cada equipo, `pos 16`). Este archivo incluye las ampliaciones necesarias y puede ejecutarse nuevamente. Conserva los nombres, fotos, propietarios y boletas existentes. Los archivos SQL anteriores quedan como referencia histórica: no volver a ejecutar `supabase_owner.sql`, que reinicia propietarios, ni las políticas anteriores, que permiten borrar boletas ajenas.
3. Publicar en Vercel: `vercel.json` indica compilar con `npm run build` y servir `dist/`. Si el proyecto de Vercel estaba configurado como sitio estático sin compilación, revisar que tome esa configuración.
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

La pantalla **Mi acceso** (copiar el código privado y recuperarlo en otro navegador) se quitó en el rediseño; está pendiente decidir si vuelve. Mientras tanto, cada lugar y cada boleta solo se pueden editar desde el navegador con el que se cargaron. Si alguien perdió ese navegador, el administrador debe liberar el lugar desde Supabase después de verificar con la persona.

Las boletas antiguas guardan nombres en lugar de identificadores; sus votos se buscan por coincidencia exacta. El Prode utiliza puntos virtuales: no procesa dinero, no liquida premios ni calcula una clasificación final.

## Vista previa y pruebas

Con Node.js:

```sh
npm install
npm run dev
```

Abrir `http://127.0.0.1:4173`. La vista previa consulta el Supabase configurado: no usarla para cargar datos ficticios en producción.

```sh
npm run test:database
npm test
```

`npm test` compila la web y la prueba en Chrome headless, interceptando todas las peticiones a Supabase para dirigirlas a PostgreSQL aislado (PGlite). Se puede cambiar el navegador mediante `PLAYWRIGHT_BROWSER_CHANNEL=msedge`. Las capturas se guardan en `.test-output/`, excluido de Git. Se prueban anchos de 320, 390, 768, 1024 y 1440 píxeles, y que ninguna pantalla tenga scroll.

El SDK está fijado en `@supabase/supabase-js@2.117.2`. La clave pública `anon` puede estar en el frontend; los permisos los controlan las funciones y políticas de Supabase. No agregar una clave `service_role` al navegador.

Referencias: [devolver filas modificadas](https://supabase.com/docs/reference/javascript/using-modifiers-select) y [eventos Broadcast](https://supabase.com/docs/guides/realtime/broadcast).
