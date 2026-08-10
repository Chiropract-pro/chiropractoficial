/**
 * El manual del sistema, dentro del sistema.
 *
 * POR QUÉ VIVE AQUÍ
 * Un manual en un PDF aparte no lo abre nadie: cuando la recepcionista tiene la
 * duda, tiene el CRM delante, no el correo donde llegó el archivo. Además cada
 * rol usa pantallas distintas — mostrarle a un paciente cómo cerrar una jornada
 * es ruido, y esconderle al dueño cómo cambiar las tarifas es un vacío.
 *
 * El contenido está separado de la interfaz a propósito: para corregir una
 * frase no hace falta tocar un componente de React.
 *
 * Cada sección: { id, titulo, para, resumen, puntos[], pasos[], ojo }
 *   · `puntos` explica QUÉ es cada cosa
 *   · `pasos`  explica CÓMO se hace
 *   · `ojo`    es la trampa real de esa pantalla — lo que la gente reporta
 *              como falla cuando en realidad es comportamiento buscado
 */

/** A qué manual pertenece cada rol del equipo. */
export const ROL_A_MANUAL = {
  owner: 'admin',
  admin: 'admin',
  doctor: 'equipo',
  assistant: 'equipo',
  receptionist: 'equipo',
};

export const NOMBRE_DEL_ROL = {
  owner: 'Dueño del consultorio',
  admin: 'Administrador',
  doctor: 'Profesional',
  assistant: 'Asistente',
  receptionist: 'Recepción',
};

// ── Manual del paciente ─────────────────────────────────────────────────────
const PACIENTE = [
  {
    id: 'entrar',
    titulo: 'Entrar a su portal',
    resumen: 'No necesita contraseña. El acceso llega por WhatsApp cada vez.',
    pasos: [
      'Escriba su número de celular, el mismo que tiene registrado en el consultorio.',
      'Le llega un código de seis dígitos por WhatsApp.',
      'Escriba el código y entra.',
    ],
    ojo: 'Si el sistema dice que no encuentra su número, es porque el consultorio lo tiene registrado distinto —o no lo tiene—. Llame y pida que lo actualicen; no es un error suyo.',
  },
  {
    id: 'citas',
    titulo: 'Sus citas',
    resumen: 'Qué tiene agendado, cuándo y con quién.',
    puntos: [
      ['Próxima cita', 'Aparece de primera, con fecha, hora, profesional y lugar.'],
      ['Historial', 'Las citas que ya pasaron, para saber cuándo fue la última vez.'],
      ['Estado', 'Pendiente quiere decir que está solicitada; confirmada, que el consultorio ya la aprobó.'],
    ],
    pasos: [
      'Toque una cita para ver el detalle.',
      'Desde ahí puede pedir cambio de fecha o cancelarla.',
    ],
    ojo: 'Pedir un cambio no lo aplica solo: le llega la solicitud al consultorio y ellos confirman. Hasta que no le respondan, su cita original sigue en pie.',
  },
  {
    id: 'historia',
    titulo: 'Su historia clínica',
    resumen: 'Lo que el profesional registró en cada consulta.',
    puntos: [
      ['Evoluciones', 'Qué se encontró y qué se hizo en cada sesión.'],
      ['Archivos', 'Radiografías o exámenes que el consultorio haya adjuntado.'],
    ],
    ojo: 'Solo usted ve su historia. Está protegida por la Ley 1581 de 2012 y nadie más puede consultarla con su número.',
  },
  {
    id: 'pagar',
    titulo: 'Pagar y ver recibos',
    resumen: 'Si tiene saldo pendiente, puede pagarlo desde aquí.',
    pasos: [
      'En la pantalla principal aparece su saldo, si tiene alguno.',
      'Toque Pagar y se abre una página segura donde elige tarjeta, PSE o Nequi.',
      'Al confirmarse el pago, el recibo le llega solo.',
    ],
    ojo: 'El enlace de pago vence a las 24 horas. Si se le pasó el tiempo, vuelva a entrar y genere uno nuevo: el anterior deja de servir por seguridad, no porque algo haya fallado.',
  },
  {
    id: 'jornadas-paciente',
    titulo: 'Jornadas en su ciudad',
    resumen: 'Cuando el consultorio viaja a atender fuera de Bogotá.',
    pasos: [
      'Si hay una jornada programada en su ciudad, aparece en la pantalla principal.',
      'Toque Reservar cupo para separar su hora.',
    ],
    ojo: 'Los cupos son limitados y se agotan. Reservar no es lo mismo que pagar: el pago se hace el día de la atención o por el enlace que le envíen.',
  },
];

