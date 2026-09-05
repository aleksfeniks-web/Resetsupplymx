# Reglas Financieras — Reset Supply MX

## Estructura de Costos y Márgenes
- **Costo Mayorista Estimado**: ~62% del precio de lista retail para productos Vonixx Oficial.
- **Margen Bruto Promedio Objetivo**: ~38% sobre ventas brutas.
- **Margen Mínimo Tolerable**: 22% (para liquidaciones autorizadas o paquetes de gran volumen).
- **Prohibición de Venta a Pérdida**: Ningún agente puede sugerir promociones, bundles o precios con margen negativo (< 0%) salvo autorización explícita por escrito del administrador.

## Moneda y Formato
- Todas las cifras monetarias deben expresarse en Pesos Mexicanos (`MXN`) con formato `$#,##0.00 MXN`.
- Los impuestos (IVA 16%) se consideran desglosados en compras y ventas formales.

## Métricas de Desempeño Financiero
- **Ventas Brutas Diarias**: Suma de ingresos POS + Ecommerce Stripe.
- **Ticket Promedio**: `Ventas Totales / Número de Transacciones`.
- **Utilidad Bruta Estimada**: `Ventas Totales * 0.38`.
- **Presupuesto de Reabastecimiento**: El capital asignado a recompras debe priorizar productos con `days_of_inventory <= 5` y `sales_velocity > 0`.
