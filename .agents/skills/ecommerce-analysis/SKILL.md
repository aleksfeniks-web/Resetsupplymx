# Skill: Ecommerce Analysis

## 1. Propósito
Evaluar el rendimiento exclusivo de la tienda en línea resetsupplymx.com.

## 2. Cuándo Usar Esta Skill
Cuando se pregunte por ventas web, pedidos de Stripe, carritos o envíos nacionales.

## 3. Datos Requeridos
Órdenes de Stripe/Firestore con montos amountTotal, estado del pedido, guías de envío y destinos.

## 4. Procedimiento Paso a Paso
1. Filtrar pedidos originados en canal online.
2. Calcular volumen de ventas, número de pedidos y ticket promedio online.
3. Contabilizar pedidos pendientes de empaque y guía de envío.
4. Evaluar los principales estados de la república a los que se envía.

## 5. Formato de Respuesta
Ventas online totales en MXN, pedidos completados vs pendientes, ticket promedio web y foco logístico urgente.

## 6. Reglas de Seguridad
Acción READ. Cancelar pedidos o emitir reembolsos en Stripe requiere confirmación CRITICAL.

## 7. Posibles Errores y Manejo de Contingencias
Intentos de pago no completados registrados como órdenes exitosas (deben filtrarse por estado de pago).
