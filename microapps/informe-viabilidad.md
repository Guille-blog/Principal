# Informe de viabilidad: micro apps rentables (web + Android, IA/no-code)

**Autor:** Guille · **Fecha:** 29/10/2026 · **Perfil:** jefe de obra en instalaciones, estudiante de ASIR, 10 h/semana, sin Mac

> Leyenda de fiabilidad: **[V]** dato verificado en fuente · **[E]** estimación mía razonada · **[O]** opinión/criterio.
> Limitación: desde este entorno no he podido acceder a `play.google.com`, así que **las descargas y los precios de Google Play no están verificados** en ficha oficial. Antes de decidir, revísalos a mano.

---

## 0. Lo que te tengo que decir primero

1. **El planteamiento "varias micro apps para generar dinero todos los meses" está mal enfocado para empezar.** Con 10 h/semana, repartirse entre varias apps es la forma más rápida de no terminar ninguna. Hay que lanzar **una**, validarla y solo entonces abrir la segunda. **[O]**
2. **La competencia en apps se ha multiplicado por la IA.** En enero de 2022 se lanzaban unas 2.000 apps de suscripción nuevas al mes; en enero de 2026, unas 14.700. Solo el **17,3 %** de las apps nuevas llega a 1.000 $/mes en dos años, y solo el **4,6 %** a 10.000 $/mes. **[V]** (RevenueCat, *State of Subscription Apps 2026*). Además, esa muestra solo incluye apps que ya usan RevenueCat, es decir, proyectos con cierto nivel. La realidad media es peor.
3. **Tu ventaja real no es técnica, es de dominio:** sabes qué le duele a un instalador y conoces la normativa. Sin esa ventaja no tiene sentido competir. Por eso el nicho recomendado es tu sector. **[O]**
4. **No hay ingreso pasivo.** Una app de pago exige soporte, actualizaciones (Google cambia los requisitos de API cada año) y marketing continuo. Calcula que, una vez lanzada, al menos el 30–50 % de tus 10 h se irán en mantenimiento y captación. **[E]**

---

## 1. Diagnóstico de viabilidad y escenarios

Supuesto: una app B2B de nicho (ver apartado 5), lanzada hacia la semana 12, cobrando unos 5–9 €/mes por usuario.

| Escenario | Mes 3 | Mes 6 | Mes 12 | Qué tiene que pasar |
|---|---|---|---|---|
| **Pesimista** (el más probable, ~50–60 %) **[E]** | 0 € | 0–20 €/mes | 0–50 €/mes | La idea no engancha o no consigues canal de distribución. Abandonas o pivotas. |
| **Medio** (~30–40 %) **[E]** | 0 € | 20–80 €/mes | 100–300 €/mes | 15–40 usuarios de pago, captados en grupos profesionales y por SEO. |
| **Optimista** (~5–10 %) **[E]** | 0–30 € | 100–300 €/mes | 500–1.000 €/mes | Algún distribuidor, asociación o influencer del sector te recomienda. |

- **Primer euro:** entre el mes 3 y el 5, si cumples el plan. **[E]**
- **Ingreso estable (>200 €/mes):** entre el mes 9 y el 18. **[E]**
- **Restando costes** (apartado 2), el primer año probablemente acabes **en negativo o empatado.** Lo normal es que sea así. **[E]**

**Objetivo coherente para empezar:** **cubrir costes en 6 meses y llegar a 150–300 €/mes netos a los 12 meses.** Si a los 6 meses del lanzamiento no tienes ni 5 clientes de pago, se pivota o se cierra. **[O]**

---

## 2. Hardware y costes

### 2.1 Hardware

El desarrollo con IA/no-code se hace casi todo **en el navegador** (Lovable, Bolt, Supabase…), así que no necesitas una máquina potente. Lo que sí necesitas son **dispositivos reales para probar**. **[O]**

