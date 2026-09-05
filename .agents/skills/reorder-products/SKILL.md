# Skill: Reorder Products

## 1. Propósito
Generar la propuesta matemática de reabastecimiento al proveedor Vonixx México Oficial.

## 2. Cuándo Usar Esta Skill
Al ejecutar /reorder o cuando el usuario pregunte qué productos debe comprar y cuánto presupuesto requiere.

## 3. Datos Requeridos
current_stock, minimum_stock, sales_velocity, reorder_point, días de cobertura objetivo (21 días), costo unitario estimado.

## 4. Procedimiento Paso a Paso
1. Calcular para cada producto su sales_velocity y reorder_point.
2. Seleccionar productos donde current_stock <= reorder_point.
3. Calcular recommended_order = (21 * sales_velocity) + minimum_stock - current_stock.
4. Redondear a múltiplos de cajas (6 o 12 piezas).
5. Estimar la inversión total requerida.

## 5. Formato de Respuesta
Tabla o listado con producto, current_stock, reorder_point, recommended_order, costo estimado y total de presupuesto necesario. Incluye advertencia de autorización.

## 6. Reglas de Seguridad
Acción RECOMMEND. NUNCA realiza la orden automáticamente. Requiere confirmación expresa del usuario.

## 7. Posibles Errores y Manejo de Contingencias
Velocidad de venta distorsionada por picos únicos, proveedores sin disponibilidad del SKU sugerido.
