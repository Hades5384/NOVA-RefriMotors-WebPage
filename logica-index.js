// ==========================================
// 1. CONFIGURACIÓN DEL SISTEMA
// ==========================================
const TASA_BCV = 804.81; 
const NUMERO_WHATSAPP = "584246192394"; 
const PORCENTAJE_UTILIDAD = 1.30; 
const PORCENTAJE_IVA = 1.16; 
const TASA_INTERNA = 1000; 

// Mostrar tasa BCV en el encabezado
document.getElementById('bcv-display').innerText = `Bs. ${TASA_BCV.toFixed(2)}`; 

// ==========================================
// 2. BASE DE DATOS DE PRODUCTOS
// ==========================================
const products = [
    // ==========================================
    // SECCIÓN: ACEITES Y LUBRICANTES
    // ==========================================
    {
        id: "ACT030", 
        name: "Aceite Sintético POE 68H 1L R410/R134", 
        category: "Químicos", 
        model: "POE 68H",
        desc: `<b>Aceite Sintético POE 68H 1 Litro</b><br><br>Aceite lubricante sintético de alta calidad para compresores de refrigeración. Especialmente formulado para trabajar con gases refrigerantes R410 y R134.`,
        costoCompra: 9.93846154, 
        images: ["productos/ACT030.webp"],
        specs: { "Tipo": "Sintético POE", "Viscosidad": "68H", "Presentación": "1 Litro" }
    },
    {
        id: "ACT032", 
        name: "Aceite Sintético POE 32H 1L R410/R134", 
        category: "Químicos", 
        model: "POE 32H",
        desc: `<b>Aceite Sintético POE 32H 1 Litro</b><br><br>Aceite lubricante sintético de alto rendimiento formulado para compresores que operan con gases refrigerantes R410 y R134.`,
        costoCompra: 8.61538462, 
        images: ["productos/ACT032.webp"],
        specs: { "Tipo": "Sintético POE", "Viscosidad": "32H", "Presentación": "1 Litro" }
    },
    {
        id: "ACT011", 
        name: "Aceite 68 Mineral 1L 4GS Landsfoss", 
        category: "Químicos", 
        model: "4GS 68 Mineral",
        desc: `<b>Aceite 68 Mineral 1 Litro 4GS Landsfoss</b><br><br>Aceite mineral 4GS de grado premium marca Landsfoss. Ideal para sistemas de aire acondicionado y refrigeración comercial.`,
        costoCompra: 4.36153846, 
        images: ["productos/ACT011.webp"],
        specs: { "Marca": "Landsfoss", "Tipo": "Mineral", "Presentación": "1 Litro" }
    },
    {
        id: "ACT403", 
        name: "Aceite Sintético POE 68H Lata Emkarate", 
        category: "Químicos", 
        model: "POE 68H",
        desc: `<b>Aceite Sintético POE 68H Emkarate (Lata)</b><br><br>Aceite sintético original Emkarate RL 68H en presentación de lata de 1 Litro. Máxima protección y lubricación para compresores.`,
        costoCompra: 35.75384615, 
        images: ["productos/ACT403.webp"],
        specs: { "Marca": "Emkarate", "Tipo": "Sintético POE", "Presentación": "Lata 1 Litro" }
    },
    {
        id: "ACT036", 
        name: "Aceite Sintético Emkarate RL32 1L", 
        category: "Químicos", 
        model: "RL32H",
        desc: `<b>Aceite Sintético Emkarate RL32 1 Litro</b><br><br>Lubricante sintético premium Emkarate RL32. Formulado específicamente para un rendimiento óptimo en sistemas de refrigeración modernos.`,
        costoCompra: 35.75384615, 
        images: ["productos/ACT036.webp"],
        specs: { "Marca": "Emkarate", "Tipo": "Sintético POE", "Presentación": "1 Litro" }
    },
    {
        id: "ACT043", 
        name: "Aceite Para Bomba de Vacío 1L Maslex", 
        category: "Químicos", 
        model: "Bomba de Vacío 1L",
        desc: `<b>Aceite Para Bomba de Vacío 1 Litro Maslex</b><br><br>Aceite especializado de alta pureza para bombas de vacío. Garantiza la máxima eficiencia y prolonga la vida útil de su equipo.`,
        costoCompra: 6.43846154, 
        images: ["productos/ACT043.webp"],
        specs: { "Marca": "Maslex", "Tipo": "Aceite para Bomba", "Presentación": "1 Litro" }
    },
    {
        id: "ACT040", 
        name: "Aceite Para Bomba de Vacío 8 Oz Landsfoss", 
        category: "Químicos", 
        model: "Bomba de Vacío 8Oz",
        desc: `<b>Aceite Para Bomba de Vacío 8 Onzas Landsfoss</b><br><br>Aceite premium para mantenimiento y óptimo funcionamiento de bombas de vacío. Presentación práctica de 8 onzas.`,
        costoCompra: 2.64615385, 
        images: ["productos/ACT040.webp"],
        specs: { "Marca": "Landsfoss", "Tipo": "Aceite para Bomba", "Presentación": "8 Onzas" }
    },
    {
        id: "ACT045", 
        name: "Aceite POE 32 1L 100% Puro Maslex", 
        category: "Químicos", 
        model: "POE-32",
        desc: `<b>Aceite POE 32 1 Litro 100% Puro Maslex</b><br><br>Aceite sintético POE-32 de máxima pureza. Excelente estabilidad térmica para sistemas de refrigeración y aires acondicionados.`,
        costoCompra: 25.20769231, 
        images: ["productos/ACT045.webp"],
        specs: { "Marca": "Maslex", "Tipo": "Sintético POE", "Presentación": "1 Litro" }
    },
    {
        id: "ACT044", 
        name: "Aceite POE 68 1L 100% Puro Maslex", 
        category: "Químicos", 
        model: "POE-68",
        desc: `<b>Aceite POE 68 1 Litro 100% Puro Maslex</b><br><br>Aceite sintético POE-68 100% puro. Proporciona una lubricación superior y mayor vida útil para los compresores.`,
        costoCompra: 26.52307692, 
        images: ["productos/ACT044.webp"],
        specs: { "Marca": "Maslex", "Tipo": "Sintético POE", "Presentación": "1 Litro" }
    },
    {
        id: "ACT025", 
        name: "Aceite Éster Sintético Para Sistemas R134", 
        category: "Químicos", 
        model: "Éster Sintético",
        desc: `<b>Aceite Éster Sintético Para Sistemas R134</b><br><br>Lubricante éster sintético universal formulado para sistemas de aire acondicionado y refrigeración que utilizan gas R134.`,
        costoCompra: 5.40000000, 
        images: ["productos/ACT025.webp"],
        specs: { "Tipo": "Éster Sintético", "Compatibilidad": "R134", "Presentación": "1 Litro" }
    },
    {
        id: "ACT035", 
        name: "Aceite 32 Mineral Capell-Oil TX-ISO-32", 
        category: "Químicos", 
        model: "TX-ISO-32",
        desc: `<b>Aceite 32 Mineral Capell-Oil TX-ISO-32</b><br><br>Aceite lubricante mineral grado ISO 32 marca Capell-Oil. Formulado para compresores de refrigeración.`,
        costoCompra: 8.61538462, 
        images: ["productos/ACT035.webp"],
        specs: { "Marca": "Capell-Oil", "Tipo": "Mineral", "Grado": "ISO 32" }
    },
    {
        id: "ACT016", 
        name: "Aceite Compresor Nevera R134 8 Oz", 
        category: "Químicos", 
        model: "R134 8 Oz",
        desc: `<b>Aceite Compresor Nevera R134 8 Onzas</b><br><br>Aceite lubricante de alta calidad envasado específicamente para compresores de neveras que emplean gas R134.`,
        costoCompra: 2.50000000, 
        images: ["productos/ACT016.webp"],
        specs: { "Uso": "Compresores de Nevera", "Compatibilidad": "R134", "Presentación": "8 Onzas" }
    },
    {
        id: "ACT005", 
        name: "Aceite PAG 46 c/UV R134 Johnsen's Org.", 
        category: "Químicos", 
        model: "PAG 46 UV",
        desc: `<b>Aceite PAG 46 c/UV R134 Johnsen's Original</b><br><br>Aceite sintético PAG 46 formulado con tinte UV para una rápida detección de fugas en sistemas automotrices R134a.`,
        costoCompra: 5.83076923, 
        images: ["productos/ACT005.webp"],
        specs: { "Marca": "Johnsen's", "Tipo": "PAG 46 con UV", "Uso": "Automotriz" }
    },
    {
        id: "ACT004", 
        name: "Aceite PAG 100 c/UV R134 Johnsen's Org.", 
        category: "Químicos", 
        model: "PAG 100 UV",
        desc: `<b>Aceite PAG 100 c/UV R134 Johnsen's Original</b><br><br>Aceite sintético PAG 100 de alta viscosidad con tinte UV rastreador para sistemas de aire acondicionado automotriz R134a.`,
        costoCompra: 5.83846154, 
        images: ["productos/ACT004.webp"],
        specs: { "Marca": "Johnsen's", "Tipo": "PAG 100 con UV", "Uso": "Automotriz" }
    },
    {
        id: "ACT003", 
        name: "Aceite PAG 150 c/UV R134 Johnsen's Org.", 
        category: "Químicos", 
        model: "PAG 150 UV",
        desc: `<b>Aceite PAG 150 c/UV R134 Johnsen's Original</b><br><br>Aceite sintético PAG 150 de máxima viscosidad, con detector de fugas UV, diseñado para compresores automotrices pesados R134a.`,
        costoCompra: 5.66153846, 
        images: ["productos/ACT003.webp"],
        specs: { "Marca": "Johnsen's", "Tipo": "PAG 150 con UV", "Uso": "Automotriz" }
    },
    // ==========================================
    // SECCIÓN: QUÍMICOS Y LIMPIADORES
    // ==========================================
    {
        id: "QMC018", 
        name: "Limpiador Alcalino Albrite 880ML", 
        category: "Químicos", 
        model: "880 ML",
        desc: `<b>Limpiador Alcalino Albrite 880ML</b><br><br>Limpiador desincrustante alcalino de alta eficiencia para serpentines y paneles de aluminio.`,
        costoCompra: 1.65384615, 
        images: ["productos/QMC018.webp"],
        specs: { "Tipo": "Limpiador Alcalino", "Presentación": "880 ML", "Uso": "Mantenimiento" }
    },
    {
        id: "QMC008", 
        name: "Ácido Evar 22 Limpiador 1 Litro", 
        category: "Químicos", 
        model: "1 Litro",
        desc: `<b>Ácido Evar 22 Limpiador 1 Litro</b><br><br>Fórmula ácida concentrada para la limpieza profunda y remoción de óxido en sistemas de refrigeración.`,
        costoCompra: 4.63846154, 
        images: ["productos/QMC008.webp"],
        specs: { "Marca": "Evar 22", "Tipo": "Ácido Limpiador", "Presentación": "1 Litro" }
    },
    {
        id: "QMC023", 
        name: "Ácido Evar 22 Limpiador Mediano 480ML", 
        category: "Químicos", 
        model: "480 ML",
        desc: `<b>Ácido Evar 22 Limpiador Mediano 480ML</b><br><br>Limpiador ácido concentrado en presentación mediana, ideal para mantenimientos rápidos de equipos de refrigeración.`,
        costoCompra: 2.45384615, 
        images: ["productos/QMC023.webp"],
        specs: { "Marca": "Evar 22", "Tipo": "Ácido Limpiador", "Presentación": "480 ML" }
    },
    {
        id: "QMC021", 
        name: "Limpiador Alcalino de Aluminio Alcalin 1L", 
        category: "Químicos", 
        model: "1 Litro",
        desc: `<b>Limpiador Alcalino de Aluminio Alcalin 1L</b><br><br>Solución alcalina formulada para abrillantar y limpiar paneles de aluminio sin dañar el metal.`,
        costoCompra: 1.38461538, 
        images: ["productos/QMC021.webp"],
        specs: { "Marca": "RQ5", "Tipo": "Limpiador Alcalino", "Presentación": "1 Litro" }
    },
    {
        id: "QMC002", 
        name: "Limpiador Ácido de Aluminio Hidroflush 1L", 
        category: "Químicos", 
        model: "1 Litro",
        desc: `<b>Limpiador Ácido de Aluminio Hidroflush 1L</b><br><br>Limpiador ácido de acción rápida para eliminar incrustaciones severas en sistemas de aire acondicionado.`,
        costoCompra: 1.86923077, 
        images: ["productos/QMC002.webp"],
        specs: { "Marca": "RQ5", "Tipo": "Ácido Limpiador", "Presentación": "1 Litro" }
    },
    {
        id: "QMC027", 
        name: "Desplazador de Humedad Metil 1 Litro", 
        category: "Químicos", 
        model: "1 Litro",
        desc: `<b>Desplazador de Humedad Metil 1 Litro</b><br><br>Líquido químico diseñado para eliminar los rastros de humedad dentro del sistema de refrigeración y prevenir congelamientos.`,
        costoCompra: 1.86923077, 
        images: ["productos/QMC027.webp"],
        specs: { "Marca": "RQ5", "Función": "Desplazador de Humedad", "Presentación": "1 Litro" }
    },
    {
        id: "QMC025", 
        name: "Dieléctrico Desengrasante RQ5 1 Litro", 
        category: "Químicos", 
        model: "1 Litro",
        desc: `<b>Dieléctrico Desengrasante RQ5 1 Litro</b><br><br>Solvente dieléctrico de alta pureza para la limpieza segura de tableros, tarjetas y componentes eléctricos.`,
        costoCompra: 2.37692308, 
        images: ["productos/QMC025.webp"],
        specs: { "Marca": "RQ5", "Tipo": "Solvente Dieléctrico", "Presentación": "1 Litro" }
    },
    {
        id: "QMC026", 
        name: "Dieléctrico Desengrasante RQ5 1/2 Litro", 
        category: "Químicos", 
        model: "1/2 Litro",
        desc: `<b>Dieléctrico Desengrasante RQ5 1/2 Litro</b><br><br>Solvente dieléctrico desengrasante en presentación práctica de medio litro para limpiezas de precisión.`,
        costoCompra: 1.43846154, 
        images: ["productos/QMC026.webp"],
        specs: { "Marca": "RQ5", "Tipo": "Solvente Dieléctrico", "Presentación": "1/2 Litro" }
    },
    {
        id: "QMC022", 
        name: "Dieléctrico Desengrasante Lata RBV 5KG", 
        category: "Químicos", 
        model: "5 Kilos",
        desc: `<b>Dieléctrico Desengrasante Lata RBV 5KG</b><br><br>Solvente dieléctrico en presentación industrial de 5 kilos, ideal para limpiezas a gran escala y talleres de mantenimiento.`,
        costoCompra: 21.06153846, 
        images: ["productos/QMC022.webp"],
        specs: { "Tipo": "Solvente Dieléctrico", "Presentación": "Lata 5 KG", "Uso": "Industrial" }
    },
    {
        id: "QMC005-RBV", 
        name: "Limpiador Dieléctrico RVB de Lata de 1/2kg", 
        category: "Químicos", 
        model: "1/2 Litro",
        desc: `<b>Limpiador Dielectrico RVB de Lata de 1/2kg</b><br><br>Solvente para la limpieza de componentes eléctricos sin riesgo de cortocircuitos. Presentación de 500ml.`,
        costoCompra: 1.65384615, 
        images: ["productos/QMC005-RBV.webp"],
        specs: { "Marca": "RBV Compresors Oil", "Presentación": "Lata de 1/2L", "Uso": "Solvente Dieléctrico" }
    },
    {
        id: "QMC006-RBV", 
        name: "Limpiador Dielectrico RBV de Lata de 1kg", 
        category: "Químicos", 
        model: "1 Kilo",
        desc: `<b>Limpiador Dielectrico RBV de 1kg<br>Fórmula dieléctrica de máxima pureza y rápida evaporación. Presentación en lata de 1 Kilo para uso profesional.`,
        costoCompra: 4.63846154, 
        images: ["productos/QMC006-RBV.webp"],
        specs: { "Marca": "RBV Compresors Oil", "Presentación": "Lata 1 Kilo", "Uso": "Dieléctrico Premium" }
    },
    {
        id: "QMC019", 
        name: "Limpiador Químico Multi Ultra Clean 1L", 
        category: "Químicos", 
        model: "1 Litro",
        desc: `<b>Limpiador Químico Multiuso Ultra Clean 1L</b><br><br>Limpiador multipropósito formulado para aflojar y remover suciedad pesada en componentes de refrigeración.`,
        costoCompra: 1.32307692, 
        images: ["productos/QMC019.webp"],
        specs: { "Tipo": "Limpiador Multiuso", "Presentación": "1 Litro", "Aplicación": "General" }
    },
    {
        id: "QMC007", 
        name: "Alcohol Metílico (Medio) 0.5 Litros", 
        category: "Químicos", 
        model: "0.5 Litros",
        desc: `<b>Alcohol Metílico 0.5 Litros</b><br><br>Alcohol metílico de alta pureza diseñado para absorber la humedad residual en tuberías y prevenir congelamiento.`,
        costoCompra: 1.32307692, 
        images: ["productos/QMC007.webp"],
        specs: { "Función": "Absorbedor de Humedad", "Presentación": "0.5 Litros", "Uso": "Interno" }
    },
    {
        id: "QMC024", 
        name: "Limpiador Panel Clean 66 Galón 3.75L", 
        category: "Químicos", 
        model: "1 Galón (3.75L)",
        desc: `<b>Limpiador Panel Clean 66 Galón 3.750LTS</b><br><br>Limpiador profundo de aluminio para serpentines en presentación industrial de 1 Galón. Alto rendimiento.`,
        costoCompra: 5.30000000, 
        images: ["productos/QMC024.webp"],
        specs: { "Marca": "Productos 66", "Presentación": "1 Galón (3.75L)", "Uso": "Limpiador de Aluminio" }
    },
    {
        id: "QMC011", 
        name: "Ácido Limpiador Evar 22 Galón 3.78L", 
        category: "Químicos", 
        model: "1 Galón (3.78L)",
        desc: `<b>Ácido Evar 22 Limpiador Galón 3.78 LTS</b><br><br>Ácido limpiador concentrado en tamaño industrial de 1 galón. Máxima potencia para limpiezas mayores.`,
        costoCompra: 16.36153846, 
        images: ["productos/QMC011.webp"],
        specs: { "Marca": "Evar 22", "Tipo": "Ácido Limpiador", "Presentación": "1 Galón (3.78L)" }
    },
    // ==========================================
    // SECCIÓN: GASES REFRIGERANTES Y SOLDADURA
    // ==========================================
    {
        id: "GAS002", 
        name: "Recarga de Gas Refrigerante R134a (Por Kilo)", 
        category: "Refrigeración", 
        model: "R134a",
        desc: `<b>Recarga de Gas R134a para Neveras / Autos</b><br><br>Servicio de recarga de gas refrigerante R134a kileado para neveras y automóviles. El precio indicado es por Kilo.`,
        costoCompra: 16.66923077, 
        images: ["productos/GAS002.webp"],
        specs: { "Tipo": "Gas Refrigerante", "Gas": "R134a", "Presentación": "Recarga (Por Kilo)" }
    },
    {
        id: "GAS003", 
        name: "Recarga de Gas Refrigerante R410a (Por Kilo)", 
        category: "Refrigeración", 
        model: "R410A",
        desc: `<b>Recarga de Gas R410A para Aires Acondicionados</b><br><br>Gas refrigerante R410A de alta eficiencia para aires acondicionados. El precio indicado es por Kilo.`,
        costoCompra: 11.13076923, 
        images: ["productos/GAS003.webp"],
        specs: { "Tipo": "Gas Refrigerante", "Gas": "R410A", "Presentación": "Recarga (Por Kilo)" }
    },
    {
        id: "GAS006", 
        name: "Lata de Gas Propano de 400gr Maxwell MAPP PRO", 
        category: "Herramientas", 
        model: "MAPP 400G",
        desc: `<b>Lata de Gas Propano de 400gr Maxwell MAPP Pro</b><br><br>Lata de gas propano Maxwell MAPP Pro ideal para trabajos de soldadura fuerte en tuberías de refrigeración. Presentación por unidad.`,
        costoCompra: 6.62307692, 
        images: ["productos/GAS006.webp"],
        specs: { "Tipo": "Gas de Soldadura", "Gas": "Propano MAPP", "Presentación": "Lata de 400G" }
    },
    {
        id: "GAS007", 
        name: "Recarga de Gas Refrigerante R404a (Por Kilo)", 
        category: "Refrigeración", 
        model: "R404a",
        desc: `<b>Recarga de Gas R404a para Cava-Cuarto</b><br><br>Gas refrigerante R404a diseñado para sistemas de refrigeración comercial y cavas cuarto. El precio indicado es por Kilo.`,
        costoCompra: 14.57692308, 
        images: ["productos/GAS007.webp"],
        specs: { "Tipo": "Gas Refrigerante", "Gas": "R404a", "Presentación": "Recarga (Por Kilo)" }
    },
    {
        id: "GAS008", 
        name: "Lata de Gas Refrigerante R600A de 160gr", 
        category: "Refrigeración", 
        model: "R600A 160G",
        desc: `<b>Lata de Gas Refrigerante R600a de 160gr</b><br><br>Gas refrigerante ecológico R600a en presentación de lata desechable de 160 gramos por unidad.`,
        costoCompra: 3.32307692, 
        images: ["productos/GAS008.webp"],
        specs: { "Tipo": "Gas Refrigerante", "Gas": "R600A", "Presentación": "Lata de 160G" }
    },
    {
        id: "GAS013", 
        name: "Lata de Gas Refrigerante R134a de 340gr", 
        category: "Refrigeración", 
        model: "R134A 340G",
        desc: `<b>Lata de Gas Refrigerante R134a 340gr</b><br><br>Gas refrigerante R134A en lata de 340 gramos con válvula de rosca fina.`,
        costoCompra: 7.99230769, 
        images: ["productos/GAS013.webp"],
        specs: { "Tipo": "Gas Refrigerante", "Gas": "R134A", "Presentación": "Lata de 340G (Rosca Fina)" }
    },
    {
        id: "GAS018", 
        name: "Recarga de Gas Refrigerante R32 (Por Kilo)", 
        category: "Refrigeración", 
        model: "R32",
        desc: `<b>Recarga de Gas Refrigerante R32 para Aires Acondicionados</b><br><br>Gas refrigerante R32 de nueva generación para aires acondicionados modernos. El precio indicado es por Kilo.`,
        costoCompra: 16.73076923, 
        images: ["productos/GAS018.webp"],
        specs: { "Tipo": "Gas Refrigerante", "Gas": "R32", "Presentación": "Recarga (Por Kilo)" }
    },
    {
        id: "GAS019", 
        name: "Recarga de Gas Refrigerante R422D (Por Kilo)", 
        category: "Refrigeración", 
        model: "R422D",
        desc: `<b>Recarga de Gas Refrigerante R422D para Aires Acondicionados</b><br><br>Gas refrigerante R422D especial para equipos de aire acondicionado. El precio indicado es por Kilo.`,
        costoCompra: 11.33846154, 
        images: ["productos/GAS019.webp"],
        specs: { "Tipo": "Gas Refrigerante", "Gas": "R422D", "Presentación": "Recarga (Por Kilo)" }
    },
    {
        id: "GAS022", 
        name: "Recarga de Gas Refrigerante R134a DuPont Original (Por Kilo)", 
        category: "Refrigeración", 
        model: "R134A DuPont",
        desc: `<b>Recarga de Gas Refrigerante R134a DuPont Original</b><br><br>Servicio de recarga de gas refrigerante premium R134A marca DuPont / Chemours. El precio indicado es por Kilo.`,
        costoCompra: 22.00000000, 
        images: ["productos/GAS022.webp"],
        specs: { "Marca": "DuPont", "Gas": "R134A", "Presentación": "Recarga (Por Kilo)" }
    },
    {
        id: "GAS023", 
        name: "Lata de Gas Propano Bernzomatic Botella de 400gr", 
        category: "Herramientas", 
        model: "Bernzomatic 400G",
        desc: `<b>Lata de Gas Propano Bernzomatic Botella 400gr</b><br><br>Cilindro de propano original marca Bernzomatic para sopletes y soldadura. Presentación por unidad de 400 gramos.`,
        costoCompra: 7.50000000, 
        images: ["productos/GAS023.webp"],
        specs: { "Marca": "Bernzomatic", "Tipo": "Gas Propano", "Presentación": "Lata de 400G" }
    },
    {
        id: "GAS024", 
        name: "Recarga de Gas Refrigerante R290a (Por Kilo)", 
        category: "Refrigeración", 
        model: "R290a",
        desc: `<b>Recarga de Gas Refrigerante R290a</b><br><br>Gas refrigerante ecológico de alta pureza R290a. El precio indicado es por Kilo.`,
        costoCompra: 9.94615385, 
        images: ["productos/GAS024.webp"],
        specs: { "Tipo": "Gas Refrigerante", "Gas": "R290a", "Presentación": "Recarga (Por Kilo)" }
    },
    {
        id: "GAS025", 
        name: "Recarga de Gas Refrigerante R507A (Por Kilo)", 
        category: "Refrigeración", 
        model: "R507A",
        desc: `<b>Recarga de Gas Refrigerante R507A</b><br><br>Mezcla de gas refrigerante R507A para bajas y medias temperaturas. El precio indicado es por Kilo.`,
        costoCompra: 11.93846154, 
        images: ["productos/GAS025.webp"],
        specs: { "Tipo": "Gas Refrigerante", "Gas": "R507A", "Presentación": "Recarga (Por Kilo)" }
    },
    {
        id: "GAS029", 
        name: "Lata de Gas Refrigerante R600a de 340gr Cowplandt", 
        category: "Refrigeración", 
        model: "R600A 340G",
        desc: `<b>Lata de Gas Refrigerante R600a de 340gr Cowplandt</b><br><br>Gas refrigerante ecológico R600a marca Cowplandt. Presentación de lata de 340 gramos.`,
        costoCompra: 4.63076923, 
        images: ["productos/GAS029.webp"],
        specs: { "Marca": "Cowplandt", "Gas": "R600A", "Presentación": "Lata de 340G" }
    },
    {
        id: "GAS031", 
        name: "Recarga de Gas Refrigerante R417a (Por Kilo)", 
        category: "Refrigeración", 
        model: "R417A",
        desc: `<b>Recarga de Gas Refrigerante R417A</b><br><br>Sustituto ecológico para R22 en equipos de aire acondicionado. El precio indicado es por Kilo.`,
        costoCompra: 11.13076923, 
        images: ["productos/GAS031.webp"],
        specs: { "Tipo": "Gas Refrigerante", "Gas": "R417A", "Presentación": "Recarga (Por Kilo)" }
    },
    {
        id: "GAS032", 
        name: "Lata de Gas Refrigerante R290 de 300gr", 
        category: "Refrigeración", 
        model: "R290 300G",
        desc: `<b>Lata de Gas Refrigerante R290 de 300gr</b><br><br>Gas refrigerante ecológico R290 de alta pureza. Presentación en lata de 300 gramos por unidad.`,
        costoCompra: 6.63076923, 
        images: ["productos/GAS032.webp"],
        specs: { "Tipo": "Gas Refrigerante", "Gas": "R290", "Presentación": "Lata de 300G" }
    },
    {
        id: "GAS034", 
        name: "Lata de Gas Refrigerante R134a de 750gr Cowplandt", 
        category: "Refrigeración", 
        model: "R134A 750G",
        desc: `<b>Lata de Gas Refrigerante R134a de 750gr Cowplandt</b><br><br>Cilindro desechable de gas refrigerante R134A marca Cowplandt. Presentación de 750 gramos.`,
        costoCompra: 13.26153846, 
        images: ["productos/GAS034.webp"],
        specs: { "Marca": "Cowplandt", "Gas": "R134A", "Presentación": "Lata de 750G" }
    },
    {
        id: "PUN-MEDIDA", 
        name: "Evaporador de Placa para Nevera con Capilar", 
        category: "Refrigeración", 
        model: "Varias Medidas",
        desc: `<b>Evaporador de Placa para Nevera con Capilar</b><br><br>Evaporador de aluminio tipo placa de alta eficiencia térmica. Incluye tubo capilar soldado. Excelente para reemplazos de sistemas congeladores. Por favor, seleccione la medida que necesita.`,
        costoCompra: 14.59230769, // Costo base para la visualización inicial (equivale a Bs 20.904,94)
        images: ["productos/PUN104-105-106-107-108.webp"],
        specs: { "Tipo": "Placa", "Incluye": "Capilar", "Material": "Aluminio" },
        // VARIANTES DE MEDIDAS
        variants: [
            { id: "PUN104", name: "Medida: 80x40cm", costoCompra: 14.59230769 },
            { id: "PUN107", name: "Medida: 84x45cm", costoCompra: 19.89230769 },
            { id: "PUN108", name: "Medida: 94x45cm", costoCompra: 23.20769231 },
            { id: "PUN105", name: "Medida: 105x45cm", costoCompra: 26.52307692 },
            { id: "PUN106", name: "Medida: 150x50cm", costoCompra: 29.84615385 }
        ]
    },
    {
        id: "NEV100", 
        name: "Nevera Hotpoint de 2 Puertas Importada", 
        category: "Neveras / Cavas", 
        model: "Hotpoint",
        desc: `<b>Nevera Kenmore 2 Puertas Importada</b><br><br>Refrigerador de alta capacidad, diseño clásico de 2 puertas. Componentes de calidad garantizada para máxima durabilidad.`,
        costoCompra: 437.66923077, 
        images: ["productos/NEV100.webp"],
        specs: { "Marca": "HotPonit", "Tipo": "2 Puertas", "Categoría": "Importada" }
    },
    {
        id: "NEV104", 
        name: "Nevera GE de 2 Puertas Importada", 
        category: "Neveras / Cavas", 
        model: "General Electric",
        desc: `<b>Nevera GE de 2 Puertas Importada</b><br><br>Nevera refrigeradora de la marca General Electric. Diseño compacto y eficiente, ideal para espacios modernos.`,
        costoCompra: 497.34615385, 
        images: ["productos/NEV104.webp"],
        specs: { "Marca": "General Electric", "Categoría": "Importada" }
    },
    {
        id: "NEV107", 
        name: "Nevera GE Side by Side Vertical de 2 Puertas", 
        category: "Neveras / Cavas", 
        model: "General Electric",
        desc: `<b>Nevera Hotpoint GE 20.5 Pies Cúbicos Blanca</b><br><br>Nevera General Electric Hotpoint de gran capacidad (20.5 pies cúbicos), diseño de 2 puertas. Sistema de enfriamiento superior.`,
        costoCompra: 464.19230769, 
        images: ["productos/NEV107.webp"],
        specs: { "Marca": "General Electric", "Capacidad": "760 Litros", "Color": "Blanca" }
    },
    {
        id: "RES008", 
        name: "Resistencia de Nevera Samsung DA47-00038B", 
        category: "Neveras / Cavas", 
        model: "DA47-00038B",
        desc: `<b>Resistencia Nevera Samsung DA47-00038B</b><br><br>Resistencia de descongelación original para neveras Samsung. Componente esencial para el sistema No Frost.`,
        costoCompra: 32.92307692, 
        images: ["productos/RES008.webp"],
        specs: { "Marca": "Samsung", "Repuesto": "Resistencia de Deshielo", "Modelo": "DA47-00038B" }
    },
    {
        id: "RES047", 
        name: "Resistencia de Nevera Samsung DA81-01691B", 
        category: "Neveras / Cavas", 
        model: "DA81-01691B",
        desc: `<b>Resistencia H. Nevera Samsung DA81-01691B</b><br><br>Resistencia calefactora tipo H para sistemas de refrigeración Samsung. Reemplazo directo y garantizado.`,
        costoCompra: 21.93846154, 
        images: ["productos/RES047.webp"],
        specs: { "Marca": "Samsung", "Tipo": "Forma en H", "Modelo": "DA81-01691B" }
    },
    {
        id: "RES044", 
        name: "Resistencia de Nevera Samsung DA81-01691A", 
        category: "Neveras / Cavas", 
        model: "DA81-01691A",
        desc: `<b>Resistencia H. Nevera Samsung DA81-01691A</b><br><br>Resistencia calefactora tipo H para sistemas de refrigeración Samsung. Reemplazo directo y garantizado.`,
        costoCompra: 10.96923077, 
        images: ["productos/RES044.webp"],
        specs: { "Marca": "Samsung", "Tipo": "Forma en H", "Modelo": "DA81-01691A" }
    },
    {
        id: "RES045", 
        name: "Resistencia Nevera Samsung G001A081SMB", 
        category: "Neveras / Cavas", 
        model: "G001A081SMB",
        desc: `<b>Resistencia H. Nevera Samsung G001A081SMB</b><br><br>Resistencia calefactora tipo H para sistemas de refrigeración Samsung. Reemplazo directo y garantizado.`,
        costoCompra: 13.72307692, 
        images: ["productos/RES045.webp"],
        specs: { "Marca": "Samsung", "Tipo": "Forma en H", "Modelo": "G001A081SMB" }
    },
    {
        id: "CNV300", 
        name: "Condensador Tipo Parrilla de 3 Vueltas Para Cava 1/3", 
        category: "Refrigeración", 
        model: "1/3 HP",
        desc: `<b>Condensador Tipo Parrilla de 3 Vueltas Para Cava 1/3</b><br><br>Parrilla condensadora estática de alta transferencia de calor diseñada para unidades de 1/3 HP. Ideal para cavas y exhibidores.`,
        costoCompra: 10.25384615, 
        images: ["productos/CNV300.webp"],
        specs: { "Tipo": "Parrilla Estática", "Capacidad": "1/3 HP", "Uso": "Cavas" }
    },
    {
        id: "CNV301", 
        name: "Condensador Tipo Parrilla de 2 Vueltas Para Cava 1/5", 
        category: "Refrigeración", 
        model: "1/3 HP",
        desc: `<b>Condensador Tipo Parrilla de 2 Vueltas Para Cava 1/5</b><br><br>Parrilla condensadora estática de alta transferencia de calor diseñada para unidades de 1/5 HP. Ideal para cavas y exhibidores.`,
        costoCompra: 7.3692307692,
        images: ["productos/CNV300.webp"],
        specs: { "Tipo": "Parrilla Estática", "Capacidad": "1/5 HP", "Uso": "Cavas" }
    },
    {
        id: "TIM500", name: "Reloj de Descongelación Mecánico Paragon 220V", category: "Neveras / Cavas", model: "8145-00",
        desc: `<b>Reloj de Descongelación Mecánico Paragon 8145-00 (Serie 8000)</b><br><br>Temporizador electromecánico para refrigeración comercial e industrial.`,
        costoCompra: 79.6, images: ["productos/RELOJ-PARAGON.webp"],
        specs: { "Marca": "Paragon", "Voltaje": "220v - 60Hz", "Tipo": "Mecánico" }
    },
    {
        id: "TIM400", name: "Reloj de Descongelación Mecánico Paragon 110V", category: "Neveras / Cavas", model: "D8145-00EX",
        desc: `<b>Reloj de Descongelación Mecánico Paragon (Serie 8000)</b><br><br>Temporizador electromecánico para refrigeración comercial e industrial.`,
        costoCompra: 66.319, images: ["productos/RELOJ-PARAGON.webp"],
        specs: { "Marca": "Paragon", "Voltaje": "110v - 60Hz", "Tipo": "Mecánico" }
    },
    {
        id: "CLC002", name: "Cuchilla Oster de 4 Aspas con Anillo de Goma", category: "Licuadoras", model: "BLSTAA4961",
        desc: `<b>Cuchilla Picahielo Oster con Anillo de Goma</b><br><br>Repuesto original Oster de cuchilla trituradora de hielo de 4 aspas con anillo de goma incluido.`,
        costoCompra: 2.73, images: ["productos/CUCHILLA_4_ASPAS_OSTER.webp"],
        specs: { "Material": "Acero Inoxidable", "Aspas": "4", "Compatibilidad": "Rosca Estándar" }
    },
    {
        id: "CLC003", name: "Cuchilla Oster de 6 Aspas con Anillo de Goma", category: "Licuadoras", model: "BLSTAA4961-000",
        desc: `<b>Cuchilla Oster de 6 Aspas Procesadora</b><br><br>Repuesto de alto rendimiento con diseño de 6 aspas en múltiples niveles para un procesado rápido.`,
        costoCompra: 3.1, images: ["productos/CUCHILLA_6_ASPAS_OSTER.webp"],
        specs: { "Material": "Acero Inoxidable", "Aspas": "6", "Compatibilidad": "Rosca Estándar" }
    },
    {
        id: "PDV020", name: "Protector de Voltaje 120V Enchufable Exceline para Nevera", category: "Protectores", model: "GSM-N120",
        desc: `<b>Protector de Voltaje 120V Enchufable Exceline para Nevera (GSM-N120)</b><br><br>Protección integral para refrigeradores, neveras y congeladores.`,
        costoCompra: 6.9, images: ["productos/PDV020.webp"],
        specs: { "Voltaje": "120V", "Tipo": "Enchufable", "Uso": "Neveras" }
    },
    {
        id: "PDV023", name: "Protector de Voltaje Enchufable Exceline para Aires Acondicionados 120V", category: "Protectores", model: "GSM-RE120",
        desc: `<b>Protector de Voltaje Enchufable Exceline para Aires Acondicionados 120V</b><br><br>Diseñado específicamente para acondicionadores de aire de ventana o split de 120V.`,
        costoCompra: 12.23, images: ["productos/PDV023.webp"],
        specs: { "Voltaje": "120V", "Tipo": "Enchufable", "Uso": "Aires Acondicionados" }
    },
    {
        id: "PDV021", name: "Protector de Voltaje Enchufable Exceline para Aires Acondicionados 220V", category: "Protectores", model: "GSM-RE220",
        desc: `<b>Protector de Voltaje Enchufable Exceline para Aires Acondicionados 220V</b><br><br>Protección especializada para equipos de aire acondicionado con alimentación a 220V.`,
        costoCompra: 12.71, images: ["productos/PDV021.webp"],
        specs: { "Voltaje": "220V", "Tipo": "Enchufable", "Uso": "Aires Acondicionados" }
    },
    {
        id: "PDV022", name: "Protector de Voltaje Enchufable Exceline para Aires 220V Tipo Chino", category: "Protectores", model: "GSM-RE220CS",
        desc: `<b>Protector de Voltaje Enchufable Exceline 220V Tipo Chino</b><br><br>Diseñado para equipos de aire acondicionado de 220V con enchufe tipo chino.`,
        costoCompra: 12.23, images: ["productos/PDV022.webp"],
        specs: { "Voltaje": "220V", "Tipo": "Enchufable Tipo Chino", "Uso": "Aires Acondicionados" }
    },
    {
        id: "PDV031", name: "Protector de Voltaje Exceline Cable a Cable 120V Alta Carga", category: "Protectores", model: "GSM-R120B",
        desc: `<b>Protector de Voltaje Exceline Cable a Cable 120V Alta Carga</b><br><br>Protector industrial/comercial para conexión directa por bornera para cargas pesadas en 120V.`,
        costoCompra: 12.40, images: ["productos/PDV031.webp"],
        specs: { "Voltaje": "120V", "Tipo": "Cable a Cable", "Uso": "Alta Carga" }
    },
    {
        id: "PDV030", name: "Protector de Voltaje Exceline Cable a Cable 220V Alta Carga", category: "Protectores", model: "GSM-R220B",
        desc: `<b>Protector de Voltaje Exceline Cable a Cable 220V Alta Carga</b><br><br>Protector de alta capacidad para aires acondicionados de gran tonelaje y sistemas de refrigeración de 220V.`,
        costoCompra: 12.40, images: ["productos/PDV030.webp"],
        specs: { "Voltaje": "220V", "Tipo": "Cable a Cable", "Uso": "Alta Carga" }
    },
    {
        id: "PDV029", name: "Protector de Voltaje Exceline para Compresores Monofásicos 120V", category: "Protectores", model: "GSM-RF120",
        desc: `<b>Protector de Voltaje Exceline para Compresores Monofásicos 120V</b><br><br>Dispositivo especializado en proteger motocompresores de refrigeración monofásicos de 120V.`,
        costoCompra: 10.73, images: ["productos/PDV029.webp"],
        specs: { "Voltaje": "120V", "Tipo": "Bornera", "Uso": "Compresores Monofásicos" }
    },
    {
        id: "PDV051", name: "Protector de Voltaje Exceline para Motores Monofásicos 120V", category: "Protectores", model: "GSM-M120B",
        desc: `<b>Protector de Voltaje Exceline para Motores Monofásicos 120V</b><br><br>Módulo de protección para motores eléctricos monofásicos industriales y comerciales en 120V.`,
        costoCompra: 12.40, images: ["productos/PDV051.webp"],
        specs: { "Voltaje": "120V", "Tipo": "Bornera", "Uso": "Motores Monofásicos" }
    },
    {
        id: "FIL001", name: "Filtro de 1 Salida Soldable", category: "Refrigeración", model: "",
        desc: `<b>Filtro Secador de 1 Salida Soldable</b><br><br>Filtro deshidratador de cobre para sistemas de refrigeración comercial y doméstica.`,
        costoCompra: 0.61, images: ["productos/FIL001.webp"],
        specs: { "Tipo": "Soldable", "Salidas": "1" }
    },
    {
        id: "FIL002", name: "Filtro de 2 Salidas Soldable", category: "Refrigeración", model: "",
        desc: `<b>Filtro Secador de 2 Salidas Soldable</b><br><br>Filtro deshidratador de cobre de 2 salidas para aplicaciones de refrigeración con tubos capilares o derivaciones.`,
        costoCompra: 0.67, images: ["productos/FIL002.webp"],
        specs: { "Tipo": "Soldable", "Salidas": "2" }
    },
    {
        id: "FIL003", name: "Filtro de 3 Salidas Soldable", category: "Refrigeración", model: "",
        desc: `<b>Filtro Secador de 3 Salidas Soldable</b><br><br>Filtro deshidratador de cobre diseñado para circuitos que requieren 3 conexiones o salidas para capilares.`,
        costoCompra: 0.68, images: ["productos/FIL003.webp"],
        specs: { "Tipo": "Soldable", "Salidas": "3" }
    },
    {
        id: "FIL004", name: "Filtro de 4 Salidas Soldable", category: "Refrigeración", model: "",
        desc: `<b>Filtro Secador de 4 Salidas Soldable</b><br><br>Filtro de cobre de 4 salidas especializado para equipos de refrigeración con múltiples circuitos de expansión.`,
        costoCompra: 0.73, images: ["productos/FIL004.webp"],
        specs: { "Tipo": "Soldable", "Salidas": "4" }
    },
    {
        id: "FIL005", name: "Filtro de 5 Salidas Soldable", category: "Refrigeración", model: "",
        desc: `<b>Filtro Secador de 5 Salidas Soldable</b><br><br>Filtro deshidratador de cobre con 5 salidas para instalaciones avanzadas de refrigeración.`,
        costoCompra: 0.78, images: ["productos/FIL005.webp"],
        specs: { "Tipo": "Soldable", "Salidas": "5" }
    },
    {
        id: "FIL011", name: "Filtro de 6 Salidas Soldable", category: "Refrigeración", model: "",
        desc: `<b>Filtro Secador de 6 Salidas Soldable</b><br><br>Filtro de cobre de 6 salidas para la máxima distribución de refrigerante en sistemas frigoríficos pesados.`,
        costoCompra: 0.84, images: ["productos/FIL011.webp"],
        specs: { "Tipo": "Soldable", "Salidas": "6" }
    },
    {
        id: "LVT113", name: "Lavadora Doble Tina de 7kg AKARI", category: "Lavadoras", model: "AKARI 7KG",
        desc: `<b>Lavadora Doble Tina de 7kg AKARI</b><br><br>Semiautomática de doble tina para lavado y centrifugado eficiente, ideal para el hogar.`,
        costoCompra: 113, images: ["productos/LVT113.webp"],
        specs: { "Capacidad": "7 kg", "Tipo": "Doble Tina", "Voltaje": "110V" }
    },
    {
        id: "AIR009", name: "Aire Acondicionado de Ventana 110V de 8.000 BTU", category: "Aires Acondicionados", model: "Genérico",
        desc: `<b>Aire Acondicionado de Ventana 110V de 8.000 BTU</b><br><br>Unidad de aire acondicionado de ventana eficiente para enfriar espacios y habitaciones medianas de forma rápida.`,
        costoCompra: 106, images: ["productos/AIR009.webp"],
        specs: { "Capacidad": "8000 BTU", "Voltaje": "110V", "Tipo": "Ventana" }
    },
    {
        id: "AIR012", name: "Aire Acondicionado de Ventana 110V de 8.000 BTU Danby", category: "Aires Acondicionados", model: "DAC080EB7WDB",
        desc: `<b>Aire Acondicionado de Ventana 110V de 8.000 BTU Danby</b><br><br>Equipo de climatización compacto Danby de alta eficiencia para habitaciones y espacios pequeños/medianos.`,
        costoCompra: 106, images: ["productos/AIR009-DANBY.webp"],
        specs: { "Capacidad": "8000 BTU", "Voltaje": "110V", "Marca": "Danby" }
    },
    {
        id: "AIR009-FRIEDRICH-CHILL", name: "Aire Acondicionado de Ventana 110V de 8.000 BTU Friedrich Chill", category: "Aires Acondicionados", model: "CCF08A10A",
        desc: `<b>Aire Acondicionado de Ventana 110V de 8.000 BTU Friedrich Chill Premier</b><br><br>Unidad premium de ventana con operación ultrasilenciosa y conectividad moderna.`,
        costoCompra: 106, images: ["productos/AIR009-FRIEDRICH-CHILL.webp"],
        specs: { "Capacidad": "8000 BTU", "Voltaje": "110V", "Marca": "Friedrich" }
    },
    {
        id: "AIR009-FRIEDRICH-UNIFIT", name: "Aire Acondicionado de Ventana 110V de 8.000 BTU Friedrich Uni-Fit", category: "Aires Acondicionados", model: "UCC08B10A",
        desc: `<b>Aire Acondicionado de Ventana 110V de 8.000 BTU Friedrich Uni-Fit</b><br><br>Equipo de la serie Uni-Fit diseñado para adaptarse fácilmente a mangas de pared universales o ventanas.`,
        costoCompra: 106, images: ["productos/AIR009-FRIEDRICH-UNIFIT.webp"],
        specs: { "Capacidad": "8000 BTU", "Voltaje": "110V", "Marca": "Friedrich" }
    },
    {
        id: "AIR009-FRIGIDAIRE", name: "Aire Acondicionado de Ventana 110V de 8.000 BTU Frigidaire", category: "Aires Acondicionados", model: "FHWW084TE1",
        desc: `<b>Aire Acondicionado de Ventana 110V de 8.000 BTU Frigidaire</b><br><br>Aire acondicionado Frigidaire con control de temperatura preciso y múltiples modos de operación.`,
        costoCompra: 106, images: ["productos/AIR009-FRIGIDAIRE.webp"],
        specs: { "Capacidad": "8000 BTU", "Voltaje": "110V", "Marca": "Frigidaire" }
    },
    {
        id: "AIR009-GE", name: "Aire Acondicionado de Ventana 110V de 8.000 BTU General Electric", category: "Aires Acondicionados", model: "AHTT08BC",
        desc: `<b>Aire Acondicionado de Ventana 110V de 8.000 BTU General Electric</b><br><br>Unidad GE de alta confiabilidad diseñada para un enfriamiento rápido y continuo.`,
        costoCompra: 106, images: ["productos/AIR009-GE.webp"],
        specs: { "Capacidad": "8000 BTU", "Voltaje": "110V", "Marca": "General Electric" }
    },
    {
        id: "AIR009-HISENSE", name: "Aire Acondicionado de Ventana 110V de 8.000 BTU Hisense", category: "Aires Acondicionados", model: "AW0822CW1W",
        desc: `<b>Aire Acondicionado de Ventana 110V de 8.000 BTU Hisense</b><br><br>Equipo Hisense con diseño moderno y funciones inteligentes para un confort total.`,
        costoCompra: 106, images: ["productos/AIR009-HISENSE.webp"],
        specs: { "Capacidad": "8000 BTU", "Voltaje": "110V", "Marca": "Hisense" }
    },
    {
        id: "AIR009-LG", name: "Aire Acondicionado de Ventana 110V de 8.000 BTU LG", category: "Aires Acondicionados", model: "LW8016ER",
        desc: `<b>Aire Acondicionado de Ventana 110V de 8.000 BTU LG</b><br><br>Aire acondicionado LG con control remoto y tecnología de enfriamiento eficiente.`,
        costoCompra: 106, images: ["productos/AIR009-LG.webp"],
        specs: { "Capacidad": "8000 BTU", "Voltaje": "110V", "Marca": "LG" }
    },
    {
        id: "AIR007-FRIGIDAIRE", name: "Aire Acondicionado de Ventana 110V de 14.000 BTU Frigidaire", category: "Aires Acondicionados", model: "FHWW144TF1",
        desc: `<b>Aire Acondicionado de Ventana 110V de 14.000 BTU Frigidaire</b><br><br>Equipo de climatización de alta potencia Frigidaire para enfriar rápidamente espacios amplios y áreas medianas/grandes.`,
        costoCompra: 185, images: ["productos/AIR007-FRIGIDAIRE.webp"],
        specs: { "Capacidad": "14000 BTU", "Voltaje": "110V", "Marca": "Frigidaire" }
    },
    {
        id: "AIR017-FRIGIDAIRE-FHWW", name: "Aire Acondicionado de Ventana 110V de 14.000 BTU Frigidaire Nuevo", category: "Aires Acondicionados", model: "FHWW144TF1",
        desc: `<b>Aire Acondicionado de Ventana 110V de 14.000 BTU Frigidaire - Nuevo con Caja</b><br><br>Unidad completamente nueva en empaque original Frigidaire de 14.000 BTU.`,
        costoCompra: 198.94, images: ["productos/AIR007-FRIGIDAIRE.webp"],
        specs: { "Capacidad": "14000 BTU", "Voltaje": "110V", "Estado": "Nuevo en Caja" }
    },
    {
        id: "AIR017-FRIGIDAIRE-FHTC", name: "Aire Acondicionado de Ventana 110V de 14.000 BTU Frigidaire Nuevo", category: "Aires Acondicionados", model: "FHTC142WA2",
        desc: `<b>Aire Acondicionado de Ventana 110V de 14.000 BTU Frigidaire - Nuevo con Caja</b><br><br>Aire acondicionado Frigidaire serie FHTC de 14.000 BTU nuevo en caja.`,
        costoCompra: 198.94, images: ["productos/AIR017-FRIGIDAIRE-FHTC.webp"],
        specs: { "Capacidad": "14000 BTU", "Voltaje": "110V", "Modelo": "FHTC142WA2" }
    },
    {
        id: "AIR007-HISENSE", name: "Aire Acondicionado de Ventana 110V de 14.000 BTU Hisense", category: "Aires Acondicionados", model: "AW1422CW1W",
        desc: `<b>Aire Acondicionado de Ventana 110V de 14.000 BTU Hisense</b><br><br>Unidad Hisense de 14.000 BTU a 110V, ideal para climatizar salas, locales o habitaciones de gran tamaño.`,
        costoCompra: 185, images: ["productos/AIR009-HISENSE.webp"],
        specs: { "Capacidad": "14000 BTU", "Voltaje": "110V", "Marca": "Hisense" }
    },
    {
        id: "AIR007-GE", name: "Aire Acondicionado de Ventana 110V de 14.000 BTU General Electric", category: "Aires Acondicionados", model: "AHWG14BC",
        desc: `<b>Aire Acondicionado de Ventana 110V de 14.000 BTU General Electric</b><br><br>Unidad de climatización General Electric de alta capacidad.`,
        costoCompra: 185, images: ["productos/AIR007-GE.webp"],
        specs: { "Capacidad": "14000 BTU", "Voltaje": "110V", "Marca": "General Electric" }
    },
    {
        id: "AIR007-LG", name: "Aire Acondicionado de Ventana 110V de 14.000 BTU LG", category: "Aires Acondicionados", model: "LW1521ERSM",
        desc: `<b>Aire Acondicionado de Ventana 110V de 14.000 BTU LG</b><br><br>Unidad de aire acondicionado de ventana LG con tecnología ThinQ.`,
        costoCompra: 185, images: ["productos/AIR009-LG.webp"],
        specs: { "Capacidad": "14000 BTU", "Voltaje": "110V", "Marca": "LG" }
    },
    {
        id: "AIR022", name: "Aire Acondicionado de Ventana 220V de 18.000 BTU Hisense", category: "Aires Acondicionados", model: "AW1822DR3W",
        desc: `<b>Aire Acondicionado de Ventana 220V de 18.000 BTU Hisense</b><br><br>Equipo de gran capacidad Hisense diseñado para climatizar espacios amplios.`,
        costoCompra: 232, images: ["productos/AIR009-HISENSE.webp"],
        specs: { "Capacidad": "18000 BTU", "Voltaje": "220V", "Marca": "Hisense" }
    },
    {
        id: "AIR023", name: "Aire Acondicionado de Ventana 220V de 18.000 BTU Inverter Hisense", category: "Aires Acondicionados", model: "AW1823TW3W",
        desc: `<b>Aire Acondicionado de Ventana 220V de 18.000 BTU Inverter Hisense</b><br><br>Aire acondicionado de alta eficiencia con tecnología Inverter para un consumo eléctrico menor.`,
        costoCompra: 212, images: ["productos/AIR023.webp"],
        specs: { "Capacidad": "18000 BTU", "Voltaje": "220V", "Tecnología": "Inverter" }
    },
    {
        id: "TIM053", name: "Reloj de Nevera de 6H 21M Paragon", category: "Neveras / Cavas", model: "6H 21M",
        desc: `<b>Reloj de Nevera de 6H 21M Paragon</b><br><br> Temporizador de descongelación automático para neveras y refrigeradores no-frost con ciclo de congelación de 6 horas y descongelación de 21 minutos.`,
        costoCompra: 6.82, images: ["productos/TIM053.webp"],
        specs: { "Tiempo Trabajo": "6 Horas", "Tiempo Deshielo": "21 Minutos", "Marca": "Paragon" }
    },
    {
        id: "TIM018", name: "Reloj de Nevera de 8H 20M Paragon", category: "Neveras / Cavas", model: "8H 20M",
        desc: `<b>Reloj de Nevera de 8H 20M Paragon</b><br><br> Temporizador de deshielo para refrigeradores no-frost con intervalo de congelación de 8 horas y descongelación de 20 minutos.`,
        costoCompra: 6.8, images: ["productos/TIM018.webp"],
        specs: { "Tiempo Trabajo": "8 Horas", "Tiempo Deshielo": "20 Minutos", "Marca": "Paragon" }
    },
    {
        id: "TIM052", name: "Reloj de Nevera de 10H 25M Paragon", category: "Neveras / Cavas", model: "10H 25M",
        desc: `<b>Reloj de Nevera de 10H 25M Paragon</b><br><br> Temporizador de deshielo para neveras de ciclo largo con congelación de 10 horas y descongelación de 25 minutos.`,
        costoCompra: 8.53, images: ["productos/TIM052.webp"],
        specs: { "Tiempo Trabajo": "10 Horas", "Tiempo Deshielo": "25 Minutos", "Marca": "Paragon" }
    },
    {
        id: "SWL102", name: "Switch de Licuadora Oster Original de 3 Velocidades", category: "Licuadoras", model: "3 Velocidades",
        desc: `<b>Switch de Licuadora Oster Original de 3 Velocidades con Perilla</b><br><br> Repuesto original de interruptor giratorio de 3 velocidades para licuadoras Oster.`,
        costoCompra: 2.42, images: ["productos/SWL102.webp"],
        specs: { "Velocidades": "3", "Incluye": "Perilla", "Marca": "Oster" }
    },
    {
        id: "VLC005", name: "Vaso de Licuadora Oster Original con Tapa", category: "Licuadoras", model: "Estándar",
        desc: `<b>Vaso de Licuadora Oster Original con Tapa</b><br><br> Vaso original para licuadoras Oster fabricado en vidrio refractario resistente a cambios de temperatura, completo con su tapa y copa medidora.`,
        costoCompra: 7.8, images: ["productos/VLC005.webp"],
        specs: { "Material": "Vidrio Refractario", "Incluye": "Tapa y Copa", "Marca": "Oster" }
    },
    {
        id: "QMC004", name: "Panel Clean 66 Limpiador de Aluminio", category: "Químicos", model: "1 Litro",
        desc: `<b>Panel Clean 66 Limpiador de Aluminio</b><br><br>Fórmula especializada para la limpieza profunda de serpentines y paneles de aluminio en aires acondicionados.`,
        costoCompra: 1.423077, images: ["productos/PANEL-CLEAN.webp"],
        specs: { "Marca": "Productos 66", "Presentación": "1 Litro", "Uso": "Limpiador de Aluminio" }
    },
    {
        id: "QMC016", name: "Panel Clean 66 Plus+ Alta Concentración", category: "Químicos", model: "1 Litro",
        desc: `<b>Panel Clean 66 Plus+ Limpiador de Aluminio</b><br><br>Limpiador de aluminio de alta concentración. Remueve el sucio más pesado y la oxidación con máxima eficiencia.`,
        costoCompra: 2.315385, images: ["productos/PANEL-CLEAN+.webp"],
        specs: { "Marca": "Productos 66", "Presentación": "1 Litro", "Tipo": "Alta Concentración" }
    },
    {
        id: "QMC003", name: "Panel Cool 66 Alcohol Metílico", category: "Químicos", model: "1 Litro",
        desc: `<b>Panel Cool 66 Alcohol Metílico</b><br><br>Eliminador de humedad ideal para sistemas de refrigeración. Evita la congelación en válvulas y capilares.`,
        costoCompra: 1.984615, images: ["productos/PANEL-COOL.webp"],
        specs: { "Marca": "Productos 66", "Presentación": "1 Litro", "Función": "Eliminador de Humedad" }
    },
    {
        id: "QMC020", name: "Panel Shine 66 Abrillantador", category: "Químicos", model: "1 Litro",
        desc: `<b>Panel Shine 66 Abrillantador de Aluminio</b><br><br>Restaura el brillo original de los serpentines y componentes de aluminio, dejándolos como nuevos.`,
        costoCompra: 1.984615, images: ["productos/PANEL-SHINE.webp"],
        specs: { "Marca": "Productos 66", "Presentación": "1 Litro", "Uso": "Abrillantador" }
    },
    {
        id: "QMC001", name: "Paneltron 66 Dieléctrico", category: "Químicos", model: "1 Litro",
        desc: `<b>Paneltron 66 Dieléctrico Plástico de 1 Litro</b><br><br>Solvente dieléctrico para limpieza de motores, tableros y componentes eléctricos sin riesgo de cortocircuitos.`,
        costoCompra: 2.646153, images: ["productos/PANELTRON.webp"],
        specs: { "Marca": "Productos 66", "Presentación": "Envase Plástico 1L", "Uso": "Solvente Dieléctrico" }
    },
    {
        id: "QMC006", name: "Paneltron 66 Plus+ Dieléctrico Lata", category: "Químicos", model: "1 Kilo",
        desc: `<b>Paneltron 66 Plus/RBV Dieléctrico (Lata)</b><br><br>Fórmula dieléctrica premium en presentación de lata de 1 Kilo. Máxima pureza y rápida evaporación.`,
        costoCompra: 4.638462, images: ["productos/PANELTRON+.webp"],
        specs: { "Marca": "Productos 66", "Presentación": "Lata 1 Kilo", "Uso": "Dieléctrico Premium" }
    },
    {
        id: "CAP320", name: "Capacitor Maxwell Gold de 20 MFD", category: "Capacitores", model: "20 MFD",
        desc: `<b>Capacitor Maxwell Línea Gold de 20 MFD</b><br><br>Capacitor de marcha metálico premium. Rango de voltaje dual 370/440V. Alta durabilidad con 5 años de garantía.`,
        costoCompra: 5.838462, images: ["productos/20UF-GOLD.webp"],
        specs: { "Marca": "Maxwell", "Capacitancia": "20 MFD", "Voltaje": "370/440V", "Garantía": "5 Años" }
    },
    {
        id: "CAP325", name: "Capacitor Maxwell Gold de 25 MFD", category: "Capacitores", model: "25 MFD",
        desc: `<b>Capacitor Maxwell Línea Gold de 25 MFD</b><br><br>Capacitor de marcha metálico premium. Rango de voltaje dual 370/440V. Alta durabilidad con 5 años de garantía.`,
        costoCompra: 6.507692, images: ["productos/25UF-GOLD.webp"],
        specs: { "Marca": "Maxwell", "Capacitancia": "25 MFD", "Voltaje": "370/440V", "Garantía": "5 Años" }
    },
    {
        id: "CAP330", name: "Capacitor Maxwell Gold de 30 MFD", category: "Capacitores", model: "30 MFD",
        desc: `<b>Capacitor Maxwell Línea Gold de 30 MFD</b><br><br>Capacitor de marcha metálico premium. Rango de voltaje dual 370/440V. Alta durabilidad con 5 años de garantía.`,
        costoCompra: 7.076923, images: ["productos/30UF-GOLD.webp"],
        specs: { "Marca": "Maxwell", "Capacitancia": "30 MFD", "Voltaje": "370/440V", "Garantía": "5 Años" }
    },
    {
        id: "CAP335", name: "Capacitor Maxwell Gold de 35 MFD", category: "Capacitores", model: "35 MFD",
        desc: `<b>Capacitor Maxwell Línea Gold de 35 MFD</b><br><br>Capacitor de marcha metálico premium. Rango de voltaje dual 370/440V. Alta durabilidad con 5 años de garantía.`,
        costoCompra: 7.592308, images: ["productos/35UF-GOLD.webp"],
        specs: { "Marca": "Maxwell", "Capacitancia": "35 MFD", "Voltaje": "370/440V", "Garantía": "5 Años" }
    },
    {
        id: "CAP340", name: "Capacitor Maxwell Gold de 40 MFD", category: "Capacitores", model: "40 MFD",
        desc: `<b>Capacitor Maxwell Línea Gold de 40 MFD</b><br><br>Capacitor de marcha metálico premium. Rango de voltaje dual 370/440V. Alta durabilidad con 5 años de garantía.`,
        costoCompra: 7.923077, images: ["productos/40UF-GOLD.webp"],
        specs: { "Marca": "Maxwell", "Capacitancia": "40 MFD", "Voltaje": "370/440V", "Garantía": "5 Años" }
    },
    {
        id: "CAP345", name: "Capacitor Maxwell Gold de 45 MFD", category: "Capacitores", model: "45 MFD",
        desc: `<b>Capacitor Maxwell Línea Gold de 45 MFD</b><br><br>Capacitor de marcha metálico premium. Rango de voltaje dual 370/440V. Alta durabilidad con 5 años de garantía.`,
        costoCompra: 8.923077, images: ["productos/45UF-GOLD.webp"],
        specs: { "Marca": "Maxwell", "Capacitancia": "45 MFD", "Voltaje": "370/440V", "Garantía": "5 Años" }
    },
    {
        id: "CAP350", name: "Capacitor Maxwell Gold de 50 MFD", category: "Capacitores", model: "50 MFD",
        desc: `<b>Capacitor Maxwell Línea Gold de 50 MFD</b><br><br>Capacitor de marcha metálico premium. Rango de voltaje dual 370/440V. Alta durabilidad con 5 años de garantía.`,
        costoCompra: 9.607692, images: ["productos/50UF-GOLD.webp"],
        specs: { "Marca": "Maxwell", "Capacitancia": "50 MFD", "Voltaje": "370/440V", "Garantía": "5 Años" }
    },
    {
        id: "CAP360", name: "Capacitor Maxwell Gold de 60 MFD", category: "Capacitores", model: "60 MFD",
        desc: `<b>Capacitor Maxwell Línea Gold de 60 MFD</b><br><br>Capacitor de marcha metálico premium. Rango de voltaje dual 370/440V. Alta durabilidad con 5 años de garantía.`,
        costoCompra: 10.953846, images: ["productos/60UF-GOLD.webp"],
        specs: { "Marca": "Maxwell", "Capacitancia": "60 MFD", "Voltaje": "370/440V", "Garantía": "5 Años" }
    },
    {
        id: "CAP370", name: "Capacitor Maxwell Gold de 70 MFD", category: "Capacitores", model: "70 MFD",
        desc: `<b>Capacitor Maxwell Línea Gold de 70 MFD</b><br><br>Capacitor de marcha metálico premium. Rango de voltaje dual 370/440V. Alta durabilidad con 5 años de garantía.`,
        costoCompra: 12.823077, images: ["productos/70UF-GOLD.webp"],
        specs: { "Marca": "Maxwell", "Capacitancia": "70 MFD", "Voltaje": "370/440V", "Garantía": "5 Años" }
    },
    {
        id: "CAP371", name: "Capacitor Maxwell Gold de 75 MFD", category: "Capacitores", model: "75 MFD",
        desc: `<b>Capacitor Maxwell Línea Gold de 75 MFD</b><br><br>Capacitor de marcha metálico premium para equipos de alta demanda. Rango dual 370/440V con 5 años de garantía.`,
        costoCompra: 13.261538, images: ["productos/75UF-GOLD.webp"],
        specs: { "Marca": "Maxwell", "Capacitancia": "75 MFD", "Voltaje": "370/440V", "Garantía": "5 Años" }
    },
    {
        id: "HID012", name: "Hidrojet de Alta Presión 1600W INGCO", category: "Herramientas", model: "1600W",
        desc: `<b>Hidrojet de Alta Presión 1600W INGCO</b><br><br>Hidrolavadora de alta presión. Ideal para limpieza profunda industrial y comercial.`,
        costoCompra: 86.207692, images: ["productos/HID012.webp"], 
        specs: { "Marca": "INGCO", "Potencia": "1600W", "Tipo": "Alta Presión" }
    },
    {
        id: "ASP105", name: "Aspiradora de Seco y Húmedo 1000W 10L INGCO", category: "Herramientas", model: "10 Litros",
        desc: `<b>Aspiradora 1000W Seco/Húmedo 10L INGCO</b><br><br>Aspiradora de grado industrial capaz de aspirar tanto polvo como líquidos con tanque de 10 litros.`,
        costoCompra: 41.899999, images: ["productos/ASP105.webp"],
        specs: { "Marca": "INGCO", "Potencia": "1000W", "Capacidad": "10 Litros" }
    },
    {
        id: "BMB098", name: "Bomba de Agua 1HP 110V INGCO", category: "Herramientas", model: "1 HP",
        desc: `<b>Bomba de Agua 1HP 110V INGCO (Bobina de Cobre)</b><br><br>Bomba periférica de alto rendimiento con embobinado de cobre para mayor durabilidad y potencia.`,
        costoCompra: 72.353846, images: [ "productos/BMB098-2.webp", "productos/BMB098.webp"],
        specs: { "Marca": "INGCO", "Caballaje": "1 HP", "Voltaje": "110V", "Bobina": "Cobre" }
    },
    {
        id: "BMB100", name: "Bomba de Agua 1/2HP 110V INGCO", category: "Herramientas", model: "1/2 HP",
        desc: `<b>Bomba de Agua 1/2HP 110V INGCO (Bobina de Cobre)</b><br><br>Bomba periférica eficiente y resistente para uso residencial o comercial ligero.`,
        costoCompra: 40.338461, images: ["productos/BMB100-2.webp", "productos/BMB100.webp"],
        specs: { "Marca": "INGCO", "Caballaje": "1/2 HP", "Voltaje": "110V", "Bobina": "Cobre" }
    },
    {
        id: "ESR100", name: "Esmeriladora Angular 4-1/2 750W INGCO", category: "Herramientas", model: "4 1/2 Pulgadas",
        desc: `<b>Esmeriladora Angular 4 1/2 750W INGCO</b><br><br>Esmeril de alto rendimiento ideal para corte y desbaste de metales y mampostería.`,
        costoCompra: 26.523077, images: ["productos/ESR100.webp"],
        specs: { "Marca": "INGCO", "Potencia": "750W", "Disco": "4-1/2 Pulgadas" }
    },
    {
        id: "VAM110", name: "Kit Multímetro, Pinza y Detector INGCO", category: "Herramientas", model: "Profesional",
        desc: `<b>Kit Multímetro, Pinza y Detector de Voltaje INGCO</b><br><br>El combo eléctrico definitivo para técnicos de refrigeración y electricistas.`,
        costoCompra: 56.353846, images: ["productos/VAM110.webp"],
        specs: { "Marca": "INGCO", "Incluye": "Multímetro, Pinza Amperimétrica, Detector con sus pilas" }
    },
    {
        id: "PST101", name: "Control de Presión Automático 110V INGCO", category: "Herramientas", model: "Automático",
        desc: `<b>Control de Presión Automático INGCO 110V</b><br><br>Automatiza el encendido y apagado de bombas de agua manteniendo una presión constante.`,
        costoCompra: 26.515385, images: ["productos/PST101.webp"],
        specs: { "Marca": "INGCO", "Voltaje": "110V", "Uso": "Bombas de agua" }
    },
    {
        id: "PST104", name: "Regulador Presscontrol Electrónico 110V INGCO", category: "Herramientas", model: "Electrónico",
        desc: `<b>Regulador Presscontrol Electrónico 110V</b><br><br>Módulo electrónico de control de flujo y presión para sistemas de bombeo hidroneumáticos.`,
        costoCompra: 25.423077, images: ["productos/PST104.webp"],
        specs: { "Marca": "INGCO", "Voltaje": "110V", "Tipo": "Electrónico" }
    },
    {
        id: "CAJ001", name: "Caja de Herramientas de 17\" INGCO", category: "Herramientas", model: "17 Pulgadas",
        desc: `<b>Caja de Herramientas de 17\" INGCO</b><br><br>Organizador portátil de plástico de alta resistencia con compartimientos superiores.`,
        costoCompra: 9.600000, images: ["productos/CAJ001.webp"],
        specs: { "Marca": "INGCO", "Tamaño": "17 Pulgadas", "Material": "Polímero de Alto Impacto" }
    },
    {
        id: "FUM001", name: "Fumigadora Asperjadora 5L INGCO", category: "Herramientas", model: "5 Litros",
        desc: `<b>Fumigadora Asperjadora 5L 2.5BAR INGCO</b><br><br>Bomba rociadora manual a presión ideal para aplicar químicos limpiadores a serpentines y aires acondicionados.`,
        costoCompra: 13.261538, images: ["productos/FUM001.webp"],
        specs: { "Marca": "INGCO", "Capacidad": "5 Litros", "Presión": "2.5 BAR" }
    },
    {
        id: "HID107", name: "Pistola Pulverizadora para Hidrojet INGCO", category: "Herramientas", model: "Pistola",
        desc: `<b>Pistola Pulverizadora INGCO</b><br><br>Repuesto de pistola de alta presión compatible con hidrojets INGCO.`,
        costoCompra: 15.915384, images: ["productos/HID107.webp"],
        specs: { "Marca": "INGCO", "Uso": "Hidrojet", "Tipo": "Pulverizadora" }
    },
    {
        id: "HID106", name: "Manguera para Hidrojet de 5mts INGCO", category: "Herramientas", model: "5 Metros",
        desc: `<b>Manguera para Hidrojet de 5mts INGCO</b><br><br>Manguera de alta presión reforzada, longitud de 5 metros.`,
        costoCompra: 9.976923, images: ["productos/HID106.webp"],
        specs: { "Marca": "INGCO", "Longitud": "5 Metros", "Uso": "Hidrojet" }
    },
    {
        id: "DES112", name: "Juego de Destornilladores Precisión con 37Pcs INGCO", category: "Herramientas", model: "37 Piezas",
        desc: `<b>Juego de Destornilladores Precisión con 37Pcs INGCO</b><br><br>Set completo de micropuntas magnéticas para trabajos delicados de electrónica y tarjetas de control.`,
        costoCompra: 7.092307, images: ["productos/DES112.webp"],
        specs: { "Marca": "INGCO", "Piezas": "37", "Tipo": "Precisión" }
    },
    {
        id: "DES114", name: "Juego de Destornilladores Impacto con 6Pcs INGCO", category: "Herramientas", model: "6 Piezas",
        desc: `<b>Juego de Destornilladores Impacto con 6Pcs INGCO</b><br><br>Destornilladores robustos para trabajo pesado, diseñados para resistir golpes en la empuñadura.`,
        costoCompra: 6.038461, images: ["productos/DES114.webp"],
        specs: { "Marca": "INGCO", "Piezas": "6", "Tipo": "Impacto" }
    },
    {
        id: "DES113", name: "Juego de Destornillador Tuerca Plegable 6Pcs INGCO", category: "Herramientas", model: "6 Piezas",
        desc: `<b>Juego de Destornillador Tuerca Plegable 6Pcs INGCO</b><br><br>Llaves de copa tipo destornillador en formato plegable tipo navaja suiza.`,
        costoCompra: 7.092307, images: ["productos/DES113.webp"],
        specs: { "Marca": "INGCO", "Piezas": "6", "Tipo": "Tuerca Plegable" }
    },
    {
        id: "RAC701", name: "Llave Ajustable 10\" INGCO", category: "Herramientas", model: "10 Pulgadas",
        desc: `<b>Llave Ajustable 10\" 24CM Francesa INGCO</b><br><br>Llave inglesa de acero forjado con mango ergonómico antideslizante.`,
        costoCompra: 4.638461, images: ["productos/RAC701.webp"],
        specs: { "Marca": "INGCO", "Tamaño": "10 Pulgadas (24cm)", "Tipo": "Ajustable" }
    },
    {
        id: "RAC802", name: "Juego Llave Torx de Bolsillo T9 a T40 INGCO", category: "Herramientas", model: "Plegable",
        desc: `<b>Juego Llave Torx de Bolsillo T9 a T40 INGCO</b><br><br>Set de llaves Torx en formato navaja compacta para llevar a cualquier lado.`,
        costoCompra: 5.338461, images: ["productos/RAC802.webp"],
        specs: { "Marca": "INGCO", "Tipo": "Torx", "Medidas": "T9 a T40" }
    },
    {
        id: "ALT104", name: "Alicate Corta Cable 8\" INGCO", category: "Herramientas", model: "8 Pulgadas",
        desc: `<b>Alicate Corta Cable 8\" INGCO</b><br><br>Pinza especializada de alto apalancamiento para cortes limpios de cables eléctricos gruesos.`,
        costoCompra: 4.392308, images: ["productos/ALT104.webp"],
        specs: { "Marca": "INGCO", "Tamaño": "8 Pulgadas", "Función": "Corta Cable" }
    },
    {
        id: "ALT105", name: "Alicate Corta Cable 6\" INGCO", category: "Herramientas", model: "6 Pulgadas",
        desc: `<b>Alicate Corta Cable 6\" INGCO</b><br><br>Pinza compacta corta cable con mangos aislados antideslizantes.`,
        costoCompra: 3.323077, images: ["productos/ALT106.webp"], 
        specs: { "Marca": "INGCO", "Tamaño": "6 Pulgadas", "Función": "Corta Cable" }
    },
    {
        id: "MCW001", name: "Mecha Copa de Widia 65mm INGCO", category: "Herramientas", model: "65mm",
        desc: `<b>Mecha Copa de Widia 65mm Vástago 110mm INGCO</b><br><br>Ideal para perforar paredes y concreto al instalar tuberías de aire acondicionado.`,
        costoCompra: 9.623077, images: ["productos/MCW001.webp"],
        specs: { "Marca": "INGCO", "Diámetro": "65mm", "Tipo": "Widia" }
    },
    {
        id: "MCW002", name: "Mecha Copa de Widia 80mm INGCO", category: "Herramientas", model: "80mm",
        desc: `<b>Mecha Copa de Widia 80mm Vástago 3-1/8 INGCO</b><br><br>Broca copa perforadora para mampostería de diámetro ancho.`,
        costoCompra: 11.753846, images: ["productos/MCW002.webp"],
        specs: { "Marca": "INGCO", "Diámetro": "80mm", "Tipo": "Widia" }
    },
    {
        id: "CAU009", name: "Set de Puntas de Cautín 5Pcs INGCO", category: "Herramientas", model: "5 Piezas",
        desc: `<b>Set de Puntas de Cautín 5Pcs 90W/120W INGCO</b><br><br>Puntas de repuesto de alta conductividad térmica para soldadura electrónica.`,
        costoCompra: 5.307692, images: ["productos/CAU009.webp"],
        specs: { "Marca": "INGCO", "Piezas": "5", "Potencia soportada": "90W / 120W" }
    },
    {
        id: "WAL103", name: "Bolso Porta Herramientas INGCO", category: "Herramientas", model: "Cinturón",
        desc: `<b>Bolso Porta Herramienta INGCO</b><br><br>Práctico organizador de cinturón para llevar las herramientas más importantes siempre a la mano.`,
        costoCompra: 2.976923, images: ["productos/WAL103.webp"],
        specs: { "Marca": "INGCO", "Tipo": "Cinturón / Bolso", "Material": "Lona Reforzada" }
    },
    {
        id: "BRO202", name: "Juego de Brocas Hierro HSS 8Pcs INGCO", category: "Herramientas", model: "8 Piezas",
        desc: `<b>Juego de Brocas Hierro HSS 8Pcs INGCO</b><br><br>Set de brocas de acero de alta velocidad (HSS) para perforar metal de forma precisa.`,
        costoCompra: 1.638461, images: ["productos/BRO202.webp"],
        specs: { "Marca": "INGCO", "Material": "HSS (High Speed Steel)", "Piezas": "8" }
    },
    {
        id: "TRR007", name: "Bolsa de Tirrap Negro de 100Pcs INGCO", category: "Herramientas", model: "2.5mm x 10cm",
        desc: `<b>Bolsa de Tirrap Negro 2.5MMx10CM 100Pcs INGCO</b><br><br>Sujetadores plásticos de alta resistencia para organizar cables y aislamientos.`,
        costoCompra: 0.661538, images: ["productos/TRR007.webp"],
        specs: { "Marca": "INGCO", "Cantidad": "100 Piezas", "Dimensiones": "2.5mm x 10cm" }
    },
    {
        id: "CTB014", name: "Corta Tubo Grande 1/8 a 1-1/4 Steinmann", category: "Herramientas", model: "1/8 x 1-1/4",
        desc: `<b>Corta Tubo Grande Steinmann 1/8 x 1-1/4</b><br><br>Herramienta de corte de precisión para tuberías de cobre y aluminio, ideal para refrigeración.`,
        costoCompra: 21.407692, images: ["productos/CTB014.webp"],
        specs: { "Marca": "Steinmann", "Capacidad": "1/8 a 1-1/4 Pulgadas", "Uso": "Cobre y Aluminio" }
    },
    {
        id: "CTB011", name: "Corta Tubo Mediano 3/16 a 7/8 Steinmann", category: "Herramientas", model: "3/16 - 7/8",
        desc: `<b>Corta Tubo Mediano Steinmann 3/16 a 7/8</b><br><br>Cortador de tubos compacto, excelente para trabajos en espacios reducidos.`,
        costoCompra: 11.530769, images: ["productos/CTB011.webp"],
        specs: { "Marca": "Steinmann", "Capacidad": "3/16 a 7/8 Pulgadas", "Uso": "Refrigeración" }
    },
    {
        id: "MVA362", name: "Motor Ventilador Succión 10\" Axial 220V Steinmann", category: "Motores", model: "10 Pulgadas",
        desc: `<b>Motor Ventilador de Succión 10" Axial 220V Steinmann</b><br><br>Motor axial de alta eficiencia para condensadores y evaporadores comerciales.`,
        costoCompra: 43.100000, images: ["productos/MVA362.webp"],
        specs: { "Marca": "Steinmann", "Tipo": "Axial Succión", "Tamaño": "10 Pulgadas", "Voltaje": "220V" }
    },
    {
        id: "MVA363", name: "Motor Ventilador Succión 12\" Axial 220V Steinmann", category: "Motores", model: "12 Pulgadas",
        desc: `<b>Motor Ventilador de Succión 12" Axial 220V Steinmann</b><br><br>Motor extractor axial para refrigeración industrial, diseño robusto y aspas balanceadas.`,
        costoCompra: 49.738461, images: ["productos/MVA363.webp"],
        specs: { "Marca": "Steinmann", "Tipo": "Axial Succión", "Tamaño": "12 Pulgadas", "Voltaje": "220V" }
    },
    {
        id: "MVA364", name: "Motor Ventilador Succión 18\" Axial 220V Steinmann", category: "Motores", model: "18 Pulgadas",
        desc: `<b>Motor Ventilador de Succión 18" Axial 220V Steinmann</b><br><br>Motor de succión de gran caudal para cavas cuarto y condensadores de alto tonelaje.`,
        costoCompra: 76.261538, images: ["productos/MVA364.webp"],
        specs: { "Marca": "Steinmann", "Tipo": "Axial Succión", "Tamaño": "18 Pulgadas", "Voltaje": "220V" }
    },
    {
        id: "BMB109", name: "Bomba de Vacío 1/4 HP 3CFM Steinmann", category: "Herramientas", model: "1/4 HP - 3 CFM",
        desc: `<b>Bomba de Vacío 1/4 HP 3CFM Steinmann</b><br><br>Bomba de vacío de una etapa, compacta y potente. Garantiza la extracción total de humedad en sistemas de refrigeración.`,
        costoCompra: 112.732095, images: ["productos/BMB109.webp"],
        specs: { "Marca": "Steinmann", "Potencia": "1/4 HP", "Caudal": "3 CFM", "Aplicación": "Refrigeración" }
    },
    {
        id: "BMB110", name: "Bomba de Vacío Inalámbrica 18V Steinmann", category: "Herramientas", model: "18V Inalámbrica",
        desc: `<b>Bomba de Vacío Inalámbrica Steinmann 18V</b><br><br>La máxima portabilidad para técnicos exigentes. Bomba a batería de 18V para trabajar en techos o lugares sin electricidad.`,
        costoCompra: 122.679045, images: ["productos/BMB110.webp", "productos/BMB110-BATERIA.webp", "productos/BMB110-CARGADOR.webp"],
        specs: { "Marca": "Steinmann", "Alimentación": "Batería 18V", "Tipo": "Inalámbrica", "Incluye": "Batería y Cargador" }
    },
    {
        id: "MOI019", name: "Motor Ventilador 1/4HP 220V 1075RPM Steinmann", category: "Motores", model: "1/4 HP",
        desc: `<b>Motor Ventilador Steinmann 1/4HP 220V 1075RPM</b><br><br>Motor para condensador de aire acondicionado. Alto rendimiento térmico y rodamientos sellados.`,
        costoCompra: 69.623076, images: ["productos/MOI019.webp"],
        specs: { "Marca": "Steinmann", "Potencia": "1/4 HP", "RPM": "1075", "Voltaje": "220V" }
    },
    {
        id: "MOI020", name: "Motor Ventilador 1/3HP 220V 1075RPM Steinmann", category: "Motores", model: "1/3 HP",
        desc: `<b>Motor Ventilador Steinmann 1/3HP 220V 1075RPM</b><br><br>Motor potente para equipos de refrigeración y aires acondicionados centrales de gran capacidad.`,
        costoCompra: 76.253846, images: ["productos/MOI020.webp"],
        specs: { "Marca": "Steinmann", "Potencia": "1/3 HP", "RPM": "1075", "Voltaje": "220V" }
    },
    {
        id: "KIT105", name: "Kit Vacío Veloz Lite 2 Mangueras 1/2 Steinmann", category: "Herramientas", model: "Lite 1/2",
        desc: `<b>Kit Vacío Veloz Lite 2 Mangueras 1/2 Steinmann</b><br><br>Herramienta especializada para realizar vacíos profundos en tiempo récord con adaptadores de alto flujo.`,
        costoCompra: 69.623076, images: ["productos/KIT105.webp", "productos/ADAPTADOR-KIT105.webp"],
        specs: { "Marca": "Steinmann", "Conexiones": "1/2", "Incluye": "2 Mangueras y 2 Adaptadores" }
    },
    {
        id: "ANT006", name: "Extensión de Manguera para Picos de Soldar", category: "Herramientas", model: "Extensión",
        desc: `<b>Extensión Manguera para Picos de Soldar Steinmann</b><br><br>Manguera de extensión flexible y resistente al calor para equipos de soldadura de refrigeración.`,
        costoCompra: 29.830769, images: ["productos/ANT006.webp"],
        specs: { "Marca": "Steinmann", "Uso": "Soldadura Autógena", "Accesorio": "Extensión" }
    },
    {
        id: "CTB009", name: "Dobla Tubo Múltiple 1/2, 3/8, 1/4 Steinmann", category: "Herramientas", model: "Múltiple",
        desc: `<b>Dobla Tubo Múltiple Steinmann 1/2, 3/8, 1/4</b><br><br>Doblador de tuberías 3 en 1. Permite curvar tuberías de cobre sin estrangularlas ni partirlas.`,
        costoCompra: 22.200000, images: ["productos/CTB009.webp"],
        specs: { "Marca": "Steinmann", "Medidas": "1/2, 3/8, 1/4", "Material": "Aleación Metálica" }
    },
    {
        id: "CTB010", name: "Dobla Tubo Múltiple 1/4, 5/16, 3/8 Steinmann", category: "Herramientas", model: "Múltiple Pequeño",
        desc: `<b>Dobla Tubo Múltiple Steinmann 1/4, 5/16, 3/8</b><br><br>Doblador tipo palanca para medidas más pequeñas, ideal para refrigeración doméstica.`,
        costoCompra: 10.423077, images: ["productos/CTB010.webp"],
        specs: { "Marca": "Steinmann", "Medidas": "1/4, 5/16, 3/8", "Uso": "Tubería de Cobre" }
    },
    {
        id: "JMG010", name: "Juego de Mangueras Heavy Duty Steinmann", category: "Herramientas", model: "1/4 x 1/4",
        desc: `<b>Juego Manguera Steinmann Heavy Duty 1/4 x 1/4</b><br><br>Set de mangueras para manifold de refrigeración de alta presión, revestimiento reforzado (Heavy Duty).`,
        costoCompra: 17.907692, images: ["productos/JMG010.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "1/4 x 1/4", "Tipo": "Heavy Duty" }
    },
    {
        id: "JMG359", name: "Manguera de Carga Steinmann 1/4 x 5/16 152cm", category: "Herramientas", model: "152 CM",
        desc: `<b>Manguera de Carga Steinmann 1/4 x 5/16 152CM</b><br><br>Juego de mangueras especializadas para sistemas R410A con conexión 5/16.`,
        costoCompra: 49.238461, images: ["productos/JMG359.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "1/4 x 5/16", "Longitud": "152 cm (60\")" }
    },
    {
        id: "WAL105", name: "Bolso para Herramienta Multiuso Steinmann", category: "Herramientas", model: "Multiuso",
        desc: `<b>Bolso para Herramienta Steinmann Multiuso</b><br><br>Morral técnico tipo mochila con múltiples compartimientos para organizar y transportar herramientas profesionales.`,
        costoCompra: 79.569230, images: ["productos/WAL105.webp"],
        specs: { "Marca": "Steinmann", "Tipo": "Mochila / Bolso", "Uso": "Transporte de Herramientas" }
    },
    {
        id: "FIL142", name: "Filtro Secador de Rosca con Nucleo Solido 1/2 S-084 3-5 Ton", category: "Refrigeración", model: "S-084",
        desc: `<b>Filtro Secador 1/2 S-084 Rosca 3-5 Ton Steinmann</b><br><br>Filtro de bloque desecante para líneas de líquido en sistemas de 3 a 5 toneladas.`,
        costoCompra: 6.700000, images: ["productos/FIL042.webp", "productos/TABLA_FIL042-164-041.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "1/2 Rosca", "Capacidad": "3 a 5 Toneladas" }
    },
    {
        id: "FIL144", name: "Filtro Secador de Rosca con Nucleo Solido 1/2 S-164 4-6 Ton", category: "Refrigeración", model: "S-164",
        desc: `<b>Filtro Secador 1/2 S-164 Rosca 4-6 Ton Steinmann</b><br><br>Filtro desecante antiácido para protección de sistemas de aire acondicionado comercial.`,
        costoCompra: 8.200000, images: ["productos/FIL144.webp", "productos/TABLA_FIL144-145-165-143.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "1/2 Rosca", "Capacidad": "4 a 6 Toneladas" }
    },
    {
        id: "FIL145", name: "Filtro Secador de Rosca con Nucleo Solido 5/8 S-165 5-8 Ton", category: "Refrigeración", model: "S-165",
        desc: `<b>Filtro Secador 5/8 S-165 Rosca 5-8 Ton Steinmann</b><br><br>Filtro de línea de líquido para equipos de 5 a 8 toneladas con conexión 5/8 Flare.`,
        costoCompra: 8.376923, images: ["productos/FIL145.webp", "productos/TABLA_FIL144-145-165-143.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "5/8 Rosca", "Capacidad": "5 a 8 Toneladas" }
    },
    {
        id: "FIL164", name: "Filtro Secador de Rosca con Nuecleo Solido 3/8 S-083 Rosca 2.5-4 Ton", category: "Refrigeración", model: "S-083",
        desc: `<b>Filtro Secador 3/8 S-083 Rosca 2.5-4 Ton Steinmann</b><br><br>Filtro desecante de 8 pulgadas cúbicas para líneas de líquido 3/8.`,
        costoCompra: 6.600000, images: ["productos/FIL164.webp", "productos/TABLA_FIL042-164-041.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "3/8 Rosca", "Capacidad": "2.5 a 4 Toneladas" }
    },
    {
        id: "FIL166", name: "Filtro Secador de Rosca con Nucleo Solido 3/8 S-303 3-6 Ton", category: "Refrigeración", model: "S-303",
        desc: `<b>Filtro Secador 3/8 S-303 Rosca 3-6 Ton Steinmann</b><br><br>Filtro desecante de alto volumen (30 pulgadas cúbicas) para retención máxima de humedad y ácidos.`,
        costoCompra: 10.969230, images: ["productos/FIL166.webp", "productos/TABLA_FIL166-167-168.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "3/8 Rosca", "Volumen": "30 Cu. In.", "Capacidad": "3 a 6 Toneladas" }
    },
    {
        id: "FIL168", name: "Filtro Secador de Rosca con Nucleo Solido 5/8 S-305 8-10 Ton", category: "Refrigeración", model: "S-305",
        desc: `<b>Filtro Secador 5/8 S-305 Rosca 8-10 Ton Steinmann</b><br><br>Filtro industrial para equipos de gran tonelaje, conexión 5/8 Flare.`,
        costoCompra: 11.238461, images: ["productos/FIL168.webp", "productos/TABLA_FIL166-167-168.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "5/8 Rosca", "Capacidad": "8 a 10 Toneladas" }
    },
    {
        id: "FIL167", name: "Filtro Secador de Rosca con Nucleo Solido 1/2 S-304 6-8 Ton", category: "Refrigeración", model: "S-304",
        desc: `<b>Filtro Secador 1/2 S-304 Rosca 6-8 Ton Steinmann</b><br><br>Filtro desecante de línea de líquido de alta capacidad para conexiones de 1/2.`,
        costoCompra: 10.969230, images: ["productos/FIL167.webp", "productos/TABLA_FIL166-167-168.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "1/2 Rosca", "Capacidad": "6 a 8 Toneladas" }
    },
    {
        id: "FIL165", name: "Filtro Secador de Rosca con Nucleo Solido 3/8 S-163 3-4 Ton", category: "Refrigeración", model: "S-163",
        desc: `<b>Filtro Secador 3/8 S-163 Rosca 3-4 Ton Steinmann</b><br><br>Filtro antiácido de 16 pulgadas cúbicas para sistemas de refrigeración de tamaño medio.`,
        costoCompra: 8.092307, images: ["productos/FIL165.webp", "productos/TABLA_FIL144-145-165-143.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "3/8 Rosca", "Volumen": "16 Cu. In." }
    },
    {
        id: "FIL162", name: "Filtro Secador de Rosca con Nucleo Solido 3/8 S-053 2-3 Ton", category: "Refrigeración", model: "S-053",
        desc: `<b>Filtro Secador 3/8 S-053 Rosca 2-3 Ton Steinmann</b><br><br>Filtro secador compacto para líneas de 3/8 en aires acondicionados estándar.`,
        costoCompra: 5.369230, images: ["productos/FIL162.webp", "productos/TABLA_FIL040-162.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "3/8 Rosca", "Capacidad": "2 a 3 Toneladas" }
    },
    {
        id: "FIL163", name: "Filtro Secador de Rosca con Nucleo Solido 3/8 S-033 3/4-1 Ton", category: "Refrigeración", model: "S-033",
        desc: `<b>Filtro Secador 3/8 S-033 Rosca 3/4-1 Ton Steinmann</b><br><br>Filtro pequeño para cavas y neveras comerciales con línea de 3/8.`,
        costoCompra: 5.069230, images: ["productos/FIL163.webp", "productos/TABLA_163.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "3/8 Rosca", "Capacidad": "3/4 a 1 Tonelada" }
    },
    {
        id: "FIL143", name: "Filtro Secador de Rosca con Nucleo Solido 1/4 S-162 3-4 Ton", category: "Refrigeración", model: "S-162",
        desc: `<b>Filtro Secador 1/4 S-162 Rosca 3-4 Ton Steinmann</b><br><br>Filtro desecante de 16 Cu. In. con rosca de 1/4.`,
        costoCompra: 7.900000, images: ["productos/FIL143.webp", "productos/TABLA_FIL144-145-165-143.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "1/4 Rosca", "Capacidad": "3 a 4 Toneladas" }
    },
    {
        id: "FIL141", name: "Filtro Secador de Rosca con Nucleo Solido 1/4 S-082 2-3 Ton", category: "Refrigeración", model: "S-082",
        desc: `<b>Filtro Secador 1/4 S-082 Rosca 2-3 Ton Steinmann</b><br><br>Filtro desecante de 8 Cu. In. con conexión flare de 1/4 para refrigeración.`,
        costoCompra: 5.900000, images: ["productos/FIL041.webp", "productos/TABLA_FIL042-164-041.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "1/4 Rosca", "Capacidad": "2 a 3 Toneladas" }
    },
    {
        id: "FIL140", name: "Filtro Secador de Rosca con Nucleo Solido 1/4 S-052 1-2 Ton", category: "Refrigeración", model: "S-052",
        desc: `<b>Filtro Secador 1/4 S-052 Rosca 1-2 Ton Steinmann</b><br><br>Filtro secador compacto para equipos de 1 a 2 toneladas.`,
        costoCompra: 5.238461, images: ["productos/FIL140.webp", "productos/TABLA_FIL040-162.webp"],
        specs: { "Marca": "Steinmann", "Conexión": "1/4 Rosca", "Capacidad": "1 a 2 Toneladas" }
    },
    {
        id: "PGT100", name: "Pegamento Instantáneo 2G INCGO", category: "Químicos", model: "2 Gramos",
        desc: `<b>Pegamento Instantáneo 2G INGCO</b><br><br>Adhesivo de cianoacrilato de secado ultra rápido para reparaciones múltiples.`,
        costoCompra: 0.523076, images: ["productos/PGT100.webp"],
        specs: { "Marca": "INGCO", "Cantidad": "2 Gramos", "Tipo": "Instantáneo" }
    }
];

// ==========================================
// 3. VARIABLES GLOBALES Y PAGINACIÓN
// ==========================================
let currentCategory = 'Todos';
let currentLetterFilter = '';
let cart = [];
let currentPage = 1;
const itemsPerPage = 20;

function renderAlphabet() {
    const sidebar = document.getElementById('alphabetSidebar');
    sidebar.innerHTML = '<div class="alpha-btn" onclick="setLetterFilter(\'\')" title="Borrar filtro">↺</div>';
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
    letters.forEach(char => {
        sidebar.innerHTML += `<div class="alpha-btn" id="letter-${char}" onclick="setLetterFilter('${char}')">${char}</div>`;
    });
}

function setLetterFilter(letter) {
    if (currentLetterFilter === letter) { currentLetterFilter = ''; }
    else { currentLetterFilter = letter; }
    document.querySelectorAll('.alpha-btn').forEach(btn => btn.classList.remove('active'));
    if (currentLetterFilter !== '') {
        document.getElementById(`letter-${currentLetterFilter}`).classList.add('active');
    }
    currentPage = 1;
    filterProducts();
}

function resetPaginationAndFilter() {
    currentPage = 1;
    filterProducts();
}

function calcularPrecios(costoCompra) {
    let precioNovaClientesUSD = costoCompra * PORCENTAJE_UTILIDAD * PORCENTAJE_IVA;
    let precioPublicoBs = precioNovaClientesUSD * TASA_INTERNA;
    let precioPublicoUSD = precioPublicoBs / TASA_BCV;
    return { novaClientesUSD: precioNovaClientesUSD, publicoBs: precioPublicoBs, publicoUSD: precioPublicoUSD };
}

function setCategory(categoryName, btnElement) {
    currentCategory = categoryName;
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    currentPage = 1;
    filterProducts();
}

function filterProducts() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = products.filter(prod => {
        const matchesSearch = prod.name.toLowerCase().includes(query) || prod.id.toLowerCase().includes(query) || prod.model.toLowerCase().includes(query);
        const matchesCategory = (currentCategory === 'Todos') || (prod.category === currentCategory);
        let matchesLetter = true;
        if (currentLetterFilter !== '') {
            matchesLetter = prod.name.charAt(0).toUpperCase() === currentLetterFilter;
        }
        return matchesSearch && matchesCategory && matchesLetter;
    });
    setupPagination(filtered);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedItems = filtered.slice(start, end);
    renderProducts(paginatedItems);
}

function setupPagination(filteredArray) {
    const totalPages = Math.ceil(filteredArray.length / itemsPerPage);
    const container = document.getElementById('pagination-container');
    container.innerHTML = '';
    if (totalPages <= 1) return;
    
    container.innerHTML += `<button class="page-btn page-arrow" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Ant</button>`;
    for (let i = 1; i <= totalPages; i++) {
        container.innerHTML += `<button class="page-btn ${currentPage === i ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
    container.innerHTML += `<button class="page-btn page-arrow" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Sig &raquo;</button>`;
}

function changePage(pageNumber) {
    currentPage = pageNumber;
    filterProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 4. RENDERIZADO DE LA GRILLA DE PRODUCTOS
// ==========================================
function renderProducts(productList) {
    const container = document.getElementById('products-container');
    if (productList.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">No se encontraron repuestos con estos filtros.</p>';
        return;
    }
    let htmlContent = '';
    productList.forEach(prod => {
        const precios = calcularPrecios(prod.costoCompra);
        const imgTag = `<img src="${prod.images[0]}" alt="${prod.name}" loading="lazy" onclick="openQuickView('${prod.id}')" onerror="this.src='https://static.vecteezy.com/system/resources/previews/004/141/669/non_2x/no-photo-or-blank-image-icon-loading-images-or-missing-image-mark-image-not-available-or-image-coming-soon-sign-simple-nature-silhouette-in-frame-isolated-illustration-vector.jpg'">`;
        
        // Si el producto tiene variantes (ej: la placa PUN), el botón dice "Ver Opciones"
        const btnText = prod.variants ? 'Ver Opciones' : 'Agregar al Pedido';
        const btnAction = prod.variants ? `openQuickView('${prod.id}')` : `addToCart('${prod.id}')`;

        htmlContent += `
            <div class="product-card">
                ${imgTag}
                <div class="product-code" onclick="openQuickView('${prod.id}')">CÓDIGO: ${prod.id}</div>
                <div class="product-title" onclick="openQuickView('${prod.id}')">${prod.name}</div>
                <div class="price-container" style="margin-top: auto;">
                    <div class="price-public-usd">Precio: $${precios.publicoUSD.toFixed(2)}</div>
                    <div class="price-public-bs">Ref: Bs. ${precios.publicoBs.toFixed(2)}</div>
                </div>
                <button class="add-btn" onclick="${btnAction}">${btnText}</button>
            </div>
        `;
    });
    container.innerHTML = htmlContent;
}

// ==========================================
// 5. LÓGICA DE VISTA RÁPIDA (QUICK VIEW) Y VARIANTES
// ==========================================
let currentViewedProduct = null;
let currentVariantIndex = 0;

function openQuickView(productId) {
    currentViewedProduct = products.find(p => p.id === productId);
    if (!currentViewedProduct) return;
    
    currentVariantIndex = 0; // Reiniciamos el índice de la variante
    
    document.getElementById('qvCategory').innerText = currentViewedProduct.category;
    document.getElementById('qvTitle').innerText = currentViewedProduct.name;
    
    const descEl = document.getElementById('qvDesc');
    const btnEl = document.getElementById('qvReadMoreBtn');
    descEl.innerHTML = currentViewedProduct.desc;
    descEl.classList.remove('expanded');
    btnEl.innerText = 'Leer más';
    
    if (currentViewedProduct.desc.length > 130) {
        btnEl.style.display = 'inline-block';
    } else {
        btnEl.style.display = 'none';
        descEl.classList.add('expanded');
    }
    
    // --- MANEJO DE VARIANTES (MEDIDAS) ---
    const variantContainer = document.getElementById('qvVariantContainer');
    const variantSelect = document.getElementById('qvVariantSelect');
    
    if (currentViewedProduct.variants) {
        variantContainer.style.display = 'block';
        variantSelect.innerHTML = '';
        currentViewedProduct.variants.forEach((v, index) => {
            variantSelect.innerHTML += `<option value="${index}">${v.name}</option>`;
        });
        
        // Al cambiar de medida en el select, actualizamos precios y código
        variantSelect.onchange = function() {
            currentVariantIndex = parseInt(this.value);
            updateQuickViewPrices();
        };
    } else {
        variantContainer.style.display = 'none';
    }
    
    // Actualizamos precios (con o sin variante)
    updateQuickViewPrices();
    
    // Especificaciones
    const specsTable = document.getElementById('qvSpecsTable');
    specsTable.innerHTML = '';
    for (const [key, value] of Object.entries(currentViewedProduct.specs)) {
        specsTable.innerHTML += `<tr><td>${key}</td><td>${value}</td></tr>`;
    }
    
    // Imagen Principal
    const mainImg = document.getElementById('qvMainImg');
    mainImg.src = currentViewedProduct.images[0];
    mainImg.onerror = function () { this.src = 'https://static.vecteezy.com/system/resources/previews/004/141/669/non_2x/no-photo-or-blank-image-icon-loading-images-or-missing-image-mark-image-not-available-or-image-coming-soon-sign-simple-nature-silhouette-in-frame-isolated-illustration-vector.jpg'; };
    
    // Miniaturas
    const thumbContainer = document.getElementById('qvThumbnails');
    thumbContainer.innerHTML = '';
    currentViewedProduct.images.forEach((imgUrl) => {
        thumbContainer.innerHTML += `<img src="${imgUrl}" class="qv-thumb" onclick="changeMainImage(this.src)" onerror="this.style.display='none'">`;
    });
    
    // Botón Agregar al Pedido desde el Modal
    const addBtn = document.getElementById('qvAddBtn');
    addBtn.onclick = function () {
        if (currentViewedProduct.variants) {
            // Si tiene variantes, agregamos el hijo específico seleccionado
            const variant = currentViewedProduct.variants[currentVariantIndex];
            const item = {
                id: variant.id,
                name: currentViewedProduct.name + " (" + variant.name + ")",
                costoCompra: variant.costoCompra,
                images: currentViewedProduct.images
            };
            addItemToCart(item);
        } else {
            // Producto normal
            addItemToCart(currentViewedProduct);
        }
        closeQuickView();
    };
    
    document.getElementById('quickViewModal').classList.add('active');
}

function updateQuickViewPrices() {
    let costo = currentViewedProduct.costoCompra;
    let codigo = currentViewedProduct.id;
    
    // Si tiene variantes, obtenemos el costo y el código de la variante seleccionada
    if (currentViewedProduct.variants) {
        costo = currentViewedProduct.variants[currentVariantIndex].costoCompra;
        codigo = currentViewedProduct.variants[currentVariantIndex].id;
    }
    
    document.getElementById('qvCode').innerText = `CÓDIGO: ${codigo}`;
    
    const precios = calcularPrecios(costo);
    document.getElementById('qvPrice').innerText = `Precio: $${precios.publicoUSD.toFixed(2)}`;
    document.getElementById('qvPriceVes').innerText = `Ref: Bs. ${precios.publicoBs.toFixed(2)}`;
    document.getElementById('qvPriceNova').innerText = `$${precios.novaClientesUSD.toFixed(2)}`;
}

// Utilidades del Modal
function openZoom() {
    const currentImgSrc = document.getElementById('qvMainImg').src;
    document.getElementById('zoomImg').src = currentImgSrc;
    document.getElementById('zoomOverlay').classList.add('active');
}

function closeZoom(event) {
    if (!event || event.target.id === 'zoomOverlay' || event.target.classList.contains('close-zoom')) {
        document.getElementById('zoomOverlay').classList.remove('active');
    }
}

function toggleDescription() {
    const descEl = document.getElementById('qvDesc');
    const btnEl = document.getElementById('qvReadMoreBtn');
    descEl.classList.toggle('expanded');
    if (descEl.classList.contains('expanded')) {
        btnEl.innerText = 'Ocultar descripción';
    } else {
        btnEl.innerText = 'Leer más';
    }
}

function changeMainImage(url) { 
    document.getElementById('qvMainImg').src = url; 
}

function closeQuickView(event) {
    if (!event || event.target.id === 'quickViewModal' || event.target.classList.contains('close-qv')) {
        document.getElementById('quickViewModal').classList.remove('active');
    }
}

// ==========================================
// 6. CARRITO DE COMPRAS Y WHATSAPP
// ==========================================
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (product && !product.variants) {
        addItemToCart(product);
    }
}

function addItemToCart(item) {
    const existingItem = cart.find(i => i.id === item.id);
    if (existingItem) { existingItem.quantity += 1; }
    else { cart.push({ ...item, quantity: 1 }); }
    updateCartUI();
    document.getElementById('cartModal').classList.add('active');
}

function changeQuantity(index, amount) {
    cart[index].quantity += amount;
    if (cart[index].quantity <= 0) removeFromCart(index);
    else updateCartUI();
}

function updateCartUI() {
    const cartContainer = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotalPublic = document.getElementById('cart-total-public');
    const cartTotalNova = document.getElementById('cart-total-nova');
    let totalPublicUSD = 0;
    let totalPublicBs = 0; 
    let totalNovaUSD = 0;
    let totalItems = 0;
    
    if (cart.length === 0) {
        cartContainer.innerHTML = '<p style="text-align:center; color:#999; margin-top: 20px;">Tu carrito está vacío.</p>';
        cartCount.innerText = "0";
        cartTotalPublic.innerText = "$0.00 (Bs. 0.00)"; 
        cartTotalNova.innerText = "$0.00";
        return;
    }
    
    let htmlContent = '';
    cart.forEach((item, index) => {
        const preciosItem = calcularPrecios(item.costoCompra);
        totalPublicUSD += preciosItem.publicoUSD * item.quantity;
        totalPublicBs += preciosItem.publicoBs * item.quantity;
        totalNovaUSD += preciosItem.novaClientesUSD * item.quantity;
        totalItems += item.quantity;
        
        const imgSource = item.images && item.images.length > 0 ? item.images[0] : 'https://static.vecteezy.com/system/resources/previews/004/141/669/non_2x/no-photo-or-blank-image-icon-loading-images-or-missing-image-mark-image-not-available-or-image-coming-soon-sign-simple-nature-silhouette-in-frame-isolated-illustration-vector.jpg';
        
        htmlContent += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <img src="${imgSource}" alt="${item.name}" class="cart-item-img">
                    <div class="cart-item-details">
                        <span class="cart-item-code">${item.id}</span>
                        <span class="cart-item-name">${item.name}</span>
                    </div>
                </div>
                <div class="cart-controls">
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="changeQuantity(${index}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn" onclick="changeQuantity(${index}, 1)">+</button>
                    </div>
                    <button class="del-btn" onclick="removeFromCart(${index})">
                        🗑️ Eliminar
                    </button>
                </div>
            </div>
        `;
    });
    
    cartContainer.innerHTML = htmlContent;
    cartCount.innerText = totalItems;
    cartTotalPublic.innerText = `$${totalPublicUSD.toFixed(2)} (Bs. ${totalPublicBs.toFixed(2)})`;
    cartTotalNova.innerText = `$${totalNovaUSD.toFixed(2)}`;
}

function removeFromCart(index) { 
    cart.splice(index, 1); 
    updateCartUI(); 
}

function toggleCart() { 
    document.getElementById('cartModal').classList.toggle('active'); 
}

async function sendWhatsApp() {
    if (cart.length === 0) {
        alert("Agrega al menos un repuesto para consultar la disponibilidad.");
        return;
    }
    const clientName = document.getElementById('customerName').value.trim();
    const clientPhone = document.getElementById('customerPhone').value.trim();
    if (clientName === "" || clientPhone === "") {
        alert("Por favor, ingresa tu Nombre y tu número de WhatsApp para registrar el pedido.");
        document.getElementById('customerName').focus();
        return;
    }
    
    let resumenCodigos = "";
    let totalCantidad = 0;
    let montoTotalPublico = 0;
    let message = `Hola equipo de *NOVA RefriMotors*. Mi nombre es *${clientName}* y quisiera consultar la disponibilidad de los siguientes repuestos:%0A%0A`;
    
    cart.forEach(item => {
        message += `• Código: *${item.id}* - (Cantidad: ${item.quantity})%0A`;
        resumenCodigos += `${item.id} (x${item.quantity}), `;
        totalCantidad += item.quantity;
        const preciosItem = calcularPrecios(item.costoCompra);
        montoTotalPublico += preciosItem.publicoUSD * item.quantity;
    });
    
    const orderData = {
        nombre: clientName,
        whatsapp: clientPhone,
        codigos: resumenCodigos,
        cantidad: totalCantidad,
        monto: montoTotalPublico.toFixed(2),
        estado: "Pendiente"
    };
    
    const webhookURL = "https://hook.us2.make.com/0wu87f5st6nmk708w61nt183oxfddwsa";
    try {
        await fetch(webhookURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderData)
        });
        console.log("Datos enviados a Notion con éxito:", orderData);
    } catch (error) {
        console.error("Error enviando a la base de datos:", error);
    }
    
    const whatsappURL = `https://wa.me/${NUMERO_WHATSAPP}?text=${message}`;
    window.open(whatsappURL, '_blank'); 
}

// ==========================================
// ARRANQUE DEL SISTEMA
// ==========================================
renderAlphabet();
filterProducts();