// ── Manual del equipo (profesional, asistente, recepción) ───────────────────
const EQUIPO = [
  {
    id: 'moverte',
    titulo: 'Cómo moverse',
    resumen: 'El menú de la izquierda, el buscador y el celular.',
    puntos: [
      ['Menú lateral', 'En computador está siempre visible. Se puede plegar con Colapsar para ganar espacio.'],
      ['Buscador', 'Con ⌘K o Ctrl+K se abre en cualquier momento: busca pacientes y salta a cualquier pantalla.'],
      ['Celular', 'Las cuatro pantallas más usadas quedan en la barra de abajo; el resto está en Más.'],
    ],
  },
  {
    id: 'panel',
    titulo: 'Panel',
    resumen: 'El resumen del día: con qué arrancar la mañana.',
    puntos: [
      ['Pacientes hoy', 'Cuántas citas hay y cuántas siguen sin confirmar.'],
      ['Lo que sigue', 'La próxima cita, con hora y nombre.'],
      ['Meta del mes', 'Cuánto se ha facturado y cuánto falta.'],
      ['Por recuperar', 'Lo que el Radar estima que se puede rescatar llamando a pacientes dormidos.'],
    ],
  },
  {
    id: 'citas',
    titulo: 'Citas',
    resumen: 'Agendar, confirmar, completar, cobrar y dejar la nota clínica.',
    pasos: [
      'Nueva cita: elija paciente, tipo, fecha, hora y lugar. El precio se muestra al elegir el tipo.',
      'Confirmar: cuando el paciente responde que sí viene.',
      'Completar: cuando ya se atendió.',
      'Nota SOAP: se escribe desde la cita, y queda en la historia del paciente.',
    ],
    ojo: 'Completada no significa pagada. Son dos cosas distintas: una cita puede quedar completada y con saldo pendiente. El cobro se hace aparte, con el botón Cobrar.',
  },
  {
    id: 'pacientes',
    titulo: 'Pacientes',
    resumen: 'El archivador: buscar, crear, editar y cobrar.',
    pasos: [
      'Busque por nombre o número; los filtros de estado y ciudad afinan la lista.',
      'Toque una fila para abrir la ficha completa con su historia y archivos.',
      'El botón Cobrar de cada fila genera el enlace de pago sin tener que entrar a la ficha.',
    ],
    ojo: 'Al cobrar, el monto viene propuesto —el saldo que debe, o la tarifa de seguimiento si no debe nada— pero se puede cambiar antes de generar. Sirve igual para un abono parcial.',
  },
  {
    id: 'cobrar',
    titulo: 'Cobrar con enlace de pago',
    resumen: 'Generar el cobro y hacérselo llegar al paciente.',
    pasos: [
      'Toque Cobrar, revise el monto y el concepto, y genere el enlace.',
      'Use WhatsApp para abrir el chat del paciente con el mensaje ya escrito, o Copiar para pegarlo donde quiera.',
      'Cuando el paciente paga, la venta se registra sola y la cita queda cerrada.',
    ],
    ojo: 'El enlace vence a las 24 horas. Si el paciente llama diciendo que «no le sirve el link», casi siempre es eso: genere uno nuevo, no es una falla. Y si el paciente no tiene celular registrado, el sistema avisa antes y copia el mensaje completo en vez de abrir WhatsApp.',
  },
  {
    id: 'radar',
    titulo: 'Reactivación — el Radar',
    resumen: 'A quién llamar hoy, y por qué.',
    puntos: [
      ['Con saldo', 'Deben plata. Se les cobra.'],
      ['Tratamiento interrumpido', 'Empezaron y no terminaron.'],
      ['Dormidos', 'Hace mucho que no vienen.'],
      ['Primera vez', 'Vinieron una sola vez y no volvieron.'],
    ],
    ojo: 'Un paciente desaparece de la lista si ya tiene cita futura, o si alguien lo contactó hace menos de 21 días. No es que el Radar lo haya perdido: es para no llamar dos veces a la misma persona, que es la forma más rápida de quemar la confianza.',
  },
  {
    id: 'conversaciones',
    titulo: 'Conversaciones',
    resumen: 'El WhatsApp del consultorio: lo que contesta el asistente y lo que escribe el equipo.',
    puntos: [
      ['Enviados y respuestas', 'Lo del día. Las respuestas son la cifra que dice si el canal sirve.'],
      ['Sin leer', 'Mensajes de pacientes que nadie ha abierto.'],
      ['Requieren humano', 'El paciente pidió hablar con una persona, o un mensaje no se pudo entregar.'],
    ],
    ojo: 'WhatsApp solo permite escribir libremente durante las 24 horas siguientes al último mensaje del paciente. Pasado ese tiempo el cuadro se bloquea: es la norma de la plataforma, no una falla del programa.',
  },
  {
    id: 'finanzas',
    titulo: 'Finanzas',
    resumen: 'Ingresos por periodo, fuentes, ciudades y cobros pendientes.',
    pasos: [
      'Elija el periodo arriba: Hoy, Este mes, Mes pasado, 3 meses, Este año o un rango propio.',
      'Todo lo de abajo corresponde a ese periodo, incluida la exportación.',
      'Movimientos del periodo muestra cada cobro con su detalle.',
    ],
    ojo: 'La meta solo aparece cuando el periodo son meses completos. Con Hoy o un rango suelto, la tarjeta cambia a Resumen: comparar tres días contra una meta mensual no diría nada útil.',
  },
  {
    id: 'jornadas',
    titulo: 'Jornadas',
    resumen: 'Las salidas a atender en otra ciudad.',
    ojo: 'Crear la jornada no agenda a nadie: solo abre los cupos. Los pacientes se agendan uno por uno desde Citas, escogiendo esa ciudad. Por eso una jornada recién creada aparece siempre en 0 de N.',
  },
  {
    id: 'productos',
    titulo: 'Productos y servicios',
    resumen: 'El catálogo y el punto de venta.',
    ojo: 'El inventario solo baja cuando la venta se registra aquí. Si se entrega un producto y se cobra por otro lado, el stock queda descuadrado.',
  },
];

