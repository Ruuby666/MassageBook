# MassageBook

Sistema de reservas para un masajista independiente a domicilio. Tiene dos lados que comparten una sola base de datos en Firebase:

- **App del masajista** (React Native / Expo) — calendario personal donde el masajista ve todas sus citas, crea citas manualmente, y bloquea horarios o días completos para que los clientes no puedan reservar ahí.
- **Formulario web del cliente** (HTML/JS estático en Firebase Hosting) — el cliente abre un link, llena sus datos y elige un horario. La reserva se guarda en Firestore como **pendiente** y aparece al instante en la app del masajista, quien la confirma o rechaza manualmente; el cliente recibe un correo cuando eso pasa.

Diseñado para vivir dentro de las capas gratuitas de Firebase (excepto Cloud Functions, que requiere el plan Blaze aunque el coste real sea 0 € con este volumen de uso).

## Estructura del proyecto

```
App.js                    Punto de entrada: gate de autenticación (login o tabs) + tab
                             navigator (Calendario/Masajes, barra de tabs oculta —
                             se navega con el botón del tag, el swipe entre tabs o la
                             flecha de regreso)
src/
  screens/
    LoginScreen.js         Login con email/contraseña
    CalendarScreen.js      Calendario principal (calendario mensual + agenda del día + menú flotante)
    ServicesScreen.js      Catálogo de masajes: listar, crear, editar, habilitar/deshabilitar
  components/
    AppointmentCard.js       Tarjeta de una cita en la agenda
    AppointmentDetailModal.js  Detalle de una cita: confirmar/rechazar, cambiar hora, eliminar
    AppointmentModal.js      Modal para crear una cita manualmente
    BlockCard.js              Tarjeta de un bloqueo en la agenda
    BlockModal.js              Modal para bloquear un día completo u horas
    ServiceFormModal.js        Modal para crear/editar un masaje del catálogo
    ServicePicker.js            Selector de masaje reutilizable (lista + detalles)
    ExpandableFabMenu.js       Menú flotante desplegable (Cita / Bloquear / Masajes)
    FloatingActionButton.js    Botón flotante reutilizable (apilable)
    ModalBackdrop.js           Fondo oscurecido de los modales (se cierran al tocar fuera)
  firebase/
    config.js               Config pública del proyecto Firebase (no es secreta)
    index.js                Inicialización de Auth/Firestore/Functions para la app
  notifications/pushNotifications.js
                            Registro del token push del móvil (solo Android) y
                            manejo del toque en una notificación
  utils/dateHelpers.js      Helpers de fecha/hora (formateo, solapamiento, zonas horarias)
  utils/calendarLocale.js   Pone los calendarios en español
  theme.js                  Colores, tipografía y espaciados compartidos

functions/
  index.js                 getAvailability (horarios libres para el calendario de la web),
                             createReservation (único punto de escritura de reservas),
                             confirmReservation/rejectReservation (revisión manual de
                             reservas pendientes, envían email),
                             updateReservationTime/deleteReservation (cambiar la hora o
                             borrar una cita, con aviso por correo) y las programadas
                             sendReminders (recordatorio por correo en las 48 h previas)
                             y notifyTherapist (avisos push al masajista)
  validation.js             Lógica pura de validación/solapamiento de reservas
  availability.js            Lógica pura de los huecos libres (reutiliza las reglas
                             de validation.js para no ofrecer nada que luego se rechace)
  reminders.js               Lógica pura de la ventana de fecha y el contenido
                             del correo de recordatorio
  notifications.js           Lógica pura del contenido de los correos de
                             confirmación/rechazo
  push.js                    Contenido y envío (vía Expo) de la notificación push
                             de reserva nueva al masajista
  therapistAlerts.js         Lógica pura de los avisos de notifyTherapist (reservas sin
                             revisar y próxima cita)
  html.js                    Escapa los datos del cliente antes de meterlos en los correos

web/
  index.html, styles.css, script.js, firebase-config.js
                             Formulario público de reservas (Firebase Hosting): el
                             cliente elige masaje y luego día y hora en un calendario
                             con solo los horarios libres

firebase.json, firestore.rules, firestore.indexes.json, .firebaserc
                             Configuración del proyecto Firebase

app.config.js, app.json, eas.json, google-services.<variante>.json
                             Config de Expo/EAS y de cada app (ver "Dos apps")

scripts/use-project.js       Cambia el proyecto de Firebase activo (npm run use:*)
tests/                       Tests contra los emuladores (reglas, funciones programadas,
                             reservas simultáneas, formulario web en Chrome)
```