| Elemento | ¿Necesario? | Recomendación | Precio orientativo **[E]** |
|---|---|---|---|
| Ordenador | **Imprescindible** (si ya tienes uno con ≥16 GB de RAM, **no compres**) | Portátil con 16 GB de RAM (mejor 32 GB si vas a usar Android Studio o su emulador) y SSD de 512 GB. Ej.: Lenovo IdeaPad Slim 5 / ThinkPad E14 con Ryzen 7, o similar | 650–950 € |
| Móvil Android de pruebas (gama media) | **Imprescindible** | Google Pixel 9a/10a: Android "puro", recibe las actualizaciones primero y es el estándar de referencia. Las guías de 2026 lo sitúan como el gama media de referencia **[V]** | 350–500 € |
| Móvil Android barato (gama baja) | Muy recomendable | Samsung Galaxy A1x / Redmi gama baja. Tus clientes usarán móviles modestos, y la app debe ir fluida ahí | 120–180 € (o uno viejo que tengas) |
| Monitor externo | Recomendable | 24–27" | 120–200 € |
| Mini-PC / Raspberry Pi / servidor casero | **Prescindible** | Solo si quieres practicar lo de ASIR. **No alojes producción en casa**: pon un VPS (Hetzner, ~5 €/mes) o el plan gratuito de Supabase | 0 € |
| Mac | **No por ahora** | Solo hará falta si un día publicas en iOS | 0 € |

**Total hardware:** entre **0 €** (si ya tienes PC y móvil decente) y **~1.300 €** (todo nuevo). Lo mínimo sensato es comprar solo el móvil de pruebas.

### 2.2 Costes de software y servicios (primer año)

| Concepto | Coste | Fuente |
|---|---|---|
| Cuenta Google Play Developer | 25 $ pago único + verificación de identidad | **[V]** |
| Requisito de prueba cerrada en Play (cuenta personal) | **12 testers durante 14 días seguidos** antes de poder publicar. Si baja de 12, el contador se reinicia. Recluta 15–20. | **[V]** |
| Generador IA (Lovable Pro o Bolt Pro) | ~25 €/$ al mes. Solo los meses de desarrollo intenso: unos 150–200 € el primer año | **[V]** precio / **[E]** total |
| Backend Supabase | Gratis al principio; Pro 25 $/mes cuando tengas usuarios de pago. Ojo: los proyectos gratuitos se pausan tras 7 días sin actividad | **[V]** |
| Dominio | 10–15 €/año | **[E]** |
| Comisión de Google Play | Reforma en despliegue desde el 30/06/2026 en la UE: 10 % en suscripciones + 5 % de facturación (antes, 15 % fijo). **Comprueba la tarifa vigente en Play Console** | **[V]** con cambios en curso |
| Pagos web (Stripe) o "merchant of record" (Paddle / Lemon Squeezy, que te gestionan el IVA europeo) | ~1,5 % + 0,25 € por cobro con Stripe; ~5 % + 0,50 $ con MoR | **[E]** |
| Gestoría (si te das de alta) | 40–80 €/mes | **[E]** |

**Coste del primer año sin hardware ni gestoría:** **~300–500 €.** **[E]**

**Aviso importante:** Google está implantando la **verificación obligatoria de desarrolladores Android** también para apps instaladas fuera de Play. Empieza en septiembre de 2026 en 4 países y llegará a todo el mundo en 2027. **[V]** No te afecta si publicas en Play, pero descarta la idea de "distribuir el APK por mi cuenta para ahorrarme Google".

---

## 3. Stack recomendado para tu perfil

**Estrategia: primero web (PWA) y luego Android empaquetando esa misma web (TWA).** Una sola base de código sirve para las dos plataformas. **[O]**

| Capa | Elección | Por qué |
|---|---|---|
| Construcción | **Lovable** (alternativa: Bolt) | Genera **código real (React)** que puedes exportar a GitHub, así que estás **menos atado a la plataforma** que con FlutterFlow, Bubble, Glide o Adalo. Si mañana Lovable sube precios o cierra, te llevas el código. |
| Backend / base de datos | **Supabase** (PostgreSQL) | Aquí ASIR sí te sirve: SQL, roles, copias de seguridad. Elige **región UE** por el RGPD. |
| App Android | **PWABuilder / Bubblewrap (TWA)** | Convierte la PWA en un paquete para Play sin reescribir nada. |
| Uso sin conexión | Service worker de la PWA | **Crítico en tu sector:** en sótanos y salas técnicas no hay cobertura. Las calculadoras deben funcionar sin red, y los partes deben guardarse y sincronizarse después. |
| Cobros | Web: Stripe o Paddle. Android: **Google Play Billing** (obligatorio para contenido digital dentro de la app) | Ofrece el alta por web para pagar menos comisión, respetando las políticas de Play. |
| Hosting web | Netlify / Vercel (gratis), o un VPS si quieres practicar | Vale con el plan gratuito al empezar. |

