# Workflow: Auditoría de Inventario y Detección de Mermas

- **Comando Directo**: `/inventory-audit`
- **Descripción**: Compara el inventario teórico con las transacciones y conteos físicos.

---

## Procedimiento de Ejecución
1. Consultar el inventario registrado en la base de datos (stock actual).
2. Analizar el flujo de salidas por ventas registradas en POS y Web.
3. Contrastar con entradas de mercancía y ajustes manuales previos.
4. Identificar productos con discrepancias entre ventas teóricas y stock remanente.
5. Detectar productos con stock negativo o inconsistencias de variantes.
6. Identificar productos sin movimiento en más de 60 días para plan de liquidación.
7. Emitir un informe de auditoría con el valor monetario en riesgo y sugerencias de corrección.

---

## Políticas y Reglas de Seguridad
Acción RECOMMEND. Los ajustes definitivos al inventario requieren autorización WRITE.