## Modelo de datos (Firestore)

**`therapists`** — quién es el masajista: un doc por cuenta con acceso, con id = UID de Firebase Auth (sin campos obligatorios). Estar logueado no basta: las rules y las Cloud Functions solo tratan como masajista a quien tenga este doc. Se gestiona solo desde la consola de Firebase (rules bloquean escrituras).

**`reservations`** — solo lectura para el masajista; toda escritura pasa por las Cloud Functions `createReservation`/`confirmReservation`/`rejectReservation` (rules bloquean writes directos). `service`, `durationMinutes` y `price` los pone el servidor a partir del catálogo (`serviceId`), nunca vienen del cliente.
```
clientName, phone, email, address, serviceId, service, durationMinutes,
price, date (Timestamp), notes, createdAt, reminderSent, status ('pending' | 'confirmed'),
pendingReminderSent, therapistReminderSent
```

**`blocks`** — lectura/escritura del masajista autenticado directamente desde la app.
```
date ("YYYY-MM-DD"), allDay (bool), startTime, endTime, reason, createdAt
```

**`services`** — catálogo de masajes. Lectura pública (sin PII, lo necesita el formulario del cliente), escritura solo del masajista autenticado, directo desde la app.
```
name, description, durationMinutes, price, materials, enabled, createdAt
```

**`slotLocks`** — un doc por día (id = "YYYY-MM-DD", día de Canarias) que solo usan las Cloud Functions para poner en fila las reservas de ese día. Sin acceso desde el cliente.

**`pushTokens`** — un doc por móvil del masajista (id = token de Expo). La app solo puede crear/actualizar el suyo; nadie lo lee desde el cliente, solo `createReservation` vía Admin SDK.
```
token, uid, platform, updatedAt
```

## Reglas de negocio clave

- La duración de cada masaje la define el masajista libremente (en minutos) al crear/editar el masaje en el catálogo — no está limitada a valores fijos.
- El cliente (formulario web) y el masajista (app) **eligen el masaje del mismo catálogo** (`services`) en vez de escribir servicio/duración/precio a mano — el servidor toma esos datos del catálogo, no del request.
- `enabled` en un masaje solo controla si el **cliente** puede elegirlo en el formulario público; el masajista puede seguir agendándolo él mismo aunque esté deshabilitado.
- El **formulario web** muestra un **calendario de los próximos 30 días** con solo los horarios libres para el masaje elegido (cada 30 min), calculados por la Cloud Function `getAvailability` con las mismas reglas que `createReservation` (horario, bloqueos, colchón). Devuelve solo horas, nunca datos de otros clientes ni el motivo de un bloqueo. Las reservas pendientes también ocupan su hueco. Si alguien se adelanta y ocupa la hora mientras el cliente rellena el formulario, `createReservation` lo rechaza y la web recarga los horarios.
- El **formulario web** no permite reservar **para el mismo día** (día local de Canarias): como mínimo para mañana. El masajista sí puede agendar para hoy desde la app.
- El **formulario web** (sin autenticar) exige un **colchón de 30 minutos** entre citas.
- El **formulario web** solo permite reservar entre **8:00 a.m. y 9:00 p.m.** (hora de Canarias); el masaje tampoco puede terminar después de las 9:00 p.m. El masajista puede seguir agendando fuera de ese horario desde la app si lo necesita.
- El **formulario web** no permite reservar en días u horas que el masajista haya bloqueado (`blocks`); él puede seguir agendando sobre su propio bloqueo desde la app si lo necesita.
- La **creación manual en la app** (masajista autenticado) solo evita el solapamiento literal, sin exigir el colchón — el masajista puede agendar de forma más ajustada si lo necesita.
- Ambos casos comparten la misma Cloud Function, así que la regla vive en un solo lugar.
- **Reservas simultáneas:** si dos personas reservan la misma hora a la vez, se la queda la primera en completar el proceso; la otra recibe "Ese horario ya está ocupado" (y la web le recarga los horarios). La comprobación y el guardado van en una transacción de Firestore que además toma el cerrojo del día en `slotLocks`. Lo mismo al cambiar la hora de una cita.
- Reserva del **formulario web** nace en `status: 'pending'` — el masajista la confirma o rechaza desde la app (`confirmReservation`/`rejectReservation`). Confirmar envía un email al cliente; rechazar borra la reserva (libera el horario) y también le avisa por email.
- Reserva creada **manualmente por el masajista** nace en `status: 'confirmed'` — no requiere su propia revisión.
- Si el masajista **cambia el horario** de una cita (`updateReservationTime`), el cliente recibe un correo con el horario anterior y el nuevo. Si la **elimina** (`deleteReservation`), él elige en la app si avisarle por correo o no (no toda eliminación es una cancelación real).
- Cada cita confirmada con correo recibe un **recordatorio por email en las 48 h previas**, una sola vez (`reminderSent`). También las reservas con poca antelación o confirmadas tarde; solo se espera a que la reserva tenga 12 h, para no llegar justo detrás del correo de confirmación. Citas creadas por el masajista sin correo simplemente no reciben recordatorio, y las reservas aún **pendientes** de confirmar tampoco (el masajista todavía podría rechazarlas).