**¿Por qué no FlutterFlow?** Su plan Basic ha subido a 39 $/mes **[V]**, la curva de aprendizaje es mayor y el modelo es más cerrado. Tiene sentido solo si en el futuro necesitas una app nativa compleja. **¿Por qué no Bubble o Glide?** Te dejan muy atado a la plataforma y los costes crecen con el uso. Son buenos para un prototipo de una semana, pero no para un producto de pago. **[O]**

**Riesgo real del enfoque IA/no-code:** cuando algo falle (pagos, sincronización sin conexión, permisos de la base de datos), la IA no siempre sabrá arreglarlo y tú tendrás que entender el código. **Dedica una parte de las horas a aprender lo básico de JavaScript/React y SQL.** Con ASIR ya tienes media base hecha. **[O]**

---

## 4. Benchmark de apps publicadas

### 4.1 En tu nicho (instalaciones y obra, España)

| App | Qué hace | Monetización | Datos | Lectura **[O]** |
|---|---|---|---|---|
| **Cálculos Eléctricos** (Ettore Gallina) | Secciones, caídas de tensión, corrientes, potencias | Gratis con anuncios + versión Pro | Muy extendida. Descargas **no verificables** desde aquí | Es el rival a batir en calculadoras. Es genérica y no va ligada al REBT. |
| **Voltio Pro** (Android) | Calculadoras, consulta del REBT/ITC-BT, visor del reglamento, asistente IA | No verificable | v1.1.0, actualizada en abril de 2026 **[V]** | **Competidor directo y reciente** de tu idea de calculadora REBT con IA. |
| **REBT Cálculo de Secciones** (App Inventor) | Sección por caída de tensión según el REBT | Gratis + funciones PRO | Ficha de 2020 **[V]**, probablemente abandonada | Muestra que hay demanda, pero también que la calidad del nicho es baja. |
| **REBT Pro** (solo iOS) | Secciones y acceso al REBT | Suscripción mensual/anual | **[V]** | Que haya suscripción confirma que algunos pagan. En Android hay hueco. |
| **Electrodoc** (antes ElectroDroid) | Calculadoras de electrónica y electricidad | Gratis con anuncios + Pro de pago único (~3–5 $) | Más de 500.000 instalaciones según terceros **[no verificable]** | Referencia de cómo funciona el modelo "gratis con anuncios + Pro barato". |
| **Calculadoras de fabricantes** (Prysmian, Top Cable, etc.) | Cálculo de cables | Gratis (son marketing del fabricante) | — | **Tu mayor problema:** hacen que el cálculo básico "valga 0 €". |
| **Apps de fabricantes de climatización/calderas** (p. ej. CointraPREMIUM de Ferroli) | Registro de instalaciones con fotos | Gratis | **[V]** | También gratis, pero atadas a una marca. |
| **Software de servicio técnico** (STEL Order, Holded, etc.) | Partes, presupuestos, facturación y gestión completa | Suscripción, normalmente 20–60 €/mes por empresa **[E]**. No he podido verificar sus tarifas actuales | — | Demasiado completos y caros para el autónomo o la microempresa que solo quiere "parte + fotos + firma + PDF". **Ahí está el hueco.** |

### 4.2 Micro apps rentables en general

Las cifras públicas de facturación de apps indie salen casi siempre de capturas en X o Indie Hackers: **no son verificables** y tienen un fuerte sesgo de superviviente. Por eso no te pongo nombres con cifras inventadas. Lo único sólido es el dato agregado de RevenueCat del apartado 0: **la mediana de las apps no da para vivir.** **[V]**

---

## 5. Top 3 ideas priorizadas

Puntuación de 1 a 5 (en "Riesgo legal", 5 = riesgo mínimo).

