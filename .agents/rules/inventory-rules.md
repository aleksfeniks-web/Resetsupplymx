# Reglas de Inventario — Reset Supply MX

## Conceptos y Fórmulas Obligatorias

1. **`current_stock`**:
   - Stock físico disponible actualmente en almacén y mostrador.
   - `stock = 0` se clasifica como `AGOTADO`.

2. **`minimum_stock`**:
   - Nivel de seguridad mínimo para amortiguar retrasos del proveedor.
   - `minimum_stock = Math.max(3, Math.ceil(sales_velocity * 4))` (mínimo 3 unidades o 4 días de demanda).

3. **`sales_velocity`**:
   - Velocidad de venta promedio diaria expresada en `piezas/día`.
   - Calculada a partir de los pedidos de mostrador y web en la ventana de tiempo activa (7 a 30 días).

4. **`days_of_inventory`**:
   - Días de inventario disponible antes de agotar existencias:
     `days_of_inventory = current_stock / sales_velocity`.
   - Si `days_of_inventory <= 3` y `current_stock > 0`, se clasifica como `RIESGO_CRÍTICO`.
   - Si `days_of_inventory > 60`, se clasifica como `EXCESO_INVENTARIO`.

5. **`reorder_point`**:
   - Umbral en el que se debe generar la recomendación de compra considerando tiempo de entrega del proveedor (~3 días):
     `reorder_point = Math.ceil((sales_velocity * 3) + minimum_stock)`.

6. **`recommended_order`**:
   - Cantidad sugerida para cubrir 21 días (3 semanas) de demanda proyectada:
     `recommended_order = Math.max(6, Math.ceil(((21 * sales_velocity) + minimum_stock - current_stock) / 6) * 6)`.
   - Si `current_stock > reorder_point`, `recommended_order = 0`.

## Reglas de Seguridad Operativa
- **Cero Órdenes Automáticas**: Los agentes de IA NUNCA crean órdenes de compra hacia el proveedor de manera autónoma.
- **Autorización Expresa**: Toda recomendación de compra requiere confirmación humana directa mediante botón de aprobación o comando explícito.
- **Empaque Mayorista**: Las recomendaciones de recompra deben redondearse a cajas cerradas o múltiplos de 6/12 piezas para optimizar fletes de Vonixx.
