const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
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

// Middleware
app.use(cors());


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

// Parsers estándar para JSON y URL-Encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Ruta por defecto: servir resetsupplymx.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'resetsupplymx.html'));
});

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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ResetAdmin2026!';

// Middleware para verificar token/clave admin
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Acceso no autorizado. Clave de administración requerida.' });
  }
}

// 1. Login de Administración
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
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



// Catálogo Oficial de Productos Vonixx (37 Artículos)
const DEFAULT_PRODUCTS = [
  {
    "id": "prod_1",
    "name": "ALUMAX – DESINCRUSTANTE ÁCIDO",
    "category": "limpieza",
    "price": 2261,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/ALUMAX-4.png"
  },
  {
    "id": "prod_2",
    "name": "DELET – LIMPIADOR DE PLÁSTICOS, VINILO Y CAUCHO",
    "category": "limpieza",
    "price": 200.00566,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/DELET-.png"
  },
  {
    "id": "prod_3",
    "name": "IMPACT – DESENGRASANTE MULTIUSOS",
    "category": "limpieza",
    "price": 225,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/IMPACT-.png"
  },
  {
    "id": "prod_4",
    "name": "IZER – REMOVEDOR DE ÓXIDO",
    "category": "limpieza",
    "price": 212.00422,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/IZER-1.png"
  },
  {
    "id": "prod_5",
    "name": "REMOVEX – DESENGRASANTE Y LIMPIADOR DE CHASIS",
    "category": "limpieza",
    "price": 1817,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/REMOVEX-1.png"
  },
  {
    "id": "prod_6",
    "name": "REZET – ZACS",
    "category": "limpieza",
    "price": 206,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/REZET.png"
  },
  {
    "id": "prod_7",
    "name": "SINTRA FAST – LIMPIADOR DE INTERIORES",
    "category": "limpieza",
    "price": 179,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SINTRA-FAST.png"
  },
  {
    "id": "prod_8",
    "name": "SINTRA PRO – LIMPIADOR DE INTERIORES",
    "category": "limpieza",
    "price": 246.00531,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SINTRA-PRO.png"
  },
  {
    "id": "prod_9",
    "name": "BACTRAN – LIMPIADOR BACTERICIDA 7 EN 1",
    "category": "vsc",
    "price": 206.00423,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-6.png"
  },
  {
    "id": "prod_10",
    "name": "EXTRACTUS – LIMPIADOR ULTRA CONCENTRADO",
    "category": "vsc",
    "price": 195.00407,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-7.png"
  },
  {
    "id": "prod_11",
    "name": "SANITIZANTE – FINALIZADOR 4 EN 1",
    "category": "vsc",
    "price": 216.00449,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-8.png"
  },
  {
    "id": "prod_12",
    "name": "BLEND PASTE WAX – CERA CON SIO2 Y CARNAÚBA",
    "category": "cera-pasta",
    "price": 580,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/BLEND-PASTE-WAX.png"
  },
  {
    "id": "prod_13",
    "name": "CARNAUBA HYBRID WAX",
    "category": "cera-pasta",
    "price": 426,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/CARNAUBA-HYBRID-WAX.png"
  },
  {
    "id": "prod_14",
    "name": "NATIVE PASTE WAX – CARNAÚBA BRASILEÑA 100% PURA",
    "category": "cera-pasta",
    "price": 638,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/NATIVE-PASTE-WAX.png"
  },
  {
    "id": "prod_15",
    "name": "BLEND SPRAY – CERA LÍQUIDA CON SiO2 & CARNAÚBA",
    "category": "cera-liquida",
    "price": 296,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/BLEN-SPRAY-.png"
  },
  {
    "id": "prod_16",
    "name": "CARNAUBA TOK FINAL – CERA DE MANTENIMIENTO",
    "category": "cera-liquida",
    "price": 180,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/CARNAUBA-TOK-FINAL.png"
  },
  {
    "id": "prod_17",
    "name": "NATIVE SPRAY WAX – CARNAÚBA LÍQUIDA PREMIUM",
    "category": "cera-liquida",
    "price": 309,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/NATIVE-SPRAY-WAX.png"
  },
  {
    "id": "prod_18",
    "name": "CARNAÚBA PLUS – CERA DE LIMPIEZA",
    "category": "cera-liquida",
    "price": 219.00477,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/CARNAUBA-PLUS.png"
  },
  {
    "id": "prod_19",
    "name": "CITRON – SHAMPOO DESENGRASANTE",
    "category": "shampoo",
    "price": 280,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/CITRON.png"
  },
  {
    "id": "prod_20",
    "name": "HYDROX WASH – SHAMPOO CERÁMICO",
    "category": "shampoo",
    "price": 492,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/HYDROX-WASH.png"
  },
  {
    "id": "prod_21",
    "name": "SINERGY PAINT – SELLADOR CERÁMICO PARA PINTURA",
    "category": "ceramicos",
    "price": 632,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SINERGY-PAINT.png"
  },
  {
    "id": "prod_22",
    "name": "SINERGY WHEEL – CERÁMICO PARA LLANTAS",
    "category": "ceramicos",
    "price": 618,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SINERGY-WHEEL.png"
  },
  {
    "id": "prod_23",
    "name": "HYDROX PRO – CERÁMICO HIDROREACTIVO CONCENTRADO",
    "category": "ceramicos",
    "price": 571,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/HYDROX-PRO-.png"
  },
  {
    "id": "prod_24",
    "name": "HYDROX FAST – CERÁMICO HIDROREACTIVO",
    "category": "ceramicos",
    "price": 201,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/HYDROX-FAST.png"
  },
  {
    "id": "prod_25",
    "name": "RESTAURAX – RESTAURADOR DE PLÁSTICOS",
    "category": "plasticos",
    "price": 368,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-12.png"
  },
  {
    "id": "prod_26",
    "name": "RESTAURAX EN AEROSOL",
    "category": "plasticos",
    "price": 253,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-13.png"
  },
  {
    "id": "prod_27",
    "name": "FLEXUS – RENOVACIÓN DE PLÁSTICOS INTERIOR",
    "category": "plasticos",
    "price": 277,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-11.png"
  },
  {
    "id": "prod_28",
    "name": "INTENSE – PLÁSTICOS INTERNOS ACABADO NATURAL",
    "category": "plasticos",
    "price": 201,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-16.png"
  },
  {
    "id": "prod_29",
    "name": "SHINY – ABRILLANTADOR DE LLANTAS BRILLANTE",
    "category": "llantas",
    "price": 321,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SHINY-5.png"
  },
  {
    "id": "prod_30",
    "name": "REVOX – ABRILLANTADOR ACABADO SATINADO",
    "category": "llantas",
    "price": 248,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/REVOX.png"
  },
  {
    "id": "prod_31",
    "name": "REXER – RESTAURADOR DE NEUMÁTICOS",
    "category": "llantas",
    "price": 333,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/REXER.png"
  },
  {
    "id": "prod_32",
    "name": "GLAZY – LIMPIADOR DE CRISTALES",
    "category": "cristales",
    "price": 193.00725,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/GLAZY.png"
  },
  {
    "id": "prod_33",
    "name": "FOCUS – REMOVEDOR DE MARCAS DE AGUA",
    "category": "cristales",
    "price": 254,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/FOCUS.png"
  },
  {
    "id": "prod_34",
    "name": "PRIZM – RESTAURADOR DE VIDRIOS",
    "category": "cristales",
    "price": 184,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/PRIZM.png"
  },
  {
    "id": "prod_35",
    "name": "HIGICOURO – LIMPIADOR DE PIEL",
    "category": "piel",
    "price": 296,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/HIGICOURO-LIMPIADOR-DE-PIEL-5.png"
  },
  {
    "id": "prod_36",
    "name": "HIDROCOURO – HIDRATANTE Y PROTECTOR DE PIEL",
    "category": "piel",
    "price": 251,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/HIDRACOURO-HIDRATANTE-Y-PROTECTOR-DE-PIEL-3.png"
  },
  {
    "id": "prod_37",
    "name": "CEPILLO DE MICROFIBRA – LIMPIEZA DE RINES",
    "category": "accesorios",
    "price": 312,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/CEPILLO-MICROFIBRA-PARA-LIMPIEZA-RINES.png"
  },
  {
    "id": "prod_38",
    "name": "GUANTE MICROFIBRA 2 EN 1",
    "category": "accesorios",
    "price": 140,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/guante-2-en-1.png"
  },
  {
    "id": "prod_39",
    "name": "KIT DE 5 PINCELES DE DETALLADO",
    "category": "accesorios",
    "price": 313,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/KIT-DE-PINCELES-EXTERNO.png"
  },
  {
    "id": "prod_40",
    "name": "APLICADOR DE MICROFIBRA – ENCAJE DE MANO",
    "category": "accesorios",
    "price": 60,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/APLICADOR-DE-MANO.png"
  },
  {
    "id": "prod_41",
    "name": "MICROFIBRA CAR BRITE",
    "category": "microfibras",
    "price": 101.00251,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/MICROFIBRA.png"
  },
  {
    "id": "prod_42",
    "name": "PAD DE CORTE LIGERO AMARILLO",
    "category": "pads",
    "price": 282,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/PAD-DE-CORTE-LIGERO-AMARILLA.png"
  },
  {
    "id": "prod_43",
    "name": "PAD DE LUSTRO AZUL CLARO",
    "category": "pads",
    "price": 282,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/PAD-DE-LUSTRO-AZUL-CLARO.png"
  },
  {
    "id": "prod_44",
    "name": "PAD DE SUPER LUSTRO ROJO",
    "category": "pads",
    "price": 282,
    "image": "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/PAD-DE-SUPER-LUSTRO-ROJO.png"
  }
];