| Idea | Demanda | Competencia (5 = poca) | Facilidad con no-code | Disposición a pagar | Riesgo legal | **Total** |
|---|---|---|---|---|---|---|
| **A. Partes de trabajo y actas de obra**: fotos, firma del cliente, materiales, horas, PDF con logo; funciona sin conexión | 4 | 3 | 3 | 4 | 4 | **18** |
| **B. Checklists de pruebas y puesta en marcha**: estanqueidad HS4, pruebas de aislamiento y continuidad, protocolos RITE/ICT, con PDF firmado | 3 | 4 | 4 | 3 | 3 | **17** |
| **C. Calculadoras REBT pro con informe PDF** (secciones, caída de tensión, previsión de cargas ITC-BT-10) | 4 | 1 | 4 | 1 | 2 | **12** |

### Recomendación **[O]**

- **Lanzar primero A, con B integrada como plantillas** dentro de la misma app ("parte de trabajo" y "acta de pruebas" son el mismo motor de formulario + fotos + firma + PDF).
- **Usar C como gancho gratuito en la web, no como producto:** calculadoras REBT gratis en tu web para atraer tráfico de Google (búsquedas tipo "calculadora caída de tensión"), con un botón "genera el informe en PDF / guarda el cálculo en tu parte de obra" que lleve a A. Así la calculadora deja de competir con las gratuitas y pasa a ser tu marketing.
- **Precio orientativo:** gratis hasta 5 partes al mes; Pro a 6–9 €/mes o 59–79 €/año por usuario. **[E]**

### Trampas que evitar en la idea A

- **No incluyas facturación.** Si la app emite facturas, pasa a ser un **sistema informático de facturación** sujeto a **Verifactu**, y como fabricante del software tendrías obligaciones ya en vigor desde julio de 2025. **[V]** Haz partes y albaranes sin valor de factura y exporta los datos a la herramienta de facturación del cliente.
- **Las calculadoras deben ser exactas.** Ejemplos de los límites de caída de tensión que hay que respetar: ITC-BT-14 (LGA 0,5 % o 1 % según la centralización de contadores), ITC-BT-15 (DI 0,5 %, 1 % o 1,5 %) e ITC-BT-19 (interiores: 3 % en viviendas; en otras instalaciones, 3 % en alumbrado y 5 % en el resto). Un solo error de criterio te quita toda la credibilidad en el gremio. **Comprueba si hay revisión del REBT en curso:** el RD 842/2002 sigue siendo la base, pero no he verificado si en 2026 hay borradores de modificación avanzados.

---

## 6. Plan de 12 semanas (10 h/semana = 120 h)

| Semana | Tareas | Entregable |
|---|---|---|
| 1 | Hablar con 10–15 instaladores y jefes de equipo (no de Talat, ver el apartado 8): cómo hacen hoy los partes, qué les molesta, si pagarían y cuánto | Notas de entrevistas + decisión de seguir o no |
| 2 | Landing page con propuesta de valor y lista de espera; mover el enlace en grupos del gremio | Landing + objetivo de **30 correos** apuntados |
| 3 | Aprender Lovable + Supabase: tutorial y un proyecto de juguete | Prototipo de pruebas desechable |
| 4–5 | MVP: login, crear parte, fotos, firma, PDF | Versión 0.1 web |
| 6 | Uso sin conexión y sincronización; pruebas en móvil de gama baja | Versión 0.2 |
| 7 | Plantillas de actas (idea B) y logo del cliente en el PDF | Versión 0.3 |
| 8 | Cobros (Stripe/Paddle en web), aviso legal, política de privacidad, contrato de encargado de tratamiento | Versión 0.4, ya cobrable |
| 9 | Empaquetar con TWA y abrir la **prueba cerrada en Play con 15–20 testers** (cuentan 14 días) | Prueba cerrada activa |
| 10 | 2–3 calculadoras REBT gratuitas en la web (SEO); corregir errores del feedback | Calculadoras publicadas |
| 11 | Ficha de Play (ASO): capturas, textos, palabras clave | Ficha lista |
| 12 | Publicación en producción y comunicación en grupos y redes | **Lanzamiento** |

