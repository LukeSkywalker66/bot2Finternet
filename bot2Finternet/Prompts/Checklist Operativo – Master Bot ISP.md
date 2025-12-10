 Checklist Operativo – Master Bot ISP
1. Inicio
- [ ] El bot muestra mensajes de bienvenida.
- [ ] Se inicia el bloque Validar Identidad inmediatamente después.

2. Bloque Validar Identidad
- [ ] Si ${dni_ingresado} está vacío → solicitar DNI/CUIT.
- [ ] Guardar el valor en ${dni_ingresado}.
- [ ] Si el usuario no es cliente → ${sector} = "Ventas", pasar al bloque Ventas.
- [ ] Si confirma identidad → ${nEsCliente} = True, continuar.
- [ ] Si niega identidad → ${nResetChat} = True, reiniciar flujo.

3. Bloque Router de Intenciones
- [ ] Analizar el mensaje inicial del cliente.
- [ ] Si menciona problemas → ${sector} = "Soporte".
- [ ] Si menciona consultas administrativas → ${sector} = "Administracion".
- [ ] Si manifiesta interés en contratar → ${sector} = "Ventas".
- [ ] Si no queda claro → ${sector} = "Otros".
- [ ] Actualizar ${sector} con mayor prioridad si aparece información más clara.

4. Bloque Soporte Técnico
- [ ] Confirmar que ${nEsCliente} = True.
- [ ] Preguntar cuál es el inconveniente principal.
- [ ] Guardar en ${nProblemaCliente}.
- [ ] Clasificar:
- Sin conexión → ${nTipoSoporte} = "Sin Conexión".
- Velocidad baja → ${nTipoSoporte} = "Velocidad".
- Intermitencia → ${nTipoSoporte} = "Intermitencia".
- Otro → ${nTipoSoporte} = "Otros".
- [ ] Pasar al flujo de diagnóstico correspondiente.

5. Bloque Administración
- [ ] Confirmar que ${nEsCliente} = True.
- [ ] Preguntar cuál es la gestión administrativa.
- [ ] Guardar en ${nConsultaAdmin}.
- [ ] Clasificar:
- Planes/precios → ${nTipoAdmin} = "Planes".
- Facturación/saldo → ${nTipoAdmin} = "Facturacion".
- Datos personales → ${nTipoAdmin} = "Datos".
- Traslado → ${nTipoAdmin} = "Traslado".
- Otro → ${nTipoAdmin} = "Otros".
- [ ] Pasar al flujo de gestión correspondiente.

6. Bloque Ventas
- [ ] Confirmar que ${nEsCliente} = False.
- [ ] Pasar al bot de ventas sin explicaciones adicionales.

7. Bloque Otros
- [ ] Si la intención no es clara → ${sector} = "Otros".
- [ ] Derivar a atención humana o flujo genérico