// ── Manual del administrador: lo del equipo, más la configuración ───────────
const SOLO_ADMIN = [
  {
    id: 'ajustes-consultorio',
    titulo: 'Datos del consultorio',
    resumen: 'Lo que aparece en recibos, correos y el perfil público.',
    ojo: 'La dirección web del perfil público no se puede cambiar después de creada: es el enlace que ya se compartió con pacientes.',
  },
  {
    id: 'ajustes-tarifas',
    titulo: 'Tarifas',
    resumen: 'Cuánto se cobra por cada tipo de cita.',
    pasos: [
      'Ajustes → Tarifas. Se fija el precio de primera consulta, seguimiento, jornada y urgencia.',
      'Debajo de cada campo aparece el valor en pesos, para confirmar que no sobra ni falta un cero.',
    ],
    ojo: 'Cambiar una tarifa no cambia las citas ya agendadas: cada cita guarda el precio con el que se creó. Es a propósito — quien agendó antes mantiene lo que se le prometió.',
  },
  {
    id: 'ajustes-equipo',
    titulo: 'Equipo y permisos',
    resumen: 'Quién tiene acceso y con qué rol.',
    puntos: [
      ['Dueño y administrador', 'Ven y cambian todo, incluidas tarifas, facturación y plan.'],
      ['Profesional, asistente, recepción', 'El día a día: agenda, pacientes, cobros y conversaciones.'],
    ],
    ojo: 'Invitar a alguien le da acceso a las historias clínicas de todos los pacientes. Invite solo a quien deba verlas.',
  },
  {
    id: 'ajustes-facturacion',
    titulo: 'Facturación electrónica',
    resumen: 'La conexión con la DIAN a través de Alegra.',
    ojo: 'Mientras no se configuren las credenciales, las ventas se registran igual pero no se emite factura electrónica. El sistema no avisa solo: hay que revisarlo.',
  },
  {
    id: 'ajustes-plan',
    titulo: 'Plan y suscripción',
    resumen: 'Qué plan está activo, cuántos pacientes y usuarios permite, y cuándo renueva.',
  },
];

export const MANUALES = {
  paciente: {
    titulo: 'Manual del paciente',
    subtitulo: 'Cómo usar su portal',
    secciones: PACIENTE,
  },
  equipo: {
    titulo: 'Manual del equipo',
    subtitulo: 'El día a día del consultorio',
    secciones: EQUIPO,
  },
  admin: {
    titulo: 'Manual del administrador',
    subtitulo: 'Todo lo del equipo, más la configuración',
    secciones: [...EQUIPO, ...SOLO_ADMIN],
  },
};

/** Qué manual le toca a un rol. Ante la duda, el más restringido. */
export function manualPara(rol) {
  return MANUALES[ROL_A_MANUAL[rol] || 'equipo'];
}
