# Reset Supply MX - Ecommerce & Detailing Automotriz

Sitio web oficial y tienda en línea de **Reset Supply MX**, distribuidor autorizado de productos **Vonixx** en México. Incluye catálogo interactivo, carrito de compras dinámico, procesamiento de pagos con **Stripe** y registro de pedidos en **Firebase**.

---

## 🚀 Arquitectura y Tecnologías

- **Frontend:** HTML5, Vanilla CSS3 (diseño responsivo dark mode industrial/racing), JavaScript ES6.
- **Backend:** Node.js con Express (`server.js`).
- **Pagos:** Stripe API & Stripe Checkout (`/api/create-checkout-session`).
- **Base de Datos / Webhooks:** Firebase Firestore & Admin SDK (`firebase-admin`).
- **Despliegue:** Render.com Web Service / Blueprint (`render.yaml`).
- **Repositorio:** GitHub (`https://github.com/aleksfeniks-web/Resetsupplymx.git`).

---

## 📦 1. Subir el Proyecto a GitHub

Abre tu terminal en la carpeta del proyecto y ejecuta los siguientes comandos para subir el código a GitHub:

```bash
# 1. Inicializar repositorio git
git init

# 2. Agregar todos los archivos (resetsupplymx.html, server.js, etc.)
git add .

# 3. Crear el primer commit
git commit -m "Initial commit: Reset Supply MX website with Stripe & Firebase integration"

# 4. Cambiar a rama principal main
git branch -M main

# 5. Conectar con tu repositorio de GitHub
git remote add origin https://github.com/aleksfeniks-web/Resetsupplymx.git

# 6. Subir el código a GitHub
git push -u origin main
```

---

## 🌐 2. Publicar en Render (Paso a Paso)

Render compilará y ejecutará la aplicación de forma gratuita o en un plan básico Node.js.

1. Ve a [Render.com](https://render.com) e inicia sesión (o crea una cuenta gratuita).
2. Haz clic en **New +** y selecciona **Web Service**.
3. Conecta tu cuenta de GitHub y busca el repositorio **`aleksfeniks-web/Resetsupplymx`**.
4. Render detectará automáticamente el archivo `render.yaml` o configura manualmente:
   - **Name:** `resetsupplymx`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. En la sección **Environment Variables**, agrega las siguientes variables de entorno:
   - `STRIPE_SECRET_KEY` = `sk_test_...` (Tu clave secreta de Stripe)
   - `STRIPE_PUBLISHABLE_KEY` = `pk_test_...` (Tu clave pública de Stripe)
   - `PUBLIC_URL` = `https://resetsupplymx.onrender.com` (La URL que te asigne Render)
6. Haz clic en **Create Web Service**. ¡Tu sitio estará en vivo en unos minutos!

---

## 💳 3. Configurar Stripe para Cobros

1. Registra tu cuenta en [Stripe.com](https://stripe.com).
2. Entra al **Dashboard de Stripe** > **API Keys** (`https://dashboard.stripe.com/apikeys`).
3. Copia tu **Publishable key** (`pk_test_...`) y tu **Secret key** (`sk_test_...`).
4. Pega estas claves en las variables de entorno de Render (`STRIPE_PUBLISHABLE_KEY` y `STRIPE_SECRET_KEY`).
5. *(Opcional)* Para escuchar pagos completados automáticamente y registrarlos en Firebase:
   - Ve a **Stripe Dashboard** > **Webhooks**.
   - Agrega el endpoint de tu servidor: `https://resetsupplymx.onrender.com/api/webhook`.
   - Selecciona el evento `checkout.session.completed`.
   - Copia el **Signing secret** (`whsec_...`) y agrégalo en Render como `STRIPE_WEBHOOK_SECRET`.

---

## 🔥 4. Configurar Firebase (Firestore)

1. Ve a [Firebase Console](https://console.firebase.google.com/) y crea un nuevo proyecto `ResetSupplyMX`.
2. Crea una base de datos **Cloud Firestore** en modo de producción.
3. En la configuración del proyecto > **Cuentas de servicio** (Service Accounts), haz clic en **Generar nueva clave privada**. Se descargará un archivo `.json`.
4. Abre ese archivo `.json` de credenciales de Firebase, copia todo su contenido de texto en una sola línea y pégalo como el valor de la variable de entorno `FIREBASE_SERVICE_ACCOUNT` en Render.

---

## 💻 5. Probar Localmente

Para probar el proyecto en tu máquina local antes o después de subirlo:

```bash
# Instalar dependencias
npm install

# Crear archivo .env basado en .env.example
# y colocar tus claves de Stripe

# Iniciar servidor local
npm start
```

Visita `http://localhost:3000` en tu navegador.

---

## 📱 Contacto y Soporte
- **Distribuidor:** Reset Supply MX - Vonixx México
- **WhatsApp:** [+52 33 3969 3935](https://wa.me/523339693935)
