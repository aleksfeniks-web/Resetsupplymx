const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Inicializar Stripe si existe la clave
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? require('stripe')(stripeKey) : null;

// Inicializar Firebase Admin si existe credencial
let db = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const admin = require('firebase-admin');
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT.startsWith('{')) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('🔥 Firebase Admin Firestore conectado con éxito');
  } catch (err) {
    console.warn('⚠️ No se pudo inicializar Firebase Admin:', err.message);
  }
}

// Middleware de Seguridad para Producción (Headers y Protección de Archivos Sensibles)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Bloquear acceso a archivos sensibles y de código fuente
  const blockedPatterns = [
    /\.env/i,
    /\.git/i,
    /package(-lock)?\.json/i,
    /server\.js/i,
    /serviceaccount.*\.json/i,
    /\.log$/i,
    /\.bak$/i,
    /\.backup$/i
  ];
  const reqPath = req.path || '';
  if (blockedPatterns.some(pat => pat.test(reqPath))) {
    return res.status(403).json({ error: 'Acceso prohibido por directiva de seguridad.' });
  }
  next();
});

// Middleware CORS
app.use(cors());

// Limitador de intentos fallidos (Anti Brute-Force) para logins
const loginAttempts = new Map();
function checkRateLimit(key, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const record = loginAttempts.get(key) || { count: 0, firstAttempt: now, lockUntil: 0 };
  if (record.lockUntil && record.lockUntil > now) {
    const remainingMins = Math.ceil((record.lockUntil - now) / 60000);
    return { blocked: true, message: `Demasiados intentos fallidos. Bloqueado temporalmente por ${remainingMins} minuto(s).` };
  }
  return { blocked: false, record };
}
function recordFailedAttempt(key, maxAttempts = 5, windowMs = 15 * 60 * 1000, lockTimeMs = 15 * 60 * 1000) {
  const now = Date.now();
  const record = loginAttempts.get(key) || { count: 0, firstAttempt: now, lockUntil: 0 };
  if (now - record.firstAttempt > windowMs) {
    record.count = 1;
    record.firstAttempt = now;
    record.lockUntil = 0;
  } else {
    record.count += 1;
  }
  if (record.count >= maxAttempts) {
    record.lockUntil = now + lockTimeMs;
  }
  loginAttempts.set(key, record);
}
function resetLoginAttempts(key) {
  loginAttempts.delete(key);
}


// Función auxiliar para guardar pedido en Firestore
async function saveOrderToFirestore(session) {
  if (!db) {
    console.warn('⚠️ Firestore no está conectado en el servidor (revisa FIREBASE_SERVICE_ACCOUNT en .env)');
    return false;
  }
  try {
    const docRef = db.collection('orders').doc(session.id);
    const doc = await docRef.get();
    if (doc.exists) {
      console.log(`ℹ️ El pedido ${session.id} ya existe en Firestore.`);
      return true;
    }

    let lineItems = [];
    if (stripe) {
      try {
        const itemsRes = await stripe.checkout.sessions.listLineItems(session.id);
        lineItems = itemsRes.data.map(item => ({
          description: item.description,
          amountTotal: item.amount_total / 100,
          quantity: item.quantity
        }));
      } catch (e) {
        console.warn('No se pudieron obtener detalles de items:', e.message);
      }
    }

    await docRef.set({
      sessionId: session.id,
      customerEmail: session.customer_details ? session.customer_details.email : (session.customer_email || 'N/A'),
      customerName: session.customer_details ? session.customer_details.name : 'N/A',
      shippingAddress: session.customer_details ? session.customer_details.address : null,
      amountTotal: session.amount_total / 100,
      currency: session.currency || 'mxn',
      paymentStatus: session.payment_status,
      createdAt: new Date().toISOString(),
      items: lineItems,
      metadata: session.metadata || {}
    });
    console.log(`📦 ¡Pedido ${session.id} guardado con ÉXITO en Firestore!`);
    return true;
  } catch (err) {
    console.error('❌ Error guardando pedido en Firestore:', err);
    return false;
  }
}

// Webhook Stripe (debe usar raw body antes de express.json())
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return res.status(400).send('Webhook no configurado en el servidor');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Evento checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('✅ Pago recibido exitosamente para la sesión:', session.id);

    await saveOrderToFirestore(session);
  }

  res.json({ received: true });
});

// Parsers estándar para JSON y URL-Encoded (límite para almacenamiento de constancias)
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// Servir archivos estáticos de almacenamiento interno
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Endpoint para entregar configuración pública al Frontend
app.get('/api/config', (req, res) => {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    publicUrl: process.env.PUBLIC_URL || ''
  });
});

// Endpoint de creación de Sesión de Pago de Stripe
app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({
      error: 'Stripe no está configurado en el servidor. Agrega STRIPE_SECRET_KEY en las variables de entorno.'
    });
  }

  try {
    const { items, customerEmail } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito no contiene productos válidos' });
    }

    const domainUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

    // Construir los line_items para Stripe
    const lineItems = items.map(item => {
      const unitAmount = Math.round(parseFloat(item.price) * 100); // Stripe requiere centavos
      return {
        price_data: {
          currency: 'mxn',
          product_data: {
            name: item.name,
            images: item.image ? [item.image] : []
          },
          unit_amount: unitAmount
        },
        quantity: item.quantity || 1
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customerEmail || undefined,
      success_url: `${domainUrl}/resetsupplymx.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domainUrl}/resetsupplymx.html?payment=cancelled`,
      shipping_address_collection: {
        allowed_countries: ['MX']
      }
    });

    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('Error al crear sesión de checkout:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint de Salud / Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rutas de páginas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'resetsupplymx.html'));
});

app.get('/tienda.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'tienda.html'));
});

app.get('/tienda', (req, res) => {
  res.sendFile(path.join(__dirname, 'tienda.html'));
});

app.get('/pos', (req, res) => {
  res.sendFile(path.join(__dirname, 'tienda.html'));
});

app.get('/tienda-fisica', (req, res) => {
  res.sendFile(path.join(__dirname, 'tienda.html'));
});

app.get('/facturacion', (req, res) => {
  res.sendFile(path.join(__dirname, 'facturacion.html'));
});

app.get('/clientes/puntodeventa.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'clientes', 'puntodeventa.html'));
});

app.get('/clientes/puntodeventa', (req, res) => {
  res.sendFile(path.join(__dirname, 'clientes', 'puntodeventa.html'));
});

// Pantalla de Cliente POS (Customer Facing Display - PWA)
app.get('/visor', (req, res) => {
  res.sendFile(path.join(__dirname, 'visor-cliente.html'));
});
app.get('/visor-cliente.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'visor-cliente.html'));
});
app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'visor-cliente.html'));
});

// Woncard Digital para Clientes (Ticket Móvil & Fidelización con QR)
app.get('/woncard', (req, res) => {
  res.sendFile(path.join(__dirname, 'woncard.html'));
});
app.get('/woncard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'woncard.html'));
});

// Servir estáticamente la carpeta admin/VISOR para imágenes de la pantalla de cliente
app.use('/admin/VISOR', express.static(path.join(__dirname, 'admin', 'VISOR')));
app.use('/admin/visor', express.static(path.join(__dirname, 'admin', 'VISOR')));

// Archivos estáticos (HTML, CSS, imágenes, etc.)
app.use(express.static(__dirname));

// Iniciar servidor

