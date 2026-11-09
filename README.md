# PiLab · Análisis adimensional de procesos

Aplicación web para aplicar el **teorema Π de Buckingham** a cualquier proceso de ingeniería:
biorreactores, tanques agitados, tuberías, bombas, intercambiadores de calor, transferencia de masa,
partículas y burbujas, reactores…

1. Eliges una plantilla (o empiezas desde cero) y ajustas las variables del proceso.
2. Escribes las unidades como en el cuaderno (`kg/m3`, `Pa·s`, `W/(m²·K)`, `rpm`, `cP`, `L/min`…).
3. La app obtiene la matriz dimensional, su rango y los **k = n − r** grupos adimensionales.
4. Reconoce números con nombre (Re, Po, Fr, Nu, Pr, Sh, Sc, Fl, We, Da…) y arma la relación
   `Π_interés = f(Π₁, Π₂, …)`, con valores numéricos y régimen de flujo si das valores.
5. La pestaña **Procedimiento** muestra el método de variables repetidas paso a paso
   (útil para reportes y tesis).
6. La sección **Datos experimentales y correlación** recibe tus mediciones (pegadas desde Excel,
   CSV o capturadas a mano), calcula los grupos en cada experimento y ajusta
   `Π₀ = C·Π₁ᵃ·Π₂ᵇ…` por mínimos cuadrados con intervalos de confianza, R², gráficas de colapso y
   de paridad. Avisa si un grupo no varió o si dos variaron siempre juntos (colinealidad).
   Varias plantillas traen datos de ejemplo generados con correlaciones clásicas (Dittus–Boelter,
   Blasius, Frössling, van't Riet).
7. La sección **Escalamiento** calcula cómo cambian las variables al pasar del laboratorio a la
   planta: eliges el factor λ, qué se mantiene constante (grupos Π, P/V, velocidad de punta,
   vvm, kLa…) y la app resuelve, avisa si faltan criterios o si chocan entre sí (p. ej. Re y Fr).
   La correlación ajustada también se puede usar como criterio para predecir la variable de interés.

El **Simulador** es un biorreactor de tanque agitado con instrumentación y control: lazos PID de
oxígeno disuelto (rango dividido agitación → aireación) y temperatura (chaqueta), sensores con
retardo y ruido, alarmas con reconocimiento, enclavamiento por nivel, perturbaciones (falla de
aire, de enfriamiento, pulso de sustrato, electrodo descalibrado), diagrama P&ID en vivo con
etiquetas ISA y tendencias sincronizadas. El kLa se calcula en cada instante con Po, Fl, P/V y la
correlación de van't Riet, y se revisa la inundación del impulsor.

Cada plantilla tiene un **diagrama del proceso** cuyas cotas usan los símbolos de tus variables,
y la sección **¿Cómo funciona?** explica el método y por qué agregar o quitar variables.

Todo el cálculo corre en el navegador con **aritmética racional exacta** (sin redondeos).

## Desarrollo

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev        # servidor local en http://localhost:5173
npm test           # pruebas del motor de cálculo
npm run build      # compila a dist/
```

## Cuentas y proyectos en la nube (Firebase)

Con Firebase configurado aparece el botón **Entrar**: cada persona crea su cuenta (con uno de
los tres avatares), guarda análisis y simulaciones con «☁ Guardar en la nube», los abre desde
cualquier dispositivo en **Mis proyectos** y puede compartir un enlace de solo lectura
(`?ver=<id>`); quien lo abre recibe una copia para explorar.

Se eligió Firebase porque su plan gratuito **no pausa el proyecto por inactividad**. Los pasos
para configurarlo (≈ 10 minutos) están en [docs/FIREBASE.md](docs/FIREBASE.md). Sin
configurarlo, la app funciona completa en modo local.

## Publicar en Netlify

El proyecto ya incluye `netlify.toml`.

- **Opción A (recomendada):** sube el proyecto a GitHub y en Netlify elige
  *Add new site → Import an existing project*. Netlify detecta `npm run build` y la carpeta `dist`.
- **Opción B:** ejecuta `npm run build` y arrastra la carpeta `dist/` a https://app.netlify.com/drop.

## Estructura

```
src/
  core/                 Motor genérico (no sabe nada de procesos específicos)
    fraction.ts         Fracciones exactas
    dimensions.ts       Dimensiones SI (M, L, T, Θ, N, I, J)
    units.ts            Analizador de unidades y conversión al SI
    linalg.ts           Rango, espacio nulo y sistemas lineales exactos
    buckingham.ts       Teorema Π: matriz dimensional, variables repetidas, grupos
    quantities.ts       Catálogo de magnitudes (densidad, kLa, diámetro…)
    numbers.ts          Biblioteca de números adimensionales con nombre
    recognize.ts        Reconoce números conocidos y arma la relación final
    scaling.ts          Similitud y escalamiento (sistema lineal en logaritmos)
    fitting.ts          Ajuste de leyes de potencias, colinealidad, lectura de CSV
    bioreactor.ts       Modelo dinámico del biorreactor, PID, alarmas y simulador
  cloud/                Cuentas y proyectos en la nube (Firebase + modo demostración)
public/img/             Logotipos ITD y MCIBQ, mascota y avatares (optimizados para web)
imagenes/               Originales de las imágenes (no se publican)
firestore.rules         Reglas de seguridad de la base de datos
docs/FIREBASE.md        Cómo configurar Firebase
    *.test.ts           Pruebas
  processes/
    templates.ts        Plantillas de procesos (agregar uno = agregar un objeto)
    project.ts          Modelo de datos de un análisis
  ui/                   Componentes de la interfaz
```

### Agregar un proceso nuevo

Agrega un objeto a `TEMPLATES` en `src/processes/templates.ts` con la lista de variables
(por tipo de magnitud) y valores de ejemplo. No hay que tocar el motor.

### Agregar un número adimensional

Agrega una entrada a `NUMBERS` en `src/core/numbers.ts` con su definición en términos de
magnitudes, por ejemplo `{ density: 1, velocity: 1, length: 1, dynamic_viscosity: -1 }`.

## Hoja de ruta

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Proyecto, despliegue en Netlify, pruebas | ✅ |
| 1 | Motor Π de Buckingham con pruebas | ✅ |
| 2 | Interfaz de análisis, plantillas, diagramas, guía y biblioteca | ✅ |
| 3 | Similitud y escalamiento (modelo → prototipo, criterios en conflicto) | ✅ |
| 4 | Análisis de datos: importar CSV y ajustar `Π₀ = C·Π₁ᵃ·Π₂ᵇ` | ✅ |
| 5 | Simulador de biorreactor y panel de control (PID, alarmas) | ✅ |
| 6 | Cuentas, proyectos en la nube, enlaces compartidos, vista móvil | ✅ (falta crear el proyecto de Firebase) |
