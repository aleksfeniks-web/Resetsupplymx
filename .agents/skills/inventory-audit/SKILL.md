# Skill: Inventory Audit

## 1. Propósito
Comparar el inventario teórico con las ventas registradas y detectar posibles mermas o diferencias.

## 2. Cuándo Usar Esta Skill
Al ejecutar /inventory-audit o realizar auditorías de almacén periódicas.

## 3. Datos Requeridos
Stock registrado, movimientos de venta POS/Web, entradas de mercancía registradas y conteos físicos.

## 4. Procedimiento Paso a Paso
1. Tomar el stock base registrado.
2. Restar las ventas acumuladas por producto.
3. Sumar entradas de resurtido.
4. Comparar el saldo resultante contra el stock actual para detectar faltantes o mermas.
5. Alertar sobre discrepancias significativas.

## 5. Formato de Respuesta
Diagnóstico de auditoría, total de SKUs auditados, discrepancias detectadas, valor monetario en riesgo y protocolo de ajuste físico sugerido.

## 6. Reglas de Seguridad
Acción RECOMMEND. Los ajustes manuales en Firestore requieren confirmación WRITE.

## 7. Posibles Errores y Manejo de Contingencias
Falta de registro manual de compras al ingresar mercancía al almacén.
