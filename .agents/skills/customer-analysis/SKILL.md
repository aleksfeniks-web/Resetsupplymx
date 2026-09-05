# Skill: Customer Analysis

## 1. Propósito
Comprender la cartera de clientes, su frecuencia de compra y valor en el tiempo (LTV).

## 2. Cuándo Usar Esta Skill
Al consultar por quiénes son los mejores clientes, cuándo compraron por última vez o qué productos prefieren.

## 3. Datos Requeridos
Registros de clientes (pos_clients), historial de compras por cliente, fechas de última visita y montos acumulados.

## 4. Procedimiento Paso a Paso
1. Agrupar compras por cliente (ID o teléfono/RFC).
2. Calcular frecuencia de compra promedio (días entre visitas).
3. Determinar el valor de vida del cliente (monto total histórico).
4. Calcular días desde la última compra.

## 5. Formato de Respuesta
Total de clientes analizados, top clientes por volumen, ticket promedio por cliente y frecuencia de recompra estimada.

## 6. Reglas de Seguridad
Acción READ. Datos personales protegidos bajo principios de privacidad.

## 7. Posibles Errores y Manejo de Contingencias
Clientes registrados con nombres diferentes pero mismo teléfono, compras de mostrador registradas como "Público General".
