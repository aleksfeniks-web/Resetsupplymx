# Skill: POS Analysis

## 1. Propósito
Analizar el desempeño exclusivo del Punto de Venta físico (Mostrador Reset Supply).

## 2. Cuándo Usar Esta Skill
Cuando se consulte por caja de mostrador, ventas físicas del día o efectividad en tienda.

## 3. Datos Requeridos
Órdenes de pos_orders con total, métodos de pago, cajero y hora de la transacción.

## 4. Procedimiento Paso a Paso
1. Filtrar transacciones del POS del día o periodo.
2. Sumar ingresos totales en mostrador.
3. Desglosar por método de pago (Efectivo vs Tarjeta vs Transferencia).
4. Calcular horas pico de afluencia en tienda.

## 5. Formato de Respuesta
Corte de caja POS, número de tickets, ticket promedio físico, desglose por método de pago y recomendaciones operativas.

## 6. Reglas de Seguridad
Acción READ.

## 7. Posibles Errores y Manejo de Contingencias
Cobros no registrados por caída de red en terminal bancaria.
