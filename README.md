# MassageBook

Sistema de reservas para un masajista independiente a domicilio. Tiene dos lados que comparten una sola base de datos en Firebase:

- **App del terapeuta** (React Native / Expo) — calendario personal donde el terapeuta ve todas sus citas, crea citas manualmente, y bloquea horarios o días completos para que los clientes no puedan reservar ahí.
- **Formulario web del cliente** (HTML/JS estático en Firebase Hosting) — el cliente abre un link, llena sus datos y elige un horario. La reserva se guarda en Firestore como **pendiente** y aparece al instante en la app del terapeuta, quien la confirma o rechaza manualmente; el cliente recibe un correo cuando eso pasa.

Diseñado para vivir dentro de las capas gratuitas de Firebase (excepto Cloud Functions, que requiere el plan Blaze aunque el costo real sea $0 con este volumen de uso).

## Estructura del proyecto

```
App.js                    Punto de entrada: gate de autenticación (login o tabs) + tab
                             navigator (Calendario/Masajes, barra de tabs oculta —
                             se navega con el botón del tag, el swipe entre tabs o la
                             flecha de regreso)
src/
  screens/
    LoginScreen.js         Login con email/contraseña
    CalendarScreen.js      Calendario principal (selector de días + agenda + FABs)
    ServicesScreen.js      Catálogo de masajes: listar, crear, editar, habilitar/deshabilitar
  components/
    DaySelector.js          Tira horizontal de días con indicadores de citas/bloqueos
    AppointmentCard.js       Tarjeta de una cita en la agenda
    AppointmentModal.js      Modal para crear una cita manualmente
    BlockCard.js              Tarjeta de un bloqueo en la agenda
    BlockModal.js              Modal para bloquear un día completo u horas
    ServiceFormModal.js        Modal para crear/editar un masaje del catálogo
    ServicePicker.js            Selector de masaje reutilizable (lista + detalles)
    FloatingActionButton.js    Botón flotante reutilizable (apilable)
  firebase/
    config.js               Config pública del proyecto Firebase (no es secreta)
    index.js                Inicialización de Auth/Firestore/Functions para la app
  notifications/pushNotifications.js
                            Registro del token push del móvil (solo Android) y
                            manejo del toque en una notificación
  utils/dateHelpers.js      Helpers de fecha/hora (formateo, solapamiento, zonas horarias)
  theme.js                  Colores, tipografía y espaciados compartidos

functions/
  index.js                 createReservation (único punto de escritura de reservas),
                             confirmReservation/rejectReservation (revisión manual de
                             reservas pendientes, envían email) y sendReminders (Cloud
                             Function programada, envía el recordatorio por correo 2
                             días antes de cada cita)
  validation.js             Lógica pura de validación/solapamiento de reservas
  reminders.js               Lógica pura de la ventana de fecha y el contenido
                             del correo de recordatorio
  notifications.js           Lógica pura del contenido de los correos de
                             confirmación/rechazo
  push.js                    Contenido y envío (vía Expo) de la notificación push
                             de reserva nueva a la terapeuta

web/
  index.html, styles.css, script.js, firebase-config.js
                             Formulario público de reservas (Firebase Hosting)

firebase.json, firestore.rules, firestore.indexes.json, .firebaserc
                             Configuración del proyecto Firebase
```

## Modelo de datos (Firestore)

**`therapists`** — quién es la terapeuta: un doc por cuenta con acceso, con id = UID de Firebase Auth (sin campos obligatorios). Estar logueado no basta: las rules y las Cloud Functions solo tratan como terapeuta a quien tenga este doc. Se gestiona solo desde la consola de Firebase (rules bloquean escrituras).

**`reservations`** — solo lectura para la terapeuta; toda escritura pasa por las Cloud Functions `createReservation`/`confirmReservation`/`rejectReservation` (rules bloquean writes directos). `service`, `durationMinutes` y `price` los pone el servidor a partir del catálogo (`serviceId`), nunca vienen del cliente.
```
clientName, phone, email, address, serviceId, service, durationMinutes,
price, date (Timestamp), notes, createdAt, reminderSent, status ('pending' | 'confirmed')
```

**`blocks`** — lectura/escritura del terapeuta autenticado directamente desde la app.
```
date ("YYYY-MM-DD"), allDay (bool), startTime, endTime, reason, createdAt
```

**`services`** — catálogo de masajes. Lectura pública (sin PII, lo necesita el formulario del cliente), escritura solo del terapeuta autenticado, directo desde la app.
```
name, description, durationMinutes, price, materials, enabled, createdAt
```

**`pushTokens`** — un doc por móvil de la terapeuta (id = token de Expo). La app solo puede crear/actualizar el suyo; nadie lo lee desde el cliente, solo `createReservation` vía Admin SDK.
```
token, uid, platform, updatedAt
```

## Reglas de negocio clave

