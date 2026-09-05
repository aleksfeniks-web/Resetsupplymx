# Workflow: Cierre Diario de Negocio

- **Comando Directo**: `/daily-close`
- **Descripción**: Genera el informe ejecutivo completo al concluir la jornada operativa.

---

## Procedimiento de Ejecución
1. Recopilar ventas brutas acumuladas de hoy en POS (tienda física) y Ecommerce Stripe.
2. Calcular número total de transacciones y ticket promedio combinado.
3. Desglosar los 3 productos con mayor número de unidades vendidas en el día.
4. Calcular la utilidad bruta estimada aplicando el margen estándar del 38%.
5. Evaluar inventario crítico: alertar sobre productos con stock <= 3 unidades o en cero.
6. Revisar pedidos pendientes de guía y solicitudes de facturación SAT sin timbrar.
7. Identificar anomalías o desviaciones de la meta diaria.
8. Formular exactamente 1 alerta urgente, 1 oportunidad de venta y 1 recomendación accionable inmediata.

---

## Políticas y Reglas de Seguridad
Acción READ. Formato estandarizado sin abreviaturas confusas.