## Desarrollo local

```bash
npm install
npm run use:mio         # elige el proyecto de Firebase: crea .env, web/firebase-config.js y .firebaserc
npx expo start          # luego escanea el QR con Expo Go, o pulsa 'a' con un emulador Android abierto
```

Si cambias de proyecto con `npm run use:*`, reinicia Expo (`npx expo start -c` si la app sigue viendo el proyecto anterior).

Para el formulario web en local, sírvelo desde `localhost` (el SDK de Firebase lo necesita) en un puerto que **no** sea el 8080, porque ese lo usa el emulador de Firestore en los tests:

```bash
npx http-server web -p 5500 -c-1   # http://localhost:5500
```

La web llama a las Cloud Functions **desplegadas** del proyecto activo: si ahí no están desplegadas, el calendario dice "No pudimos conectar con el servidor".

## Dos apps: la del masajista y la demo

El mismo código genera dos apps independientes, cada una con su proyecto de Firebase. Como tienen paquetes distintos, se pueden instalar las dos en el mismo móvil.

| Variante | Para | Nombre | Paquete Android | Firebase |
|---|---|---|---|---|
| `masajista` | el masajista (uso real) | MassageBook | `io.github.ruuby666.massagebook` | `massagebook-terapeuta` |
| `mio` | portfolio / demo | MassageBook Demo | `io.github.ruuby666.massagebook.demo` | `massagebook-639a4` |

`app.config.js` elige la variante con `APP_VARIANT` (por defecto `mio`, para no generar nunca la app del masajista por error). En local la fija `npm run use:masajista` / `npm run use:mio`, que además cambia `.env`, `web/firebase-config.js` y `.firebaserc` al proyecto correspondiente. El ID del proyecto de Firebase del masajista sigue siendo `massagebook-terapeuta`: Google no permite renombrar IDs de proyecto. Para las notificaciones push en Android, cada proyecto de Firebase tiene su `google-services.json`: guárdalo como `google-services.masajista.json` / `google-services.mio.json` en la raíz. Se suben al repo a propósito: no son secretos (Google los trata como identificadores del proyecto, van dentro de cada APK y lo que protege los datos son las reglas de Firestore), y así EAS los encuentra al compilar en la nube.

## Tests

GitHub Actions (`.github/workflows/ci.yml`) ejecuta todo esto en cada PR y en cada push a `developer` y `main`, además de compilar la app para web y Android. No despliega nada ni necesita secretos. Para ejecutarlo en local:

```bash
npm run lint              # ESLint: app, functions/ y web/
npm test                  # tests de la app
(cd functions && npm test) # tests de las Cloud Functions
npm run test:rules        # reglas de Firestore en el emulador
npm run test:scheduled    # sendReminders y notifyTherapist en el emulador
npm run test:booking      # 5 reservas simultáneas de la misma hora: solo entra una
npm run test:web          # el formulario web de principio a fin en Chrome (headless)
```

Las funciones programadas (`sendReminders`, `notifyTherapist`) mandan correos y notificaciones a personas reales, así que **no se pueden probar en producción**: `test:scheduled` las ejecuta en el emulador con Gmail y el servicio push sustituidos por falsos que solo anotan lo que se habría enviado, y a una hora fija. Conviene pasarlo antes de cada despliegue de functions. Los de emulador necesitan Java y el puerto 8080 libre; `test:web` además necesita Chrome instalado (o `CHROME_PATH`) y conexión a internet, porque la página carga el SDK de Firebase desde el CDN de Google. No modifica `web/`: prueba una copia temporal apuntada a los emuladores.

