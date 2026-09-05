# Workflow: Propuesta de Reabastecimiento al Proveedor

- **Comando Directo**: `/reorder`
- **Descripción**: Calcula matemáticamente la necesidad de reposición de stock sin crear órdenes automáticas.

---

## Procedimiento de Ejecución
1. Recorrer el catálogo y extraer current_stock de cada SKU.
2. Calcular la sales_velocity (unidades vendidas/día) con base en ventas POS y Web.
3. Calcular days_of_inventory proyectados para cada producto.
4. Determinar minimum_stock y reorder_point considerando 3 días de entrega de Vonixx.
5. Filtrar productos con current_stock <= reorder_point.
6. Calcular recommended_order para alcanzar 21 días de cobertura, redondeando a cajas de 6/12 piezas.
7. Estimar el costo total de reposición en MXN con base en precios mayoristas (~62% PVP).
8. Presentar la advertencia de seguridad indicando que la orden requiere autorización explícita.
9. Proporcionar la opción de autorizar la orden mediante confirmación o botón dedicado.

---

## Políticas y Reglas de Seguridad
Acción RECOMMEND. NUNCA crear órdenes de compra automáticamente en el sistema del proveedor.