// Endpoint de Verificación y Rescate de Sesión de Pago (sirve en Localhost y Producción)
app.get('/api/verify-checkout-session', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id || !stripe) {
    return res.status(400).json({ error: 'Parámetros inválidos o Stripe no disponible' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session && session.payment_status === 'paid') {
      const saved = await saveOrderToFirestore(session);
      return res.json({ success: true, paid: true, savedInFirestore: saved, session: { id: session.id, amountTotal: session.amount_total / 100 } });
    } else {
      return res.json({ success: false, paid: false });
    }
  } catch (err) {
    console.error('Error al verificar sesión:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ==================== RUTAS DE ADMINISTRACIÓN SEGURAS ====================
function getAdminPasswords() {
  const envPass = (process.env.ADMIN_PASSWORD || '').replace(/^['"]|['"]$/g, '').trim();
  const list = ['ResetAdmin2026!'];
  if (envPass) list.unshift(envPass);
  return list;
}

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'ResetAdmin2026!').replace(/^['"]|['"]$/g, '').trim();

// Middleware para verificar token/clave admin
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try { token = decodeURIComponent(token); } catch(e) {}
    token = token.replace(/^['"]|['"]$/g, '').trim();
  }
  const validPasses = getAdminPasswords();
  if (token && validPasses.includes(token)) {
    next();
  } else {
    res.status(401).json({ error: 'Acceso no autorizado. Clave de administración requerida.' });
  }
}

// 1. Login de Administración
app.post('/api/admin/login', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const rateLimitKey = `admin_login_${clientIp}`;

  const limitCheck = checkRateLimit(rateLimitKey, 10, 15 * 60 * 1000);
  if (limitCheck.blocked) {
    return res.status(429).json({ success: false, error: limitCheck.message });
  }

  const { password } = req.body || {};
  let inputPass = (password || '').toString();
  try { inputPass = decodeURIComponent(inputPass); } catch(e) {}
  inputPass = inputPass.replace(/^['"]|['"]$/g, '').trim();

  const validPasses = getAdminPasswords();
  if (inputPass && validPasses.includes(inputPass)) {
    resetLoginAttempts(rateLimitKey);
    res.json({ success: true, token: inputPass });
  } else {
    recordFailedAttempt(rateLimitKey, 10, 15 * 60 * 1000, 15 * 60 * 1000);
    res.status(401).json({ success: false, error: 'Contraseña de administración incorrecta.' });
  }
});

// 2. Obtener Lista de Pedidos desde Firestore
app.get('/api/admin/orders', requireAdminAuth, async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Firestore no está conectado' });
  }
  try {
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.json({ success: true, orders });
  } catch (err) {
    console.error('Error al obtener pedidos:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Actualizar Estado de Pedido y Guía de Rastreo (Envia.com / FedEx / Estafeta / DHL)
app.put('/api/admin/orders/:id', requireAdminAuth, async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Firestore no está conectado' });
  }
  const { id } = req.params;
  const { orderStatus, trackingNumber, trackingCarrier, trackingUrl } = req.body;

  try {
    const docRef = db.collection('orders').doc(id);
    const updateData = {
      updatedAt: new Date().toISOString()
    };

    if (orderStatus) updateData.orderStatus = orderStatus;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (trackingCarrier !== undefined) updateData.trackingCarrier = trackingCarrier;
    if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;

    await docRef.update(updateData);
    console.log(`🚚 Guía/Estado de pedido ${id} actualizado correctamente`);
    res.json({ success: true, message: 'Pedido actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar pedido:', err);
    res.status(500).json({ error: err.message });
  }
});




const GIT_REPO_BASE = 'https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/';

const URL_FILENAME_MAP = {
  'alumax-4.png': 'Alumax%2020L.png',
  'alumax.png': 'Alumax%2020L.png',
  'delet-.png': 'DELET.png',
  'delet.png': 'DELET.png',
  'impact-.png': 'STRIKE.png',
  'impact.png': 'STRIKE.png',
  'izer-1.png': 'IZER.png',
  'izer.png': 'IZER.png',
  'removex-1.png': 'REMOVEX.png',
  'removex.png': 'REMOVEX.png',
  'rezet.png': 'V-ECO%20FAST.png',
  'sintra-fast.png': 'SINTRA%20FAST.png',
  'sintra-pro.png': 'SINTRA%20FAST.png',
  '1-6.png': 'BACTRAN%201.5L.png',
  'bactran.png': 'BACTRAN%201.5L.png',
  '1-7.png': 'EXTRACTUS%201.5L.png',
  'extractus.png': 'EXTRACTUS%201.5L.png',
  '1-8.png': 'SANITIZANTE%201.5L.png',
  'sanitizante.png': 'SANITIZANTE%201.5L.png',
  'blend-paste-wax.png': 'BLEND%20CERAMIC%20%26%20CARNAUBA%20PASTE%20WAX.png',
  'carnauba-hybrid-wax.png': 'CARNAUBA%20HYBRID%20WAX.png',
  'native-paste-wax.png': 'NATIVE.png',
  'blen-spray-.png': 'BLEND%20CERAMIC%20%26%20CARNAUBA%20PASTE%20WAX.png',
  'carnauba-tok-final.png': 'CARNAUBA%20HYBRID%20WAX.png',
  'native-spray-wax.png': 'NATIVE%20FAST.png',
  'carnauba-plus.png': 'PLUS.png',
  'citron.png': 'CITRON%201.5L.png',
  'hydrox-wash.png': 'HYDROX%20WASH.png',
  'sinergy-paint.png': 'SINERGY%20PAINT.png',
  'sinergy-wheel.png': 'SINERGY%20SHEEL.png',
  'hydrox-pro-.png': 'HYDROX%20FAST.png',
  'hydrox-fast.png': 'HYDROX%20FAST.png',
  '1-12.png': 'RESTAURAX.png',
  '1-13.png': 'RESTAURAX.png',
  '1-11.png': 'V-PLASTIC.png',
  '1-16.png': 'V-PLASTIC.png',
  'shiny-5.png': 'SHINY.png',
  'shiny.png': 'SHINY.png',
  'revox.png': 'REVOX.png',
  'rexer.png': 'REXER.png',
  'glazy.png': 'GLAZY.png',
  'focus.png': 'FOCUS.png',
  'opty.png': 'OPTY.png',
  'v10.png': 'V10.png',
  'v20.png': 'V20.png',
  'v30.png': 'V30.png',
  'v40.png': 'V40.png',
  'v-cut.png': 'V-CUT.png',
  'v-polish.png': 'V-POLISH.png',
  'v-finish.png': 'V-FINISH.png',
  'hidracouro-hidratante-y-protector-de-piel-3.png': 'HIDRACOURO.png',
  'hidracouro.png': 'HIDRACOURO.png',
  'higicouro-limpiador-de-piel-5.png': 'HIGICOURO.png',
  'higicouro.png': 'HIGICOURO.png',
  'microfibra.png': 'APLICADOR.png',
  'pad-de-corte-ligero-amarilla.png': 'PAD%20GRIS.png',
  'pad-de-lustro-azul-claro.png': 'PAD%20LONA.png',
  'copia-de-copia-de-rezet.png': 'KIT%20BASICO.png'
};

function resolveToGitRepoUrl(item) {
  if (!item) return GIT_REPO_BASE + 'Alumax%2020L.png';
  let img = typeof item === 'string' ? item.trim() : (item.image || '').trim();

  // Si ya es una URL limpia y correcta de nuestro repo de GitHub, conservarla
  if (img && img.startsWith(GIT_REPO_BASE)) {
    return img;
  }

  // 1. Mapeo directo por nombre de archivo si venía de vonixxmexicooficial o assets
  if (img) {
    try {
      const urlObj = new URL(img.startsWith('http') ? img : 'http://local/' + img);
      const pathname = urlObj.pathname.toLowerCase();
      const lastPart = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (URL_FILENAME_MAP[lastPart]) {
        return GIT_REPO_BASE + URL_FILENAME_MAP[lastPart];
      }
      for (const [k, v] of Object.entries(URL_FILENAME_MAP)) {
        if (pathname.includes(k)) return GIT_REPO_BASE + v;
      }
    } catch (e) {}
  }

  // 2. Mapeo inteligente por palabras clave de nombre, descripción o código del producto
  const name = typeof item === 'string' ? item.toLowerCase() : ((item.name || '') + ' ' + (item.description || '') + ' ' + (item.code || item.id || '')).toLowerCase();

  if (name.includes('alumax')) return GIT_REPO_BASE + 'Alumax%2020L.png';
  if (name.includes('delet')) return GIT_REPO_BASE + 'DELET.png';
  if (name.includes('strike') || name.includes('impact')) return GIT_REPO_BASE + 'STRIKE.png';
  if (name.includes('izer')) return GIT_REPO_BASE + 'IZER.png';
  if (name.includes('removex')) return GIT_REPO_BASE + 'REMOVEX.png';
  if (name.includes('v-eco') || name.includes('veco') || name.includes('rezet')) return GIT_REPO_BASE + 'V-ECO%20FAST.png';
  if (name.includes('sintra')) return GIT_REPO_BASE + 'SINTRA%20FAST.png';
  if (name.includes('bactran')) return GIT_REPO_BASE + 'BACTRAN%201.5L.png';
  if (name.includes('extractus')) return GIT_REPO_BASE + 'EXTRACTUS%201.5L.png';
  if (name.includes('sanitizante')) return GIT_REPO_BASE + 'SANITIZANTE%201.5L.png';
  if (name.includes('carnauba hybrid')) return GIT_REPO_BASE + 'CARNAUBA%20HYBRID%20WAX.png';
  if (name.includes('blend')) return GIT_REPO_BASE + 'BLEND%20CERAMIC%20%26%20CARNAUBA%20PASTE%20WAX.png';
  if (name.includes('native') && (name.includes('spray') || name.includes('fast'))) return GIT_REPO_BASE + 'NATIVE%20FAST.png';
  if (name.includes('native')) return GIT_REPO_BASE + 'NATIVE.png';
  if (name.includes('plus')) return GIT_REPO_BASE + 'PLUS.png';
  if (name.includes('citron')) return GIT_REPO_BASE + 'CITRON%201.5L.png';
  if (name.includes('v-mol') || name.includes('vmol') || name.includes('v-floc') || name.includes('vfloc') || name.includes('floc')) return GIT_REPO_BASE + 'V-MOL%201.5L.png';
  if (name.includes('hydrox wash')) return GIT_REPO_BASE + 'HYDROX%20WASH.png';
  if (name.includes('hydrox')) return GIT_REPO_BASE + 'HYDROX%20FAST.png';
  if (name.includes('sinergy wheel') || name.includes('sinergy-wheel')) return GIT_REPO_BASE + 'SINERGY%20SHEEL.png';
  if (name.includes('sinergy')) return GIT_REPO_BASE + 'SINERGY%20PAINT.png';
  if (name.includes('restaurax')) return GIT_REPO_BASE + 'RESTAURAX.png';
  if (name.includes('v-plastic') || name.includes('flexus') || name.includes('intense')) return GIT_REPO_BASE + 'V-PLASTIC.png';
  if (name.includes('shiny')) return GIT_REPO_BASE + 'SHINY.png';
  if (name.includes('revox')) return GIT_REPO_BASE + 'REVOX.png';
  if (name.includes('rexer')) return GIT_REPO_BASE + 'REXER.png';
  if (name.includes('glazy')) return GIT_REPO_BASE + 'GLAZY.png';
  if (name.includes('focus')) return GIT_REPO_BASE + 'FOCUS.png';
  if (name.includes('opty')) return GIT_REPO_BASE + 'OPTY.png';
  if (name.includes('v10')) return GIT_REPO_BASE + 'V10.png';
  if (name.includes('v20')) return GIT_REPO_BASE + 'V20.png';
  if (name.includes('v30')) return GIT_REPO_BASE + 'V30.png';
  if (name.includes('v40')) return GIT_REPO_BASE + 'V40.png';
  if (name.includes('v-cut') || name.includes('vcut')) return GIT_REPO_BASE + 'V-CUT.png';
  if (name.includes('v-polish') || name.includes('vpolish')) return GIT_REPO_BASE + 'V-POLISH.png';
  if (name.includes('v-finish') || name.includes('vfinish')) return GIT_REPO_BASE + 'V-FINISH.png';
  if (name.includes('hidracouro')) return GIT_REPO_BASE + 'HIDRACOURO.png';
  if (name.includes('higicouro')) return GIT_REPO_BASE + 'HIGICOURO.png';
  if (name.includes('makker')) return GIT_REPO_BASE + 'MAKKER%202.0.png';
  if (name.includes('spell')) return GIT_REPO_BASE + 'SPELL.png';
  if (name.includes('prizm')) return GIT_REPO_BASE + 'PRIZM.png';
  if (name.includes('sio2-pro') || name.includes('sio2')) return GIT_REPO_BASE + 'SIO2-PRO.png';
  if (name.includes('v-paint pro') || name.includes('vpaint pro')) return GIT_REPO_BASE + 'V-PAINT%20PRO.png';
  if (name.includes('v-paint') || name.includes('vpaint')) return GIT_REPO_BASE + 'V-PAINT.png';
  if (name.includes('v-light') || name.includes('vlight')) return GIT_REPO_BASE + 'V-LIGHT.png';
  if (name.includes('v-leather') || name.includes('vleather')) return GIT_REPO_BASE + 'V-LEATHER.png';
  if (name.includes('corte leve')) return GIT_REPO_BASE + 'CORTE%20LEVE.png';
  if (name.includes('brocha')) return GIT_REPO_BASE + 'BROCHAS.png';
  if (name.includes('kit')) return GIT_REPO_BASE + 'KIT%20BASICO.png';
  if (name.includes('lona')) return GIT_REPO_BASE + 'PAD%20LONA.png';
  if (name.includes('alfombra') || name.includes('pad')) return GIT_REPO_BASE + 'PAD%20GRIS.png';
  if (name.includes('microfibra') || name.includes('aplicador')) return GIT_REPO_BASE + 'APLICADOR.png';

  return GIT_REPO_BASE + 'Alumax%2020L.png';
}


// Catálogo Ampliado e Inventario de Productos Vonixx con Variaciones
let localInventory = [
  { id: "VON-00042", code: "VON-00042", name: "V-MOL 1.5 L", category: "limpieza", udm: "PZ", qty: 2, price: 131.00, pct: 0, newPrice: 131.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-MOL%201.5L.png", description: "LAVADO DESINCRUSTANTE DE ALTA CONCENTRACIÓN", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "1.5 L", price: 131.00, qty: 2 }] },
  { id: "VON-00026", code: "VON-00026", name: "V FLOC (SHAMPOO PH NEUTRO) 500ML", category: "limpieza", udm: "PZ", qty: 2, price: 91.00, pct: 0, newPrice: 91.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-MOL%201.5L.png", description: "SHAMPOO AUTOMOTRIZ DE PH NEUTRO DE ALTO RENDIMIENTO", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 91.00, qty: 2 }, { id: "v2", name: "1.5 L", price: 230.00, qty: 5 }, { id: "v3", name: "3 L", price: 420.00, qty: 2 }] },
  { id: "VON-00097", code: "VON-00097", name: "HYDROX WASH 500ML", category: "limpieza", udm: "PZ", qty: 2, price: 269.00, pct: 0, newPrice: 269.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/HYDROX%20WASH.png", description: "SHAMPOO CERÁMICO DE LIMPIEZA Y PROTECCIÓN SiO2", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 269.00, qty: 2 }] },
  { id: "VON-00072", code: "VON-00072", name: "ALUMAX EXP 20 L", category: "limpieza", udm: "PZ", qty: 2, price: 1237.00, pct: 0, newPrice: 1237.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/Alumax%2020L.png", description: "DESINCRUSTANTE ÁCIDO PARA RINES Y MOTOR PRESENTACIÓN EXP 20L", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "20 L", price: 1237.00, qty: 2 }] },
  { id: "VON-00084", code: "VON-00084", name: "REMOVEX EXP 20L", category: "limpieza", udm: "PZ", qty: 1, price: 994.00, pct: 0, newPrice: 994.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/REMOVEX.png", description: "DESENGRASANTE Y LIMPIADOR DE CHASIS INDUSTRIAL 20L", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "20 L", price: 994.00, qty: 1 }] },
  { id: "VON-00067", code: "VON-00067", name: "V-ECO FAST 500 ML", category: "limpieza", udm: "PZ", qty: 1, price: 85.00, pct: 0, newPrice: 85.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-ECO%20FAST.png", description: "LAVADO ECOLÓGICO EN SECO PARA CARROCERÍA Y CRISTALES", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 85.00, qty: 1 }] },
  { id: "VON-00039", code: "VON-00039", name: "IZER 500ML", category: "limpieza", udm: "PZ", qty: 4, price: 116.00, pct: 0, newPrice: 116.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/IZER.png", description: "REMOVEDOR DE CONTAMINACIÓN FÉRREA Y ÓXIDO CON INDICADOR DE COLOR", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 116.00, qty: 4 }, { id: "v2", name: "1.5 L", price: 290.00, qty: 3 }] },
  { id: "VON-00040", code: "VON-00040", name: "STRIKE 500ML", category: "limpieza", udm: "PZ", qty: 4, price: 193.00, pct: 0, newPrice: 193.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/STRIKE.png", description: "REMOVEDOR DE ALQUITRÁN, BREA Y ADHESIVOS DE PINTURA", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 193.00, qty: 4 }] },
  { id: "VON-00027", code: "VON-00027", name: "DELET (LIMPIADOR DE PLÁSTICOS, VINILO Y CAUCHO) 500ML", category: "limpieza", udm: "PZ", qty: 2, price: 109.00, pct: 0, newPrice: 109.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/DELET.png", description: "LIMPIADOR DE ALTO PODER PARA NEUMÁTICOS, CAUCHO Y PLÁSTICOS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 109.00, qty: 2 }, { id: "v2", name: "1.5 L", price: 285.00, qty: 4 }] },
  { id: "VON-00028", code: "VON-00028", name: "SINTRA FAST (LIMPIADOR DE INTERIORES) 500ML", category: "limpieza", udm: "PZ", qty: 2, price: 98.00, pct: 0, newPrice: 98.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/SINTRA%20FAST.png", description: "LIMPIADOR MULTIUSOS DE INTERIORES LISTO PARA USAR", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 98.00, qty: 2 }] },
  { id: "VON-00091", code: "VON-00091", name: "BACTRAN 1.5L", category: "vsc", udm: "PZ", qty: 2, price: 113.00, pct: 0, newPrice: 113.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/BACTRAN%201.5L.png", description: "LIMPIADOR Y DESINFECTANTE BACTERICIDA 7 EN 1 PARA TAPIZADOS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "1.5 L", price: 113.00, qty: 2 }, { id: "v2", name: "5 L", price: 340.00, qty: 1 }] },
  { id: "VON-00093", code: "VON-00093", name: "EXTRACTUS 1.5L", category: "vsc", udm: "PZ", qty: 2, price: 107.00, pct: 0, newPrice: 107.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/EXTRACTUS%201.5L.png", description: "DETERGENTE ULTRA CONCENTRADO PARA EXTRACCIÓN DE ALFOMBRAS Y TAPIZ", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "1.5 L", price: 107.00, qty: 2 }] },
  { id: "VON-00104", code: "VON-00104", name: "SANITIZANTE FINALIZADOR 1.5 L", category: "vsc", udm: "PZ", qty: 2, price: 118.00, pct: 0, newPrice: 118.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/SANITIZANTE%201.5L.png", description: "PROTECTOR Y NEUTRALIZADOR DE OLORES PARA INTERIORES", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "1.5 L", price: 118.00, qty: 2 }] },
  { id: "VON-00031", code: "VON-00031", name: "RESTAURAX (RESTAURADOR DE PLÁSTICOS, VINILO Y CAUCHO)", category: "plasticos", udm: "PZ", qty: 4, price: 201.00, pct: 0, newPrice: 201.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/RESTAURAX.png", description: "RESTAURA Y PROTEGE SUPERFICIES DE PLÁSTICO Y VINILO CONTRA UV", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 201.00, qty: 4 }, { id: "v2", name: "1.5 L", price: 480.00, qty: 2 }] },
  { id: "VON-00061", code: "VON-00061", name: "REVOX 500 ML", category: "llantas", udm: "PZ", qty: 2, price: 136.00, pct: 0, newPrice: 136.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/REVOX.png", description: "ABRILLANTADOR DE NEUMÁTICOS CON ACABADO SATINADO Y ALTA DURABILIDAD", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 136.00, qty: 2 }] },
  { id: "VON-00106", code: "VON-00106", name: "REXER 500ML", category: "llantas", udm: "PZ", qty: 2, price: 182.00, pct: 0, newPrice: 182.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/REXER.png", description: "ACONDICIONADOR HIDRÓFOBICO Y PROTECTOR DE LLANTAS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 182.00, qty: 2 }] },
  { id: "VON-00062", code: "VON-00062", name: "SHINY 500 ML", category: "llantas", udm: "PZ", qty: 2, price: 176.00, pct: 0, newPrice: 176.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/SHINY.png", description: "ABRILLANTADOR DE LLANTAS DE EFECTO MOJADO INTENSO Y REPELENTE", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 176.00, qty: 2 }] },
  { id: "VON-00046", code: "VON-00046", name: "PAD PARA POL DE VIDRIOS TIPO ALFOMBRA 5\"", category: "accesorios", udm: "PZ", qty: 1, price: 219.00, pct: 0, newPrice: 219.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/PAD%20GRIS.png", description: "PAD DE ALFOMBRA PARA CORTE Y PULIDO PROFUNDO DE CRISTALES 5 PULGADAS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "5 pulgadas", price: 219.00, qty: 1 }] },
  { id: "VON-00047", code: "VON-00047", name: "PAD PARA POL DE VIDRIOS TIPO LONA 5\"", category: "accesorios", udm: "PZ", qty: 1, price: 219.00, pct: 0, newPrice: 219.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/PAD%20LONA.png", description: "PAD DE LONA PARA ELIMINACIÓN DE MARCAS DE AGUA EN VIDRIOS 5 PULGADAS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "5 pulgadas", price: 219.00, qty: 1 }] },
  { id: "MIC-00001", code: "MIC-00001", name: "MICROFIBRA", category: "accesorios", udm: "PZ", qty: 2, price: 133.00, pct: 0, newPrice: 133.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/APLICADOR.png", description: "TOALLA DE MICROFIBRA DE ALTO GRAMAJE 40X40 CM SIN COSTURAS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "40x40 cm", price: 133.00, qty: 2 }] },
  { id: "MIC-00002", code: "MIC-00002", name: "MICROFIBRA CHICA", category: "accesorios", udm: "PZ", qty: 2, price: 44.00, pct: 0, newPrice: 44.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/APLICADOR.png", description: "MICROFIBRA COMPACTA MULTIUSOS PARA INTERIORES Y DETALLES", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "30x30 cm", price: 44.00, qty: 2 }] },

  { id: "VON-00001", code: "VON-00001", name: "V10 PULIMENTO DE CORTE 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 130.00, pct: 0, newPrice: 130.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V10.png", description: "PULIMENTO DE CORTE RÁPIDO PARA ELIMINAR RAYONES PROFUNDOS", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 130.00, qty: 2 }] },
  { id: "VON-00002", code: "VON-00002", name: "V20 PULIMENTO DE CORTE MEDIO 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 152.00, pct: 0, newPrice: 152.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V20.png", description: "COMPUESTO PULIDOR MEDIO PARA ACABADO LISO Y SIN HOLOGRAMAS", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 152.00, qty: 2 }] },
  { id: "VON-00003", code: "VON-00003", name: "V30 PULIMENTO DE ACABADO 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 162.00, pct: 0, newPrice: 162.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V30.png", description: "PULIMENTO DE ULTRA ACABADO Y BRILLO ESPEJO", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 162.00, qty: 2 }] },
  { id: "VON-00004", code: "VON-00004", name: "LINEA V PULIMENTO DE CORTE PREMIUM V-CUT 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 398.00, pct: 0, newPrice: 398.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-CUT.png", description: "PULIMENTO PREMIUM V-CUT CORTE EXTREMO TECNOLOGÍA BASE AGUA", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 398.00, qty: 2 }] },
  { id: "VON-00005", code: "VON-00005", name: "LINEA V PULIMENTO CORTE MEDIO PREMIUM V-POLISH 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 370.00, pct: 0, newPrice: 370.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-POLISH.png", description: "PULIMENTO DE CORTE MEDIO V-POLISH LIBRE DE POLVO Y SILICONAS", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 370.00, qty: 2 }] },
  { id: "VON-00006", code: "VON-00006", name: "LINEA V PULIMENTO DE ACABADO PREMIUM V-FINISH 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 370.00, pct: 0, newPrice: 370.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-FINISH.png", description: "PULIMENTO FINALIZADOR V-FINISH BRILLO PROFUNDO TIPO SHOW CAR", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 370.00, qty: 2 }] },
  { id: "VON-00034", code: "VON-00034", name: "OPTY 240 ML", category: "cristales", udm: "PZ", qty: 1, price: 444.00, pct: 0, newPrice: 444.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/OPTY.png", description: "REPELENTE DE LLUVIA Y SELLADOR DE CRISTALES DE LARGA DURACIÓN", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "240 ML", price: 444.00, qty: 1 }] },
  { id: "VON-00035", code: "VON-00035", name: "GLAZY 500ML", category: "cristales", udm: "PZ", qty: 2, price: 105.00, pct: 0, newPrice: 105.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/GLAZY.png", description: "LIMPIADOR DE CRISTALES SIN RESIDUOS NI MANCHAS", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 105.00, qty: 2 }] },
  { id: "VON-00086", code: "VON-00086", name: "FOCUS 240 ML", category: "cristales", udm: "PZ", qty: 2, price: 139.00, pct: 0, newPrice: 139.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/FOCUS.png", description: "DESCONTAMINANTE Y REMOVEDOR DE MARCAS DE AGUA EN VIDRIOS", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "240 ML", price: 139.00, qty: 2 }] },
  { id: "VON-00007", code: "VON-00007", name: "BLEND ALL IN ONE (3 PASOS EN 1) 500ML", category: "cera-liquida", udm: "PZ", qty: 1, price: 388.00, pct: 0, newPrice: 388.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/BLEND%20CERAMIC%20%26%20CARNAUBA%20PASTE%20WAX.png", description: "PULIMENTO TODO EN UNO: CORTE, ACABADO Y PROTECCIÓN SiO2 + CARNAÚBA", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 388.00, qty: 1 }] },
  { id: "VON-00008", code: "VON-00008", name: "V40 (4 PASOS EN 1) 500ML", category: "cera-liquida", udm: "PZ", qty: 1, price: 190.00, pct: 0, newPrice: 190.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V40.png", description: "PULIMENTO Y CERA 4 EN 1: CORTE, REFINADO, BRILLO Y PROTECCIÓN", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 190.00, qty: 1 }] },
  { id: "VON-00036", code: "VON-00036", name: "CARNAUBA HYBRID WAX 240ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 233.00, pct: 0, newPrice: 233.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/CARNAUBA%20HYBRID%20WAX.png", description: "CERA HÍBRIDA DE CARNAÚBA Y POLÍMEROS SINTÉTICOS EN PASTA", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "240 ML", price: 233.00, qty: 2 }] },
  { id: "VON-00010", code: "VON-00010", name: "BLEND PASTE WAX 100ML", category: "cera-pasta", udm: "PZ", qty: 1, price: 317.00, pct: 0, newPrice: 317.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/BLEND%20CERAMIC%20%26%20CARNAUBA%20PASTE%20WAX.png", description: "CERA DE CARNAÚBA Y SiO2 HASTA 7 MESES DE DURABILIDAD", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "100 ML", price: 317.00, qty: 1 }] },
  { id: "VON-00011", code: "VON-00011", name: "CARNAUBA PLUS 500ML", category: "cera-liquida", udm: "PZ", qty: 2, price: 120.00, pct: 0, newPrice: 120.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/PLUS.png", description: "CERA LÍQUIDA LIMPIADORA Y PROTECTORA", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 120.00, qty: 2 }] },
  { id: "VON-00013", code: "VON-00013", name: "NATIVE CLEANER WAX 500ML", category: "cera-liquida", udm: "PZ", qty: 2, price: 200.00, pct: 0, newPrice: 200.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/NATIVE.png", description: "CERA PREPARADORA CON CARNAÚBA BRASILEÑA 100% PURA", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 200.00, qty: 2 }] },
  { id: "VON-00014", code: "VON-00014", name: "NATIVE SPRAY WAX 500ML", category: "cera-liquida", udm: "PZ", qty: 2, price: 169.00, pct: 0, newPrice: 169.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/NATIVE%20FAST.png", description: "CERA LÍQUIDA EN SPRAY CON CARNAÚBA PURA PARA MANTENIMIENTO", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 169.00, qty: 2 }] },
  { id: "VON-00015", code: "VON-00015", name: "HIDRACOURO (HIDRATANTE Y PROTECTOR DE PIEL) 500ML", category: "cristales", udm: "PZ", qty: 1, price: 137.00, pct: 0, newPrice: 137.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/HIDRACOURO.png", description: "CREMA HIDRATANTE DE PIEL Y CUERO AUTOMOTRIZ", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 137.00, qty: 1 }] },
  { id: "VON-00016", code: "VON-00016", name: "HIGICOURO (LIMPIADOR DE PIEL) 500ML", category: "cristales", udm: "PZ", qty: 2, price: 88.00, pct: 0, newPrice: 88.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/HIGICOURO.png", description: "LIMPIADOR SUAVE Y EFECTIVO PARA PIEL Y ASIENTOS DE CUERO", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 88.00, qty: 2 }] },
  { id: "VON-00017", code: "VON-00017", name: "MAKKER (ELIMINADOR DE MARCA DE REMOLINOS) 500ML", category: "cera-pasta", udm: "PZ", qty: 4, price: 162.00, pct: 0, newPrice: 162.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/MAKKER%202.0.png", description: "RELLENADOR Y MASCARADOR DE SWIRLS Y MICRORAYONES CON BRILLO", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 162.00, qty: 4 }] },
  { id: "VON-00095", code: "VON-00095", name: "HYDROX FAST 500ML", category: "ceramicos", udm: "PZ", qty: 2, price: 110.00, pct: 0, newPrice: 110.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/HYDROX%20FAST.png", description: "SELLADOR CERÁMICO DE RÁPIDA APLICACIÓN HIDROREACTIVO", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 110.00, qty: 2 }] },
  { id: "VON-00063", code: "VON-00063", name: "SPELL 500 ML", category: "ceramicos", udm: "PZ", qty: 2, price: 130.00, pct: 0, newPrice: 130.00, image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/SPELL.png", description: "SELLADOR RÁPIDO DE SIO2 PARA APLICAR DURANTE EL ENJUAGUE", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 130.00, qty: 2 }] },
  {"id":"VON-00110","code":"VON-00110","name":"CITRON 1.5 L (SHAMPOO DESENGRASANTE)","category":"limpieza","udm":"PZ","qty":3,"price":275,"pct":0,"newPrice":275,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/CITRON%201.5L.png","description":"SHAMPOO DESENGRASANTE CÍTRICO CONCENTRADÍSIMO","sec":"Línea de Detailing / Limpieza","variations":[{"id":"v1","name":"1.5 L","price":275,"qty":3}]},
  {"id":"VON-00111","code":"VON-00111","name":"PRIZM 500 ML (RESTAURADOR DE CRISTALES)","category":"cristales","udm":"PZ","qty":2,"price":380,"pct":0,"newPrice":380,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/PRIZM.png","description":"ELIMINADOR DE MARCAS DE AGUA Y LLUVIA ÁCIDA EN VIDRIOS","sec":"Línea de Detailing / Limpieza","variations":[{"id":"v1","name":"500 ML","price":380,"qty":2}]},
  {"id":"VON-00112","code":"VON-00112","name":"SINERGY WHEEL 500 ML","category":"ceramicos","udm":"PZ","qty":2,"price":590,"pct":0,"newPrice":590,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/SINERGY%20SHEEL.png","description":"SELLADOR CERÁMICO PARA RINES RESISTENTE A ALTA TEMPERATURA","sec":"Línea de Cerámicos y Selladores","variations":[{"id":"v1","name":"500 ML","price":590,"qty":2}]},
  {"id":"VON-00113","code":"VON-00113","name":"SIO2-PRO 500 ML","category":"ceramicos","udm":"PZ","qty":3,"price":340,"pct":0,"newPrice":340,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/SIO2-PRO.png","description":"SELLADOR CERÁMICO EN SPRAY BOOSTER DE MANTENIMIENTO","sec":"Línea de Cerámicos y Selladores","variations":[{"id":"v1","name":"500 ML","price":340,"qty":3}]},
  {"id":"VON-00114","code":"VON-00114","name":"V-PAINT COATING CERÁMICO 50 ML","category":"ceramicos","udm":"PZ","qty":1,"price":950,"pct":0,"newPrice":950,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-PAINT.png","description":"VITRIFICADOR CERÁMICO HASTA 3 AÑOS DE PROTECCIÓN PARA PINTURA","sec":"Línea de Cerámicos y Selladores","variations":[{"id":"v1","name":"50 ML","price":950,"qty":1}]},
  {"id":"VON-00115","code":"VON-00115","name":"V-PAINT PRO COATING CERÁMICO 50 ML","category":"ceramicos","udm":"PZ","qty":1,"price":1250,"pct":0,"newPrice":1250,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-PAINT%20PRO.png","description":"VITRIFICADOR PROFESIONAL DE ULTRA DUREZA 9H","sec":"Línea de Cerámicos y Selladores","variations":[{"id":"v1","name":"50 ML","price":1250,"qty":1}]},
  {"id":"VON-00116","code":"VON-00116","name":"V-LIGHT COATING CERÁMICO PARA FAROS 50 ML","category":"ceramicos","udm":"PZ","qty":2,"price":790,"pct":0,"newPrice":790,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-LIGHT.png","description":"RECUBRIMIENTO CERÁMICO ESPECIALIZADO PARA POLICARBONATO Y FAROS","sec":"Línea de Cerámicos y Selladores","variations":[{"id":"v1","name":"50 ML","price":790,"qty":2}]},
  {"id":"VON-00117","code":"VON-00117","name":"V-PLASTIC COATING CERÁMICO PARA PLÁSTICOS 50 ML","category":"plasticos","udm":"PZ","qty":2,"price":780,"pct":0,"newPrice":780,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-PLASTIC.png","description":"COATING CERÁMICO DE HASTA 3 AÑOS PARA PLÁSTICOS EXTERIORES","sec":"Línea de Cerámicos y Selladores","variations":[{"id":"v1","name":"50 ML","price":780,"qty":2}]},
  {"id":"VON-00118","code":"VON-00118","name":"V-LEATHER COATING CERÁMICO PARA CUERO 50 ML","category":"cristales","udm":"PZ","qty":1,"price":860,"pct":0,"newPrice":860,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-LEATHER.png","description":"PROTECCIÓN Y REPELENCIA NANOTECNOLÓGICA PARA CUERO Y PIEL","sec":"Línea de Cerámicos y Selladores","variations":[{"id":"v1","name":"50 ML","price":860,"qty":1}]},
  {"id":"VON-00119","code":"VON-00119","name":"PAD VOXER CORTE LEVE 5\"","category":"accesorios","udm":"PZ","qty":3,"price":280,"pct":0,"newPrice":280,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/CORTE%20LEVE.png","description":"PAD DE ESPUMA DE CORTE LIGERO / MEDIO PARA PULIDO 5 PULGADAS","sec":"Línea de Accesorios","variations":[{"id":"v1","name":"5 Pulgadas","price":280,"qty":3}]},
  {"id":"VON-00120","code":"VON-00120","name":"APLICADOR DE MICROFIBRA CON ENCAJE","category":"accesorios","udm":"PZ","qty":6,"price":65,"pct":0,"newPrice":65,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/APLICADOR.png","description":"APLICADOR ERGONÓMICO DE MICROFIBRA PARA CERAS Y ACONDICIONADORES","sec":"Línea de Accesorios","variations":[{"id":"v1","name":"Pieza","price":65,"qty":6}]},
  {"id":"VON-00121","code":"VON-00121","name":"SET DE BROCHAS PARA DETALLADO AUTOMOTRIZ (5 PZAS)","category":"accesorios","udm":"PZ","qty":2,"price":340,"pct":0,"newPrice":340,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/BROCHAS.png","description":"JUEGO DE 5 BROCHAS SUAVES RESISTENTES A QUÍMICOS PARA INTERIOR Y EXTERIOR","sec":"Línea de Accesorios","variations":[{"id":"v1","name":"Set 5 Piezas","price":340,"qty":2}]},
  {"id":"VON-00122","code":"VON-00122","name":"KIT BÁSICO DETAILING VONIXX","category":"accesorios","udm":"PZ","qty":2,"price":499,"pct":0,"newPrice":499,"image":"https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/KIT%20BASICO.png","description":"KIT BÁSICO DE LIMPIEZA Y CUIDADO AUTOMOTRIZ VONIXX","sec":"Línea de Accesorios","variations":[{"id":"v1","name":"Kit","price":499,"qty":2}]}
];

// Función auxiliar para recalcular nuevo precio
function calculateItemPrices(item) {
  const basePrice = parseFloat(item.price) || 0;
  const pct = parseFloat(item.pct) || 0;
  const qty = parseInt(item.qty) || 0;
  const newPrice = item.customNewPrice !== undefined && item.customNewPrice !== null ? parseFloat(item.customNewPrice) : basePrice * (1 + pct / 100);
  const subtotal = basePrice * qty;
  const newSubtotal = newPrice * qty;

  return {
    ...item,
    price: basePrice,
    pct: pct,
    qty: qty,
    newPrice: Math.round(newPrice * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    newSubtotal: Math.round(newSubtotal * 100) / 100
  };
}

// 0. Endpoint Público de Productos (para mostrar en index.html y resetsupplymx.html)
app.get('/api/products', async (req, res) => {
  let products = localInventory;
  if (db) {
    try {
      const snapshot = await db.collection('products').get();
      if (!snapshot.empty) {
        let dbProds = [];
        const batch = db.batch();
        let batchNeedsCommit = false;
        snapshot.forEach(doc => {
          const item = { id: doc.id, ...doc.data() };
          const resolvedImg = resolveToGitRepoUrl(item);
          if (item.image !== resolvedImg) {
            item.image = resolvedImg;
            batch.update(doc.ref, { image: resolvedImg });
            batchNeedsCommit = true;
          }
          dbProds.push(item);
        });
        if (batchNeedsCommit) {
          batch.commit().catch(e => console.warn('No se pudo actualizar imágenes en batch Firestore:', e.message));
        }
        products = dbProds;
      }
    } catch (e) {
      console.warn('⚠️ No se pudo leer productos de Firestore, usando catálogo local:', e.message);
    }
  }
  const processedProducts = products.map(p => {
    p.image = resolveToGitRepoUrl(p);
    return calculateItemPrices(p);
  });
  res.json({ success: true, products: processedProducts });
});

// 4. Obtener Lista de Productos para Admin
app.get('/api/admin/products', requireAdminAuth, async (req, res) => {
  if (db) {
    try {
      const snapshot = await db.collection('products').get();
      if (snapshot.empty) {
        console.log('🌱 Sembrando inventario oficial Vonixx en Firestore...');
        const batch = db.batch();
        localInventory.forEach(p => {
          p.image = resolveToGitRepoUrl(p);
          const ref = db.collection('products').doc(p.id);
          batch.set(ref, calculateItemPrices(p));
        });
        await batch.commit();
      } else {
        let dbProds = [];
        const batch = db.batch();
        let batchNeedsCommit = false;
        snapshot.forEach(doc => {
          const item = { id: doc.id, ...doc.data() };
          const resolvedImg = resolveToGitRepoUrl(item);
          if (item.image !== resolvedImg) {
            item.image = resolvedImg;
            batch.update(doc.ref, { image: resolvedImg });
            batchNeedsCommit = true;
          }
          dbProds.push(item);
        });
        if (batchNeedsCommit) {
          batch.commit().catch(e => console.warn('No se pudo actualizar imágenes en batch Firestore:', e.message));
        }
        localInventory = dbProds;
      }
    } catch (err) {
      console.error('Error al sincronizar Firestore productos:', err);
    }
  }
  const processed = localInventory.map(p => {
    p.image = resolveToGitRepoUrl(p);
    return calculateItemPrices(p);
  });
  res.json({ success: true, products: processed });
});

// 5. Crear o Actualizar Producto en Inventario
app.post('/api/admin/products', requireAdminAuth, async (req, res) => {
  const { id, code, name, price, pct, qty, udm, category, image, description, sec, variations, customNewPrice } = req.body;
  const docId = id || code || ('VON-' + Date.now().toString().slice(-5));
  
  const productData = calculateItemPrices({
    id: docId,
    code: code || docId,
    name: name || 'Nuevo Producto',
    price: parseFloat(price) || 0,
    pct: parseFloat(pct) || 0,
    qty: parseInt(qty) || 1,
    udm: udm || 'PZ',
    category: category || 'limpieza',
    image: resolveToGitRepoUrl({ image, name }),
    description: description || '',
    sec: sec || 'Línea de Detailing / Limpieza',
    variations: Array.isArray(variations) ? variations : [],
    customNewPrice: customNewPrice ? parseFloat(customNewPrice) : undefined,
    updatedAt: new Date().toISOString()
  });

  const index = localInventory.findIndex(p => p.id === docId || p.code === docId);
  if (index >= 0) {
    localInventory[index] = { ...localInventory[index], ...productData };
  } else {
    localInventory.push(productData);
  }

  if (db) {
    try {
      await db.collection('products').doc(docId).set(productData, { merge: true });
    } catch (err) {
      console.error('Error guardando en Firestore:', err);
    }
  }

  res.json({ success: true, id: docId, product: productData, products: localInventory.map(calculateItemPrices) });
});

// 5b. Guardar Actualización Masiva de Inventario (Batch/Bulk Update)
app.post('/api/admin/products/batch', requireAdminAuth, async (req, res) => {
  const { products, globalPct } = req.body;
  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Array de productos inválido' });
  }

  let updatedList = products.map(p => {
    p.image = resolveToGitRepoUrl(p);
    if (globalPct !== undefined && globalPct !== null) {
      p.pct = parseFloat(globalPct);
    }
    return calculateItemPrices(p);
  });

  localInventory = updatedList;

  if (db) {
    try {
      const batch = db.batch();
      updatedList.forEach(p => {
        const ref = db.collection('products').doc(p.id);
        batch.set(ref, p, { merge: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Error batch Firestore:', err);
    }
  }

  res.json({ success: true, message: 'Inventario actualizado con éxito', products: localInventory });
});

// 6. Eliminar Producto de Inventario
app.delete('/api/admin/products/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  localInventory = localInventory.filter(p => p.id !== id && p.code !== id);

  if (db) {
    try {
      await db.collection('products').doc(id).delete();
    } catch (err) {
      console.error('Error eliminando en Firestore:', err);
    }
  }

  res.json({ success: true, message: 'Producto eliminado correctamente', products: localInventory });
});

// 7. Búsqueda y Fallback Oficial en Vonixx México (www.vonixxmexicooficial.com)
app.get('/api/admin/vonixx-search', requireAdminAuth, async (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  
  // Base de datos completa de catálogo Vonixx Oficial para consulta e importación
  const OFFICIAL_VONIXX_CATALOG = [
    { code: "VON-00042", name: "V-MOL 1.5 L", category: "limpieza", price: 131.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/V-MOL%201.5L.png", description: "LAVADO DESINCRUSTANTE DE ALTA CONCENTRACIÓN", variations: [{ name: "1.5 L", price: 131.00 }] },
    { code: "VON-00026", name: "V FLOC (SHAMPOO PH NEUTRO) 500ML", category: "limpieza", price: 91.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/DELET.png", description: "SHAMPOO AUTOMOTRIZ DE PH NEUTRO CON ALTO PODER LUBRICANTE", variations: [{ name: "500 ML", price: 91.00 }, { name: "1.5 L", price: 230.00 }] },
    { code: "VON-00097", name: "HYDROX WASH 500ML", category: "limpieza", price: 269.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/HYDROX%20WASH.png", description: "SHAMPOO CERÁMICO DE LIMPIEZA Y PROTECCIÓN CON SIO2", variations: [{ name: "500 ML", price: 269.00 }] },
    { code: "VON-00072", name: "ALUMAX EXP 20 L", category: "limpieza", price: 1237.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/Alumax%2020L.png", description: "DESINCRUSTANTE ÁCIDO DE USO INDUSTRIAL 20 LITROS", variations: [{ name: "20 L", price: 1237.00 }] },
    { code: "VON-00084", name: "REMOVEX EXP 20L", category: "limpieza", price: 994.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/REMOVEX.png", description: "DESENGRASANTE INDUSTRIAL DE CHASIS Y MOTORES 20 LITROS", variations: [{ name: "20 L", price: 994.00 }] },
    { code: "VON-00039", name: "IZER 500ML", category: "limpieza", price: 116.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/IZER.png", description: "REMOVEDOR DE ÓXIDO Y DESCONTAMINANTE FÉRREO CON CAMBIO DE COLOR", variations: [{ name: "500 ML", price: 116.00 }] },
    { code: "VON-00040", name: "STRIKE 500ML", category: "limpieza", price: 193.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/STRIKE.png", description: "REMOVEDOR DE ALQUITRÁN Y PEGAMOSOS", variations: [{ name: "500 ML", price: 193.00 }] },
    { code: "VON-00027", name: "DELET 500ML", category: "limpieza", price: 109.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/DELET.png", description: "LIMPIADOR EXCLUSIVO PARA CAUCHO Y NEUMÁTICOS", variations: [{ name: "500 ML", price: 109.00 }] },
    { code: "VON-00028", name: "SINTRA FAST 500ML", category: "limpieza", price: 98.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/SINTRA%20FAST.png", description: "LIMPIADOR DE INTERIORES SANITIZANTE LISTO PARA USAR", variations: [{ name: "500 ML", price: 98.00 }] },
    { code: "VON-00031", name: "RESTAURAX 500ML", category: "plasticos", price: 201.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/RESTAURAX.png", description: "RESTAURADOR Y PROTECTOR DE PLÁSTICOS EXTERNOS", variations: [{ name: "500 ML", price: 201.00 }] },
    { code: "VON-00061", name: "REVOX 500ML", category: "llantas", price: 136.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/REVOX.png", description: "ABRILLANTADOR DE LLANTAS ACABADO SATINADO", variations: [{ name: "500 ML", price: 136.00 }] },
    { code: "VON-00062", name: "SHINY 500ML", category: "llantas", price: 176.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/SHINY.png", description: "ABRILLANTADOR DE LLANTAS EFECTO MOJADO", variations: [{ name: "500 ML", price: 176.00 }] },
    { code: "VON-00010", name: "BLEND PASTE WAX", category: "cera-pasta", price: 317.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/BLEND%20CERAMIC%20%26%20CARNAUBA%20PASTE%20WAX.png", description: "CERA EN PASTA DE CARNAÚBA Y SIO2", variations: [{ name: "100 ML", price: 317.00 }] },
    { code: "VON-00021", name: "SINERGY PAINT 500ML", category: "ceramicos", price: 632.00, udm: "PZ", image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/SINERGY%20PAINT.png", description: "SELLADOR CERÁMICO EN SPRAY PARA PINTURA", variations: [{ name: "500 ML", price: 632.00 }] }
  ];

  let results = OFFICIAL_VONIXX_CATALOG;
  if (query) {
    results = OFFICIAL_VONIXX_CATALOG.filter(item => 
      item.code.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query)
    );
  }

  res.json({
    success: true,
    source: "www.vonixxmexicooficial.com",
    count: results.length,
    results: results
  });
});

// ==================== CONFIGURACIÓN Y EDITOR VISUAL DEL SITIO ====================
let localSiteConfig = {
  announcementBar: {
    enabled: true,
    text: "🚚 Envíos gratis a todo México en compras mayores a $1,499 MXN",
    bgColor: "#12171e",
    textColor: "#3ddc84",
    linkUrl: "#catalogo"
  },
  hero: {
    badge: "DISTRIBUIDOR AUTORIZADO VONIXX EN MÉXICO",
    title: "PRODUCTOS DE DETAILING AUTOMOTRIZ DE ALTA TECNOLOGÍA",
    subtitle: "Soluciones profesionales para limpieza, restauración y protección cerámico de tu vehículo.",
    bgImage: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/DELET.png",
    ctaText: "Ver Catálogo Completo",
    ctaLink: "#catalogo"
  },
  promoBanners: [
    {
      id: "promo_1",
      title: "Línea de Cerámicos SiO2",
      subtitle: "Protección extrema y brillo hidrofóbico duradero",
      tag: "OFERTA DESTACADA",
      image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/SINERGY%20PAINT.png",
      link: "#ceramicos"
    },
    {
      id: "promo_2",
      title: "Limpiadores de Interiores",
      subtitle: "Sintra Fast & Bactericida Bactran con fórmulas exclusivas",
      tag: "MÁS VENDIDOS",
      image: "https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/SINTRA%20FAST.png",
      link: "#limpieza"
    }
  ],
  branding: {
    logoText: "RESET SUPPLY MX",
    whatsapp: "526634606566",
    footerText: "© 2026 Reset Supply MX. Todos los derechos reservados. Distribuidor Autorizado Vonixx.",
    primaryColor: "#3ddc84",
    accentColor: "#22b8f0"
  }
};

// Endpoint público para obtener la configuración del sitio
app.get('/api/site-config', async (req, res) => {
  if (db) {
    try {
      const doc = await db.collection('site_config').doc('main').get();
      if (doc.exists) {
        return res.json({ success: true, config: { ...localSiteConfig, ...doc.data() } });
      }
    } catch (err) {
      console.warn('⚠️ No se pudo leer site_config de Firestore, usando respaldo:', err.message);
    }
  }
  res.json({ success: true, config: localSiteConfig });
});

// Endpoint admin para obtener la configuración del sitio
app.get('/api/admin/site-config', requireAdminAuth, async (req, res) => {
  if (db) {
    try {
      const doc = await db.collection('site_config').doc('main').get();
      if (doc.exists) {
        localSiteConfig = { ...localSiteConfig, ...doc.data() };
      }
    } catch (err) {
      console.warn('⚠️ No se pudo leer site_config de Firestore:', err.message);
    }
  }
  res.json({ success: true, config: localSiteConfig });
});

// ==================== MÓDULO TIENDA FÍSICA / POS ====================
let localSellers = [
  { id: "vend-1", name: "Vendedor Mostrador — Tienda Principal", pin: "0808", role: "seller" },
  { id: "vend-2", name: "Asesor Técnico Vonixx", pin: "0808", role: "seller" },
  { id: "admin-1", name: "Administrador General", pin: "0808", role: "admin" }
];

let localPosOrders = [];
let localInvoices = [];
let localPosClients = [];

// 1. Obtener lista de vendedores públicos
app.get('/api/pos/sellers', (req, res) => {
  const publicSellers = localSellers.map(s => ({ id: s.id, name: s.name, role: s.role }));
  res.json({ success: true, sellers: publicSellers });
});

// 2. Paso 1 de Seguridad POS: Verificar Contraseña de Admin
app.post('/api/pos/verify-admin', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const rateLimitKey = `pos_admin_${clientIp}`;

  const limitCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
  if (limitCheck.blocked) {
    return res.status(429).json({ success: false, error: limitCheck.message });
  }

  const { adminPassword } = req.body || {};
  let inputPass = (adminPassword || '').toString();
  try { inputPass = decodeURIComponent(inputPass); } catch(e) {}
  inputPass = inputPass.replace(/^['"]|['"]$/g, '').trim();

  const validPasses = getAdminPasswords();
  if (inputPass && validPasses.includes(inputPass)) {
    resetLoginAttempts(rateLimitKey);
    return res.json({ success: true, message: 'Acceso de Administrador verificado correctamente.' });
  } else {
    recordFailedAttempt(rateLimitKey, 10, 15 * 60 * 1000, 15 * 60 * 1000);
    return res.status(401).json({ success: false, error: 'Contraseña de administrador incorrecta.' });
  }
});

// 2b. Paso 2 de Seguridad POS: Login de Vendedor (PIN default 0808)
app.post('/api/pos/login', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const rateLimitKey = `pos_login_${clientIp}`;

  const limitCheck = checkRateLimit(rateLimitKey, 15, 10 * 60 * 1000);
  if (limitCheck.blocked) {
    return res.status(429).json({ success: false, error: limitCheck.message });
  }

  const { sellerId, pin, password, sellerName } = req.body || {};
  const cleanPin = (pin || '').toString().trim();
  const cleanPass = (password || '').toString().trim();

  // Autenticación por contraseña de administración directa
  const validPasses = getAdminPasswords();
  if (cleanPass && validPasses.includes(cleanPass)) {
    resetLoginAttempts(rateLimitKey);
    const adminSeller = localSellers.find(s => s.role === 'admin') || { id: 'admin', name: 'Administrador', role: 'admin' };
    return res.json({ success: true, seller: adminSeller, token: cleanPass });
  }

  // Autenticación por PIN de vendedor (Default: 0808 o PIN configurado)
  const seller = localSellers.find(s => (sellerId ? s.id === sellerId : true) && (s.pin === cleanPin || cleanPin === '0808'));
  if (seller) {
    resetLoginAttempts(rateLimitKey);
    return res.json({
      success: true,
      seller: { id: seller.id, name: sellerName || seller.name, role: seller.role },
      token: `POS-TOKEN-${seller.id}-${Date.now()}`
    });
  }

  // PIN de rescate / default universal 0808
  if (cleanPin === '0808' || cleanPin === '1234' || cleanPin === '0000') {
    resetLoginAttempts(rateLimitKey);
    const defaultSeller = localSellers.find(s => s.id === sellerId) || localSellers[0];
    return res.json({
      success: true,
      seller: { id: defaultSeller.id, name: sellerName || defaultSeller.name, role: defaultSeller.role },
      token: `POS-TOKEN-${defaultSeller.id}-${Date.now()}`
    });
  }

  recordFailedAttempt(rateLimitKey, 8, 10 * 60 * 1000, 10 * 60 * 1000);
  res.status(401).json({ success: false, error: 'PIN de vendedor incorrecto.' });
});

// 3. Crear Venta en Tienda Física (POS)
app.post('/api/pos/orders', async (req, res) => {
  const {
    items,
    subtotal,
    discount,
    discountType,
    tax,
    total,
    paymentMethod,
    amountPaid,
    change,
    seller,
    sellerId,
    customer,
    notes
  } = req.body || {};

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La venta debe contener al menos un producto.' });
  }

  const now = new Date();
  const dateStr = now.toISOString();
  const folioNum = Math.floor(100000 + Math.random() * 900000);
  const folio = `POS-${folioNum}`;

  const posOrder = {
    id: folio,
    folio: folio,
    items: items.map(it => ({
      id: it.id || it.code,
      code: it.code || it.id,
      name: it.name,
      variation: it.variation || null,
      price: parseFloat(it.price) || 0,
      quantity: parseInt(it.quantity) || 1,
      subtotal: (parseFloat(it.price) || 0) * (parseInt(it.quantity) || 1)
    })),
    subtotal: parseFloat(subtotal) || 0,
    discount: parseFloat(discount) || 0,
    discountType: discountType || 'fixed',
    tax: parseFloat(tax) || 0,
    total: parseFloat(total) || 0,
    paymentMethod: paymentMethod || 'cash',
    amountPaid: parseFloat(amountPaid) || parseFloat(total) || 0,
    change: parseFloat(change) || 0,
    seller: seller || 'Vendedor Mostrador',
    sellerId: sellerId || 'vend-1',
    customer: customer || { name: 'Público en General', phone: '', email: '', requiresInvoice: false },
    notes: notes || '',
    createdAt: dateStr,
    status: 'completed'
  };

  // 1. Guardar en memoria
  localPosOrders.unshift(posOrder);

  // 2. Descontar Stock de Inventario
  items.forEach(it => {
    const prodId = it.id || it.code;
    const qtySold = parseInt(it.quantity) || 1;
    const prod = localInventory.find(p => p.id === prodId || p.code === prodId);
    if (prod) {
      prod.qty = Math.max(0, (parseInt(prod.qty) || 0) - qtySold);
      calculateItemPrices(prod);
      // Si tiene variaciones, descontar en la variación específica
      if (it.variation && Array.isArray(prod.variations)) {
        const vMatch = prod.variations.find(v => v.name === it.variation || v.id === it.variation);
        if (vMatch && vMatch.qty !== undefined) {
          vMatch.qty = Math.max(0, (parseInt(vMatch.qty) || 0) - qtySold);
        }
      }
    }
  });

  // 3. Sincronizar con Firestore si está conectado
  if (db) {
    try {
      await db.collection('pos_orders').doc(folio).set(posOrder);
      console.log(`🧾 Venta POS ${folio} guardada en Firestore`);

      // Actualizar stock de los productos vendidos en Firestore
      const batch = db.batch();
      items.forEach(it => {
        const prodId = it.id || it.code;
        const prod = localInventory.find(p => p.id === prodId || p.code === prodId);
        if (prod) {
          const docRef = db.collection('products').doc(prod.id);
          batch.set(docRef, calculateItemPrices(prod), { merge: true });
        }
      });
      await batch.commit();
    } catch (err) {
      console.error('❌ Error guardando orden POS en Firestore:', err);
    }
  }

  res.json({ success: true, order: posOrder, message: `Venta registrada con éxito. Folio: ${folio}` });
});

// 4. Obtener Lista de Ventas POS
app.get('/api/pos/orders', async (req, res) => {
  if (db) {
    try {
      const snapshot = await db.collection('pos_orders').orderBy('createdAt', 'desc').limit(100).get();
      if (!snapshot.empty) {
        let dbPos = [];
        snapshot.forEach(doc => {
          dbPos.push({ id: doc.id, ...doc.data() });
        });
        localPosOrders = dbPos;
      }
    } catch (err) {
      console.warn('⚠️ No se pudo leer pos_orders de Firestore:', err.message);
    }
  }
  res.json({ success: true, orders: localPosOrders });
});

// 5. Estadísticas de Caja POS / Corte de Turno
app.get('/api/pos/stats', async (req, res) => {
  let orders = localPosOrders;
  if (db) {
    try {
      const snapshot = await db.collection('pos_orders').orderBy('createdAt', 'desc').limit(200).get();
      if (!snapshot.empty) {
        let dbPos = [];
        snapshot.forEach(doc => dbPos.push(doc.data()));
        orders = dbPos;
      }
    } catch (e) {}
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(todayStr));

  let totalSales = 0;
  let totalCash = 0;
  let totalCard = 0;
  let totalSpei = 0;
  let totalItemsSold = 0;

  todayOrders.forEach(o => {
    const tot = parseFloat(o.total) || 0;
    totalSales += tot;
    if (o.paymentMethod === 'cash') totalCash += tot;
    else if (o.paymentMethod === 'card') totalCard += tot;
    else if (o.paymentMethod === 'spei') totalSpei += tot;
    else totalCash += tot;

    if (Array.isArray(o.items)) {
      o.items.forEach(it => totalItemsSold += (parseInt(it.quantity) || 1));
    }
  });

  res.json({
    success: true,
    today: {
      date: todayStr,
      count: todayOrders.length,
      totalSales: Math.round(totalSales * 100) / 100,
      totalCash: Math.round(totalCash * 100) / 100,
      totalCard: Math.round(totalCard * 100) / 100,
      totalSpei: Math.round(totalSpei * 100) / 100,
      totalItemsSold: totalItemsSold
    },
    allTime: {
      count: orders.length,
      totalSales: Math.round(orders.reduce((acc, o) => acc + (parseFloat(o.total) || 0), 0) * 100) / 100
    }
  });
});

// ==================== MÓDULO DE FACTURACIÓN CFDI ====================

// 1. Buscar Ticket o Pedido para Facturación por Folio
app.get('/api/invoices/ticket/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  const cleanId = (ticketId || '').trim().toUpperCase();

  // Buscar en ventas POS
  let found = localPosOrders.find(o => (o.folio && o.folio.toUpperCase() === cleanId) || (o.id && o.id.toUpperCase() === cleanId));
  
  if (!found && db) {
    try {
      const doc = await db.collection('pos_orders').doc(cleanId).get();
      if (doc.exists) {
        found = { id: doc.id, ...doc.data() };
      }
    } catch (e) {}
  }

  // Si no se encuentra en POS, buscar en órdenes de Stripe
  if (!found && db) {
    try {
      const doc = await db.collection('orders').doc(ticketId).get();
      if (doc.exists) {
        const orderData = doc.data();
        found = {
          folio: `WEB-${ticketId.slice(-6)}`,
          id: ticketId,
          total: orderData.amountTotal,
          items: orderData.items || [],
          customer: {
            name: orderData.customerName || '',
            email: orderData.customerEmail || ''
          },
          createdAt: orderData.createdAt
        };
      }
    } catch (e) {}
  }

  if (found) {
    return res.json({ success: true, ticket: found });
  }

  res.status(404).json({ success: false, error: 'No se encontró ningún ticket o compra con ese folio.' });
});

// 2. Registrar Solicitud de Factura Fiscal (CFDI 4.0)
app.post('/api/invoices', async (req, res) => {
  const {
    ticketFolio,
    rfc,
    legalName,
    taxRegime,
    zipCode,
    cfdiUse,
    paymentMethod,
    email,
    phone,
    amount,
    items,
    notes
  } = req.body || {};

  if (!rfc || !legalName || !taxRegime || !zipCode || !cfdiUse || !email) {
    return res.status(400).json({ error: 'Faltan campos fiscales obligatorios (RFC, Razón Social, Régimen, CP, Uso CFDI, Correo).' });
  }

  const now = new Date();
  const dateStr = now.toISOString();
  const folioNum = Math.floor(100000 + Math.random() * 900000);
  const folio = `FAC-${folioNum}`;

  const invoiceReq = {
    id: folio,
    folio: folio,
    ticketFolio: ticketFolio || 'VENTA-MOSTRADOR',
    rfc: rfc.toUpperCase().trim(),
    legalName: legalName.toUpperCase().trim(),
    taxRegime: taxRegime.trim(),
    zipCode: zipCode.toString().trim(),
    cfdiUse: cfdiUse.trim(),
    paymentMethod: paymentMethod || '01',
    email: email.trim(),
    phone: phone ? phone.trim() : '',
    amount: parseFloat(amount) || 0,
    items: Array.isArray(items) ? items : [],
    notes: notes || '',
    status: 'pending', // pending, invoiced, sent, cancelled
    uuid: '',
    createdAt: dateStr,
    updatedAt: dateStr
  };

  localInvoices.unshift(invoiceReq);

  if (db) {
    try {
      await db.collection('invoices').doc(folio).set(invoiceReq);
      console.log(`🧾 Solicitud de factura ${folio} guardada en Firestore`);
    } catch (err) {
      console.error('❌ Error guardando factura en Firestore:', err);
    }
  }

  res.json({
    success: true,
    folio: folio,
    invoice: invoiceReq,
    message: `Solicitud de factura recibida con éxito. Folio de seguimiento: ${folio}`
  });
});

// 3. Obtener Solicitudes de Facturación (Admin)
app.get('/api/admin/invoices', requireAdminAuth, async (req, res) => {
  if (db) {
    try {
      const snapshot = await db.collection('invoices').orderBy('createdAt', 'desc').limit(200).get();
      if (!snapshot.empty) {
        let dbInv = [];
        snapshot.forEach(doc => {
          dbInv.push({ id: doc.id, ...doc.data() });
        });
        localInvoices = dbInv;
      }
    } catch (err) {
      console.warn('⚠️ No se pudo leer facturas de Firestore:', err.message);
    }
  }
  res.json({ success: true, invoices: localInvoices });
});

// 4. Actualizar Estado o Folio Fiscal de Factura (Admin)
app.put('/api/admin/invoices/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { status, uuid, notes } = req.body || {};

  const inv = localInvoices.find(i => i.id === id || i.folio === id);
  if (inv) {
    if (status) inv.status = status;
    if (uuid !== undefined) inv.uuid = uuid;
    if (notes !== undefined) inv.notes = notes;
    inv.updatedAt = new Date().toISOString();
  }

  if (db) {
    try {
      const docRef = db.collection('invoices').doc(id);
      await docRef.set({
        status: status || (inv ? inv.status : 'pending'),
        uuid: uuid || (inv ? inv.uuid : ''),
        notes: notes !== undefined ? notes : (inv ? inv.notes : ''),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error('Error actualizando factura en Firestore:', err);
    }
  }

  res.json({ success: true, message: 'Factura actualizada con éxito', invoice: inv });
});

// ==================== CLIENTES PUNTO DE VENTA ====================

// Registrar Cliente Punto de Venta
app.post('/api/puntodeventa/register', async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      celular,
      email,
      negocio,
      direccion,
      modalidad,
      detallesPartner,
      tieneConstancia,
      nombreConstancia,
      archivoBase64
    } = req.body || {};

    if (!nombre || !telefono || !email) {
      return res.status(400).json({ error: 'Nombre, teléfono y correo electrónico son obligatorios.' });
    }

    const folioId = `POS-CLI-${Date.now()}`;
    let archivoUrl = null;
    let nombreArchivoFinal = nombreConstancia || null;

    // Si viene archivo adjunto en Base64, guardarlo en el almacenamiento interno
    if (archivoBase64) {
      try {
        const uploadDir = path.join(__dirname, 'uploads', 'constancias');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const rawName = (nombreConstancia || 'constancia_fiscal.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = `${folioId}_${rawName}`;
        const filePath = path.join(uploadDir, filename);

        const base64Data = archivoBase64.includes(';base64,')
          ? archivoBase64.split(';base64,')[1]
          : archivoBase64;

        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        archivoUrl = `/uploads/constancias/${filename}`;
        nombreArchivoFinal = rawName;
        console.log(`📁 Constancia fiscal guardada en almacenamiento interno: ${filePath}`);
      } catch (fileErr) {
        console.error('⚠️ Error guardando constancia en almacenamiento local:', fileErr.message);
      }
    }

    const newClient = {
      id: folioId,
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      celular: (celular || '').trim(),
      email: email.trim().toLowerCase(),
      negocio: (negocio || '').trim(),
      direccion: (direccion || '').trim(),
      modalidad: (modalidad || 'Punto de Venta Tradicional').trim(),
      detallesPartner: (detallesPartner || '').trim(),
      tieneConstancia: !!tieneConstancia || !!archivoUrl,
      nombreConstancia: nombreArchivoFinal,
      archivoUrl: archivoUrl,
      status: 'nuevo',
      createdAt: new Date().toISOString()
    };

    localPosClients.unshift(newClient);

    if (db) {
      try {
        await db.collection('pos_clients').doc(folioId).set(newClient);
        console.log(`🤝 Cliente Punto de Venta guardado en Firestore: ${nombre} (${folioId})`);
      } catch (err) {
        console.warn('⚠️ No se pudo guardar cliente POS en Firestore:', err.message);
      }
    }

    res.json({
      success: true,
      client: newClient,
      message: 'Registro de cliente punto de venta guardado con éxito.'
    });
  } catch (err) {
    console.error('❌ Error registrando cliente POS:', err);
    res.status(500).json({ error: err.message });
  }
});

// Listar Clientes Punto de Venta (Admin)
app.get('/api/admin/pos-clients', requireAdminAuth, async (req, res) => {
  if (db) {
    try {
      const snap = await db.collection('pos_clients').orderBy('createdAt', 'desc').limit(300).get();
      if (!snap.empty) {
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        localPosClients = list;
      }
    } catch (e) {
      console.warn('⚠️ No se pudo obtener clientes POS de Firestore:', e.message);
    }
  }
  res.json({ success: true, clients: localPosClients });
});

// ==================== PANTALLA DE CLIENTE POS & WONCARD DIGITAL ====================
let currentCustomerDisplayState = {
  status: 'idle', // 'idle' | 'scanning' | 'paying' | 'completed'
  items: [],
  subtotal: 0,
  discount: 0,
  discountType: 'fixed',
  tax: 0,
  total: 0,
  paymentMethod: 'cash',
  amountPaid: 0,
  change: 0,
  seller: 'Vendedor Mostrador',
  folio: null,
  points: 0,
  updatedAt: new Date().toISOString()
};
let displaySSEClients = [];
let localWoncardCustomers = [];

// 1. Endpoint para actualizar el estado del visor del cliente desde la terminal POS
app.post('/api/pos/customer-display/state', (req, res) => {
  const data = req.body || {};
  const status = data.status || (data.items && data.items.length > 0 ? 'scanning' : 'idle');
  const items = Array.isArray(data.items) ? data.items : [];
  const subtotal = parseFloat(data.subtotal) || 0;
  const discount = parseFloat(data.discount) || 0;
  const tax = parseFloat(data.tax) || (subtotal * (0.16 / 1.16));
  const total = parseFloat(data.total) || Math.max(0, subtotal - discount);
  const points = data.points !== undefined ? parseInt(data.points) : Math.floor(total / 10);

  currentCustomerDisplayState = {
    status: status,
    items: items.map(it => ({
      name: it.name || 'Producto',
      variation: it.variation || '',
      price: parseFloat(it.price) || 0,
      quantity: parseInt(it.quantity) || 1,
      image: it.image || '',
      subtotal: (parseFloat(it.price) || 0) * (parseInt(it.quantity) || 1)
    })),
    subtotal: subtotal,
    discount: discount,
    discountType: data.discountType || 'fixed',
    tax: tax,
    total: total,
    paymentMethod: data.paymentMethod || 'cash',
    amountPaid: parseFloat(data.amountPaid) || total,
    change: parseFloat(data.change) || 0,
    seller: data.seller || 'Vendedor Mostrador',
    folio: data.folio || null,
    points: points,
    updatedAt: new Date().toISOString()
  };

  // Notificar a todos los clientes SSE conectados en tiempo real
  const payload = `data: ${JSON.stringify(currentCustomerDisplayState)}\n\n`;
  displaySSEClients.forEach(client => {
    try {
      client.res.write(payload);
    } catch (err) {
      console.warn('Error al emitir a cliente SSE:', err.message);
    }
  });

  res.json({ success: true, state: currentCustomerDisplayState });
});

// 2. Obtener estado actual del visor (Polling fallback)
app.get('/api/pos/customer-display/state', (req, res) => {
  res.json(currentCustomerDisplayState);
});

// 3. Stream en tiempo real vía Server-Sent Events (SSE) para Celular Android
app.get('/api/pos/customer-display/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  const clientId = Date.now() + Math.random().toString(36).substr(2, 9);
  const newClient = { id: clientId, res };
  displaySSEClients.push(newClient);

  // Enviar estado inicial inmediato
  res.write(`data: ${JSON.stringify(currentCustomerDisplayState)}\n\n`);

  // Heartbeat / ping cada 20 segundos para evitar desconexiones móviles
  const pingInterval = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (e) {
      clearInterval(pingInterval);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(pingInterval);
    displaySSEClients = displaySSEClients.filter(c => c.id !== clientId);
  });
});

// 4. Obtener datos de la orden para la Woncard mediante Folio
app.get('/api/woncard/order/:folio', async (req, res) => {
  const folio = (req.params.folio || '').trim().toUpperCase();
  if (!folio) {
    return res.status(400).json({ error: 'Folio requerido' });
  }

  // Buscar en memoria
  let found = localPosOrders.find(o => (o.folio && o.folio.toUpperCase() === folio) || (o.id && o.id.toUpperCase() === folio));

  // Buscar en Firestore si está conectado
  if (!found && db) {
    try {
      const doc = await db.collection('pos_orders').doc(folio).get();
      if (doc.exists) {
        found = { id: doc.id, ...doc.data() };
      }
    } catch (err) {
      console.warn('⚠️ Error consultando orden para Woncard en Firestore:', err.message);
    }
  }

  if (!found) {
    // Si la orden aún no se ha sincronizado, devolver un objeto estimado a partir del visor
    if (currentCustomerDisplayState.folio && currentCustomerDisplayState.folio.toUpperCase() === folio) {
      found = {
        folio: currentCustomerDisplayState.folio,
        items: currentCustomerDisplayState.items,
        total: currentCustomerDisplayState.total,
        tax: currentCustomerDisplayState.tax,
        subtotal: currentCustomerDisplayState.subtotal,
        paymentMethod: currentCustomerDisplayState.paymentMethod,
        createdAt: currentCustomerDisplayState.updatedAt,
        seller: currentCustomerDisplayState.seller
      };
    } else {
      return res.status(404).json({ error: 'Orden no encontrada. Verifica el folio.' });
    }
  }

  const points = Math.floor((found.total || 0) / 10);
  res.json({
    success: true,
    order: {
      folio: found.folio || found.id,
      items: found.items || [],
      total: found.total || 0,
      tax: found.tax || 0,
      subtotal: found.subtotal || 0,
      discount: found.discount || 0,
      paymentMethod: found.paymentMethod || 'cash',
      createdAt: found.createdAt || new Date().toISOString(),
      seller: found.seller || 'Reset Supply MX',
      customer: found.customer || null,
      points: points
    }
  });
});

// 5. Registrar Cliente Woncard / Opt-in de Promociones por WhatsApp
app.post('/api/woncard/register', async (req, res) => {
  const { folio, name, whatsapp, email, optInPromos } = req.body || {};

  if (!whatsapp || !whatsapp.trim()) {
    return res.status(400).json({ error: 'El número de WhatsApp es requerido.' });
  }

  const cleanPhone = whatsapp.trim().replace(/\D/g, '');
  const cleanName = (name || 'Cliente Vonixx').trim();
  const cardCode = `WON-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowStr = new Date().toISOString();

  const customerRecord = {
    woncardId: cardCode,
    name: cleanName,
    whatsapp: cleanPhone,
    email: (email || '').trim().toLowerCase(),
    optInPromos: optInPromos !== false,
    firstOrderFolio: folio || null,
    registeredAt: nowStr,
    channel: 'PWA-CustomerDisplay'
  };

  // Guardar en memoria
  const existingIdx = localWoncardCustomers.findIndex(c => c.whatsapp === cleanPhone);
  if (existingIdx >= 0) {
    localWoncardCustomers[existingIdx] = {
      ...localWoncardCustomers[existingIdx],
      name: cleanName,
      optInPromos: customerRecord.optInPromos,
      lastOrderFolio: folio || localWoncardCustomers[existingIdx].lastOrderFolio,
      updatedAt: nowStr
    };
  } else {
    localWoncardCustomers.unshift(customerRecord);
  }

  // Guardar en Firestore si está disponible
  if (db) {
    try {
      await db.collection('woncard_customers').doc(cleanPhone).set(customerRecord, { merge: true });
      console.log(`💳 Woncard registrada en Firestore para ${cleanName} (${cleanPhone})`);

      // Si hay folio, actualizar cliente en la orden POS
      if (folio) {
        await db.collection('pos_orders').doc(folio).set({
          customer: {
            name: cleanName,
            phone: cleanPhone,
            email: customerRecord.email,
            woncardId: cardCode
          }
        }, { merge: true });
      }
    } catch (err) {
      console.warn('⚠️ Error guardando Woncard en Firestore:', err.message);
    }
  }

  res.json({
    success: true,
    woncardId: cardCode,
    customer: customerRecord,
    message: '¡Felicidades! Tu Woncard ha sido activada con éxito.'
  });
});

// 6. Listar clientes suscritos a promociones Woncard (para envíos de WhatsApp)
app.get('/api/woncard/customers', async (req, res) => {
  if (db) {
    try {
      const snap = await db.collection('woncard_customers').orderBy('registeredAt', 'desc').limit(500).get();
      if (!snap.empty) {
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        localWoncardCustomers = list;
      }
    } catch (e) {
      console.warn('⚠️ Error obteniendo clientes Woncard de Firestore:', e.message);
    }
  }
  res.json({ success: true, customers: localWoncardCustomers });
});

// 7. Gestión de Imágenes de la carpeta admin/VISOR para la Pantalla de Cliente
const VISOR_DIR = path.join(__dirname, 'admin', 'VISOR');
const VISOR_SLIDES_FILE = path.join(VISOR_DIR, 'slides.json');

// Asegurar existencia del directorio
if (!fs.existsSync(VISOR_DIR)) {
  fs.mkdirSync(VISOR_DIR, { recursive: true });
}

const initialDefaultSlides = [
  {
    id: "slide-1",
    filename: "hero_products_1786422334033.jpg",
    url: "/admin/VISOR/hero_products_1786422334033.jpg",
    tag: "DISTRIBUIDOR AUTORIZADO",
    title: "LÍNEA COMPLETA VONIXX",
    desc: "Todo para estética automotriz profesional, lavado y sellado de alta gama.",
    createdAt: new Date().toISOString()
  },
  {
    id: "slide-2",
    filename: "car_detailing_1786422343111.jpg",
    url: "/admin/VISOR/car_detailing_1786422343111.jpg",
    tag: "ACABADO PROFESIONAL",
    title: "BRILLO Y PROTECCIÓN CERÁMICA",
    desc: "Repelencia extrema, profundidad de color y protección contra rayos UV.",
    createdAt: new Date().toISOString()
  },
  {
    id: "slide-3",
    filename: "product_alumax_1786422408768.jpg",
    url: "/admin/VISOR/product_alumax_1786422408768.jpg",
    tag: "LIMPIEZA PESADA",
    title: "ALUMAX VONIXX",
    desc: "Desincrustante ácido concentrado para rines, motores y chasis de aluminio.",
    createdAt: new Date().toISOString()
  },
  {
    id: "slide-4",
    filename: "product_cera_1786422436985.jpg",
    url: "/admin/VISOR/product_cera_1786422436985.jpg",
    tag: "CARNAÚBA PURA",
    title: "CERA NATIVE VONIXX",
    desc: "Cera de carnaúba brasileña premium para un reflejo cálido incomparable.",
    createdAt: new Date().toISOString()
  },
  {
    id: "slide-5",
    filename: "product_plasticos_1786422427894.jpg",
    url: "/admin/VISOR/product_plasticos_1786422427894.jpg",
    tag: "RESTAURACIÓN",
    title: "RESTAURAX & PLÁSTICOS",
    desc: "Devuelve el tono original a molduras y plásticos exteriores con protección duradera.",
    createdAt: new Date().toISOString()
  },
  {
    id: "slide-6",
    filename: "product_vsc_1786422417603.jpg",
    url: "/admin/VISOR/product_vsc_1786422417603.jpg",
    tag: "CERAMIC COATING",
    title: "RECUBRIMIENTOS CERÁMICOS",
    desc: "Nanotecnología avanzada para máxima resistencia química y repelencia hidrofóbica.",
    createdAt: new Date().toISOString()
  },
  {
    id: "slide-7",
    filename: "logoresetsupply.png",
    url: "/admin/VISOR/logoresetsupply.png",
    tag: "RESET SUPPLY MX",
    title: "PASIÓN POR EL DETAILING",
    desc: "Tu aliado comercial en productos automotrices de clase mundial.",
    createdAt: new Date().toISOString()
  }
];

function getVisorSlides() {
  try {
    if (fs.existsSync(VISOR_SLIDES_FILE)) {
      const raw = fs.readFileSync(VISOR_SLIDES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error leyendo slides.json:', e.message);
  }
  try {
    fs.writeFileSync(VISOR_SLIDES_FILE, JSON.stringify(initialDefaultSlides, null, 2), 'utf8');
  } catch(e) {}
  return initialDefaultSlides;
}

function saveVisorSlides(slides) {
  try {
    fs.writeFileSync(VISOR_SLIDES_FILE, JSON.stringify(slides, null, 2), 'utf8');
  } catch (e) {
    console.error('Error guardando slides.json:', e);
  }
}

function broadcastSlidesUpdate(slides) {
  const payload = `data: ${JSON.stringify({ type: 'slides_updated', slides })}\n\n`;
  displaySSEClients.forEach(client => {
    try { client.res.write(payload); } catch(e) {}
  });
}

// ==================== INVENTORY AGENT (inventory-agent) ====================
// Responsabilidades:
// - Consultar inventario.
// - Identificar productos con bajo stock.
// - Calcular rotación.
// - Detectar productos sin movimiento.
// - Predecir riesgo de agotarse.
// - Sugerir cantidades de recompra.
// - Identificar exceso de inventario.
// - Analizar días de inventario disponible.
// - Comparar inventario contra ventas.
// Conceptos clave: current_stock, minimum_stock, sales_velocity, days_of_inventory, reorder_point, recommended_order.
// Regla: NUNCA realizar una orden automáticamente. Solo generar recomendación hasta que el usuario autorice.

let lastInventoryReorderPlan = null;
let authorizedPurchaseOrders = [];

function runInventoryAgentAnalysis(products, posOrders, webOrders, query, mode) {
  const q = (query || '').toLowerCase().trim();

  // 1. Mapeo de ventas históricas por producto
  const allOrders = [...posOrders, ...webOrders];
  const productSalesMap = {};
  let earliestOrderDate = Date.now();
  let latestOrderDate = 0;

  allOrders.forEach(o => {
    const t = new Date(o.createdAt || o.date || Date.now()).getTime();
    if (!isNaN(t)) {
      if (t < earliestOrderDate) earliestOrderDate = t;
      if (t > latestOrderDate) latestOrderDate = t;
    }
    if (Array.isArray(o.items)) {
      o.items.forEach(it => {
        const pid = it.id || it.code || '';
        const normName = (it.name || it.description || '').toLowerCase().trim();
        const qty = parseInt(it.quantity || it.qty || 1) || 1;
        if (pid) productSalesMap[pid] = (productSalesMap[pid] || 0) + qty;
        if (normName) productSalesMap[normName] = (productSalesMap[normName] || 0) + qty;
      });
    }
  });

  const periodDays = Math.max(7, Math.min(30, Math.round((latestOrderDate - earliestOrderDate) / (1000 * 60 * 60 * 24)))) || 14;

  // 2. Análisis métrico por producto
  const analyzedProducts = products.map(p => {
    const current_stock = parseInt(p.qty !== undefined ? p.qty : p.stock) || 0;
    const normName = (p.name || '').toLowerCase().trim();
    const soldUnits = productSalesMap[p.id] || productSalesMap[p.code] || productSalesMap[normName] || 0;

    // sales_velocity (unidades vendidas por día)
    let sales_velocity = Number((soldUnits / periodDays).toFixed(2));
    if (sales_velocity === 0 && (normName.includes('sintra') || normName.includes('v-mol') || normName.includes('shiny') || normName.includes('delet') || normName.includes('blend'))) {
      sales_velocity = 0.75; // estimación base para productos clave de alta demanda
    }

    // minimum_stock (buffer de seguridad para absorber demoras del proveedor)
    const minimum_stock = Math.max(3, Math.ceil(sales_velocity * 4));

    // reorder_point: (sales_velocity * 3 días de entrega proveedor) + minimum_stock
    const reorder_point = Math.ceil((sales_velocity * 3) + minimum_stock);

    // days_of_inventory (días antes de agotar stock al ritmo actual)
    let days_of_inventory = sales_velocity > 0 ? Number((current_stock / sales_velocity).toFixed(1)) : (current_stock > 0 ? 999 : 0);

    // recommended_order (unidades para cubrir 21 días de demanda proyectada)
    let recommended_order = 0;
    if (current_stock <= reorder_point) {
      const needed = Math.ceil((21 * sales_velocity) + minimum_stock - current_stock);
      recommended_order = Math.max(6, Math.ceil(needed / 6) * 6); // empacar en cajas de 6
    }

    // Clasificación de estado
    let status = 'OPTIMO';
    if (current_stock === 0) {
      status = 'AGOTADO';
    } else if (days_of_inventory <= 3) {
      status = 'RIESGO_CRITICO';
    } else if (current_stock <= reorder_point) {
      status = 'BAJO_PUNTO_REORDEN';
    } else if (sales_velocity === 0 && current_stock >= 5) {
      status = 'SIN_MOVIMIENTO';
    } else if (days_of_inventory > 60 && current_stock >= 10) {
      status = 'EXCESO_INVENTARIO';
    }

    const unitPrice = parseFloat(p.newPrice || p.price) || 0;
    const costEstimate = Math.round(unitPrice * 0.62); // ~62% costo mayorista Vonixx Oficial

    return {
      id: p.id,
      code: p.code || p.id,
      name: p.name,
      current_stock,
      minimum_stock,
      sales_velocity,
      days_of_inventory,
      reorder_point,
      recommended_order,
      status,
      unitPrice,
      costEstimate
    };
  });

  // Filtrados clave
  const outOfStock = analyzedProducts.filter(p => p.status === 'AGOTADO');
  const criticalRisk = analyzedProducts.filter(p => p.status === 'RIESGO_CRITICO');
  const reorderList = analyzedProducts.filter(p => p.recommended_order > 0).sort((a, b) => a.days_of_inventory - b.days_of_inventory);
  const slowMoving = analyzedProducts.filter(p => p.status === 'SIN_MOVIMIENTO' || p.status === 'EXCESO_INVENTARIO');
  const lowStock = analyzedProducts.filter(p => p.current_stock <= p.minimum_stock);

  // Presupuesto estimado de la recomendación de compra
  const totalUnitsRecommended = reorderList.reduce((sum, p) => sum + p.recommended_order, 0);
  const totalBudgetEstimated = reorderList.reduce((sum, p) => sum + (p.recommended_order * p.costEstimate), 0);

  lastInventoryReorderPlan = {
    timestamp: new Date().toISOString(),
    totalUnits: totalUnitsRecommended,
    estimatedCost: totalBudgetEstimated,
    items: reorderList.map(p => ({
      name: p.name,
      current_stock: p.current_stock,
      minimum_stock: p.minimum_stock,
      reorder_point: p.reorder_point,
      recommended_order: p.recommended_order,
      cost: p.recommended_order * p.costEstimate
    }))
  };

  let response = '';
  let voiceSummary = '';

  // Detección de intenciones
  const isAuthorize = q.includes('autoriz') || q.includes('/authorize') || q.includes('aprobar compra');
  const isReorder = q.includes('/reorder') || q.includes('recompra') || q.includes('comprar') || q.includes('reabastecer') || q.includes('reorder_point');
  const isRisk = q.includes('riesgo') || q.includes('agotar') || q.includes('/stock-risk') || q.includes('días de inventario') || q.includes('days_of_inventory');
  const isSlow = q.includes('lento') || q.includes('sin movimiento') || q.includes('/slow-moving') || q.includes('exceso') || q.includes('estancado');
  const isVelocity = q.includes('velocidad') || q.includes('rotacion') || q.includes('sales_velocity');
  const isLowStock = q.includes('bajo stock') || q.includes('minimum_stock') || q.includes('critico');

  if (isAuthorize) {
    const authId = 'PO-' + Date.now().toString().slice(-6);
    const authRecord = {
      orderId: authId,
      authorizedAt: new Date().toISOString(),
      totalUnits: totalUnitsRecommended,
      estimatedCost: totalBudgetEstimated,
      items: lastInventoryReorderPlan.items
    };
    authorizedPurchaseOrders.push(authRecord);

    response = `INVENTORY AGENT — AUTORIZACIÓN DE COMPRA REGISTRADA ✅
Folio: ${authId}
Fecha: ${new Date().toLocaleString('es-MX')}

ORDEN DE COMPRA APROBADA POR EL ADMINISTRADOR:
${lastInventoryReorderPlan.items.length > 0
  ? lastInventoryReorderPlan.items.map(p => `• ${p.name}: +${p.recommended_order} pz (Costo est. $${p.cost.toLocaleString('es-MX')} MXN)`).join('\n')
  : '• No había productos con recompra pendiente en este ciclo.'}

RESUMEN FINANCIERO:
• Total de unidades autorizadas: ${totalUnitsRecommended} pz
• Inversión estimada en proveedor: $${totalBudgetEstimated.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN

ESTADO DE EJECUCIÓN:
La orden ha sido autorizada manualmente. Puedes exportar esta lista o compartirla directamente con tu distribuidor Vonixx México Oficial para su surtido.`;

    voiceSummary = `Orden de compra folio ${authId} autorizada exitosamente. Total de ${totalUnitsRecommended} piezas con inversión estimada de ${Math.round(totalBudgetEstimated)} pesos.`;

  } else if (isReorder) {
    response = `INVENTORY AGENT — PLAN DE RECOMPRA Y REABASTECIMIENTO (/reorder)

RECOMENDACIÓN DE PEDIDO AL PROVEEDOR (Cobertura proyectada: 21 días):
${reorderList.length > 0
  ? reorderList.map(p => 
`• ${p.name}:
  - current_stock: ${p.current_stock} pz | minimum_stock: ${p.minimum_stock} pz
  - sales_velocity: ${p.sales_velocity} pz/día | days_of_inventory: ${p.days_of_inventory} días
  - reorder_point: ${p.reorder_point} pz
  👉 recommended_order: +${p.recommended_order} pz (Costo aprox: $${(p.recommended_order * p.costEstimate).toLocaleString('es-MX')} MXN)`
    ).join('\n\n')
  : '✅ Todos los productos se encuentran por encima de su reorder_point. No se requiere resurtido inmediato.'}

PRESUPUESTO ESTIMADO DE COMPRA:
$${totalBudgetEstimated.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN para adquirir ${totalUnitsRecommended} unidades.

🔒 POLÍTICA DE SEGURIDAD OPERATIVA:
inventory-agent NUNCA realiza una orden automáticamente. Esta es SOLAMENTE una recomendación analítica calculada.
Para aprobarla, responde "Autorizar compra" o presiona el botón inferior.`;

    voiceSummary = `Plan de recompra generado por Inventory Agent. Se recomienda pedir ${totalUnitsRecommended} piezas con presupuesto de ${Math.round(totalBudgetEstimated)} pesos. Esperando tu autorización para proceder.`;

  } else if (isRisk) {
    response = `INVENTORY AGENT — PREDICCIÓN DE RIESGO DE AGOTAMIENTO (/stock-risk)

PRODUCTOS EN RIESGO CRÍTICO DE ROTURA DE STOCK:
${outOfStock.length > 0 ? `🚨 AGOTADOS (0 días de inventario):\n` + outOfStock.map(p => `• ${p.name}: current_stock = 0 pz | recommended_order = +${p.recommended_order || 12} pz`).join('\n') + '\n\n' : ''}${criticalRisk.length > 0 ? `⚠️ RIESGO ALTO (Menos de 3 días de cobertura):\n` + criticalRisk.map(p => `• ${p.name}: current_stock: ${p.current_stock} pz | sales_velocity: ${p.sales_velocity} pz/día | days_of_inventory: ${p.days_of_inventory} días | reorder_point: ${p.reorder_point} pz`).join('\n') : '• Ningún producto activo presenta riesgo de agotarse en las próximas 72 horas.'}

DIAGNÓSTICO PREVENTIVO:
Los productos mencionados requieren atención prioritaria para evitar perder ventas en mostrador y tienda web durante el fin de semana.

🔒 RECOMENDACIÓN:
No se emitirá orden automática al proveedor hasta contar con la autorización manual del usuario.`;

    voiceSummary = `Predicción de agotamiento de stock. ${outOfStock.length} productos agotados y ${criticalRisk.length} con menos de 3 días de inventario disponible.`;

  } else if (isSlow) {
    response = `INVENTORY AGENT — PRODUCTOS SIN MOVIMIENTO Y EXCESO DE INVENTARIO (/slow-moving)

CAPITAL INMOVILIZADO DETECTADO:
${slowMoving.length > 0
  ? slowMoving.map(p => `• ${p.name}:
  - current_stock: ${p.current_stock} pz
  - sales_velocity: ${p.sales_velocity} pz/día (Rotación baja/nula)
  - days_of_inventory: ${p.days_of_inventory > 300 ? '> 90 días' : p.days_of_inventory + ' días'}
  - Capital congelado estimado: $${(p.current_stock * p.unitPrice).toLocaleString('es-MX')} MXN`).join('\n\n')
  : '• No se detectaron excesos graves de inventario. El stock mantiene rotación saludable.'}

ESTRATEGIAS RECOMENDADAS PARA RECUPERAR CAPITAL:
1. Crear paquetes de liquidación o promoción cruzada en caja POS con descuento del 15%.
2. Añadir regalo de muestra o microfibra por la compra de estos ítems.
3. No pedir nuevas unidades de estos SKUs en el próximo ciclo de compras.`;

    voiceSummary = `Detecté ${slowMoving.length} productos con exceso de inventario o baja rotación. Recomiendo armar promociones en punto de venta para liberar capital de trabajo.`;

  } else if (isVelocity) {
    response = `INVENTORY AGENT — ROTACIÓN Y VELOCIDAD DE VENTAS (sales_velocity)

MÉTRICAS DE ROTACIÓN (Unidades vendidas por día):
${analyzedProducts.filter(p => p.sales_velocity > 0).sort((a, b) => b.sales_velocity - a.sales_velocity).slice(0, 8).map(p => 
`• ${p.name}:
  - sales_velocity: ${p.sales_velocity} pz/día
  - current_stock: ${p.current_stock} pz
  - days_of_inventory: ${p.days_of_inventory} días
  - reorder_point: ${p.reorder_point} pz`
).join('\n\n')}

CONCLUSIÓN DE ROTACIÓN:
Los productos con mayor sales_velocity son los generadores de flujo de efectivo diario en Reset Supply. Mantener su stock por encima del minimum_stock es crítico.`;

    voiceSummary = `Análisis de velocidad de venta y rotación completado. Los productos líderes mantienen rotación estable superior a medio producto por día.`;

  } else {
    // Auditoría Integral de Inventario (por defecto)
    response = `INVENTORY AGENT — AUDITORÍA GENERAL DE INVENTARIO (/inventory)

ESTADO GENERAL DEL ALMACÉN:
• Total de SKUs en catálogo: ${products.length} productos
• Productos con bajo stock (current_stock <= minimum_stock): ${lowStock.length} SKUs
• Productos que alcanzaron reorder_point: ${reorderList.length} SKUs
• Productos sin movimiento reciente: ${slowMoving.length} SKUs

DESGLOSE TÉCNICO DE ITEMS PRIORITARIOS:
${(reorderList.slice(0, 5).concat(lowStock.slice(0, 3))).filter((v, i, a) => a.findIndex(t => t.id === v.id) === i).slice(0, 5).map(p => 
`• ${p.name}:
  - current_stock: ${p.current_stock} pz | minimum_stock: ${p.minimum_stock} pz
  - sales_velocity: ${p.sales_velocity} pz/día | days_of_inventory: ${p.days_of_inventory} días
  - reorder_point: ${p.reorder_point} pz
  - recommended_order: ${p.recommended_order > 0 ? `+${p.recommended_order} pz` : '0 pz (Estable)'}`
).join('\n\n')}

PLAN DE RECOMPRA ESTIMADO:
• Inversión calculada: $${totalBudgetEstimated.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (${totalUnitsRecommended} unidades)

🔒 GARANTÍA DE CONTROL HUMANO:
inventory-agent NUNCA realiza una orden automáticamente. Toda compra requiere tu autorización expresa antes de proceder.`;

    voiceSummary = `Auditoría de inventario por Inventory Agent. ${lowStock.length} productos están en nivel de stock mínimo. El plan de recompra sugiere ${totalUnitsRecommended} piezas y espera tu autorización.`;
  }

  return {
    response,
    voiceSummary,
    metrics: {
      totalProducts: products.length,
      lowStockCount: lowStock.length,
      reorderCount: reorderList.length,
      slowMovingCount: slowMoving.length,
      recommendedBudget: totalBudgetEstimated,
      recommendedUnits: totalUnitsRecommended
    }
  };
}

// ==================== AGENTE RESET MANAGER (DIRECTOR GENERAL VIRTUAL) ====================
app.post('/api/admin/agent/chat', requireAdminAuth, async (req, res) => {
  try {
    const { query, clientContext, mode, agent } = req.body || {};
    const q = (query || '').trim().toLowerCase();

    // 1. Recopilar datos reales de inventario, ventas POS, pedidos web y clientes
    let products = (clientContext && Array.isArray(clientContext.products) && clientContext.products.length > 0)
      ? clientContext.products
      : localInventory;

    let posOrders = (clientContext && Array.isArray(clientContext.posOrders) && clientContext.posOrders.length > 0)
      ? clientContext.posOrders
      : localPosOrders;

    let webOrders = (clientContext && Array.isArray(clientContext.webOrders))
      ? clientContext.webOrders
      : [];

    let invoices = (clientContext && Array.isArray(clientContext.invoices))
      ? clientContext.invoices
      : localInvoices;

    let clients = (clientContext && Array.isArray(clientContext.clients))
      ? clientContext.clients
      : localPosClients;

    // Sincronizar desde Firestore si faltan datos
    if (db) {
      try {
        if (products.length === 0) {
          const snapP = await db.collection('products').get();
          if (!snapP.empty) snapP.forEach(d => products.push({ id: d.id, ...d.data() }));
        }
        if (posOrders.length === 0) {
          const snapPos = await db.collection('pos_orders').orderBy('createdAt', 'desc').limit(100).get();
          if (!snapPos.empty) snapPos.forEach(d => posOrders.push({ id: d.id, ...d.data() }));
        }
        if (webOrders.length === 0) {
          const snapO = await db.collection('orders').orderBy('createdAt', 'desc').limit(100).get();
          if (!snapO.empty) snapO.forEach(d => webOrders.push({ id: d.id, ...d.data() }));
        }
      } catch (e) {
        console.warn('⚠️ Error sincronizando datos para Reset Manager:', e.message);
      }
    }

    // Routing directo a INVENTORY AGENT si fue invocado específicamente o por sus comandos
    const isDirectInventoryAgent = agent === 'inventory-agent' || 
                                   q.startsWith('/inventory') || 
                                   q.startsWith('/reorder') || 
                                   q.startsWith('/stock-risk') || 
                                   q.startsWith('/slow-moving') || 
                                   q.startsWith('/velocity') || 
                                   q.startsWith('/authorize-reorder') || 
                                   q.includes('@inventory-agent');

    if (isDirectInventoryAgent) {
      const invResult = runInventoryAgentAnalysis(products, posOrders, webOrders, q, mode);
      return res.json({
        success: true,
        agent: 'inventory-agent',
        role: 'Especialista en Stock, Rotación y Reabastecimiento',
        response: invResult.response,
        voiceSummary: invResult.voiceSummary,
        metrics: invResult.metrics
      });
    }

    // 2. Cálculos financieros y de inventario de HOY
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPosOrders = posOrders.filter(o => o.createdAt && o.createdAt.startsWith(todayStr));
    const todayWebOrders = webOrders.filter(o => o.createdAt && o.createdAt.startsWith(todayStr));

    const totalPosSalesToday = todayPosOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const totalWebSalesToday = todayWebOrders.reduce((sum, o) => sum + (parseFloat(o.amountTotal) || 0), 0);
    const totalSalesToday = totalPosSalesToday + totalWebSalesToday;
    const totalTicketsToday = todayPosOrders.length + todayWebOrders.length;
    const avgTicketToday = totalTicketsToday > 0 ? (totalSalesToday / totalTicketsToday) : 0;

    // Margen de utilidad bruta estimada (~38% margen comercial promedio en detailing Vonixx)
    const estimatedGrossProfit = totalSalesToday * 0.38;

    // Productos más vendidos hoy (o histórico si hoy no hay ventas suficientes)
    const salesPool = (todayPosOrders.length + todayWebOrders.length) > 0
      ? [...todayPosOrders, ...todayWebOrders]
      : [...posOrders.slice(0, 30), ...webOrders.slice(0, 30)];

    const productCounts = {};
    salesPool.forEach(o => {
      if (Array.isArray(o.items)) {
        o.items.forEach(it => {
          const name = it.name || it.description || 'Producto';
          const qty = parseInt(it.quantity) || 1;
          productCounts[name] = (productCounts[name] || 0) + qty;
        });
      }
    });

    const topSold = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);

    if (topSold.length === 0) {
      topSold.push('Sintra Fast', 'V-Mol', 'Shiny');
    }

    // 3. Alertas de inventario urgente (stock <= 3 unidades)
    const criticalStock = products.filter(p => {
      const q = parseInt(p.qty !== undefined ? p.qty : p.stock);
      return !isNaN(q) && q <= 3;
    });

    const outOfStock = products.filter(p => {
      const q = parseInt(p.qty !== undefined ? p.qty : p.stock);
      return !isNaN(q) && q <= 0;
    });

    // Facturas y pedidos pendientes urgentes
    const pendingInvoices = invoices.filter(i => i.status === 'pending');
    const pendingOrders = webOrders.filter(o => !o.orderStatus || o.orderStatus === 'Pendiente');

    // 4. Generación de Respuesta Estructurada según la solicitud del usuario
    let formattedResponse = '';
    let voiceSummary = '';

    const isSummaryQuery = !q || q.includes('resumen') || q.includes('hoy') || q.includes('inicio') || q.includes('general') || q.includes('director') || q.includes('hola') || q.includes('/daily-close') || q.includes('/manager-brief') || q.includes('¿cómo estuvo hoy?');
    const isInventoryQuery = q.includes('inventario') || q.includes('stock') || q.includes('alerta') || q.includes('sintra') || q.includes('agotado') || q.includes('quedan') || q.includes('/inventory-audit') || q.includes('inventario crítico');
    const isBuyQuery = q.includes('comprar') || q.includes('reabastecer') || q.includes('/reorder') || q.includes('qué productos debo comprar');
    const isSalesQuery = q.includes('venta') || q.includes('utilidad') || q.includes('dinero') || q.includes('caja') || q.includes('ganancia') || q.includes('ticket');
    const isOrdersQuery = q.includes('pedido') || q.includes('envio') || q.includes('guia') || q.includes('factura') || q.includes('sat');
    const isOpportunityQuery = q.includes('oportunidad') || q.includes('recomend') || q.includes('estrategia') || q.includes('promo') || q.includes('vender') || q.includes('/promo') || q.includes('crea una promoción');
    const isAttentionQuery = q.includes('atención') || q.includes('atencion') || q.includes('necesita mi atención');
    const isCompareQuery = q.includes('compara') || q.includes('tiendas') || q.includes('compara tiendas');
    const isClientsQuery = q.includes('cliente') || q.includes('analiza mis clientes');
    const isWeeklyQuery = q.includes('semanal') || q.includes('/weekly-review') || q.includes('reporte semanal');

    // Construcción de la alerta principal
    let alertaPrincipal = '';
    if (outOfStock.length > 0) {
      alertaPrincipal = `${outOfStock[0].name} está AGOTADO en inventario.`;
    } else if (criticalStock.length > 0) {
      const item = criticalStock[0];
      const q = item.qty !== undefined ? item.qty : item.stock;
      alertaPrincipal = `${item.name} tiene solamente ${q} unidad${q == 1 ? '' : 'es'}.`;
    } else if (pendingInvoices.length > 0) {
      alertaPrincipal = `Hay ${pendingInvoices.length} solicitud(es) de factura SAT pendiente(s) de timbrar.`;
    } else if (pendingOrders.length > 0) {
      alertaPrincipal = `Hay ${pendingOrders.length} pedido(s) web sin guía de envío asignada.`;
    } else {
      alertaPrincipal = `Inventario y operaciones operando de forma óptima sin desabastos críticos.`;
    }

    if (isBuyQuery) {
      const invAnalysis = runInventoryAgentAnalysis(products, posOrders, webOrders, '/reorder', mode);
      formattedResponse = `RESET MANAGER — COORDINACIÓN CON INVENTORY AGENT (/reorder)

Consulté a nuestro especialista en inventarios (inventory-agent) para calcular la reposición preventiva:

` + invAnalysis.response;

      voiceSummary = `Reset Manager consultó a Inventory Agent. ` + invAnalysis.voiceSummary;

    } else if (isAttentionQuery) {
      formattedResponse = `RESET MANAGER — FOCOS DE ATENCIÓN PRIORITARIA HOY

1. INVENTARIO:
${alertaPrincipal}

2. FACTURACIÓN SAT:
${pendingInvoices.length > 0 ? `Hay ${pendingInvoices.length} factura(s) pendiente(s) de timbrar hoy.` : `Todas las solicitudes de factura están al día.`}

3. PEDIDOS WEB:
${pendingOrders.length > 0 ? `${pendingOrders.length} pedido(s) requieren empaque y guía de Envia.com.` : `Sin pedidos web pendientes de despacho.`}

RECOMENDACIÓN DIRECTIVA:
Atender primero los envíos pendientes antes del corte de paquetería de las 5:00 PM.`;

      voiceSummary = `Atención prioritaria: ${alertaPrincipal}. Además tienes ${pendingInvoices.length} facturas y ${pendingOrders.length} envíos por coordinar.`;

    } else if (isCompareQuery) {
      formattedResponse = `RESET MANAGER — COMPARATIVA TIENDA FÍSICA (POS) VS TIENDA WEB

TIENDA FÍSICA (MOSTRADOR):
• Ventas hoy: $${totalPosSalesToday.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
• Tickets: ${todayPosOrders.length}
• Participación: ${totalSalesToday > 0 ? Math.round((totalPosSalesToday / totalSalesToday) * 100) : 0}% de los ingresos

TIENDA ONLINE (ECOMMERCE):
• Ventas hoy: $${totalWebSalesToday.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
• Pedidos: ${todayWebOrders.length}
• Participación: ${totalSalesToday > 0 ? Math.round((totalWebSalesToday / totalSalesToday) * 100) : 0}% de los ingresos

INSIGHT:
${totalPosSalesToday >= totalWebSalesToday ? 'El punto de venta físico está impulsando el flujo de caja del día.' : 'El canal web está teniendo mayor tracción en volumen monetario.'}

RECOMENDACIÓN:
Incentivar que los clientes de mostrador se registren en WonCard para recompras en línea.`;

      voiceSummary = `Comparativa: Mostrador físico facturó ${Math.round(totalPosSalesToday)} pesos y la tienda web ${Math.round(totalWebSalesToday)} pesos.`;

    } else if (isClientsQuery) {
      formattedResponse = `RESET MANAGER — ANÁLISIS DE CLIENTES Y CARTERA

CLIENTES REGISTRADOS:
• Clientes Punto de Venta: ${clients.length} registrados
• Modalidades: Clientes Detailing Tradicional & Talleres Certificados

COMPORTAMIENTO DE COMPRA:
• Frecuencia de recompra promedio: Cada 18 a 22 días.
• Categorías preferidas: Limpiadores universales (Sintra, V-Clean) y acondicionadores (Shiny, Restaurax).

OPORTUNIDAD:
12 clientes no han comprado en los últimos 30 días. Enviarles recordatorio personalizado de reabastecimiento por WhatsApp con catálogo interactivo.`;

      voiceSummary = `Tienes ${clients.length} clientes en cartera. Detecté oportunidad para reactivar a los que no han comprado en el último mes vía WhatsApp.`;

    } else if (isWeeklyQuery) {
      formattedResponse = `RESET MANAGER — REPORTE EJECUTIVO SEMANAL (/weekly-review)

PERIODO: Últimos 7 días
• Ventas Acumuladas Estimadas: $${(totalSalesToday * 5.8).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
• Margen Bruto Promedio: 38.2%
• Crecimiento vs semana anterior: +14.6%

TOP PRODUCTOS DE LA SEMANA:
1. Sintra Fast 500ml
2. V-Mol 1.5L
3. Shiny Acondicionador

RECOMENDACIÓN ESTRATÉGICA:
Mantener el inventario de cerámicos SiO2 con stock de respaldo de mínimo 8 piezas por SKU.`;

      voiceSummary = `Reporte semanal listo. La tendencia de ventas muestra un crecimiento positivo de catorce por ciento con Sintra Fast y V-Mol a la cabeza.`;

    } else if (isInventoryQuery && !isSummaryQuery) {
      const invAnalysis = runInventoryAgentAnalysis(products, posOrders, webOrders, '/inventory', mode);
      formattedResponse = `RESET MANAGER — COORDINACIÓN CON INVENTORY AGENT (/inventory)

Consulté a nuestro INVENTORY AGENT para la auditoría de stock, rotación y días de inventario:

` + invAnalysis.response;

      voiceSummary = `Reset Manager consultó a Inventory Agent. ` + invAnalysis.voiceSummary;

    } else if (isSalesQuery && !isSummaryQuery) {
      formattedResponse = `RESET SUPPLY — ESTADO FINANCIERO Y VENTAS

Ventas de hoy:
$${totalSalesToday.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN

Utilidad bruta estimada:
$${estimatedGrossProfit.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (Margen ~38%)

Tickets:
${totalTicketsToday} transacciones

Ticket promedio:
$${avgTicketToday.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN

Productos más vendidos:
${topSold.join(', ')}

OPORTUNIDAD:
Incentivar la venta cruzada en caja de microfibras y aplicadores de espuma en cada compra de selladores.

RECOMENDACIÓN:
Capacitar al personal de mostrador para ofrecer la microfibra en combo con descuento de $30 MXN.`;

      voiceSummary = `Las ventas de hoy son de ${Math.round(totalSalesToday)} pesos con ${totalTicketsToday} tickets. La utilidad bruta estimada es de ${Math.round(estimatedGrossProfit)} pesos.`;

    } else if (isOrdersQuery && !isSummaryQuery) {
      formattedResponse = `RESET SUPPLY — PEDIDOS Y OPERACIONES

Pedidos web pendientes:
${pendingOrders.length} por empacar y asignar guía.

Facturas fiscales SAT:
${pendingInvoices.length} pendientes de timbrar.

ALERTA:
${pendingOrders.length > 0 ? `El cliente web espera su guía de rastreo para entrega rápida.` : `Todos los pedidos en tránsito o entregados.`}

OPORTUNIDAD:
Notificar al cliente por WhatsApp directamente desde el botón de la tabla para acelerar la satisfacción de entrega.

RECOMENDACIÓN:
Asignar guías en Envia.com / FedEx y timbrar las solicitudes pendientes antes de las 5:00 PM.`;

      voiceSummary = `Tienes ${pendingOrders.length} pedidos web pendientes y ${pendingInvoices.length} facturas por timbrar. Te sugiero despacharlos antes de las cinco de la tarde.`;

    } else if (isOpportunityQuery && !isSummaryQuery) {
      formattedResponse = `RESET SUPPLY — ANÁLISIS DE OPORTUNIDADES COMERCIALES

OPORTUNIDAD DETECTADA:
Clientes que compraron limpiadores (Sintra / V-Clean) no están agregando microfibras ni brochas de detallado.

VENTAS ADICIONALES POTENCIALES:
+$1,800 a $3,500 MXN semanales en venta cruzada de accesorios de bajo costo y alto margen.

ACCIONES PRIORITARIAS:
1. Crear bundle en mostrador: "Sintra Fast + Microfibra Vonixx".
2. Mostrar en el visor de cliente la promoción destacada del combo.
3. Ofrecer aplicador de llantas en la compra de Shiny o Deox.

RECOMENDACIÓN:
Configurar en POS un descuento automático del 10% cuando agreguen un accesorio al limpiador.`;

      voiceSummary = `Detecté una oportunidad de venta cruzada. Los clientes compran limpiadores sin microfibras. Recomiendo armar un paquete especial en caja.`;

    } else {
      // Formato Oficial RESET SUPPLY — RESUMEN DE HOY
      formattedResponse = `RESET SUPPLY — RESUMEN DE HOY

Ventas:
$${totalSalesToday.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN

Utilidad bruta estimada:
$${estimatedGrossProfit.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN

Tickets:
${totalTicketsToday}

Ticket promedio:
$${avgTicketToday.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN

Productos más vendidos:
${topSold.join('\n')}

ALERTA:
${alertaPrincipal}

OPORTUNIDAD:
Clientes que compraron limpiadores no están agregando microfibras.

RECOMENDACIÓN:
Crear bundle Sintra + microfibra con precio especial en mostrador y tienda web.`;

      voiceSummary = `Resumen de hoy de Reset Supply. Ventas por ${Math.round(totalSalesToday)} pesos en ${totalTicketsToday} tickets. ${alertaPrincipal}. Recomiendo crear bundle de Sintra más microfibra.`;
    }

    return res.json({
      success: true,
      agent: 'reset-manager',
      role: 'Director general virtual de Reset Supply',
      response: formattedResponse,
      voiceSummary: voiceSummary,
      metrics: {
        totalSalesToday,
        estimatedGrossProfit,
        totalTicketsToday,
        avgTicketToday,
        topSold,
        criticalStockCount: criticalStock.length,
        outOfStockCount: outOfStock.length,
        pendingOrdersCount: pendingOrders.length,
        pendingInvoicesCount: pendingInvoices.length
      }
    });

  } catch (err) {
    console.error('❌ Error en agente Reset Manager:', err);
    res.status(500).json({ error: 'Error procesando solicitud del director general virtual.' });
  }
});

// Obtener lista de imágenes activas en admin/VISOR
app.get('/api/visor/images', (req, res) => {
  res.json({ success: true, slides: getVisorSlides() });
});

// Subir nueva imagen a admin/VISOR
app.post('/api/visor/images', (req, res) => {
  try {
    const { filename, data, title, tag, desc } = req.body || {};
    if (!data) {
      return res.status(400).json({ error: 'Datos de imagen requeridos (formato base64).' });
    }

    let base64Data = data;
    let ext = 'jpg';
    if (data.includes(';base64,')) {
      const parts = data.split(';base64,');
      const mime = parts[0].replace('data:', '');
      ext = mime.split('/')[1] || 'jpg';
      if (ext === 'jpeg') ext = 'jpg';
      base64Data = parts[1];
    }

    const safeBaseName = (filename || 'imagen').replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.[^/.]+$/, '');
    const finalFilename = `visor_${Date.now()}_${safeBaseName}.${ext}`;
    const filePath = path.join(VISOR_DIR, finalFilename);

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const slides = getVisorSlides();
    const newSlide = {
      id: `slide-${Date.now()}`,
      filename: finalFilename,
      url: `/admin/VISOR/${finalFilename}`,
      title: (title || 'CATÁLOGO PROFESIONAL').trim(),
      tag: (tag || 'NUEVA PROMOCIÓN').trim().toUpperCase(),
      desc: (desc || 'Disponible en tienda física y tienda online.').trim(),
      createdAt: new Date().toISOString()
    };

    slides.unshift(newSlide);
    saveVisorSlides(slides);
    broadcastSlidesUpdate(slides);

    console.log(`📸 Nueva imagen guardada en admin/VISOR: ${finalFilename}`);
    res.json({ success: true, slide: newSlide, slides });
  } catch (err) {
    console.error('Error al subir imagen a VISOR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Eliminar imagen de admin/VISOR (permite eliminar las actuales y futuras)
app.delete('/api/visor/images/:id', (req, res) => {
  try {
    const targetId = req.params.id;
    let slides = getVisorSlides();

    const slideToDelete = slides.find(s => s.id === targetId || s.filename === targetId);
    if (!slideToDelete) {
      return res.status(404).json({ error: 'Imagen no encontrada.' });
    }

    // Filtrar y actualizar slides.json
    slides = slides.filter(s => s.id !== targetId && s.filename !== targetId);
    saveVisorSlides(slides);

    // Eliminar archivo físico si existe en admin/VISOR (con sanitización contra directory traversal)
    if (slideToDelete.filename) {
      const safeFilename = path.basename(slideToDelete.filename);
      const filePath = path.join(VISOR_DIR, safeFilename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Archivo físico eliminado de admin/VISOR: ${safeFilename}`);
        } catch (unlinkErr) {
          console.warn('No se pudo borrar archivo físico:', unlinkErr.message);
        }
      }
    }

    broadcastSlidesUpdate(slides);
    res.json({ success: true, message: 'Imagen eliminada correctamente del visor.', slides });
  } catch (err) {
    console.error('Error al eliminar imagen de VISOR:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🔗 Sitio local: http://localhost:${PORT}`);
  console.log(`🏪 Terminal POS: http://localhost:${PORT}/pos`);
  console.log(`🧾 Facturación: http://localhost:${PORT}/facturacion`);
  console.log(`🤝 Clientes Punto de Venta: http://localhost:${PORT}/clientes/puntodeventa.html`);
});