## Desplegar cambios a Firebase

Hosting tiene dos targets: `booking` (el formulario público, `web/`) y `app` (build web
de Expo, solo existe como sitio en el proyecto demo `massagebook-639a4`). Por eso
`hosting` siempre se despliega por target, nunca a secas.

```bash
# Todo junto (firestore + functions; hosting hay que indicarlo por target, ver abajo)
npx firebase-tools deploy --except hosting

# O por partes
npx firebase-tools deploy --only firestore:rules
npx firebase-tools deploy --only functions
npx firebase-tools deploy --only hosting:booking
```

Requiere haber corrido `npx firebase-tools login` una vez (sesión interactiva en el navegador).

## Acceso del masajista (una sola vez por proyecto)

Hazlo **antes** de desplegar rules/functions, o el masajista se queda sin acceso a la app:

1. Firebase Console → Authentication → Users: copia el **UID** de la cuenta del masajista.
2. Firestore → crea la colección `therapists` con un documento cuyo **ID sea ese UID** (puede tener un campo cualquiera, p. ej. `name`).
3. Authentication → Settings → User actions: desactiva **"Enable create (sign-up)"**, para que nadie pueda crearse cuentas con la API key pública.

## Recordatorios y notificaciones por correo

`sendReminders` corre **cada hora de 9:00 a 21:00 (hora de Canarias)**, busca citas confirmadas en las próximas 48 h que aún no tengan recordatorio y les manda un correo (una sola vez, marca `reminderSent: true`). `confirmReservation`/`rejectReservation` reutilizan el mismo transporter para avisar al cliente en cuanto el masajista revisa su reserva pendiente. Todo se envía desde un Gmail normal por SMTP (sin necesidad de dominio propio verificado).

**Configuración (una sola vez):**
1. En la cuenta de Gmail que va a enviar los correos: activa la verificación en 2 pasos, luego genera una "contraseña de aplicación" en `myaccount.google.com` → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones.
2. Copia `functions/.env.local.example` a `functions/.env.local` (ya está en `.gitignore`, nunca se sube) y rellena `GMAIL_USER` y `GMAIL_APP_PASSWORD`.
3. Sube esos valores como secretos de Firebase (cada uno por separado, `--data-file=-` lee el valor de stdin):
   ```bash
   grep '^GMAIL_USER=' functions/.env.local | cut -d= -f2- | npx firebase-tools functions:secrets:set GMAIL_USER --data-file=-
   grep '^GMAIL_APP_PASSWORD=' functions/.env.local | cut -d= -f2- | npx firebase-tools functions:secrets:set GMAIL_APP_PASSWORD --data-file=-
   ```
   (o `functions:secrets:set NOMBRE` de forma interactiva, pegando el valor cuando lo pida).
4. Despliega: `npx firebase-tools deploy --only functions`.

## Notificaciones push al masajista (Android)

Cada reserva nueva del **formulario web** le manda una notificación push al móvil del masajista ("Nueva reserva pendiente: cliente · masaje · fecha"); tocarla abre el calendario en ese día. Las reservas que crea él mismo no notifican. Además, en la app un banner muestra cuántas reservas siguen pendientes y los días con pendientes llevan un punto ámbar (sirve de respaldo si una notificación no llega).

Además, la Cloud Function programada `notifyTherapist` (cada 15 min) le avisa de:
- **Reservas sin revisar:** si una reserva lleva 2 h pendiente sin confirmar ni rechazar, un solo push agrupado ("2 reservas sin revisar…"; tocarlo abre el día de la más próxima). Solo entre las 9:00 y las 21:00 (hora de Canarias) y una vez por reserva (`pendingReminderSent`).
- **Próxima cita:** unos 45–60 min antes de cada cita confirmada, un push con la hora, el cliente, el masaje y la dirección (a diferencia del de reserva nueva, este sí muestra la dirección: es a donde tiene que ir). Una vez por cita (`therapistReminderSent`, que se reinicia si se cambia la hora).

Ambos avisos van en una sola función programada para quedarse dentro de los 3 trabajos gratuitos de Cloud Scheduler (`sendReminders` es el otro). Si el masajista no tiene ningún móvil registrado, no se marca nada y se reintenta en la siguiente pasada.

