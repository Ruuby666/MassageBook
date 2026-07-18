# MassageBook

Sistema de reservas para un masajista independiente a domicilio. Tiene dos lados que comparten una sola base de datos en Firebase:

- **App del terapeuta** (React Native / Expo) — calendario personal donde el terapeuta ve todas sus citas, crea citas manualmente, y bloquea horarios o días completos para que los clientes no puedan reservar ahí.
- **Formulario web del cliente** (HTML/JS estático en Firebase Hosting) — el cliente abre un link, llena sus datos y elige un horario. La reserva se guarda directo en Firestore y aparece al instante en la app del terapeuta.

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
  utils/dateHelpers.js      Helpers de fecha/hora (formateo, solapamiento, zonas horarias)
  theme.js                  Colores, tipografía y espaciados compartidos

functions/
  index.js                 Cloud Function createReservation (único punto de escritura
                             de reservas; valida duración, campos requeridos, fecha
                             futura y solapamiento con colchón de 30 min)

web/
  index.html, styles.css, script.js, firebase-config.js
                             Formulario público de reservas (Firebase Hosting)

firebase.json, firestore.rules, firestore.indexes.json, .firebaserc
                             Configuración del proyecto Firebase
```

## Modelo de datos (Firestore)

**`reservations`** — solo lectura para el terapeuta autenticado; toda escritura pasa por la Cloud Function `createReservation` (rules bloquean writes directos). `service`, `durationMinutes` y `price` los pone el servidor a partir del catálogo (`serviceId`), nunca vienen del cliente.
```
clientName, phone, email, address, serviceId, service, durationMinutes,
price, date (Timestamp), notes, createdAt, reminderSent
```

**`blocks`** — lectura/escritura del terapeuta autenticado directamente desde la app.
```
date ("YYYY-MM-DD"), allDay (bool), startTime, endTime, reason, createdAt
```

**`services`** — catálogo de masajes. Lectura pública (sin PII, lo necesita el formulario del cliente), escritura solo del terapeuta autenticado, directo desde la app.
```
name, description, durationMinutes, price, materials, enabled, createdAt
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

## Desarrollo local

```bash
npm install
npx expo start          # luego escanea el QR con Expo Go, o presiona 'a' con un emulador Android corriendo
```

Para levantar el formulario web localmente: abre `web/index.html` con un servidor estático (necesita HTTPS/localhost para que el SDK de Firebase funcione bien; `npx firebase-tools emulators:start --only hosting` es una opción).

## Desplegar cambios a Firebase

```bash
# Todo junto
npx firebase-tools deploy

# O por partes
npx firebase-tools deploy --only firestore:rules
npx firebase-tools deploy --only functions
npx firebase-tools deploy --only hosting
```

Requiere haber corrido `npx firebase-tools login` una vez (sesión interactiva en el navegador).

## Pendiente / próximas fases

- **Recordatorios por correo**: Cloud Function programada (diaria) que busque citas a 4 días de distancia y envíe un recordatorio por email vía Resend. El campo `email` y `reminderSent` en `reservations` ya están listos para esto.
- **WhatsApp** como canal de recordatorio adicional (mencionado en el brief original, no priorizado aún).
