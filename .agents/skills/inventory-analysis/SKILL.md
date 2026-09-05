# Skill: Inventory Analysis

## 1. Propósito
Auditar el estado actual del inventario, stock disponible y detectar desabastos o excesos.

## 2. Cuándo Usar Esta Skill
Cuando se requiera saber qué productos tienen bajo stock, cuántas unidades quedan o qué productos están agotados.

## 3. Datos Requeridos
Catálogo de productos con campos current_stock, categoría, precio y umbrales de stock mínimo.

## 4. Procedimiento Paso a Paso
1. Recorrer la lista de productos registrados en catálogo.
2. Identificar productos con stock = 0 (Agotados).
3. Identificar productos con stock <= minimum_stock (Críticos).
4. Calcular el porcentaje de disponibilidad del catálogo.
5. Generar lista priorizada de SKUs que requieren atención.

## 5. Formato de Respuesta
Total de SKUs evaluados, lista de productos agotados, lista de productos en stock crítico y porcentaje de salud del inventario.

## 6. Reglas de Seguridad
Acción READ. No modifica existencias en la base de datos.

## 7. Posibles Errores y Manejo de Contingencias
Discrepancias entre stock en memoria y Firestore (sincronizar antes de ejecutar), valores de stock nulos o no numéricos.