**Criterio de seguir o abandonar:**
- **Semana 2:** menos de 15 apuntados en la lista y entrevistas tibias → cambia de idea antes de construir.
- **Mes 3 tras el lanzamiento:** menos de 30 usuarios activos o 0 de pago → pivota.
- **Mes 6:** menos de 5 de pago → cierra y aprovecha lo aprendido para la siguiente idea.

**Aviso de plazo:** 120 h es **justo** para un MVP de esta envergadura, aun con IA. Es realista que se vaya a 16–20 semanas. Si no llegas, recorta funciones, no calidad (las firmas y los PDF tienen que ir perfectos). **[O]**

---

## 7. Distribución sin presupuesto

1. **Grupos del gremio:** WhatsApp, Telegram y Facebook de electricistas, climatizadores y fontaneros en España. Es el canal número uno. Aporta valor (resuelve dudas del REBT) y no hagas spam.
2. **SEO con las calculadoras gratuitas** y artículos tipo "cómo calcular la caída de tensión según la ITC-BT-19 con ejemplo". Tarda 4–8 meses en dar fruto. **[E]**
3. **ASO en Play:** palabras clave como "parte de trabajo", "albarán", "instalador", "electricista", "firma cliente".
4. **Asociaciones:** FENIE, CONAIF, APIEM y asociaciones provinciales de instaladores, con boletines, ferias y descuentos para socios.
5. **Almacenes y distribuidores de material:** el mostrador ve a cientos de instaladores al mes. Un cartel o código QR con descuento puede funcionar.
6. **YouTube Shorts / TikTok:** vídeos de 30 s del tipo "parte firmado y enviado en 40 segundos desde la obra".
7. **LinkedIn:** tu perfil de jefe de obra te da credibilidad; cuenta el proceso de construir la app.

---

## 8. Riesgos legales y fiscales en España (para revisar con un asesor)

| Tema | Situación | Acción |
|---|---|---|
| **Alta de autónomo** | Si los ingresos son habituales, toca alta en el RETA. Tarifa plana 2026: **80 €/mes** (≈ 88,64 € con el MEI) durante 12 meses, prorrogable si los ingresos no llegan al SMI **[V]**. Después, cuota por tramos desde unos **200 €/mes** **[V]**. Hay una zona gris jurisprudencial sobre no darse de alta cuando los ingresos están por debajo del SMI: **es arriesgado, no lo des por bueno.** Como ya cotizas por el Régimen General, estarías en **pluriactividad**, con posibles bonificaciones o devoluciones. | Consulta con una gestoría **antes del primer cobro.** |
| **Momento del alta** | Con la cuota de autónomo, 200 €/mes de ingresos son **pérdidas**. | Plantea con el asesor cuándo darte de alta (por ejemplo, cobrar solo por Play durante la fase de pruebas). No lo hagas sin asesoramiento. |
| **IVA** | En las ventas dentro de Google Play, Google actúa como vendedor ante el cliente y gestiona el IVA. En las ventas directas por web a particulares de la UE aplica el régimen **OSS**. Un *merchant of record* (Paddle, Lemon Squeezy) te lo resuelve. | Para B2B (empresas e instaladores con NIF), revisa la inversión del sujeto pasivo. |
| **Verifactu** | Para autónomos es obligatorio a partir del **1/7/2027** (RDL 15/2025); hay un posible aplazamiento anunciado a 2028 sin confirmar **[V]**. Para tus propias facturas, usa un software homologado. | **No metas facturación en tu app** (ver apartado 5). |
| **RGPD** | Los partes contienen datos de clientes finales, fotos de viviendas y firmas. Tú eres **encargado del tratamiento** de tus usuarios. | Contrato de encargo, política de privacidad, servidores en la UE, borrado de datos a petición y copias de seguridad. |
| **Responsabilidad por las calculadoras** | Si alguien usa tu cálculo para un boletín y está mal, te pueden reclamar. | Aviso legal claro ("herramienta de apoyo; el instalador habilitado es responsable"), validación caso por caso y valorar un seguro de RC (~150–300 €/año **[E]**). |
| **Contrato con Talat** | Revisa si tienes **pacto de plena dedicación** (art. 21 del Estatuto de los Trabajadores) o de no competencia. Un software para instaladores no compite en principio con una instaladora, pero puede discutirse si tus clientes son competidores o subcontratas de Talat. | **No uses ni tiempo, ni equipos, ni datos, ni plantillas, ni clientes de Talat.** Si hay dudas, consulta a un laboralista o pide autorización por escrito. |

