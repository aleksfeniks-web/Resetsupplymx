# Skill: Profit Calculator

## 1. Propósito
Calcular la utilidad bruta estimada y márgenes comerciales de las ventas realizadas.

## 2. Cuándo Usar Esta Skill
Cuando se consulte por ganancias, utilidad bruta, margen comercial o rentabilidad de productos/pedidos.

## 3. Datos Requeridos
Ventas totales en MXN, costo estimado de adquisición de Vonixx (~62% del PVP), precios de venta y descuentos aplicados.

## 4. Procedimiento Paso a Paso
1. Obtener los ingresos brutos del periodo analizado.
2. Aplicar el factor de margen bruto estándar de detailing (~38%) o calcular costo unitario por producto.
3. Deducir descuentos o costos de envío no cobrados.
4. Calcular el porcentaje de margen real.
5. Alertar si el margen cae por debajo del 25%.

## 5. Formato de Respuesta
Monto de ventas totales, utilidad bruta en MXN, porcentaje de margen bruto obtenido y diagnóstico de rentabilidad.

## 6. Reglas de Seguridad
Acción READ. Nunca altera los costos base en la base de datos.

## 7. Posibles Errores y Manejo de Contingencias
Costos no registrados para productos nuevos (usar estimación del 62% por defecto), productos con promociones agresivas con margen negativo.
