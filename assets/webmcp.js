/**
 * ============================================================================
 * WebMCP - Asistente Inteligente de Productos Vonixx (Voz y Texto)
 * Reset Supply MX — Distribuidor Autorizado Vonixx en México
 * ============================================================================
 */

(function () {
  'use strict';

  const GIT_REPO_BASE = 'https://raw.githubusercontent.com/aleksfeniks-web/reset_catalogo_fotos/main/';
  const WHATSAPP_NUMBER = '526634606566';

  // Base de conocimiento completa del catálogo oficial Vonixx
  const CATALOG_DATABASE = [
    {
      id: "VON-00001",
      name: "V10 – PULIMENTO DE CORTE",
      category: "pulimentos-blando",
      price: 380.00,
      image: GIT_REPO_BASE + "V10.png",
      keywords: ["v10", "pulimento", "corte", "barniz blando", "rayones", "pulido"],
      description: "Pulimento de corte para barnices asiáticos y blandos. Elimina marcas de lija grano 1200 a 1500 rápidamente.",
      use: "Usar con pad de lana o espuma de corte pesado."
    },
    {
      id: "VON-00002",
      name: "V20 – PULIMENTO DE CORTE MEDIO",
      category: "pulimentos-blando",
      price: 360.00,
      image: GIT_REPO_BASE + "V20.png",
      keywords: ["v20", "corte medio", "pulido", "barniz blando", "refinado"],
      description: "Pulimento de corte medio para refinar y remover microrayones moderados en barnices blandos.",
      use: "Usar con pad de espuma de corte medio o corte suave."
    },
    {
      id: "VON-00003",
      name: "V30 – PULIMENTO DE ACABADO",
      category: "pulimentos-blando",
      price: 340.00,
      image: GIT_REPO_BASE + "V30.png",
      keywords: ["v30", "acabado", "lustre", "brillo", "hologramas"],
      description: "Pulimento de acabado final que elimina hologramas y microrayones leves, dejando un acabado espejo impecable.",
      use: "Usar con pad de acabado o lustro."
    },
    {
      id: "VON-00004",
      name: "V-CUT – PULIMENTO DE CORTE PREMIUM",
      category: "pulimentos-premium",
      price: 440.00,
      image: GIT_REPO_BASE + "V-CUT.png",
      keywords: ["v-cut", "vcut", "corte premium", "barniz duro", "barniz aleman"],
      description: "Compuesto pulidor de alto corte para barnices duros y de alta resistencia (línea alemana). Cero polvo.",
      use: "Usar con rotativa o roto-orbital y pad de lana."
    },
    {
      id: "VON-00005",
      name: "V-POLISH – PULIMENTO CORTE MEDIO PREMIUM",
      category: "pulimentos-premium",
      price: 420.00,
      image: GIT_REPO_BASE + "V-POLISH.png",
      keywords: ["v-polish", "vpolish", "corte medio", "barniz premium"],
      description: "Pulimento de corte medio y refinado para pinturas medias a duras con máxima claridad óptica.",
      use: "Usar con pad de espuma de corte medio."
    },
    {
      id: "VON-00006",
      name: "V-FINISH – PULIMENTO DE SUPER LUSTRO PREMIUM",
      category: "pulimentos-premium",
      price: 395.00,
      image: GIT_REPO_BASE + "V-FINISH.png",
      keywords: ["v-finish", "vfinish", "super lustro", "acabado final"],
      description: "Pulimento de super acabado para remover micro-swirls y brindar profundidad de brillo extrema.",
      use: "Usar con pad de super lustro."
    },
    {
      id: "VON-00007",
      name: "BLEND ALL IN ONE – PULIMENTO 3 EN 1",
      category: "productos-3-en-1",
      price: 485.00,
      image: GIT_REPO_BASE + "BLENDALLINONE.png",
      keywords: ["blend all in one", "aio", "3 en 1", "corte brillo proteccion", "carnauba sio2"],
      description: "Pulimento de un solo paso que corta microrayones, abrillanta y protege con SiO2 y Carnaúba hasta por 4 meses.",
      use: "Ideal para servicios rápidos de pulido comercial y abrillantado."
    },
    {
      id: "VON-00008",
      name: "V40 – PULIMENTO 4 EN 1",
      category: "productos-3-en-1",
      price: 375.00,
      image: GIT_REPO_BASE + "V40.png",
      keywords: ["v40", "4 en 1", "corte", "refinado", "lustro", "proteccion"],
      description: "Pulimento versátil que corta, refina, lustra y protege variando el pad utilizado.",
      use: "Funciona como corte con lana, refinado con espuma media y abrillantado con espuma suave."
    },
    {
      id: "VON-00017",
      name: "MAKKER – ELIMINADOR DE REMOLINOS Y ABRILLANTADOR",
      category: "abrillantadores",
      price: 365.00,
      image: GIT_REPO_BASE + "MAKKER%202.0.png",
      keywords: ["makker", "glaze", "abrillantador", "rellenador", "ocultar rayones"],
      description: "Glaze abrillantador que disimula microrayones y remolinos, aportando brillo profundo sin necesidad de pulir.",
      use: "Aplicar a mano o con roto-orbital y pad suave."
    },
    {
      id: "VON-00018",
      name: "BLEND METAL POLISH – PULIMENTO PARA METALES",
      category: "pulidor-metal",
      price: 290.00,
      image: GIT_REPO_BASE + "Alumax%2020L.png",
      keywords: ["metal polish", "cromo", "aluminio", "escape", "metales"],
      description: "Pulimento especializado para restaurar brillo en rines pulidos, escapes de acero inoxidable, cromo y molduras metálicas.",
      use: "Aplicar con microfibra o pad de espuma y frotar hasta retirar la oxidación."
    },
    {
      id: "VON-00042",
      name: "V-MOL 1.5 L",
      category: "shampoo",
      price: 131.00,
      image: GIT_REPO_BASE + "V-MOL%201.5L.png",
      keywords: ["vmol", "v-mol", "shampoo", "desincrustante", "suciedad pesada", "barro", "prelavado", "espuma", "ph alcalino"],
      description: "Shampoo desincrustante de alta concentración para eliminar suciedad pesada, barro, grasa y películas de carretera sin dañar la pintura.",
      use: "Ideal para prelavado y cañón de espuma (foam cannon). Dilución desde 1:10 en suciedad pesada hasta 1:100 en mantenimiento."
    },
    {
      id: "VON-00026",
      name: "V-FLOC (SHAMPOO PH NEUTRO)",
      category: "shampoo",
      price: 91.00,
      image: GIT_REPO_BASE + "V-FLOC-500ML.png",
      keywords: ["vfloc", "v-floc", "shampoo", "neutro", "ph neutro", "lavado seguro", "espuma", "mantenimiento"],
      description: "Shampoo de pH neutro con agentes acondicionadores de alto rendimiento y lubricación superior para evitar microrayones (swirls).",
      use: "Excelente poder de espuma y lubricación. No remueve ceras ni selladores previos. Dilución 1:400."
    },
    {
      id: "VON-00097",
      name: "HYDROX WASH 500ML",
      category: "shampoo",
      price: 269.00,
      image: GIT_REPO_BASE + "HYDROX%20WASH.png",
      keywords: ["hydrox wash", "shampoo ceramico", "sio2", "proteccion", "repelencia", "brillo"],
      description: "Shampoo cerámico formulado con SiO2 que limpia, revitaliza y agrega protección hidrofóbica durante el lavado regular.",
      use: "Aumenta la repelencia al agua en vehículos con tratamientos cerámicos o ceras previas."
    },
    {
      id: "VON-00072",
      name: "ALUMAX – DESINCRUSTANTE ÁCIDO",
      category: "limpieza",
      price: 1237.00,
      image: GIT_REPO_BASE + "Alumax%2020L.png",
      keywords: ["alumax", "desincrustante", "acido", "rines", "aluminio", "motor", "chasis"],
      description: "Desincrustante ácido concentrado para eliminar suciedad inorgánica severa, óxido y hollín en rines de aluminio y partes de chasis.",
      use: "Uso exclusivo en metales sin pulir y chasis. Diluir 1:10 según la intensidad de la suciedad."
    },
    {
      id: "VON-00084",
      name: "REMOVEX – LIMPIADOR DE CHASIS",
      category: "limpieza",
      price: 994.00,
      image: GIT_REPO_BASE + "REMOVEX.png",
      keywords: ["removex", "desengrasante", "chasis", "motor", "grasa pesada", "aceite"],
      description: "Desengrasante de alta potencia diseñado para remover grasa, aceite y tierra en motores, chasis y carrocerías de camiones.",
      use: "Aplicar pulverizado, dejar actuar unos minutos y enjuagar con agua a presión."
    },
    {
      id: "VON-00067",
      name: "V-ECO FAST – LAVADO ECOLÓGICO EN SECO",
      category: "limpieza",
      price: 85.00,
      image: GIT_REPO_BASE + "V-ECO%20FAST.png",
      keywords: ["veco", "v-eco", "lavado en seco", "ecologico", "sin agua", "cera"],
      description: "Lavado ecológico listo para usar con cera de carnaúba. Permite lavar el auto sin una sola gota de agua, aportando brillo y protección.",
      use: "Rociar sobre el panel y retirar con toalla de microfibra limpia en una sola dirección."
    },
    {
      id: "VON-00039",
      name: "IZER – REMOVEDOR DE ÓXIDO Y FÉRREO",
      category: "limpieza",
      price: 116.00,
      image: GIT_REPO_BASE + "IZER.png",
      keywords: ["izer", "descontaminante", "ferreo", "oxido", "rines", "polvo de frenos", "morado"],
      description: "Descontaminante férreo con pH neutro que disuelve el polvo de frenos y partículas de óxido adheridas en rines y pintura. Cambia a color morado al actuar.",
      use: "Rociar en rines fríos, esperar 2-3 minutos a que vire a color púrpura y enjuagar con agua a presión."
    },
    {
      id: "VON-00040",
      name: "STRIKE – REMOVEDOR DE ALQUITRÁN",
      category: "limpieza",
      price: 193.00,
      image: GIT_REPO_BASE + "STRIKE.png",
      keywords: ["strike", "alquitran", "brea", "pegamento", "adhesivos", "asfalto"],
      description: "Formula solvente de acción rápida para eliminar manchas de alquitrán, asfalto, brea, goma de mascar y residuos de pegamento de calcomanías.",
      use: "Rociar sobre la mancha, dejar actuar 1 minuto y retirar con microfibra."
    },
    {
      id: "VON-00041",
      name: "IMPACT – DESENGRASANTE MULTIUSOS",
      category: "limpieza",
      price: 225.00,
      image: GIT_REPO_BASE + "IMPACT.png",
      keywords: ["impact", "desengrasante", "multiusos", "apc", "motor", "rines", "llantas"],
      description: "Desengrasante ecológico multiusos no corrosivo, ideal para limpieza pesada de motor, tolvas, rines y superficies exteriores con grasa.",
      use: "Dilución 1:1 a 1:50 según la superficie. Seguro en plásticos, metales y hules."
    },
    {
      id: "VON-00027",
      name: "DELET – LIMPIADOR DE CAUCHO Y PLÁSTICOS",
      category: "limpieza",
      price: 109.00,
      image: GIT_REPO_BASE + "DELET.png",
      keywords: ["delet", "limpiador de llantas", "caucho", "plasticos", "espuma blanca", "cafe"],
      description: "Limpiador de alto rendimiento para neumáticos y plásticos. Remueve la película marrón/café del caucho dejándolo impecable para el abrillantador.",
      use: "Rociar en la llanta seca, tallar con cepillo hasta que la espuma blanca cambie a marrón y enjuagar."
    },
    {
      id: "VON-00028",
      name: "SINTRA FAST – LIMPIADOR DE INTERIORES",
      category: "limpieza",
      price: 98.00,
      image: GIT_REPO_BASE + "SINTRA%20FAST.png",
      keywords: ["sintra fast", "interiores", "tapiceria", "tablero", "apc interior", "bactericida", "listo para usar"],
      description: "Limpiador universal multiusos bactericida listo para usar en tableros, plásticos, telas, asientos y techo. Elimina suciedad, grasa y bacterias.",
      use: "Pulverizar en microfibra o cepillo suave, frotar y secar con toalla limpia."
    },
    {
      id: "VON-00029",
      name: "SINTRA PRO – LIMPIADOR INTERIORES CONCENTRADO",
      category: "limpieza",
      price: 246.00,
      image: GIT_REPO_BASE + "SINTRA-PRO.png",
      keywords: ["sintra pro", "concentrado", "interiores", "tapiceria", "extractora", "profesional"],
      description: "Versión concentrada profesional de Sintra para autolavados y detailers. Elimina manchas de aceite, grasa y malos olores en interiores.",
      use: "Dilución desde 1:5 para manchas pesadas hasta 1:60 para limpieza de mantenimiento."
    },
    {
      id: "VON-00091",
      name: "BACTRAN 1.5L – SISTEMA VSC",
      category: "vsc",
      price: 113.00,
      image: GIT_REPO_BASE + "BACTRAN%201.5L.png",
      keywords: ["bactran", "vsc", "tapizados", "desinfectante", "bactericida", "sangre", "sudor", "moho"],
      description: "Paso 1 del Sistema VSC: Limpiador bactericida 7 en 1 de alta alcalinidad para eliminar manchas biológicas (sangre, sudor, orina, moho) en telas.",
      use: "Paso inicial en el lavado de vestiduras. Diluir 1:20 a 1:60."
    },
    {
      id: "VON-00093",
      name: "EXTRACTUS 1.5L – SISTEMA VSC",
      category: "vsc",
      price: 107.00,
      image: GIT_REPO_BASE + "EXTRACTUS%201.5L.png",
      keywords: ["extractus", "vsc", "extractora", "baja espuma", "tapiceria", "alfombras"],
      description: "Paso 2 del Sistema VSC: Detergente ultra concentrado de baja espuma formulado especialmente para máquinas de inyección-succión y extractoras.",
      use: "Colocar en el depósito de la máquina extractora con dilución de 1:30 a 1:60."
    },
    {
      id: "VON-00104",
      name: "SANITIZANTE FINALIZADOR 1.5L – VSC",
      category: "vsc",
      price: 118.00,
      image: GIT_REPO_BASE + "SANITIZANTE%201.5L.png",
      keywords: ["sanitizante", "vsc", "finalizador", "neutralizador", "suavizante", "olor"],
      description: "Paso 3 del Sistema VSC: Neutraliza el pH de las fibras, elimina malos olores y sella contra nuevas bacterias dejando las telas suaves.",
      use: "Aplicar como último paso en telas húmedas o secas. No requiere enjuague."
    },
    {
      id: "VON-00010",
      name: "BLEND PASTE WAX 100ML",
      category: "cera-pasta",
      price: 317.00,
      image: GIT_REPO_BASE + "BLEND%20CERAMIC%20%26%20CARNAUBA%20PASTE%20WAX.png",
      keywords: ["blend", "paste wax", "cera pasta", "sio2", "carnauba", "7 meses", "brillo calido"],
      description: "Cera híbrida que une la calidez del brillo de carnaúba brasileña con la resistencia hidrofóbica del SiO2. Hasta 7 meses de durabilidad.",
      use: "Aplicar con pad aplicador de espuma en capas finas, esperar 5 a 10 minutos y retirar con microfibra."
    },
    {
      id: "VON-00036",
      name: "CARNAUBA HYBRID WAX 240ML",
      category: "cera-pasta",
      price: 233.00,
      image: GIT_REPO_BASE + "CARNAUBA%20HYBRID%20WAX.png",
      keywords: ["carnauba hybrid", "cera pasta", "brillo", "proteccion", "polimeros"],
      description: "Cera en pasta elaborada con carnaúba pura y polímeros sintéticos que otorgan brillo profundo y protección contra intemperie de hasta 4 meses.",
      use: "Ideal para todo tipo de color de pintura, especialmente colores oscuros."
    },
    {
      id: "VON-00012",
      name: "NATIVE PASTE WAX",
      category: "cera-pasta",
      price: 638.00,
      image: GIT_REPO_BASE + "NATIVE.png",
      keywords: ["native", "carnauba pura", "show car", "brillo calido", "concours"],
      description: "La cera insignia de Vonixx: 50% de cera de carnaúba brasileña tipo 1 en volumen. Crea el brillo show car más cálido y profundo del mercado.",
      use: "Aplicación manual con esponja fina, curado de 3 a 5 minutos."
    },
    {
      id: "VON-00109",
      name: "CARNAUBA TOK FINAL 500ML",
      category: "cera-liquida",
      price: 139.00,
      image: GIT_REPO_BASE + "TOKFINAL.png",
      keywords: ["tok final", "cera liquida", "spray", "mantenimiento", "quick detailer", "brillo express"],
      description: "Cera líquida rápida formulada con carnaúba de fácil aplicación. Perfecta para dar el toque final después del lavado, eliminando polvo ligero.",
      use: "Rociar panel por panel sobre pintura limpia y seca, frotar con microfibra y voltear para dar brillo."
    },
    {
      id: "VON-00014",
      name: "NATIVE SPRAY WAX 500ML",
      category: "cera-liquida",
      price: 169.00,
      image: GIT_REPO_BASE + "NATIVE%20FAST.png",
      keywords: ["native spray", "cera spray", "carnauba liquida", "brillo premium"],
      description: "Cera en spray con carnaúba pura brasileña para mantenimiento del brillo entre encerados. No contiene abrasivos.",
      use: "Rociar y retirar con microfibra suave."
    },
    {
      id: "VON-00011",
      name: "CARNAUBA PLUS 500ML",
      category: "cera-liquida",
      price: 120.00,
      image: GIT_REPO_BASE + "PLUS.png",
      keywords: ["carnauba plus", "cera limpiadora", "limpia y encera", "oxigenada"],
      description: "Cera limpiadora que elimina micro-manchas e impurezas de la pintura mientras deposita una película protectora de carnaúba y brillo.",
      use: "Excelente opción 2 en 1: limpia y protege a mano o con pulidora orbital."
    },
    {
      id: "VON-00110",
      name: "CITRON 1.5L – SHAMPOO CÍTRICO",
      category: "shampoo",
      price: 275.00,
      image: GIT_REPO_BASE + "CITRON%201.5L.png",
      keywords: ["citron", "shampoo desengrasante", "citrico", "bichos", "insectos", "suciedad grasa"],
      description: "Shampoo desengrasante natural a base de extracto cítrico. Disuelve savia de árboles, insectos pegados y ceras viejas antes de un pulido.",
      use: "Dilución 1:10 a 1:40 en lavado manual o cañón de espuma."
    },
    {
      id: "VON-00095",
      name: "HYDROX FAST 500ML",
      category: "ceramicos",
      price: 110.00,
      image: GIT_REPO_BASE + "HYDROX%20FAST.png",
      keywords: ["hydrox fast", "sellador ceramico", "hidroreactivo", "enjuague", "sio2"],
      description: "Sellador cerámico hidroreactivo de aplicación instantánea. Se rocía sobre el auto mojado después de lavarlo y se activa con el chorro de agua.",
      use: "Sin frotar: rociar sobre auto mojado, enjuagar de inmediato con agua a presión y secar."
    },
    {
      id: "VON-00096",
      name: "HYDROX PRO – CERÁMICO PROFESIONAL",
      category: "ceramicos",
      price: 349.00,
      image: GIT_REPO_BASE + "HYDROX-PRO.png",
      keywords: ["hydrox pro", "ceramico", "hidroreactivo", "profesional", "alta durabilidad"],
      description: "Versión profesional de Hydrox con mayor concentración de SiO2 para talleres y detailers que buscan hasta 4 meses de repelencia extrema en minutos.",
      use: "Aplicar en vehículo recién enjuagado, activar con agua a presión."
    },
    {
      id: "VON-00098",
      name: "SINERGY PAINT 500ML",
      category: "ceramicos",
      price: 490.00,
      image: GIT_REPO_BASE + "SINERGY%20PAINT.png",
      keywords: ["sinergy paint", "sellador ceramico", "carbosit", "carbono y silicio", "12 meses"],
      description: "Sellador cerámico en spray para pintura con tecnología exclusiva CarboSilt (silicio y carbono). Otorga hasta 12 meses de repelencia y súper suavidad.",
      use: "Rociar en microfibra, aplicar en tramos de 50x50 cm y nivelar de inmediato con segunda toalla seca."
    },
    {
      id: "VON-00112",
      name: "SINERGY WHEEL 500ML",
      category: "ceramicos",
      price: 590.00,
      image: GIT_REPO_BASE + "SINERGY%20SHEEL.png",
      keywords: ["sinergy wheel", "ceramico rines", "alta temperatura", "polvo de frenos", "repelencia rines"],
      description: "Coating cerámico especializado para rines. Resiste temperaturas de más de 200°C evitando que el polvo de frenos se pegue al metal.",
      use: "Aplicar en rines descontaminados y secos. Facilita el lavado durante meses."
    },
    {
      id: "VON-00031",
      name: "RESTAURAX 500ML",
      category: "plasticos",
      price: 201.00,
      image: GIT_REPO_BASE + "RESTAURAX.png",
      keywords: ["restaurax", "restaurador de plasticos", "paragolpes", "molduras", "proteccion uv", "plasticos negros"],
      description: "El restaurador de plásticos exteriores e interiores más vendido. Revive molduras grises o quemadas por el sol, dejando un acabado negro mate no graso.",
      use: "Limpiar previamente con Delet, aplicar con aplicador de espuma y retirar exceso con microfibra."
    },
    {
      id: "VON-00032",
      name: "RESTAURAX EN AEROSOL 400ML",
      category: "plasticos",
      price: 245.00,
      image: GIT_REPO_BASE + "RESTAURAXAEROSOL.png",
      keywords: ["restaurax aerosol", "spray", "motor", "rejillas", "plasticos dificiles"],
      description: "Formato aerosol para áreas de difícil acceso como parrillas de panal, rejillas de ventilación y mangueras de motor. Acabado parejo instantáneo.",
      use: "Rociar a 20 cm de distancia sobre la superficie limpia y dejar secar."
    },
    {
      id: "VON-00117",
      name: "V-PLASTIC COATING CERÁMICO PARA PLÁSTICOS 50ML",
      category: "ceramicos",
      price: 780.00,
      image: GIT_REPO_BASE + "V-PLASTIC.png",
      keywords: ["vplastic", "v-plastic", "coating plasticos", "3 anos", "ceramico molduras"],
      description: "Vitrificador cerámico semi-permanente para plásticos nuevos o restaurados. Protege contra rayos UV y degradación por hasta 3 años.",
      use: "Aplicar con bloque y gamuza de aplicación en plásticos descontaminados."
    },
    {
      id: "VON-00033",
      name: "FLEXUS 500ML",
      category: "plasticos",
      price: 185.00,
      image: GIT_REPO_BASE + "FLEXUS.png",
      keywords: ["flexus", "plasticos internos", "tablero", "acabado satinado", "suavidad"],
      description: "Acondicionador premium para plásticos de interior. Deja un tacto seco, suave y olor agradable, protegiendo tableros contra cuarteaduras.",
      use: "Aplicar en microfibra y esparcir sobre tablero y puertas."
    },
    {
      id: "VON-00034",
      name: "INTENSE 500ML",
      category: "plasticos",
      price: 195.00,
      image: GIT_REPO_BASE + "INTENSE.png",
      keywords: ["intense", "plasticos interiores", "acabado natural", "mate", "antigrasa"],
      description: "Protector de interiores con acabado 100% mate original de fábrica. No añade brillo artificial ni atrae polvo.",
      use: "Ideal para autos nuevos o conductores que prefieren el acabado original seco."
    },
    {
      id: "VON-00062",
      name: "SHINY 500ML – ABRILLANTADOR DE LLANTAS",
      category: "llantas",
      price: 176.00,
      image: GIT_REPO_BASE + "SHINY.png",
      keywords: ["shiny", "llantas", "brillo humedo", "gel", "durabilidad", "efecto mojado"],
      description: "Gel abrillantador de llantas con brillo súper húmedo y profundo. Muy resistente al agua de lluvia, dura hasta 4 semanas.",
      use: "Aplicar con aplicador para llantas sobre caucho limpio (previamente lavado con Delet)."
    },
    {
      id: "VON-00061",
      name: "REVOX 500ML – ABRILLANTADOR SATINADO",
      category: "llantas",
      price: 136.00,
      image: GIT_REPO_BASE + "REVOX.png",
      keywords: ["revox", "llantas", "satinado", "tacto seco", "caucho nuevo"],
      description: "Abrillantador de llantas con acabado satinado elegante tipo llanta nueva de agencia. Fórmula a base de solvente que no escurre.",
      use: "Aplicar uniformemente sobre llanta seca."
    },
    {
      id: "VON-00106",
      name: "REXER 500ML – HIDROFÓBICO DE LLANTAS",
      category: "llantas",
      price: 182.00,
      image: GIT_REPO_BASE + "REXER.png",
      keywords: ["rexer", "repelente llantas", "hidrofobico", "repelente de lodo"],
      description: "Acondicionador para llantas con alta repelencia a agua y lodo. Evita que la tierra y el barro se incrusten en el costado del neumático.",
      use: "Aplicar capa delgada sobre caucho desengrasado."
    },
    {
      id: "VON-00035",
      name: "GLAZY 500ML – LIMPIADOR DE CRISTALES",
      category: "cristales",
      price: 105.00,
      image: GIT_REPO_BASE + "GLAZY.png",
      keywords: ["glazy", "limpiavidrios", "cristales", "sin manchas", "antiempanante"],
      description: "Limpiador de vidrios libre de amoniaco. Seguro en películas de polarizado, remueve grasa y huellas sin dejar rayas ni sombras.",
      use: "Rociar en microfibra tipo waffle y limpiar el cristal por ambos lados."
    },
    {
      id: "VON-00086",
      name: "FOCUS 240ML – REMOVEDOR DE SARRO EN VIDRIOS",
      category: "cristales",
      price: 139.00,
      image: GIT_REPO_BASE + "FOCUS.png",
      keywords: ["focus", "marcas de agua", "sarro", "gotas secas", "vidrios"],
      description: "Removedor químico de marcas de agua leves y sarro en parabrisas y ventanas laterales sin necesidad de pulir a máquina.",
      use: "Aplicar con toalla de microfibra en área pequeña, no dejar secar al sol y retirar inmediatamente."
    },
    {
      id: "VON-00111",
      name: "PRIZM 500ML – RESTAURADOR PROFUNDO DE CRISTALES",
      category: "cristales",
      price: 380.00,
      image: GIT_REPO_BASE + "PRIZM.png",
      keywords: ["prizm", "lluvia acida", "marcas de agua severas", "pulido de vidrios", "sarro extremo"],
      description: "El removedor definitivo de lluvia ácida y sarro incrustado en cristales automotrices. Restaura la claridad óptica total en parabrisas.",
      use: "Usar guantes de nitrilo. Aplicar con pad de lona o aplicador de microfibra con movimientos circulares en tramos de 30x30 cm, enjuagando abundantemente con agua."
    },
    {
      id: "VON-00015",
      name: "HIDRACOURO 500ML – HIDRATANTE DE PIEL",
      category: "piel",
      price: 137.00,
      image: GIT_REPO_BASE + "HIDRACOURO.png",
      keywords: ["hidracouro", "piel", "cuero", "hidratante", "suavidad", "asientos"],
      description: "Crema humectante a base de lanolina para asientos y volantes de cuero. Evita resequedad, grietas y pérdida de color.",
      use: "Limpiar antes con Higicouro, aplicar crema con aplicador y retirar excedente."
    },
    {
      id: "VON-00016",
      name: "HIGICOURO 500ML – LIMPIADOR DE PIEL",
      category: "piel",
      price: 88.00,
      image: GIT_REPO_BASE + "HIGICOURO.png",
      keywords: ["higicouro", "limpiador de piel", "cuero", "asientos", "ph neutro piel"],
      description: "Limpiador suave con pH balanceado formulado específicamente para cuero natural o sintético. Desprende la mugre de los poros sin resecar.",
      use: "Frotar suavemente con cepillo de cerdas de caballo o toalla de microfibra."
    },
    {
      id: "VON-00114",
      name: "V-PAINT COATING CERÁMICO PARA PINTURA",
      category: "ceramicos",
      price: 950.00,
      image: GIT_REPO_BASE + "V-PAINT.png",
      keywords: ["vpaint", "v-paint", "coating ceramico", "vitrificador", "3 anos", "proteccion 9h"],
      description: "Recubrimiento cerámico profesional para pintura con durabilidad de hasta 3 años. Dureza 9H, brillo de espejo y máxima repelencia química.",
      use: "Aplicación profesional tras descontaminado y pulido de pintura."
    },
    {
      id: "VON-00115",
      name: "V-PAINT PRO COATING CERÁMICO",
      category: "ceramicos",
      price: 1250.00,
      image: GIT_REPO_BASE + "V-PAINT%20PRO.png",
      keywords: ["vpaint pro", "v-paint pro", "coating premium", "nanotecnologia"],
      description: "Versión Pro de ultra alta concentración para detailers certificados. Mayor grosor de capa y máxima resistencia a químicos y rayos UV.",
      use: "Uso exclusivo en cabina de detallado."
    },
    {
      id: "VON-00122",
      name: "KIT BÁSICO DETAILING VONIXX",
      category: "kits",
      price: 499.00,
      image: GIT_REPO_BASE + "KIT%20BASICO.png",
      keywords: ["kit basico", "kit detailing", "combo", "principiante", "regalo"],
      description: "Combo esencial para comenzar en el mundo del detallado automotriz profesional con los productos más aclamados de Vonixx.",
      use: "Incluye shampoo de pH neutro, cera líquida Tok Final, microfibra de alta densidad y aplicador."
    }
  ];

  // Reglas de diagnóstico experto para WebMCP
  const DIAGNOSTIC_RULES = [
    {
      triggers: ["pulir", "pulimento", "rayones", "swirls", "microrayones", "pulido", "hologramas", "borrar rayas"],
      problem: "Corrección de pintura, microrayones y pulido",
      recommendation: "Para pulido en 1 solo paso con protección, usa **BLEND ALL IN ONE** (con SiO2 y Carnaúba). Para barnices asiáticos/blandos, utiliza la línea **V10, V20 y V30**. Para barnices duros alemanes, usa la línea premium **V-CUT, V-POLISH y V-FINISH**.",
      productNames: ["BLEND ALL IN ONE – PULIMENTO 3 EN 1", "V10 – PULIMENTO DE CORTE", "V-CUT – PULIMENTO DE CORTE PREMIUM"]
    },
    {
      triggers: ["metal", "metales", "escape", "cromo", "aluminio pulido", "tubo de escape", "oxido en cromo"],
      problem: "Limpieza y pulido de metales y escapes",
      recommendation: "Para devolver el brillo espejo a puntas de escape, rines de aluminio y molduras cromadas, utiliza **BLEND METAL POLISH**.",
      productNames: ["BLEND METAL POLISH – PULIMENTO PARA METALES"]
    },
    {
      triggers: ["lluvia acida", "marca de agua", "marcas de agua", "sarro", "cristal manchado", "vidrio manchado", "vidrios", "cristales"],
      problem: "Marcas de lluvia ácida o sarro en cristales",
      recommendation: "Para eliminar marcas de agua incrustadas en cristales, el tratamiento profesional recomendado es **PRIZM** aplicado con un **Pad de Lona** o aplicador de microfibra. Si las marcas son leves, puedes usar **FOCUS**.",
      productNames: ["PRIZM 500ML – RESTAURADOR PROFUNDO DE CRISTALES", "FOCUS 240ML – REMOVEDOR DE SARRO EN VIDRIOS", "GLAZY 500ML – LIMPIADOR DE CRISTALES"]
    },
    {
      triggers: ["shampoo", "lavar", "lavado", "espuma", "prelavado", "suciedad", "mugre", "champu"],
      problem: "Elección del shampoo correcto",
      recommendation: "Para suciedad pesada o barro te recomendamos **V-MOL** (desincrustante de alto poder). Para lavado regular y seguro sin remover cera, usa **V-FLOC** (pH neutro). Si buscas protección hidrofóbica mientras lavas, elige **HYDROX WASH**.",
      productNames: ["V-MOL 1.5 L", "V-FLOC (SHAMPOO PH NEUTRO)", "HYDROX WASH 500ML"]
    },
    {
      triggers: ["plastico", "plasticos", "molduras", "paragolpes", "quemado", "descolorido", "blanco", "gris"],
      problem: "Plásticos exteriores opacos o quemados por el sol",
      recommendation: "Limpia primero los poros del plástico con **DELET**. Después aplica **RESTAURAX** para restaurar el color negro profundo con protección UV. Si buscas una protección permanente de hasta 3 años, aplica **V-PLASTIC**.",
      productNames: ["RESTAURAX 500ML", "DELET – LIMPIADOR DE CAUCHO Y PLÁSTICOS", "V-PLASTIC COATING CERÁMICO PARA PLÁSTICOS 50ML"]
    },
    {
      triggers: ["cera", "brillo", "encerar", "encerado", "carnauba", "espejo", "show car"],
      problem: "Máximo brillo y protección para la pintura",
      recommendation: "Para el brillo más profundo y cálido tipo exhibición, usa **NATIVE PASTE WAX** (100% carnaúba pura). Para un híbrido de cera + cerámico con 7 meses de duración, elige **BLEND PASTE WAX**. Y para el toque rápido tras lavar, **CARNAUBA TOK FINAL**.",
      productNames: ["BLEND PASTE WAX 100ML", "CARNAUBA TOK FINAL 500ML", "NATIVE PASTE WAX"]
    },
    {
      triggers: ["llanta", "llantas", "neumatico", "neumaticos", "caucho", "abrillantador"],
      problem: "Cuidado y abrillantado de neumáticos",
      recommendation: "Limpia profundamente la llanta con **DELET** hasta eliminar toda la mugre café. Luego aplica **SHINY** si buscas brillo ultra húmedo (dura semanas), o **REVOX** si prefieres un acabado satinado tipo auto nuevo.",
      productNames: ["DELET – LIMPIADOR DE CAUCHO Y PLÁSTICOS", "SHINY 500ML – ABRILLANTADOR DE LLANTAS", "REVOX 500ML – ABRILLANTADOR SATINADO"]
    },
    {
      triggers: ["asiento", "asientos", "piel", "cuero", "volante de piel"],
      problem: "Limpieza e hidratación de vestiduras de piel",
      recommendation: "Aplica **HIGICOURO** para limpiar la grasa y sudor de los poros sin resecar. Luego hidrata con **HIDRACOURO** a base de lanolina para evitar arrugas y cuarteaduras.",
      productNames: ["HIGICOURO 500ML – LIMPIADOR DE PIEL", "HIDRACOURO 500ML – HIDRATANTE DE PIEL"]
    },
    {
      triggers: ["interior", "interiores", "tapiceria", "tela", "vestiduras", "tablero", "mancha asiento"],
      problem: "Limpieza y desinfección de interiores y telas",
      recommendation: "Para limpieza general de tableros y telas listas para usar, aplica **SINTRA FAST** (bactericida). Para lavado profundo por inyección-succión, utiliza el **SISTEMA VSC (Bactran + Extractus + Sanitizante)**.",
      productNames: ["SINTRA FAST – LIMPIADOR DE INTERIORES", "BACTRAN 1.5L – SISTEMA VSC", "EXTRACTUS 1.5L – SISTEMA VSC"]
    },
    {
      triggers: ["ceramico", "sellador", "grafeno", "sio2", "proteccion pintura", "repelencia"],
      problem: "Protección cerámica de pintura",
      recommendation: "El sellador más práctico y rendidor es **SINERGY PAINT** (spray con hasta 12 meses de duración). Si buscas una aplicación instantánea en mojado, usa **HYDROX FAST**. Y para vitrificado profesional permanente, **V-PAINT**.",
      productNames: ["SINERGY PAINT 500ML", "HYDROX FAST 500ML", "V-PAINT COATING CERÁMICO PARA PINTURA"]
    },
    {
      triggers: ["motor", "grasa", "aceite", "chasis", "rines con grasa"],
      problem: "Limpieza pesada de motor y grasa",
      recommendation: "Para desengrasar el motor de forma segura sin corroer componentes, usa **IMPACT APC** diluido 1:10. Para chasis pesado con tierra y aceite, usa **REMOVEX**.",
      productNames: ["IMPACT – DESENGRASANTE MULTIUSOS", "REMOVEX – LIMPIADOR DE CHASIS"]
    },
    {
      triggers: ["alquitran", "brea", "pegamento", "adhesivo", "calcomania"],
      problem: "Eliminar brea, alquitrán o residuos de pegamento",
      recommendation: "Aplica **STRIKE** directamente sobre la mancha, espera un minuto a que disuelva el adhesivo o chapopote y limpia suavemente con microfibra.",
      productNames: ["STRIKE – REMOVEDOR DE ALQUITRÁN"]
    }
  ];

  // Motor WebMCP (Model Context Protocol Tools)
  const WebMCP = {
    // Tool: Buscar en el catálogo
    searchCatalog: function (query) {
      if (!query || typeof query !== 'string') return [];
      const terms = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/);
      
      const results = CATALOG_DATABASE.filter(prod => {
        const fullText = (prod.name + ' ' + prod.category + ' ' + prod.description + ' ' + (prod.keywords || []).join(' ')).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return terms.every(term => fullText.includes(term));
      });

      return results.slice(0, 4);
    },

    // Tool: Diagnosticar problema de detailing
    diagnose: function (text) {
      const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      for (const rule of DIAGNOSTIC_RULES) {
        for (const trigger of rule.triggers) {
          const normTrigger = trigger.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (normalized.includes(normTrigger)) {
            const matchedProducts = rule.productNames.map(pName => 
              CATALOG_DATABASE.find(p => p.name.toLowerCase().includes(pName.toLowerCase().split(' ')[0]))
            ).filter(Boolean);

            return {
              problem: rule.problem,
              explanation: rule.recommendation,
              products: matchedProducts
            };
          }
        }
      }

      // Fallback: búsqueda directa por texto
      const searchResults = this.searchCatalog(text);
      if (searchResults.length > 0) {
        return {
          problem: "Consulta sobre: " + text,
          explanation: `Encontré estos productos en el catálogo oficial de Reset Supply MX que se adaptan a lo que buscas:`,
          products: searchResults
        };
      }

      return null;
    },

    // Tool: Formatear enlace a WhatsApp
    createWhatsAppUrl: function (productName) {
      const msg = encodeURIComponent(`Hola Reset Supply MX, me interesa comprar/cotizar: ${productName}. ¿Tienen stock disponible?`);
      return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
    }
  };

  // Exponer API global de WebMCP
  window.WebMCP = WebMCP;

  // ==========================================================================
  // CONSTRUCCIÓN DE LA INTERFAZ DE USUARIO (UI)
  // ==========================================================================
  function injectWebMCPStyles() {
    if (document.getElementById('webmcp-styles')) return;
    const style = document.createElement('style');
    style.id = 'webmcp-styles';
    style.textContent = `
      /* Launcher flotante */
      #webmcp-launcher {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        background: linear-gradient(135deg, #12171e 0%, #161c24 100%);
        border: 2px solid #3ddc84;
        border-radius: 50px;
        padding: 8px 18px 8px 12px;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(61, 220, 132, 0.4);
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      #webmcp-launcher:hover {
        transform: translateY(-4px) scale(1.03);
        box-shadow: 0 14px 36px rgba(0,0,0,0.7), 0 0 28px rgba(34, 184, 240, 0.6);
        border-color: #22b8f0;
      }
      .webmcp-launcher-icon {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: visible;
      }
      .webmcp-launcher-icon img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        box-shadow: 0 0 14px rgba(61, 220, 132, 0.65);
        display: block;
      }
      .webmcp-pulse {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 2px solid #3ddc84;
        animation: webmcpPing 2s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
      @keyframes webmcpPing {
        75%, 100% {
          transform: scale(1.8);
          opacity: 0;
        }
      }
      .webmcp-launcher-text {
        display: flex;
        flex-direction: column;
      }
      .webmcp-launcher-title {
        font-family: 'Rajdhani', sans-serif;
        font-weight: 700;
        font-size: 15.5px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #f2f5f8;
        line-height: 1;
        padding-right: 4px;
      }

      /* Modal / Drawer de Chat */
      #webmcp-modal {
        position: fixed;
        bottom: 90px;
        right: 24px;
        width: 390px;
        max-width: calc(100vw - 32px);
        height: 580px;
        max-height: calc(100vh - 120px);
        background: #12171e;
        border: 1px solid #232b34;
        border-radius: 16px;
        display: none;
        flex-direction: column;
        z-index: 10000;
        box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(61, 220, 132, 0.25);
        backdrop-filter: blur(14px);
        overflow: hidden;
        animation: webmcpFadeIn 0.25s ease-out forwards;
      }
      @keyframes webmcpFadeIn {
        from { opacity: 0; transform: translateY(20px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Header del chat */
      .webmcp-header {
        padding: 14px 18px;
        background: #161c24;
        border-bottom: 1px solid #232b34;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .webmcp-header-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .webmcp-header-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 1.5px solid #3ddc84;
        box-shadow: 0 0 10px rgba(61, 220, 132, 0.4);
      }
      .webmcp-header-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .webmcp-header-title {
        font-family: 'Rajdhani', sans-serif;
        font-weight: 700;
        font-size: 16px;
        color: #f2f5f8;
        line-height: 1.2;
      }
      .webmcp-header-status {
        font-size: 11.5px;
        color: #3ddc84;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .webmcp-status-dot {
        width: 7px;
        height: 7px;
        background: #3ddc84;
        border-radius: 50%;
        box-shadow: 0 0 8px #3ddc84;
      }
      .webmcp-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .webmcp-btn-icon {
        background: transparent;
        border: 1px solid #232b34;
        color: #93a0ac;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .webmcp-btn-icon:hover {
        color: #f2f5f8;
        border-color: #3ddc84;
        background: rgba(61, 220, 132, 0.1);
      }
      .webmcp-btn-icon.active {
        color: #3ddc84;
        border-color: #3ddc84;
      }

      /* Contenido / Mensajes */
      .webmcp-body {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
        scroll-behavior: smooth;
      }
      .webmcp-message {
        display: flex;
        flex-direction: column;
        max-width: 90%;
        font-size: 13.5px;
        line-height: 1.45;
      }
      .webmcp-message.bot {
        align-self: flex-start;
      }
      .webmcp-message.user {
        align-self: flex-end;
      }
      .webmcp-bubble {
        padding: 10px 14px;
        border-radius: 12px;
      }
      .webmcp-message.bot .webmcp-bubble {
        background: #1a222c;
        border: 1px solid #232b34;
        color: #f2f5f8;
        border-bottom-left-radius: 3px;
      }
      .webmcp-message.user .webmcp-bubble {
        background: linear-gradient(135deg, #3ddc84, #22b8f0);
        color: #04130b;
        font-weight: 600;
        border-bottom-right-radius: 3px;
      }

      /* Fichas de producto interactivas en el chat */
      .webmcp-products-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 8px;
        width: 100%;
      }
      .webmcp-product-card {
        background: #141a22;
        border: 1px solid #232b34;
        border-radius: 10px;
        padding: 10px;
        display: flex;
        gap: 10px;
        align-items: center;
        transition: border-color 0.2s ease;
      }
      .webmcp-product-card:hover {
        border-color: #3ddc84;
      }
      .webmcp-product-thumb {
        width: 54px;
        height: 54px;
        border-radius: 8px;
        background: #0a0e13;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        flex-shrink: 0;
      }
      .webmcp-product-thumb img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      .webmcp-product-details {
        flex: 1;
        min-width: 0;
      }
      .webmcp-product-name {
        font-family: 'Rajdhani', sans-serif;
        font-weight: 700;
        font-size: 13px;
        color: #f2f5f8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .webmcp-product-price {
        color: #3ddc84;
        font-weight: 700;
        font-size: 13.5px;
        font-family: 'Rajdhani', sans-serif;
        margin-top: 2px;
      }
      .webmcp-product-actions {
        display: flex;
        gap: 6px;
        margin-top: 6px;
      }
      .webmcp-btn-card {
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 700;
        font-family: 'Rajdhani', sans-serif;
        border-radius: 5px;
        cursor: pointer;
        border: 1px solid;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s;
      }
      .webmcp-btn-cart {
        background: #1f2730;
        border-color: #3ddc84;
        color: #3ddc84;
      }
      .webmcp-btn-cart:hover {
        background: #3ddc84;
        color: #04130b;
      }
      .webmcp-btn-wa {
        background: rgba(37, 211, 102, 0.12);
        border-color: #25d366;
        color: #25d366;
      }
      .webmcp-btn-wa:hover {
        background: #25d366;
        color: #04130b;
      }

      /* Sugerencias rápidas (Chips) */
      .webmcp-quick-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }
      .webmcp-chip {
        background: #161c24;
        border: 1px solid #232b34;
        color: #93a0ac;
        padding: 5px 10px;
        border-radius: 20px;
        font-size: 11.5px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .webmcp-chip:hover {
        border-color: #3ddc84;
        color: #3ddc84;
        background: rgba(61, 220, 132, 0.08);
      }

      /* Barra de Audio / Escucha de Voz */
      .webmcp-voice-listening {
        padding: 10px 14px;
        background: rgba(220, 61, 61, 0.15);
        border: 1px solid #dc3d3d;
        border-radius: 10px;
        color: #ff7676;
        font-size: 12px;
        display: none;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        animation: webmcpPulseRed 1.5s infinite;
      }
      @keyframes webmcpPulseRed {
        0% { box-shadow: 0 0 0 0 rgba(220, 61, 61, 0.4); }
        70% { box-shadow: 0 0 0 8px rgba(220, 61, 61, 0); }
        100% { box-shadow: 0 0 0 0 rgba(220, 61, 61, 0); }
      }
      .webmcp-voice-waves {
        display: flex;
        align-items: center;
        gap: 3px;
      }
      .webmcp-wave-bar {
        width: 3px;
        height: 12px;
        background: #dc3d3d;
        border-radius: 2px;
        animation: webmcpWave 0.8s ease-in-out infinite alternate;
      }
      .webmcp-wave-bar:nth-child(2) { animation-delay: 0.2s; height: 18px; }
      .webmcp-wave-bar:nth-child(3) { animation-delay: 0.4s; height: 14px; }
      @keyframes webmcpWave {
        from { transform: scaleY(0.4); }
        to { transform: scaleY(1.4); }
      }

      /* Input y Controles Inferiores */
      .webmcp-footer {
        padding: 12px 14px;
        background: #161c24;
        border-top: 1px solid #232b34;
      }
      .webmcp-input-box {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #12171e;
        border: 1.5px solid #232b34;
        border-radius: 10px;
        padding: 6px 10px;
        transition: border-color 0.2s ease;
      }
      .webmcp-input-box:focus-within {
        border-color: #3ddc84;
        box-shadow: 0 0 12px rgba(61, 220, 132, 0.2);
      }
      .webmcp-input {
        flex: 1;
        background: transparent;
        border: none;
        color: #f2f5f8;
        font-size: 13.5px;
        outline: none;
        font-family: inherit;
      }
      .webmcp-input::placeholder {
        color: #6b7683;
        font-size: 12.5px;
      }
      .webmcp-btn-mic {
        background: transparent;
        border: none;
        color: #93a0ac;
        cursor: pointer;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }
      .webmcp-btn-mic:hover {
        color: #3ddc84;
        background: rgba(61, 220, 132, 0.1);
      }
      .webmcp-btn-mic.recording {
        color: #fff;
        background: #dc3d3d;
        box-shadow: 0 0 10px #dc3d3d;
      }
      .webmcp-btn-send {
        background: linear-gradient(135deg, #3ddc84, #22b8f0);
        border: none;
        color: #04130b;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s ease;
      }
      .webmcp-btn-send:hover {
        transform: scale(1.06);
      }

      /* Responsividad */
      @media (max-width: 480px) {
        #webmcp-launcher {
          bottom: 16px;
          right: 16px;
          padding: 6px 14px 6px 8px;
        }
        #webmcp-modal {
          bottom: 0;
          right: 0;
          width: 100vw;
          max-width: 100vw;
          height: 100vh;
          max-height: 100vh;
          border-radius: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createWebMCPDOM() {
    if (document.getElementById('webmcp-launcher')) return;

    injectWebMCPStyles();

    // 1. Launcher Flotante
    const launcher = document.createElement('div');
    launcher.id = 'webmcp-launcher';
    launcher.setAttribute('aria-label', 'Abrir Reset IA');
    launcher.innerHTML = `
      <div class="webmcp-launcher-icon">
        <div class="webmcp-pulse"></div>
        <img src="/assets/reset-ia-icon.png" alt="Reset IA" />
      </div>
      <div class="webmcp-launcher-text">
        <span class="webmcp-launcher-title">Reset IA</span>
      </div>
    `;
    document.body.appendChild(launcher);

    // 2. Modal de Chat
    const modal = document.createElement('div');
    modal.id = 'webmcp-modal';
    modal.innerHTML = `
      <div class="webmcp-header">
        <div class="webmcp-header-info">
          <div class="webmcp-header-avatar">
            <img src="/assets/reset-ia-icon.png" alt="Reset IA" />
          </div>
          <div>
            <div class="webmcp-header-title">Reset IA</div>
            <div class="webmcp-header-status">
              <span class="webmcp-status-dot"></span> Catálogo conectado en tiempo real
            </div>
          </div>
        </div>
        <div class="webmcp-header-actions">
          <button class="webmcp-btn-icon" id="webmcp-tts-toggle" title="Activar/Desactivar Voz">
            <i class="fa-solid fa-volume-high"></i>
          </button>
          <button class="webmcp-btn-icon" id="webmcp-close" title="Cerrar asistente">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div class="webmcp-body" id="webmcp-messages">
        <!-- Mensaje de bienvenida -->
        <div class="webmcp-message bot">
          <div class="webmcp-bubble">
            ¡Hola! Soy <strong>Reset IA</strong>. ¿Te puedo ayudar con alguna duda?
          </div>
        </div>

        <div class="webmcp-quick-chips">
          <button class="webmcp-chip" data-query="lluvia acida en vidrios">💧 Gotas de lluvia en vidrios</button>
          <button class="webmcp-chip" data-query="plasticos quemados por el sol">☀️ Plásticos grises o quemados</button>
          <button class="webmcp-chip" data-query="cual shampoo me recomiendan">🧴 Mejor shampoo de lavado</button>
          <button class="webmcp-chip" data-query="cera para maximo brillo">✨ Cera de máximo brillo</button>
          <button class="webmcp-chip" data-query="como limpiar asientos de tela">💺 Limpiar vestiduras y telas</button>
          <button class="webmcp-chip" data-query="abrillantador para llantas">🛞 Abrillantador de llantas</button>
        </div>
      </div>

      <div class="webmcp-footer">
        <div class="webmcp-voice-listening" id="webmcp-voice-status">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-microphone-lines"></i>
            <span>Escuchando... Di lo que necesitas</span>
          </div>
          <div class="webmcp-voice-waves">
            <div class="webmcp-wave-bar"></div>
            <div class="webmcp-wave-bar"></div>
            <div class="webmcp-wave-bar"></div>
          </div>
        </div>

        <div class="webmcp-input-box">
          <input type="text" id="webmcp-input" class="webmcp-input" placeholder="Pregunta algo o pulsa el micro..." autocomplete="off">
          <button type="button" id="webmcp-mic-btn" class="webmcp-btn-mic" title="Hablar con el asistente">
            <i class="fa-solid fa-microphone"></i>
          </button>
          <button type="button" id="webmcp-send-btn" class="webmcp-btn-send" title="Enviar mensaje">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    initWebMCPEvents();
  }

  // ==========================================================================
  // LÓGICA DE EVENTOS, VOZ Y PROCESAMIENTO
  // ==========================================================================
  function initWebMCPEvents() {
    const launcher = document.getElementById('webmcp-launcher');
    const modal = document.getElementById('webmcp-modal');
    const closeBtn = document.getElementById('webmcp-close');
    const input = document.getElementById('webmcp-input');
    const sendBtn = document.getElementById('webmcp-send-btn');
    const micBtn = document.getElementById('webmcp-mic-btn');
    const voiceStatus = document.getElementById('webmcp-voice-status');
    const ttsToggle = document.getElementById('webmcp-tts-toggle');
    const messages = document.getElementById('webmcp-messages');

    let voiceEnabled = true;
    let isRecording = false;
    let recognition = null;

    // Toggle Modal
    launcher.addEventListener('click', () => {
      const isVisible = modal.style.display === 'flex';
      modal.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        setTimeout(() => input.focus(), 200);
      }
    });

    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      if (recognition && isRecording) {
        recognition.stop();
      }
    });

    // Toggle TTS
    ttsToggle.addEventListener('click', () => {
      voiceEnabled = !voiceEnabled;
      ttsToggle.classList.toggle('active', voiceEnabled);
      ttsToggle.title = voiceEnabled ? 'Voz activada' : 'Voz silenciada';
      if (!voiceEnabled && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    });
    ttsToggle.classList.add('active');

    // Speech Synthesis
    function speakText(text) {
      if (!voiceEnabled || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();

      // Limpiar texto para lectura hablada natural
      const clean = text.replace(/[*_#`]/g, '').replace(/https?:\/\/\S+/g, '');
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'es-MX';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }

    // Speech Recognition (Web Speech API)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.lang = 'es-MX';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        isRecording = true;
        micBtn.classList.add('recording');
        voiceStatus.style.display = 'flex';
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        input.value = transcript;
        handleUserMessage(transcript);
      };

      recognition.onerror = (event) => {
        console.warn('Error en reconocimiento de voz:', event.error);
        stopRecording();
      };

      recognition.onend = () => {
        stopRecording();
      };

      function stopRecording() {
        isRecording = false;
        micBtn.classList.remove('recording');
        voiceStatus.style.display = 'none';
      }

      micBtn.addEventListener('click', () => {
        if (!isRecording) {
          try {
            recognition.start();
          } catch (e) {
            recognition.stop();
          }
        } else {
          recognition.stop();
        }
      });
    } else {
      micBtn.style.display = 'none'; // El navegador no soporta reconocimiento de voz
    }

    // Enviar mensaje
    function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      handleUserMessage(text);
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Quick chips
    messages.addEventListener('click', (e) => {
      const chip = e.target.closest('.webmcp-chip');
      if (chip) {
        const query = chip.getAttribute('data-query');
        handleUserMessage(query);
      }
    });

    // Procesar mensaje del usuario con herramientas WebMCP
    function handleUserMessage(text) {
      // 1. Mostrar mensaje del usuario
      appendUserMessage(text);

      // 2. Ejecutar Tool de Diagnóstico / Búsqueda WebMCP
      setTimeout(() => {
        const diagnosis = WebMCP.diagnose(text);

        if (diagnosis) {
          let replyText = diagnosis.explanation;
          appendBotMessage(replyText, diagnosis.products);
          speakText(diagnosis.explanation);
        } else {
          const fallback = `No encontré una coincidencia exacta para "${text}", pero puedes preguntarme por ejemplo: *¿Cómo quitar sarro de los cristales?*, *¿Qué cera da más brillo?* o decir el nombre de cualquier producto Vonixx como *V-Mol*, *Sintra*, *Prizm* o *Restaurax*.`;
          appendBotMessage(fallback);
          speakText("No encontré una coincidencia exacta, pero prueba preguntándome sobre cómo quitar marcas de agua, plásticos o el nombre de cualquier producto Vonixx.");
        }
      }, 350);
    }

    function appendUserMessage(text) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'webmcp-message user';
      msgDiv.innerHTML = `<div class="webmcp-bubble">${escapeHTML(text)}</div>`;
      messages.appendChild(msgDiv);
      messages.scrollTop = messages.scrollHeight;
    }

    function appendBotMessage(text, products = []) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'webmcp-message bot';

      // Parsear markdown básico (*bold*)
      let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

      let productsHtml = '';
      if (products && products.length > 0) {
        productsHtml += '<div class="webmcp-products-list">';
        products.forEach(p => {
          productsHtml += `
            <div class="webmcp-product-card">
              <div class="webmcp-product-thumb">
                <img src="${p.image}" alt="${p.name}" loading="lazy">
              </div>
              <div class="webmcp-product-details">
                <div class="webmcp-product-name" title="${p.name}">${p.name}</div>
                <div class="webmcp-product-price">$${p.price.toFixed(2)} MXN</div>
                <div class="webmcp-product-actions">
                  <button class="webmcp-btn-card webmcp-btn-cart" data-prod-name="${p.name}">
                    <i class="fa-solid fa-cart-plus"></i> Carrito
                  </button>
                  <a href="${WebMCP.createWhatsAppUrl(p.name)}" target="_blank" rel="noopener noreferrer" class="webmcp-btn-card webmcp-btn-wa">
                    <i class="fa-brands fa-whatsapp"></i> Cotizar
                  </a>
                </div>
              </div>
            </div>
          `;
        });
        productsHtml += '</div>';
      }

      msgDiv.innerHTML = `
        <div class="webmcp-bubble">
          ${formatted}
          ${productsHtml}
        </div>
      `;
      messages.appendChild(msgDiv);

      // Vincular botones de "Agregar al carrito" en el chat
      msgDiv.querySelectorAll('.webmcp-btn-cart').forEach(btn => {
        btn.addEventListener('click', () => {
          const prodName = btn.getAttribute('data-prod-name');
          const matchedItem = CATALOG_DATABASE.find(p => p.name === prodName);
          if (matchedItem) {
            addToSiteCart(matchedItem);
            btn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Agregado!';
            btn.style.background = '#3ddc84';
            btn.style.color = '#04130b';
            setTimeout(() => {
              btn.innerHTML = '<i class="fa-solid fa-cart-plus"></i> Carrito';
              btn.style.background = '';
              btn.style.color = '';
            }, 2000);
          }
        });
      });

      messages.scrollTop = messages.scrollHeight;
    }

    function escapeHTML(str) {
      return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
    }

    // Agregar producto al carrito global del sitio
    function addToSiteCart(product) {
      // Buscar botón de carrito en el DOM para invocar el evento nativo si existe
      const existingBtn = document.querySelector(`.btn-card-action[data-product*="${product.name.split(' ')[0]}"]`) ||
                          document.querySelector(`.btn-add-cart[data-product*="${product.name.split(' ')[0]}"]`);
      if (existingBtn) {
        existingBtn.click();
      } else {
        // Fallback: Disparar evento de carrito o guardar en localStorage
        let cart = [];
        try {
          cart = JSON.parse(localStorage.getItem('cart') || '[]');
        } catch (e) {}
        const idx = cart.findIndex(c => c.name === product.name);
        if (idx > -1) {
          cart[idx].qty = (cart[idx].qty || 1) + 1;
        } else {
          cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            qty: 1
          });
        }
        try {
          localStorage.setItem('cart', JSON.stringify(cart));
          const badge = document.getElementById('cartBadge');
          if (badge) {
            const count = cart.reduce((acc, i) => acc + (i.qty || 1), 0);
            badge.textContent = count;
            badge.classList.add('bump');
            setTimeout(() => badge.classList.remove('bump'), 300);
          }
        } catch (e) {}
      }
    }
  }

  // Auto-iniciar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWebMCPDOM);
  } else {
    createWebMCPDOM();
  }
})();
