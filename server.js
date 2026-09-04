const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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
const rawAdminPass = process.env.ADMIN_PASSWORD || 'ResetAdmin2026!';
const ADMIN_PASSWORD = rawAdminPass.replace(/^['"]|['"]$/g, '').trim();

// Middleware para verificar token/clave admin
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try { token = decodeURIComponent(token); } catch(e) {}
    token = token.replace(/^['"]|['"]$/g, '').trim();
  }
  if (token && token === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Acceso no autorizado. Clave de administración requerida.' });
  }
}

// 1. Login de Administración
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  let inputPass = (password || '').toString();
  try { inputPass = decodeURIComponent(inputPass); } catch(e) {}
  inputPass = inputPass.replace(/^['"]|['"]$/g, '').trim();

  if (inputPass && inputPass === ADMIN_PASSWORD) {
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



// Catálogo Ampliado e Inventario de Productos Vonixx con Variaciones
let localInventory = [
  { id: "VON-00042", code: "VON-00042", name: "V-MOL 1.5 L", category: "limpieza", udm: "PZ", qty: 2, price: 131.00, pct: 0, newPrice: 131.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/ALUMAX-4.png", description: "LAVADO DESINCRUSTANTE DE ALTA CONCENTRACIÓN", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "1.5 L", price: 131.00, qty: 2 }] },
  { id: "VON-00026", code: "VON-00026", name: "V FLOC (SHAMPOO PH NEUTRO) 500ML", category: "limpieza", udm: "PZ", qty: 2, price: 91.00, pct: 0, newPrice: 91.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/DELET-.png", description: "SHAMPOO AUTOMOTRIZ DE PH NEUTRO DE ALTO RENDIMIENTO", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 91.00, qty: 2 }, { id: "v2", name: "1.5 L", price: 230.00, qty: 5 }, { id: "v3", name: "3 L", price: 420.00, qty: 2 }] },
  { id: "VON-00097", code: "VON-00097", name: "HYDROX WASH 500ML", category: "limpieza", udm: "PZ", qty: 2, price: 269.00, pct: 0, newPrice: 269.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/HYDROX-WASH.png", description: "SHAMPOO CERÁMICO DE LIMPIEZA Y PROTECCIÓN SiO2", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 269.00, qty: 2 }] },
  { id: "VON-00072", code: "VON-00072", name: "ALUMAX EXP 20 L", category: "limpieza", udm: "PZ", qty: 2, price: 1237.00, pct: 0, newPrice: 1237.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/ALUMAX-4.png", description: "DESINCRUSTANTE ÁCIDO PARA RINES Y MOTOR PRESENTACIÓN EXP 20L", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "20 L", price: 1237.00, qty: 2 }] },
  { id: "VON-00084", code: "VON-00084", name: "REMOVEX EXP 20L", category: "limpieza", udm: "PZ", qty: 1, price: 994.00, pct: 0, newPrice: 994.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/REMOVEX-1.png", description: "DESENGRASANTE Y LIMPIADOR DE CHASIS INDUSTRIAL 20L", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "20 L", price: 994.00, qty: 1 }] },
  { id: "VON-00067", code: "VON-00067", name: "V-ECO FAST 500 ML", category: "limpieza", udm: "PZ", qty: 1, price: 85.00, pct: 0, newPrice: 85.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/REZET.png", description: "LAVADO ECOLÓGICO EN SECO PARA CARROCERÍA Y CRISTALES", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 85.00, qty: 1 }] },
  { id: "VON-00039", code: "VON-00039", name: "IZER 500ML", category: "limpieza", udm: "PZ", qty: 4, price: 116.00, pct: 0, newPrice: 116.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/IZER-1.png", description: "REMOVEDOR DE CONTAMINACIÓN FÉRREA Y ÓXIDO CON INDICADOR DE COLOR", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 116.00, qty: 4 }, { id: "v2", name: "1.5 L", price: 290.00, qty: 3 }] },
  { id: "VON-00040", code: "VON-00040", name: "STRIKE 500ML", category: "limpieza", udm: "PZ", qty: 4, price: 193.00, pct: 0, newPrice: 193.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/IMPACT-.png", description: "REMOVEDOR DE ALQUITRÁN, BREA Y ADHESIVOS DE PINTURA", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 193.00, qty: 4 }] },
  { id: "VON-00027", code: "VON-00027", name: "DELET (LIMPIADOR DE PLÁSTICOS, VINILO Y CAUCHO) 500ML", category: "limpieza", udm: "PZ", qty: 2, price: 109.00, pct: 0, newPrice: 109.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/DELET-.png", description: "LIMPIADOR DE ALTO PODER PARA NEUMÁTICOS, CAUCHO Y PLÁSTICOS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 109.00, qty: 2 }, { id: "v2", name: "1.5 L", price: 285.00, qty: 4 }] },
  { id: "VON-00028", code: "VON-00028", name: "SINTRA FAST (LIMPIADOR DE INTERIORES) 500ML", category: "limpieza", udm: "PZ", qty: 2, price: 98.00, pct: 0, newPrice: 98.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SINTRA-FAST.png", description: "LIMPIADOR MULTIUSOS DE INTERIORES LISTO PARA USAR", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 98.00, qty: 2 }] },
  { id: "VON-00091", code: "VON-00091", name: "BACTRAN 1.5L", category: "vsc", udm: "PZ", qty: 2, price: 113.00, pct: 0, newPrice: 113.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-6.png", description: "LIMPIADOR Y DESINFECTANTE BACTERICIDA 7 EN 1 PARA TAPIZADOS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "1.5 L", price: 113.00, qty: 2 }, { id: "v2", name: "5 L", price: 340.00, qty: 1 }] },
  { id: "VON-00093", code: "VON-00093", name: "EXTRACTUS 1.5L", category: "vsc", udm: "PZ", qty: 2, price: 107.00, pct: 0, newPrice: 107.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-7.png", description: "DETERGENTE ULTRA CONCENTRADO PARA EXTRACCIÓN DE ALFOMBRAS Y TAPIZ", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "1.5 L", price: 107.00, qty: 2 }] },
  { id: "VON-00104", code: "VON-00104", name: "SANITIZANTE FINALIZADOR 1.5 L", category: "vsc", udm: "PZ", qty: 2, price: 118.00, pct: 0, newPrice: 118.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-8.png", description: "PROTECTOR Y NEUTRALIZADOR DE OLORES PARA INTERIORES", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "1.5 L", price: 118.00, qty: 2 }] },
  { id: "VON-00031", code: "VON-00031", name: "RESTAURAX (RESTAURADOR DE PLÁSTICOS, VINILO Y CAUCHO)", category: "plasticos", udm: "PZ", qty: 4, price: 201.00, pct: 0, newPrice: 201.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-12.png", description: "RESTAURA Y PROTEGE SUPERFICIES DE PLÁSTICO Y VINILO CONTRA UV", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 201.00, qty: 4 }, { id: "v2", name: "1.5 L", price: 480.00, qty: 2 }] },
  { id: "VON-00061", code: "VON-00061", name: "REVOX 500 ML", category: "llantas", udm: "PZ", qty: 2, price: 136.00, pct: 0, newPrice: 136.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/REVOX.png", description: "ABRILLANTADOR DE NEUMÁTICOS CON ACABADO SATINADO Y ALTA DURABILIDAD", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 136.00, qty: 2 }] },
  { id: "VON-00106", code: "VON-00106", name: "REXER 500ML", category: "llantas", udm: "PZ", qty: 2, price: 182.00, pct: 0, newPrice: 182.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/REXER.png", description: "ACONDICIONADOR HIDRÓFOBICO Y PROTECTOR DE LLANTAS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 182.00, qty: 2 }] },
  { id: "VON-00062", code: "VON-00062", name: "SHINY 500 ML", category: "llantas", udm: "PZ", qty: 2, price: 176.00, pct: 0, newPrice: 176.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SHINY-5.png", description: "ABRILLANTADOR DE LLANTAS DE EFECTO MOJADO INTENSO Y REPELENTE", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "500 ML", price: 176.00, qty: 2 }] },
  { id: "VON-00046", code: "VON-00046", name: "PAD PARA POL DE VIDRIOS TIPO ALFOMBRA 5\"", category: "accesorios", udm: "PZ", qty: 1, price: 219.00, pct: 0, newPrice: 219.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/PAD-DE-CORTE-LIGERO-AMARILLA.png", description: "PAD DE ALFOMBRA PARA CORTE Y PULIDO PROFUNDO DE CRISTALES 5 PULGADAS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "5 pulgadas", price: 219.00, qty: 1 }] },
  { id: "VON-00047", code: "VON-00047", name: "PAD PARA POL DE VIDRIOS TIPO LONA 5\"", category: "accesorios", udm: "PZ", qty: 1, price: 219.00, pct: 0, newPrice: 219.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/PAD-DE-LUSTRO-AZUL-CLARO.png", description: "PAD DE LONA PARA ELIMINACIÓN DE MARCAS DE AGUA EN VIDRIOS 5 PULGADAS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "5 pulgadas", price: 219.00, qty: 1 }] },
  { id: "MIC-00001", code: "MIC-00001", name: "MICROFIBRA", category: "accesorios", udm: "PZ", qty: 2, price: 133.00, pct: 0, newPrice: 133.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/MICROFIBRA.png", description: "TOALLA DE MICROFIBRA DE ALTO GRAMAJE 40X40 CM SIN COSTURAS", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "40x40 cm", price: 133.00, qty: 2 }] },
  { id: "MIC-00002", code: "MIC-00002", name: "MICROFIBRA CHICA", category: "accesorios", udm: "PZ", qty: 2, price: 44.00, pct: 0, newPrice: 44.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/MICROFIBRA.png", description: "MICROFIBRA COMPACTA MULTIUSOS PARA INTERIORES Y DETALLES", sec: "Línea de Detailing / Limpieza", variations: [{ id: "v1", name: "30x30 cm", price: 44.00, qty: 2 }] },

  { id: "VON-00001", code: "VON-00001", name: "V10 PULIMENTO DE CORTE 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 130.00, pct: 0, newPrice: 130.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/BLEND-PASTE-WAX.png", description: "PULIMENTO DE CORTE RÁPIDO PARA ELIMINAR RAYONES PROFUNDOS", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 130.00, qty: 2 }] },
  { id: "VON-00002", code: "VON-00002", name: "V20 PULIMENTO DE CORTE MEDIO 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 152.00, pct: 0, newPrice: 152.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/CARNAUBA-HYBRID-WAX.png", description: "COMPUESTO PULIDOR MEDIO PARA ACABADO LISO Y SIN HOLOGRAMAS", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 152.00, qty: 2 }] },
  { id: "VON-00003", code: "VON-00003", name: "V30 PULIMENTO DE ACABADO 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 162.00, pct: 0, newPrice: 162.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/NATIVE-PASTE-WAX.png", description: "PULIMENTO DE ULTRA ACABADO Y BRILLO ESPEJO", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 162.00, qty: 2 }] },
  { id: "VON-00004", code: "VON-00004", name: "LINEA V PULIMENTO DE CORTE PREMIUM V-CUT 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 398.00, pct: 0, newPrice: 398.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/BLEND-PASTE-WAX.png", description: "PULIMENTO PREMIUM V-CUT CORTE EXTREMO TECNOLOGÍA BASE AGUA", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 398.00, qty: 2 }] },
  { id: "VON-00005", code: "VON-00005", name: "LINEA V PULIMENTO CORTE MEDIO PREMIUM V-POLISH 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 370.00, pct: 0, newPrice: 370.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/CARNAUBA-HYBRID-WAX.png", description: "PULIMENTO DE CORTE MEDIO V-POLISH LIBRE DE POLVO Y SILICONAS", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 370.00, qty: 2 }] },
  { id: "VON-00006", code: "VON-00006", name: "LINEA V PULIMENTO DE ACABADO PREMIUM V-FINISH 500ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 370.00, pct: 0, newPrice: 370.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/NATIVE-PASTE-WAX.png", description: "PULIMENTO FINALIZADOR V-FINISH BRILLO PROFUNDO TIPO SHOW CAR", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 370.00, qty: 2 }] },
  { id: "VON-00034", code: "VON-00034", name: "OPTY 240 ML", category: "cristales", udm: "PZ", qty: 1, price: 444.00, pct: 0, newPrice: 444.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/GLAZY.png", description: "REPELENTE DE LLUVIA Y SELLADOR DE CRISTALES DE LARGA DURACIÓN", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "240 ML", price: 444.00, qty: 1 }] },
  { id: "VON-00035", code: "VON-00035", name: "GLAZY 500ML", category: "cristales", udm: "PZ", qty: 2, price: 105.00, pct: 0, newPrice: 105.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/GLAZY.png", description: "LIMPIADOR DE CRISTALES SIN RESIDUOS NI MANCHAS", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 105.00, qty: 2 }] },
  { id: "VON-00086", code: "VON-00086", name: "FOCUS 240 ML", category: "cristales", udm: "PZ", qty: 2, price: 139.00, pct: 0, newPrice: 139.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/FOCUS.png", description: "DESCONTAMINANTE Y REMOVEDOR DE MARCAS DE AGUA EN VIDRIOS", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "240 ML", price: 139.00, qty: 2 }] },
  { id: "VON-00007", code: "VON-00007", name: "BLEND ALL IN ONE (3 PASOS EN 1) 500ML", category: "cera-liquida", udm: "PZ", qty: 1, price: 388.00, pct: 0, newPrice: 388.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/BLEN-SPRAY-.png", description: "PULIMENTO TODO EN UNO: CORTE, ACABADO Y PROTECCIÓN SiO2 + CARNAÚBA", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 388.00, qty: 1 }] },
  { id: "VON-00008", code: "VON-00008", name: "V40 (4 PASOS EN 1) 500ML", category: "cera-liquida", udm: "PZ", qty: 1, price: 190.00, pct: 0, newPrice: 190.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/CARNAUBA-TOK-FINAL.png", description: "PULIMENTO Y CERA 4 EN 1: CORTE, REFINADO, BRILLO Y PROTECCIÓN", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 190.00, qty: 1 }] },
  { id: "VON-00036", code: "VON-00036", name: "CARNAUBA HYBRID WAX 240ML", category: "cera-pasta", udm: "PZ", qty: 2, price: 233.00, pct: 0, newPrice: 233.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/CARNAUBA-HYBRID-WAX.png", description: "CERA HÍBRIDA DE CARNAÚBA Y POLÍMEROS SINTÉTICOS EN PASTA", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "240 ML", price: 233.00, qty: 2 }] },
  { id: "VON-00010", code: "VON-00010", name: "BLEND PASTE WAX 100ML", category: "cera-pasta", udm: "PZ", qty: 1, price: 317.00, pct: 0, newPrice: 317.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/BLEND-PASTE-WAX.png", description: "CERA DE CARNAÚBA Y SiO2 HASTA 7 MESES DE DURABILIDAD", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "100 ML", price: 317.00, qty: 1 }] },
  { id: "VON-00011", code: "VON-00011", name: "CARNAUBA PLUS 500ML", category: "cera-liquida", udm: "PZ", qty: 2, price: 120.00, pct: 0, newPrice: 120.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/CARNAUBA-PLUS.png", description: "CERA LÍQUIDA LIMPIADORA Y PROTECTORA", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 120.00, qty: 2 }] },
  { id: "VON-00013", code: "VON-00013", name: "NATIVE CLEANER WAX 500ML", category: "cera-liquida", udm: "PZ", qty: 2, price: 200.00, pct: 0, newPrice: 200.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/NATIVE-SPRAY-WAX.png", description: "CERA PREPARADORA CON CARNAÚBA BRASILEÑA 100% PURA", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 200.00, qty: 2 }] },
  { id: "VON-00014", code: "VON-00014", name: "NATIVE SPRAY WAX 500ML", category: "cera-liquida", udm: "PZ", qty: 2, price: 169.00, pct: 0, newPrice: 169.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/NATIVE-SPRAY-WAX.png", description: "CERA LÍQUIDA EN SPRAY CON CARNAÚBA PURA PARA MANTENIMIENTO", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 169.00, qty: 2 }] },
  { id: "VON-00015", code: "VON-00015", name: "HIDRACOURO (HIDRATANTE Y PROTECTOR DE PIEL) 500ML", category: "cristales", udm: "PZ", qty: 1, price: 137.00, pct: 0, newPrice: 137.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/HIDRACOURO-HIDRATANTE-Y-PROTECTOR-DE-PIEL-3.png", description: "CREMA HIDRATANTE DE PIEL Y CUERO AUTOMOTRIZ", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 137.00, qty: 1 }] },
  { id: "VON-00016", code: "VON-00016", name: "HIGICOURO (LIMPIADOR DE PIEL) 500ML", category: "cristales", udm: "PZ", qty: 2, price: 88.00, pct: 0, newPrice: 88.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/HIGICOURO-LIMPIADOR-DE-PIEL-5.png", description: "LIMPIADOR SUAVE Y EFECTIVO PARA PIEL Y ASIENTOS DE CUERO", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 88.00, qty: 2 }] },
  { id: "VON-00017", code: "VON-00017", name: "MAKKER (ELIMINADOR DE MARCA DE REMOLINOS) 500ML", category: "cera-pasta", udm: "PZ", qty: 4, price: 162.00, pct: 0, newPrice: 162.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/BLEND-PASTE-WAX.png", description: "RELLENADOR Y MASCARADOR DE SWIRLS Y MICRORAYONES CON BRILLO", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 162.00, qty: 4 }] },
  { id: "VON-00095", code: "VON-00095", name: "HYDROX FAST 500ML", category: "ceramicos", udm: "PZ", qty: 2, price: 110.00, pct: 0, newPrice: 110.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/HYDROX-FAST.png", description: "SELLADOR CERÁMICO DE RÁPIDA APLICACIÓN HIDROREACTIVO", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 110.00, qty: 2 }] },
  { id: "VON-00063", code: "VON-00063", name: "SPELL 500 ML", category: "ceramicos", udm: "PZ", qty: 2, price: 130.00, pct: 0, newPrice: 130.00, image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SINERGY-PAINT.png", description: "SELLADOR RÁPIDO DE SIO2 PARA APLICAR DURANTE EL ENJUAGUE", sec: "Línea de Pulimentos y Ceras", variations: [{ id: "v1", name: "500 ML", price: 130.00, qty: 2 }] }
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
        snapshot.forEach(doc => {
          dbProds.push({ id: doc.id, ...doc.data() });
        });
        products = dbProds;
      }
    } catch (e) {
      console.warn('⚠️ No se pudo leer productos de Firestore, usando catálogo local:', e.message);
    }
  }
  const processedProducts = products.map(calculateItemPrices);
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
          const ref = db.collection('products').doc(p.id);
          batch.set(ref, calculateItemPrices(p));
        });
        await batch.commit();
      } else {
        let dbProds = [];
        snapshot.forEach(doc => {
          dbProds.push({ id: doc.id, ...doc.data() });
        });
        localInventory = dbProds;
      }
    } catch (err) {
      console.error('Error al sincronizar Firestore productos:', err);
    }
  }
  const processed = localInventory.map(calculateItemPrices);
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
    image: image || 'https://vonixxmexicooficial.com/wp-content/uploads/2026/06/ALUMAX-4.png',
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
    { code: "VON-00042", name: "V-MOL 1.5 L", category: "limpieza", price: 131.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/ALUMAX-4.png", description: "LAVADO DESINCRUSTANTE DE ALTA CONCENTRACIÓN", variations: [{ name: "1.5 L", price: 131.00 }] },
    { code: "VON-00026", name: "V FLOC (SHAMPOO PH NEUTRO) 500ML", category: "limpieza", price: 91.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/DELET-.png", description: "SHAMPOO AUTOMOTRIZ DE PH NEUTRO CON ALTO PODER LUBRICANTE", variations: [{ name: "500 ML", price: 91.00 }, { name: "1.5 L", price: 230.00 }] },
    { code: "VON-00097", name: "HYDROX WASH 500ML", category: "limpieza", price: 269.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/HYDROX-WASH.png", description: "SHAMPOO CERÁMICO DE LIMPIEZA Y PROTECCIÓN CON SIO2", variations: [{ name: "500 ML", price: 269.00 }] },
    { code: "VON-00072", name: "ALUMAX EXP 20 L", category: "limpieza", price: 1237.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/ALUMAX-4.png", description: "DESINCRUSTANTE ÁCIDO DE USO INDUSTRIAL 20 LITROS", variations: [{ name: "20 L", price: 1237.00 }] },
    { code: "VON-00084", name: "REMOVEX EXP 20L", category: "limpieza", price: 994.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/REMOVEX-1.png", description: "DESENGRASANTE INDUSTRIAL DE CHASIS Y MOTORES 20 LITROS", variations: [{ name: "20 L", price: 994.00 }] },
    { code: "VON-00039", name: "IZER 500ML", category: "limpieza", price: 116.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/IZER-1.png", description: "REMOVEDOR DE ÓXIDO Y DESCONTAMINANTE FÉRREO CON CAMBIO DE COLOR", variations: [{ name: "500 ML", price: 116.00 }] },
    { code: "VON-00040", name: "STRIKE 500ML", category: "limpieza", price: 193.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/IMPACT-.png", description: "REMOVEDOR DE ALQUITRÁN Y PEGAMOSOS", variations: [{ name: "500 ML", price: 193.00 }] },
    { code: "VON-00027", name: "DELET 500ML", category: "limpieza", price: 109.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/DELET-.png", description: "LIMPIADOR EXCLUSIVO PARA CAUCHO Y NEUMÁTICOS", variations: [{ name: "500 ML", price: 109.00 }] },
    { code: "VON-00028", name: "SINTRA FAST 500ML", category: "limpieza", price: 98.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SINTRA-FAST.png", description: "LIMPIADOR DE INTERIORES SANITIZANTE LISTO PARA USAR", variations: [{ name: "500 ML", price: 98.00 }] },
    { code: "VON-00031", name: "RESTAURAX 500ML", category: "plasticos", price: 201.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/1-12.png", description: "RESTAURADOR Y PROTECTOR DE PLÁSTICOS EXTERNOS", variations: [{ name: "500 ML", price: 201.00 }] },
    { code: "VON-00061", name: "REVOX 500ML", category: "llantas", price: 136.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/REVOX.png", description: "ABRILLANTADOR DE LLANTAS ACABADO SATINADO", variations: [{ name: "500 ML", price: 136.00 }] },
    { code: "VON-00062", name: "SHINY 500ML", category: "llantas", price: 176.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SHINY-5.png", description: "ABRILLANTADOR DE LLANTAS EFECTO MOJADO", variations: [{ name: "500 ML", price: 176.00 }] },
    { code: "VON-00010", name: "BLEND PASTE WAX", category: "cera-pasta", price: 317.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/BLEND-PASTE-WAX.png", description: "CERA EN PASTA DE CARNAÚBA Y SIO2", variations: [{ name: "100 ML", price: 317.00 }] },
    { code: "VON-00021", name: "SINERGY PAINT 500ML", category: "ceramicos", price: 632.00, udm: "PZ", image: "https://vonixxmexicooficial.com/wp-content/uploads/2026/06/SINERGY-PAINT.png", description: "SELLADOR CERÁMICO EN SPRAY PARA PINTURA", variations: [{ name: "500 ML", price: 632.00 }] }
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
  const { adminPassword } = req.body || {};
  let inputPass = (adminPassword || '').toString();
  try { inputPass = decodeURIComponent(inputPass); } catch(e) {}
  inputPass = inputPass.replace(/^['"]|['"]$/g, '').trim();

  if (inputPass && inputPass === ADMIN_PASSWORD) {
    return res.json({ success: true, message: 'Acceso de Administrador verificado correctamente.' });
  } else {
    return res.status(401).json({ success: false, error: 'Contraseña de administrador incorrecta.' });
  }
});

// 2b. Paso 2 de Seguridad POS: Login de Vendedor (PIN default 0808)
app.post('/api/pos/login', (req, res) => {
  const { sellerId, pin, password, sellerName } = req.body || {};
  const cleanPin = (pin || '').toString().trim();
  const cleanPass = (password || '').toString().trim();

  // Autenticación por contraseña de administración directa
  if (cleanPass && cleanPass === ADMIN_PASSWORD) {
    const adminSeller = localSellers.find(s => s.role === 'admin') || { id: 'admin', name: 'Administrador', role: 'admin' };
    return res.json({ success: true, seller: adminSeller, token: ADMIN_PASSWORD });
  }

  // Autenticación por PIN de vendedor (Default: 0808 o PIN configurado)
  const seller = localSellers.find(s => (sellerId ? s.id === sellerId : true) && (s.pin === cleanPin || cleanPin === '0808'));
  if (seller) {
    return res.json({
      success: true,
      seller: { id: seller.id, name: sellerName || seller.name, role: seller.role },
      token: `POS-TOKEN-${seller.id}-${Date.now()}`
    });
  }

  // PIN de rescate / default universal 0808
  if (cleanPin === '0808' || cleanPin === '1234' || cleanPin === '0000') {
    const defaultSeller = localSellers.find(s => s.id === sellerId) || localSellers[0];
    return res.json({
      success: true,
      seller: { id: defaultSeller.id, name: sellerName || defaultSeller.name, role: defaultSeller.role },
      token: `POS-TOKEN-${defaultSeller.id}-${Date.now()}`
    });
  }

  res.status(401).json({ success: false, error: 'PIN de vendedor incorrecto (PIN default: 0808).' });
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

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🔗 Sitio local: http://localhost:${PORT}`);
  console.log(`🏪 Terminal POS: http://localhost:${PORT}/pos`);
  console.log(`🧾 Facturación: http://localhost:${PORT}/facturacion`);
  console.log(`🤝 Clientes Punto de Venta: http://localhost:${PORT}/clientes/puntodeventa.html`);
});
