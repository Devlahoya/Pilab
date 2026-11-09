# Configurar Firebase para PiLab

PiLab usa **Firebase Authentication** (cuentas con correo y contraseña) y **Cloud Firestore**
(base de datos) para guardar proyectos en la nube y compartirlos con un enlace.

> **¿Por qué Firebase?** El plan gratuito (Spark) **no pausa el proyecto por inactividad**
> (Supabase sí lo hace después de unos días sin uso). Límites gratuitos de Firestore: 1 GiB
> almacenado, 50 000 lecturas y 20 000 escrituras por día; de sobra para un grupo o una tesis.
> No hace falta tarjeta de crédito.

Sin configurar Firebase la app funciona completa en modo local; sólo se ocultan las cuentas y
«Mis proyectos».

## 1. Crear el proyecto (≈ 5 minutos)

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google y elige
   **Crear un proyecto** (por ejemplo `pilab-itd`). Google Analytics no es necesario.
2. En la página del proyecto pulsa el ícono **`</>` (Web)** para registrar una app web.
   Ponle un nombre (`PiLab`) y **no** marques Firebase Hosting (usamos Netlify).
3. Firebase te muestra un bloque `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`.
   Copia esos valores; los usarás en el paso 4.

## 2. Activar el inicio de sesión con correo

1. Menú izquierdo → **Compilación → Authentication → Comenzar**.
2. Pestaña **Método de acceso** → **Correo electrónico/contraseña** → **Habilitar** → Guardar.
3. Pestaña **Configuración → Dominios autorizados** → **Agregar dominio** y escribe el dominio
   de Netlify (por ejemplo `pilab-itd.netlify.app`). `localhost` ya viene incluido.
4. (Opcional) En **Plantillas** puedes poner en español el correo de «restablecer contraseña».

## 3. Crear la base de datos y sus reglas

1. Menú izquierdo → **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: la más cercana (por ejemplo `us-central1` o `northamerica-south1`).
   Elige **modo de producción**.
3. Pestaña **Reglas**: borra lo que haya, pega el contenido del archivo
   [`firestore.rules`](../firestore.rules) de este repositorio y pulsa **Publicar**.

Las reglas garantizan que:

- cada persona sólo puede leer y modificar **sus** proyectos;
- un proyecto marcado como «compartido» lo puede **leer** cualquiera que tenga el enlace,
  pero nadie más lo puede modificar;
- se rechazan documentos mal formados o demasiado grandes.

## 4. Poner las claves en la app

### En tu computadora (para `npm run dev`)

Copia `.env.example` como `.env.local` y llena los valores del paso 1:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=pilab-itd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=pilab-itd
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
VITE_FIREBASE_STORAGE_BUCKET=pilab-itd.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
```

Reinicia `npm run dev`. Aparecerá el botón **Entrar** arriba a la derecha.

### En Netlify (para la versión publicada)

**Site configuration → Environment variables → Add a variable**: agrega las mismas seis
variables con los mismos valores y vuelve a desplegar (**Deploys → Trigger deploy**).

> Estas claves **no son secretas**: sólo identifican tu proyecto y viajan en el código del
> navegador de cualquier app de Firebase. La seguridad la dan las reglas de Firestore del paso 3.
> Aun así, `.env.local` está en `.gitignore` para no mezclar configuraciones.

## Probar sin Firebase (sólo desarrollo)

Con `npm run dev`, abre `http://localhost:5173/?nube=demo`: se activa un modo de demostración que
imita a Firebase guardando todo en el navegador. Sirve para probar las pantallas de cuentas y
proyectos; no se usa en la versión publicada.

## Estructura de datos

| Colección | Documento | Campos |
|---|---|---|
| `users` | `{uid}` | `name`, `avatar` (1, 2 o 3) |
| `projects` | id automático | `owner`, `ownerName`, `title`, `kind` (`analisis` / `simulacion`), `payload` (JSON), `isPublic`, `createdAt`, `updatedAt` |

Un proyecto compartido se abre con `https://tu-sitio.netlify.app/?ver=<id>`; quien lo abre
recibe una copia para explorar sin modificar el original.