- La duración de cada masaje la define el terapeuta libremente (en minutos) al crear/editar el masaje en el catálogo — no está limitada a valores fijos.
- El cliente (formulario web) y el terapeuta (app) **eligen el masaje del mismo catálogo** (`services`) en vez de escribir servicio/duración/precio a mano — el servidor toma esos datos del catálogo, no del request.
- `enabled` en un masaje solo controla si el **cliente** puede elegirlo en el formulario público; el terapeuta puede seguir agendándolo ella misma aunque esté deshabilitado.
- El **formulario web** (sin autenticar) exige un **colchón de 30 minutos** entre citas.
- El **formulario web** solo permite reservar entre **8:00 a.m. y 9:00 p.m.** (hora de Canarias); el masaje tampoco puede terminar después de las 9:00 p.m. La terapeuta puede seguir agendando fuera de ese horario desde la app si lo necesita.
- El **formulario web** no permite reservar en días u horas que la terapeuta haya bloqueado (`blocks`); ella puede seguir agendando sobre su propio bloqueo desde la app si lo necesita.
- La **creación manual en la app** (terapeuta autenticado) solo evita el solapamiento literal, sin exigir el colchón — el terapeuta puede agendar de forma más ajustada si lo necesita.
- Ambos casos comparten la misma Cloud Function, así que la regla vive en un solo lugar.
- Reserva del **formulario web** nace en `status: 'pending'` — el terapeuta la confirma o rechaza desde la app (`confirmReservation`/`rejectReservation`). Confirmar envía un email al cliente; rechazar borra la reserva (libera el horario) y también le avisa por email.
- Reserva creada **manualmente por el terapeuta** nace en `status: 'confirmed'` — no requiere su propia revisión.
- Cada cita con correo recibe un **recordatorio por email 2 días antes**, una sola vez (`reminderSent`). Citas creadas por la terapeuta sin correo simplemente no reciben recordatorio.

## Desarrollo local

```bash
npm install
npx expo start          # luego escanea el QR con Expo Go, o presiona 'a' con un emulador Android corriendo
```

Para levantar el formulario web localmente: abre `web/index.html` con un servidor estático (necesita HTTPS/localhost para que el SDK de Firebase funcione bien; `npx firebase-tools emulators:start --only hosting` es una opción).

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

## Acceso de la terapeuta (una sola vez por proyecto)

Hazlo **antes** de desplegar rules/functions, o la terapeuta se queda sin acceso a la app:

1. Firebase Console → Authentication → Users: copia el **UID** de la cuenta de la terapeuta.
2. Firestore → crea la colección `therapists` con un documento cuyo **ID sea ese UID** (puede tener un campo cualquiera, p. ej. `name`).
3. Authentication → Settings → User actions: desactiva **"Enable create (sign-up)"**, para que nadie pueda crearse cuentas con la API key pública.

## Recordatorios y notificaciones por correo

`sendReminders` corre todos los días a las **10:00 (hora de Canarias)**, busca citas cuya fecha caiga exactamente 2 días después y les manda un correo (una sola vez, marca `reminderSent: true`). `confirmReservation`/`rejectReservation` reutilizan el mismo transporter para avisar al cliente en cuanto el terapeuta revisa su reserva pendiente. Todo se envía desde un Gmail normal por SMTP (sin necesidad de dominio propio verificado).

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

## Notificaciones push a la terapeuta (Android)

Cada reserva nueva del **formulario web** le manda una notificación push al móvil de la terapeuta ("Nueva reserva pendiente: cliente · masaje · fecha"); tocarla abre el calendario en ese día. Las reservas que crea ella misma no notifican. Además, en la app un banner muestra cuántas reservas siguen pendientes y los días con pendientes llevan un punto ámbar (sirve de respaldo si una notificación no llega).

Cómo funciona: al iniciar sesión la app pide permiso y guarda el token del móvil en `pushTokens/{token}`; `createReservation` lee esos tokens y envía la notificación a través del servicio push de Expo (gratis, sin claves en el servidor). Los tokens que Expo reporta como inválidos se borran solos.

**Requisitos:** solo **Android**, con una build propia de EAS en un móvil físico. En Expo Go (Android quitó el push remoto en el SDK 53), en emuladores, en iPhone y en la versión web el módulo de notificaciones ni se carga: la app no pide permiso y todo lo demás sigue igual.

**Configuración (una sola vez):**
1. `npm install -g eas-cli`, `eas login` y `eas init` (esto añade el `projectId` a `app.json`; sin él no hay token).
2. En Firebase Console → Configuración del proyecto → añade una app Android con el mismo `android.package` de `app.json`, descarga `google-services.json` a la raíz y añade `"googleServicesFile": "./google-services.json"` dentro de `android` en `app.json`.
3. En Firebase → Configuración del proyecto → Cuentas de servicio, genera una clave privada y súbela con `eas credentials` → Android → Push Notifications (FCM V1). Esa clave **sí es secreta**: no la subas al repo.
4. Compila e instala el APK: `eas build -p android --profile preview`.
5. Despliega rules y functions: `npx firebase-tools deploy --only firestore:rules,functions`.

