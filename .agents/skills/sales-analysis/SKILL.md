# Skill: Sales Analysis

## 1. Propósito
Analizar el volumen, comportamiento y ritmo de ingresos de Reset Supply en todos los canales de venta.

## 2. Cuándo Usar Esta Skill
Cuando el usuario pregunte por ventas totales, ventas por canal, tendencias de facturación o pida un desglose del día/semana/mes.

## 3. Datos Requeridos
Listado de órdenes POS (pos_orders), órdenes ecommerce (orders), productos vendidos, montos totales y marcas de tiempo.

## 4. Procedimiento Paso a Paso
1. Filtrar órdenes dentro del rango de fechas solicitado.
2. Separar ventas por canal (POS mostrador vs Ecommerce web).
3. Calcular total de ventas, número de transacciones y ticket promedio.
4. Identificar productos más vendidos en el periodo.
5. Comparar contra el periodo anterior para calcular porcentaje de variación.

## 5. Formato de Respuesta
Encabezado del periodo analizado, total facturado en MXN, desglose por canal, ticket promedio, top 3 productos y conclusión ejecutiva.

## 6. Reglas de Seguridad
Acción READ. No modifica ningún registro financiero ni pedidos.

## 7. Posibles Errores y Manejo de Contingencias
Falta de registros en la fecha seleccionada (devolver $0.00 MXN sin romper la ejecución), órdenes canceladas contabilizadas por error (deben ser excluidas).