Cómo funciona: al iniciar sesión la app pide permiso y guarda el token del móvil en `pushTokens/{token}`; `createReservation` lee esos tokens y envía la notificación a través del servicio push de Expo (gratis, sin claves en el servidor). Los tokens que Expo reporta como inválidos se borran solos.

**Requisitos:** solo **Android**, con una build propia (de EAS o local, ver abajo) en un móvil físico. En Expo Go (Android quitó el push remoto en el SDK 53), en emuladores, en iPhone y en la versión web el módulo de notificaciones ni se carga: la app no pide permiso y todo lo demás sigue igual.

**Configuración (una sola vez):** las dos apps (ver "Dos apps") comparten un proyecto de EAS, y cada una se compila con su perfil de `eas.json` (`masajista` o `mio`). Cada perfil fija `APP_VARIANT` y lee sus variables de un entorno de EAS distinto: `production` para el masajista y `preview` para la demo.
1. `npx eas-cli login` y `npx eas-cli init --account <cuenta>` (con varias cuentas de Expo exige `--account`). `eas init` escribe `expo.extra.eas.projectId` y `owner` en `app.json`; si además copia `extra.appVariant`, bórralo, porque lo pone `app.config.js`. Sin `projectId` no hay token push.
2. En cada proyecto de Firebase, añade una app Android con su paquete (`io.github.ruuby666.massagebook` en `massagebook-terapeuta`, `io.github.ruuby666.massagebook.demo` en `massagebook-639a4`) y descarga su `google-services.json`.
3. En [expo.dev](https://expo.dev) → el proyecto → Environment variables, crea en el entorno **production** (masajista) y en **preview** (demo): las `EXPO_PUBLIC_FIREBASE_*` de ese proyecto (como en `.env.example`). El `google-services.json` no hace falta subirlo: EAS usa el del repo (una variable `GOOGLE_SERVICES_JSON` de tipo *archivo*, si existe, tiene prioridad).
4. En cada proyecto de Firebase → Configuración del proyecto → Cuentas de servicio, genera una clave privada y súbela con `npx eas-cli credentials -p android` → el perfil → **Google Service Account** → **Manage your Google Service Account Key for Push Notifications (FCM V1)** → **Set up**. Hazlo desde la terminal: el asistente de la web de expo.dev pide antes un keystore. Esa clave **sí es secreta**: guárdala fuera del repo.
5. Compila e instala: `eas build -p android --profile masajista` (para el masajista) o `--profile mio` (tu demo). Generan un APK instalable directamente y un enlace para descargarlo. La primera vez pide generar un keystore: di que sí; EAS lo guarda y firma con él las siguientes versiones, que así se instalan encima.
6. Despliega rules y functions en el proyecto que toque (`npm run use:masajista` o `use:mio` antes): `npx firebase-tools deploy --only firestore:rules,functions`.

**Compilar el APK en local (sin EAS)**, para probar en tu móvil por USB (Android SDK + JDK 17; los pasos 1, 2, 4 y 6 de arriba siguen haciendo falta para que lleguen las push):

```bash
npm run use:mio
npx expo prebuild --clean --platform android
cd android && ./gradlew assembleRelease      # en Windows: .\gradlew.bat assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

Queda firmado con la clave de depuración genérica de React Native: sirve para probar, pero la app que usa el masajista se compila con EAS para que las actualizaciones se instalen encima.

## Problemas frecuentes

- **El login dice "Correo o contraseña incorrectos" con la contraseña buena:** la app muestra ese mensaje para cualquier error, también **sin internet**. Mira primero que el móvil tenga conexión.
- **"No se pudieron cargar los bloqueos: Missing or insufficient permissions" tras entrar:** esa cuenta no tiene su documento `therapists/{UID}` en ese proyecto (ver "Acceso del masajista"), o la app apunta a otro proyecto (mira `EXPO_PUBLIC_FIREBASE_PROJECT_ID` en `.env`).
- **Cambiar de usuario:** la app no tiene botón de cerrar sesión. Borra los datos de la app (en Expo Go: `adb shell pm clear host.exp.exponent`) y vuelve a entrar.
- **Los tests de emulador fallan con un `Error` vacío en `loadFirestoreRules`:** otro programa ocupa el puerto 8080 (p. ej. un servidor del formulario web).