---

## 9. Resumen ejecutivo

- **Inversión:** 0–1.300 € en hardware (lo mínimo es un móvil de pruebas) + ~300–500 € el primer año en servicios.
- **Producto 1:** app de partes y actas de obra para instaladores, primero web y luego Android, que funcione sin conexión, a 6–9 €/mes.
- **Gancho:** calculadoras REBT gratuitas en la web para atraer tráfico.
- **Objetivo realista:** cubrir costes en 6 meses y llegar a 150–300 €/mes a los 12. Lo más probable es no alcanzarlo con la primera idea.
- **Antes de cobrar:** gestoría (alta, IVA) y revisión de tu contrato laboral.
- **Lo siguiente:** las semanas 1–2 del plan (entrevistas + landing). **Si no te apuntas a hacer las entrevistas, no empieces a construir.**

---

## Fuentes

- RevenueCat, *State of Subscription Apps 2026*: https://www.revenuecat.com/state-of-subscription-apps · resumen: https://ppc.land/the-app-middle-class-is-dying-and-revenuecats-data-shows-exactly-how-fast/ · https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth
- Requisito de 12 testers en Google Play: https://www.choicely.com/blog/google-play-12-tester-rule · https://extendsclass.com/blog/google-plays-closed-testing-requirement-what-developers-need-to-know-in-2026 · https://ilab.md/en/articles/publishing-on-the-app-store-and-google-play-in-2026-timelines-costs-and-7-hidden-requirements-that-could-derail-your-launch
- Verificación de desarrolladores Android: https://support.google.com/android-developer-console/answer/16561738?hl=en · https://www.theregister.com/2025/08/26/android_developer_verification_sideloading · https://engadget.com/apps/android-will-hide-app-sideloading-behind-a-new-one-time-security-process-184651171.html
- Comisiones de Google Play: https://support.google.com/googleplay/android-developer/answer/112622?hl=en · https://support.google.com/googleplay/android-developer/answer/16954621 · https://www.pocketgamer.biz/google-play-expands-billing-options-and-lowers-fees-for-developers/
- FlutterFlow: https://vp0.com/blogs/flutterflow-pricing-plans-2026/ · https://www.adalo.com/posts/flutterflow-pricing/
- Lovable / Bolt: https://www.jetadmin.io/blog/lovable-vs-bolt/ · https://www.banani.co/blog/lovable-pricing-and-credits · https://www.banani.co/blog/bolt-new-pricing
- Supabase: https://makerkit.dev/blog/saas/supabase-pricing · https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/
- Apps del nicho: https://m.apkpure.com/es/voltio-pro/com.voltiopro.android · https://www.bluestacks.com/campaign/appinventor.ai_manumv2000.REBTCALCULOSECCIONES/en · https://apps.apple.com/app/id6761301576 · https://www.bluestacks.com/es/apps/productivity/electrical-calculations-on-pc.html · https://www.nelcoproducts.com/blog/mobile-apps-for-electrical-professionals/ · https://apps.apple.com/us/app/-/id1550620326
- Móviles de gama media 2026: https://comprasmartphone.com/listas/mejores-moviles-gama-media · https://www.elgrupoinformatico.com/moviles/mejores-moviles-gama-media/
- Autónomos 2026: https://www.infoautonomos.com/seguridad-social/tarifa-plana-autonomos/ · https://www.holded.com/es/blog/tarifa-plana-autonomos · https://taxdown.es/informacion-autonomos/cuanto-cuesta-ser-autonomo-espana
- Verifactu: https://www.infoautonomos.com/blog/verifactu-cuando-es-obligatorio-a-quien-afecta/ · https://www.holded.com/es/blog/hacienda-retrasa-entrada-vigor-verifactu · https://wwwhatsnew.com/2026/10/26/verifactu-factura-electronica-obligatoria-autonomos-fechas/
