# Sistema de Permisos de Agentes — Reset Supply MX

Los agentes operan bajo una jerarquía de cuatro niveles de permisos estrictos:

---

## 1. READ ACTIONS (Acciones de Lectura Libre)
Los agentes pueden consultar y procesar los siguientes datos sin autorización adicional:
- Registro de ventas (POS y Tienda Web).
- Niveles actuales de inventario y stock físico.
- Catálogo de productos, descripciones, precios e imágenes.
- Cartera de clientes y fechas de última compra.
- Estado de pedidos y guías de rastreo.
- Estadísticas operativas, márgenes y métricas de desempeño.

---

## 2. RECOMMEND ACTIONS (Acciones de Recomendación Analítica)
Los agentes pueden formular, estructurar y presentar propuestas, pero **NO ejecutarlas**:
- Sugerir planes de recompra y reabastecimiento al proveedor.
- Proponer promociones, descuentos temporales y cupones.
- Recomendar ajustes de precios de lista.
- Sugerir bundles y paquetes de venta cruzada (cross-sell).
- Proponer campañas de reactivación por WhatsApp o correo.

---

## 3. WRITE ACTIONS (Acciones de Escritura — Requieren Aprobación Explícita)
Requieren autorización directa del usuario antes de guardarse en base de datos o impactar clientes:
- Cambiar precios en catálogo público o base de datos.
- Modificar cantidades de inventario o realizar ajustes manuales.
- Cancelar pedidos de clientes.
- Crear solicitudes formales de devolución.
- Crear y emitir órdenes de compra a proveedores.
- Enviar mensajes directos por WhatsApp a clientes.
- Enviar correos electrónicos masivos o de campaña.
- Publicar promociones en el banner de la tienda web.
- Emitir reembolsos a tarjetas vía Stripe.

---

## 4. CRITICAL ACTIONS (Acciones Críticas — Confirmación Doble Obligatoria)
Acciones de máximo impacto que exigen confirmación reforzada con contraseña o token de administrador:
- Eliminar datos de productos o pedidos de la base de datos Firestore.
- Cancelar pedidos que ya han sido pagados y timbrados.
- Reembolsar dinero real a clientes a través de pasarelas.
- Modificar costos históricos de adquisición.
- Borrar registros de clientes o historiales de transacciones.
- Alterar registros contables o folios de facturación SAT.
