# Políticas de Seguridad — Reset Supply MX

## Principios Fundamentales
1. **Control Humano en el Bucle (Human-in-the-Loop)**:
   - Ninguna acción con impacto monetario, contractual o de inventario físico se ejecuta sin la confirmación voluntaria del administrador humano.
2. **Autenticación Administrativa**:
   - Todo acceso a endpoints `/api/admin/agent/*` requiere validación de token JWT de administrador en el encabezado `Authorization: Bearer <token>`.
   - Las solicitudes sin credencial válida reciben respuesta de contingencia local sin comprometer datos confidenciales.
3. **Privacidad de Clientes (LFPDPPP)**:
   - Los números telefónicos y correos electrónicos de clientes nunca se exponen públicamente en los dashboards ni se envían a servicios externos no autorizados.
   - Las recomendaciones de campañas generan borradores para que el administrador decida el envío.
4. **Registro de Auditoría (Audit Log)**:
   - Cada autorización de orden de compra o cambio de precio genera un folio con timestamp ISO, identidad del usuario y estado de ejecución.
