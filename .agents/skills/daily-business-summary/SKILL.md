# Skill: Daily Business Summary

## 1. Propósito
Generar el resumen ejecutivo diario para el dueño del negocio al cierre del día.

## 2. Cuándo Usar Esta Skill
Al ejecutar /daily-close o solicitar "¿Cómo estuvo hoy?".

## 3. Datos Requeridos
Ventas del día POS + Web, tickets, utilidad estimada, inventario crítico, pedidos pendientes.

## 4. Procedimiento Paso a Paso
1. Totalizar ventas de hoy.
2. Calcular utilidad estimada y ticket promedio.
3. Extraer top 3 productos vendidos hoy.
4. Identificar alerta más urgente (stock o pedidos).
5. Identificar 1 oportunidad y 1 recomendación accionable.

## 5. Formato de Respuesta
Formato estándar oficial Reset Supply: Ventas, Utilidad, Tickets, Ticket Promedio, Más Vendidos, ALERTA, OPORTUNIDAD, RECOMENDACIÓN.

## 6. Reglas de Seguridad
Acción READ.

## 7. Posibles Errores y Manejo de Contingencias
Consultar temprano en la mañana antes de abrir caja (indicar que la jornada apenas inicia).