// 4. Obtener Lista de Productos (desde Firestore o respaldo)
app.get('/api/admin/products', requireAdminAuth, async (req, res) => {
  if (!db) {
    return res.json({ success: true, products: DEFAULT_PRODUCTS });
  }
  try {
    const snapshot = await db.collection('products').get();
    let products = [];
    if (snapshot.empty) {
      console.log('🌱 Sembrando 37 productos oficiales Vonixx en Firestore...');
      const batch = db.batch();
      DEFAULT_PRODUCTS.forEach(p => {
        const ref = db.collection('products').doc(p.id);
        batch.set(ref, p);
      });
      await batch.commit();
      products = DEFAULT_PRODUCTS;
    } else {
      snapshot.forEach(doc => {
        products.push({ id: doc.id, ...doc.data() });
      });
    }
    res.json({ success: true, products });
  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.json({ success: true, products: DEFAULT_PRODUCTS });
  }
});

// 5. Crear o Actualizar Producto en Firestore
app.post('/api/admin/products', requireAdminAuth, async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Firestore no está conectado' });
  }
  const { id, name, price, category, image, description } = req.body;
  try {
    const docId = id || 'prod_' + Date.now();
    const docRef = db.collection('products').doc(docId);
    const productData = {
      name,
      price: parseFloat(price),
      category,
      image,
      description: description || '',
      updatedAt: new Date().toISOString()
    };
    await docRef.set(productData, { merge: true });
    res.json({ success: true, id: docId, product: productData });
  } catch (err) {
    console.error('Error al guardar producto:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Eliminar Producto
app.delete('/api/admin/products/:id', requireAdminAuth, async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Firestore no está conectado' });
  }
  const { id } = req.params;
  try {
    await db.collection('products').doc(id).delete();
    res.json({ success: true, message: 'Producto eliminado' });
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    res.status(500).json({ error: err.message });
  }
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
    bgImage: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/DELET-.png",
    ctaText: "Ver Catálogo Completo",
    ctaLink: "#catalogo"
  },
  promoBanners: [
    {
      id: "promo_1",
      title: "Línea de Cerámicos SiO2",
      subtitle: "Protección extrema y brillo hidrofóbico duradero",
      tag: "OFERTA DESTACADA",
      image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SINERGY-PAINT.png",
      link: "#ceramicos"
    },
    {
      id: "promo_2",
      title: "Limpiadores de Interiores",
      subtitle: "Sintra Fast & Bactericida Bactran con fórmulas exclusivas",
      tag: "MÁS VENDIDOS",
      image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SINTRA-FAST.png",
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

// Endpoint admin para guardar la configuración del sitio
app.post('/api/admin/site-config', requireAdminAuth, async (req, res) => {
  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ error: 'Configuración no enviada' });
  }
  localSiteConfig = { ...localSiteConfig, ...config, updatedAt: new Date().toISOString() };

  if (db) {
    try {
      await db.collection('site_config').doc('main').set(localSiteConfig, { merge: true });
      console.log('✅ Configuración del sitio guardada en Firestore');
    } catch (err) {
      console.error('❌ Error al guardar site_config en Firestore:', err);
    }
  }
  res.json({ success: true, message: 'Configuración del sitio guardada con éxito', config: localSiteConfig });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🔗 Sitio local: http://localhost:${PORT}`);
});
