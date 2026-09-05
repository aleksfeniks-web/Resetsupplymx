# Skill: Customer Segmentation

## 1. Propósito
Clasificar a los clientes en cohortes estratégicas para acciones comerciales focalizadas.

## 2. Cuándo Usar Esta Skill
Cuando se requiera armar una campaña, filtrar clientes para WhatsApp o identificar clientes VIP e inactivos.

## 3. Datos Requeridos
Historial de compras, fechas, montos y tipos de productos adquiridos.

## 4. Procedimiento Paso a Paso
1. Segmentar según reglas:
   - new_customer: 1 compra.
   - repeat_customer: 2 a 4 compras.
   - vip_customer: 5+ compras o volumen > $10,000 MXN.
   - inactive_customer: Sin compras en > 30 días.
   - high_value_customer: Ticket promedio > $2,500 MXN.
   - professional_detailer: Compras recurrentes de galones y línea Pro.
   - carwash: Compras de shampoos industriales (V-Mol 20L/Alumax).
   - retail_customer: Compras de presentaciones de 500ml.

## 5. Formato de Respuesta
Distribución de clientes por segmento con cantidades porcentuales y oportunidad comercial para cada segmento.

## 6. Reglas de Seguridad
Acción READ. No envía mensajes sin aprobación.

## 7. Posibles Errores y Manejo de Contingencias
Clientes nuevos que no han tenido tiempo suficiente para caer en cohortes de recompra.
